import os
import re
import json
import yaml
import asyncio
import uvicorn
import httpx
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Load configuration from config.yaml
def load_settings(file_path="settings.yaml"):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        print("Error: settings.yaml not found, using defaults.")
        return {} 

# Load constants from settings.yaml
settings = load_settings()
HOST = settings.get("app", {}).get("host", "0.0.0.0")
PORT = settings.get("app", {}).get("port", 11405)
LOG_LEVEL = settings.get("logging", {}).get("level", "ERROR")
TIMEOUT_DURATION = settings.get("chat-interface", {}).get("timeout", 180)

# Using FastAPI/WebSockets + Uvicorn for real-time communication
app = FastAPI()
connected_clients = set()
notification_file = "output/new_audio.json"

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/live2d_models", StaticFiles(directory="live2d_models"), name="live2d_models")
app.mount("/output", StaticFiles(directory="output"), name="output")

# Initialize logging framework
logging.basicConfig(level=LOG_LEVEL, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

@app.get("/")
async def serve_root():
    return FileResponse("static/index.html")

@app.get("/api/settings")
async def get_settings():
    return JSONResponse(settings)

@app.get("/api/get_history")
async def get_chat_history(search: str = Query(default=None, description="Search query for filtering history")):
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
                            preview_text = f.read(50).strip() 
                            if len(preview_text) == 50:
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
async def send_prompt(request: Request):
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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    client_ip = websocket.client.host
    logger.info(f"Client {client_ip} connected")

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                logger.info(f"Received WebSocket message from {client_ip}: {message}")
            except asyncio.TimeoutError:
                await websocket.send_text("ping")  # Keep-alive ping to prevent timeout
    except WebSocketDisconnect:
        logger.info(f"Client {client_ip} disconnected")
    except asyncio.CancelledError:
        logger.warning(f"WebSocket connection for {client_ip} was cancelled")
    except Exception as e:
        logger.error(f"Unexpected WebSocket error for {client_ip}: {e}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Cleaned up WebSocket connection for {client_ip}")

# Monitor shared notification file to detect if a new TTS output is generated from Piper Docker
async def monitor_notifications():
    while True:
        if os.path.exists(notification_file):
            try:
                with open(notification_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                await send_to_clients(json.dumps(data))
                os.remove(notification_file)
            except json.JSONDecodeError:
                logger.error("Error decoding JSON from notification file")
            except Exception as e:
                logger.error(f"Error processing notification file: {e}")

        await asyncio.sleep(1)

# Send output to frontend
async def send_to_clients(message: str):
    disconnected_clients = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except WebSocketDisconnect:
            disconnected_clients.add(client)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            disconnected_clients.add(client)

    connected_clients.difference_update(disconnected_clients)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_notifications())

if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level=LOG_LEVEL.lower())