# app.py
import os
import json
import asyncio
import uvicorn
import httpx
import logging
import subprocess
import socket
from contextlib import asynccontextmanager
from wyoming.client import AsyncTcpClient
from wyoming.audio import AudioChunk, AudioStop
from wyoming.asr import Transcribe, Transcript
from fastapi import FastAPI, WebSocketDisconnect, Request, UploadFile, File, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from routes import settings, clients, chatHistory, presets
from routes.globals import connected_clients, pending_deletions
from routes.utils import validate_connection

# Using lifespan context manager for startup/shutdown event handling
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown events.
    
    - Monitors existence of 'notification_file' signalling responses from Piper Docker.
    - Suppresses asyncio connection errors.
    - Ensures clean shutdown.
    
    Args:
        app (FastAPI): The FastAPI application instance.
    """
    asyncio.create_task(monitor_notifications())
    suppress_asyncio_error()

    yield

    print("App is shutting down...")

# Using FastAPI/WebSockets + Uvicorn for real-time communication
app = FastAPI(lifespan=lifespan)
notification_file = "output/new_audio.json"

# Include API routes
app.include_router(settings.router)
app.include_router(clients.router)
app.include_router(chatHistory.router)
app.include_router(presets.router)

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/live2d_models", StaticFiles(directory="live2d_models"), name="live2d_models")
app.mount("/output", StaticFiles(directory="output"), name="output")

# Load constants from settings.yaml
config = settings.load_settings()
HOST = config.get("backend", {}).get("app", {}).get("host", "0.0.0.0")
PORT = config.get("backend", {}).get("app", {}).get("port", 11405)
PROTOCOL = config.get("backend", {}).get("app", {}).get("protocol", "http")
LOG_LEVEL = settings.get("backend", {}).get("logging", {}).get("level", "ERROR").upper()
OLLAMA_WEBHOOK = config.get("urls", {}).get("ollama_webhook", "http://homeassistant.local:8123/api/webhook/ollama_chat")
WHISPER_HOST = config.get("backend", {}).get("urls", {}).get("whisper_host", "127.0.0.1")
WHISPER_PORT = config.get("backend", {}).get("urls", {}).get("whisper_port", 10300)
SAVE_CHAT_HISTORY = bool(config.get("frontend", {}).get("save-chat-history", True))
TIMEOUT_DURATION = config.get("frontend", {}).get("timeout", 180)

# Initialize logging framework
logging.basicConfig(level=LOG_LEVEL, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

@app.get("/")
async def serve_root():
    """
    Serves the frontend webpage for vCHAOS.

    Returns:
        FileResponse: The 'index.html' file from the static directory.
    """
    return FileResponse("static/index.html")

@app.post("/api/send_prompt")
async def send_prompt(request: Request, _: None = Depends(validate_connection)):
    """
    Sends user's text input prompt to Ollama webhook.

    Args:
        request (Request): JSON request body containing the user's text input prompt.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success message and input text if processed successfully.
        400 error if input text is empty.
        500 error for further exceptions.
    """
    try:
        data = await request.json()
        user_input = data.get("text", "").strip()

        if not user_input:
            return {"success": False, "error": "No input text provided"}

        async with httpx.AsyncClient() as client:
            try:
                response = await asyncio.wait_for(
                    client.post(OLLAMA_WEBHOOK, json={"text": user_input}, headers={"Content-Type": "application/json"}),
                    timeout=TIMEOUT_DURATION
                )
                response.raise_for_status()
                return {"success": True, "message": "Sent successfully", "input": user_input}

            except asyncio.TimeoutError:
                return {"success": False, "error": f"Request timed out after {TIMEOUT_DURATION} seconds"}

    except httpx.RequestError as e:
        return {"success": False, "error": f"HTTP Request error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Application error: {str(e)}"}

@app.post("/api/send_voice")
async def send_voice(audio: UploadFile = File(...), _: None = Depends(validate_connection)):
    """
    Process and transcribe audio input via Wyoming Faster-Whisper.

    Args:
        audio (UploadFile): Audio file recorded by the client via frontend Push-To-Talk button.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Returns transcribed text in JSON format if successful.
        500 error for further exceptions.
    """
    try:
        input_bytes = await audio.read()

        ffmpeg_process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-i", "pipe:0",
            "-f", "wav", "-ar", "16000", "-ac", "1", "-sample_fmt", "s16",
            "pipe:1",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )

        stdout, _ = await ffmpeg_process.communicate(input=input_bytes)

        if ffmpeg_process.returncode != 0:
            raise RuntimeError("FFmpeg failed to convert audio")

        # Send to Faster-Whisper backend
        async with AsyncTcpClient(WHISPER_HOST, WHISPER_PORT) as client:
            await client.write_event(Transcribe(language="en").event())

            chunk_size = 4096
            offset = 0
            while offset < len(stdout):
                chunk = AudioChunk(
                    rate=16000,
                    width=2,
                    channels=1,
                    audio=stdout[offset:offset+chunk_size]
                )
                await client.write_event(chunk.event())
                offset += chunk_size

            await client.write_event(AudioStop().event())

            while True:
                event = await client.read_event()
                if event is None:
                    raise RuntimeError("No response from STT server")

                transcript = Transcript.from_event(event)
                if transcript:
                    text = transcript.text
                    break

        return {"success": True, "transcription": text}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# Monitor shared notification file to detect if a new TTS output is generated from Piper Docker
async def monitor_notifications():
    """
    Monitors the notification file and sends updates to clients.

    Continuously checks for new TTS output and forwards the data to active WebSocket clients.
    """
    while True:
        if os.path.exists(notification_file):
            try:
                with open(notification_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                audio_path = data.get("audio_file", "").strip()
                text_path = audio_path.replace(".wav", ".txt") if audio_path.endswith(".wav") else ""
                await send_to_clients(json.dumps(data))
                os.remove(notification_file)

                if not SAVE_CHAT_HISTORY:
                    file_id = os.path.splitext(os.path.basename(audio_path))[0] if audio_path else None
                    pending_deletions[file_id] = {
                        "audio": audio_path,
                        "text": text_path,
                        "acknowledged_clients": set()
                    }
            except json.JSONDecodeError:
                logger.error("Error decoding JSON from notification file")
            except Exception as e:
                logger.error(f"Error processing notification file: {e}")

        await asyncio.sleep(1)

# Send output to frontend
async def send_to_clients(message: str):
    """
    Sends message to all connected WebSocket clients.
    Simultaneously updates the list of active WebSocket clients.

    Args:
        message (str): JSON message to be sent.
    """
    disconnected_clients = set()
    
    for client_tuple in connected_clients:
        websocket, ip = client_tuple

        try:
            await websocket.send_text(message)
        except (WebSocketDisconnect, ConnectionResetError):
            disconnected_clients.add(client_tuple)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            disconnected_clients.add(client_tuple)

    connected_clients.difference_update(disconnected_clients)

# Suppress asyncio ConnectionResetError
def suppress_asyncio_error():
    """
    Suppresses known asyncio ConnectionResetError exceptions.
    """
    try:
        # Import only when needed
        import asyncio.proactor_events

        orig = asyncio.proactor_events._ProactorBasePipeTransport._call_connection_lost

        def safe_shutdown(self, exc):
            try:
                sock = getattr(self, "_sock", None)
                if sock and hasattr(sock, "shutdown"):
                    sock.shutdown(socket.SHUT_RDWR)
            except (OSError, ConnectionResetError):
                pass
            return orig(self, exc)

        asyncio.proactor_events._ProactorBasePipeTransport._call_connection_lost = safe_shutdown
    except Exception as e:
        print("Error: Failed to patch asyncio ConnectionResetError due to", e)

if __name__ == "__main__":
    if PROTOCOL == "https":
        uvicorn.run(app, host=HOST, port=PORT, log_level=LOG_LEVEL.lower(), ssl_keyfile="key.pem", ssl_certfile="cert.pem")
    else:
        uvicorn.run(app, host=HOST, port=PORT, log_level=LOG_LEVEL.lower())