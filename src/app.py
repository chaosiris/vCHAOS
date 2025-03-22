import os
import uuid
import re
import json
import asyncio
import uvicorn
import httpx
import logging
import shutil
import subprocess
from wyoming.client import AsyncTcpClient
from wyoming.audio import AudioChunk, AudioStop
from wyoming.asr import Transcribe, Transcript
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Query, UploadFile, File, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from ruamel.yaml import YAML

# Using FastAPI/WebSockets + Uvicorn for real-time communication
app = FastAPI()
yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=4, offset=2)
connected_clients = set()
pending_deletions = {}  # Track files pending deletion
client_receipts = {}  # Track which clients have received a given file
notification_file = "output/new_audio.json"

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/live2d_models", StaticFiles(directory="live2d_models"), name="live2d_models")
app.mount("/output", StaticFiles(directory="output"), name="output")

# Load configuration from config.yaml
def load_settings(file_path="settings.yaml"):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.load(f)
    except FileNotFoundError:
        print("Error: settings.yaml not found, using defaults.")
        return {} 

# Load constants from settings.yaml
settings = load_settings()
HOST = settings.get("backend", {}).get("app", {}).get("host", "0.0.0.0")
PORT = settings.get("backend", {}).get("app", {}).get("port", 11405)
PROTOCOL = settings.get("backend", {}).get("app", {}).get("protocol", "http")
LOG_LEVEL = settings.get("backend", {}).get("logging", {}).get("level", "ERROR").upper()
SAVE_CHAT_HISTORY = bool(settings.get("frontend", {}).get("save-chat-history", True))
TIMEOUT_DURATION = settings.get("frontend", {}).get("timeout", 180)

# Initialize logging framework
logging.basicConfig(level=LOG_LEVEL, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Validate received data for updated settings
def validate_settings(data):
    current_settings = load_settings()

    for category, settings in data.items():
        if category not in current_settings:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

        for key, value in settings.items():
            if key not in current_settings[category]:
                raise HTTPException(status_code=400, detail=f"Invalid setting: {key}")

            expected_type = type(current_settings[category][key])
            if not isinstance(value, expected_type):
                raise HTTPException(status_code=400, detail=f"Invalid type for {key}: Expected {expected_type.__name__}, got {type(value).__name__}")

            if category == "frontend" and key == "timeout":
                if not (30 <= value <= 600):
                    raise HTTPException(status_code=400, detail="Timeout value must be between 30 and 600")

# Ensure only clients with an active WebSockets connection can make API POST requests
def validate_connection(request: Request):
    client_ip = request.client.host
    if not any(ip == client_ip for _, ip in connected_clients):
        raise HTTPException(status_code=403, detail="Unauthorized: WebSocket connection required.")

@app.get("/")
async def serve_root():
    return FileResponse("static/index.html")

@app.get("/api/get_settings")
async def get_settings():
    try:
        with open("settings.yaml", "r", encoding="utf-8") as f:
            settings = yaml.load(f)

        if "frontend" in settings:
            return JSONResponse(settings["frontend"])
        else:
            return JSONResponse({}, status_code=200)

    except FileNotFoundError:
        return JSONResponse({"error": "settings.yaml not found"}, status_code=404)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/update_settings")
async def update_settings(request: Request, _: None = Depends(validate_connection)):
    try:
        data = await request.json()
        validate_settings(data)
        yaml_data = load_settings()

        for key, value in data.items():
            if isinstance(value, dict) and key in yaml_data:
                yaml_data[key].update(value)
            else:
                yaml_data[key] = value

        with open("settings.yaml", "w", encoding="utf-8") as f:
            yaml.dump(yaml_data, f)

        return {"success": True, "message": "Settings updated successfully"}

    except HTTPException as e:
        return {"success": False, "error": e.detail}

    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/get_history")
async def get_chat_history(search: str = Query(default=None, description="Search query for filtering history"), _: None = Depends(validate_connection)):
    try:
        files = os.listdir("output")
        history = []

        for file in files:
            if file.endswith(".txt"):
                wav_file = file.replace(".txt", ".wav")
                if wav_file in files:
                    match = re.search(r"(\d{13})", file)
                    timestamp = int(match.group(1)) if match else int(os.path.getmtime(f"output/{file}") * 1000)

                    # Load preview text from .txt file (first 50 chars)
                    try:
                        with open(f"output/{file}", "r", encoding="utf-8") as f:
                            preview_text = f.read(80).strip() 
                            if len(preview_text) == 80:
                                preview_text += "..."
                    except Exception:
                        preview_text = "Error loading text."

                    history_entry = {
                        "txt": f"/output/{file}",
                        "wav": f"/output/{wav_file}",
                        "timestamp": timestamp,
                        "preview_text": preview_text,
                    }

                    if search:
                        try:
                            with open(f"output/{file}", "r", encoding="utf-8") as f:
                                full_text = f.read().strip()
                        except Exception:
                            full_text = ""

                        if search.lower() not in full_text.lower():
                            continue  

                    history.append(history_entry)

        # Sort by timestamp (latest first)
        history.sort(key=lambda item: item["timestamp"], reverse=True)

        return JSONResponse(history)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/send_prompt")
async def send_prompt(request: Request, _: None = Depends(validate_connection)):
    try:
        data = await request.json()
        user_input = data.get("text", "").strip()

        if not user_input:
            return {"success": False, "error": "No input text provided"}

        webhook_url = settings.get("urls", {}).get("ollama_webhook", "http://homeassistant.local:8123/api/webhook/ollama_chat")

        async with httpx.AsyncClient() as client:
            try:
                response = await asyncio.wait_for(
                    client.post(webhook_url, json={"text": user_input}, headers={"Content-Type": "application/json"}),
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
async def transcribe_and_forward(audio: UploadFile = File(...), _: None = Depends(validate_connection)):
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

        # Send to Faster-Whisper backend // TODO: Make the Whisper host and port configurable in settings.yaml
        async with AsyncTcpClient("localhost", 10300) as client:
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

@app.post("/api/archive_chat_history")
async def archive_chat_history(_: None = Depends(validate_connection)):
    return await process_chat_history("archive")

@app.delete("/api/delete_chat_history")
async def delete_chat_history(_: None = Depends(validate_connection)):
    return await process_chat_history("delete")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_ip = websocket.client.host

    stale_clients = {client for client in connected_clients if client[1] == client_ip}
    for client in stale_clients:
        try:
            await client[0].close()
        except Exception:
            pass
        connected_clients.discard(client)

    connected_clients.add((websocket, client_ip))
    logger.info(f"Client {client_ip} connected")

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                logger.info(f"Received WebSocket message from {client_ip}: {message}")

                if not SAVE_CHAT_HISTORY:
                    if message.startswith("ack:"):
                        file_id = message.split("ack:")[1].strip()
                        logger.debug(f"Received acknowledgment for file ID: {file_id}")

                        if file_id in pending_deletions:
                            pending_deletions[file_id]["acknowledged_clients"].add(client_ip)
                            logger.debug(f"Acknowledged clients: {pending_deletions[file_id]['acknowledged_clients']}")

                            if len(pending_deletions[file_id]["acknowledged_clients"]) >= len(connected_clients):
                                files_to_delete = {k: v for k, v in pending_deletions.pop(file_id, {}).items() if k != "acknowledged_clients"}
                                filelist = [os.path.basename(v) for v in files_to_delete.values()]
                                deletion_result = await process_chat_history("delete", filelist)

            except asyncio.TimeoutError:
                await websocket.send_text("ping") # Keep-alive ping
    except (WebSocketDisconnect, ConnectionResetError):
        logger.info(f"Client {client_ip} disconnected")
    except asyncio.CancelledError:
        logger.warning(f"WebSocket connection for {client_ip} was cancelled")
    except Exception as e:
        logger.error(f"Unexpected WebSocket error for {client_ip}: {e}")
    finally:
        connected_clients.discard((websocket, client_ip))
        logger.info(f"Cleaned up WebSocket connection for {client_ip}")

@app.get("/api/clients")
async def get_connected_clients(_: None = Depends(validate_connection)):
    return JSONResponse({"clients": [{"ip": ip} for _, ip in connected_clients]})

@app.post("/api/disconnect_client")
async def disconnect_client(request: Request, _: None = Depends(validate_connection)):
    try:
        data = await request.json()
        client_ip = data.get("ip")

        for client in connected_clients:
            if client[1] == client_ip:
                await client[0].send_text("disconnect_client")
                await client[0].close()
                connected_clients.remove(client)
                return JSONResponse({"success": True, "message": f"Client {client_ip} disconnected."})

        return JSONResponse({"success": False, "error": "Client not found."}, status_code=404)

    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

# Monitor shared notification file to detect if a new TTS output is generated from Piper Docker
async def monitor_notifications():
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

async def process_chat_history(action: str, filenames: list[str] = None):
    os.makedirs("archived", exist_ok=True)
    files_processed = 0
    filename_pattern = re.compile(r"^\d{19}\.(wav|txt)$")

    with os.scandir("output") as entries:
        for entry in entries:
            if entry.is_file() and re.fullmatch(filename_pattern, entry.name):
                if filenames and entry.name not in filenames:
                    continue

                try:
                    if action == "archive":
                        shutil.move(entry.path, os.path.join("archived", entry.name))
                    elif action == "delete":
                        secure_delete(entry.path)
                    files_processed += 1
                except Exception as e:
                    return {"success": False, "error": f"Failed to {action} {entry.name}: {str(e)}"}

    return {
        "success": files_processed > 0,
        "message": f"{action.capitalize()}d {files_processed} chat history files."
        if files_processed else f"No valid chat history files found to {action}."
    }

def secure_delete(file_path, passes=3):
    try:
        if os.path.exists(file_path):
            with open(file_path, "wb") as f:
                length = os.path.getsize(file_path)
                for _ in range(passes):
                    f.seek(0)
                    f.write(os.urandom(length))
                    f.flush()
                    os.fsync(f.fileno())

            os.remove(file_path)
    except Exception as e:
        print(f"Error securely deleting {file_path}: {e}")

# Send output to frontend
async def send_to_clients(message: str):
    disconnected_clients = set()
    
    for client_tuple in connected_clients:
        websocket, ip = client_tuple

        try:
            await websocket.send_text(message)
        except WebSocketDisconnect:
            disconnected_clients.add(client_tuple)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            disconnected_clients.add(client_tuple)

    connected_clients.difference_update(disconnected_clients)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_notifications())

if __name__ == "__main__":
    if PROTOCOL == "https":
        uvicorn.run(app, host=HOST, port=PORT, log_level=LOG_LEVEL.lower(), ssl_keyfile="key.pem", ssl_certfile="cert.pem")
    else:
        uvicorn.run(app, host=HOST, port=PORT, log_level=LOG_LEVEL.lower())