import os
import json
import yaml
import asyncio
import uvicorn
import httpx
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
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

@app.post("/api/send_prompt")
async def send_prompt(request: Request):
    try:
        data = await request.json()
        user_input = data.get("text", "").strip()

        if not user_input:
            return {"success": False, "error": "No input text provided"}

        # Use Ollama Webhook URL from settings.yaml, otherwise use default URL
        webhook_url = settings.get("urls", {}).get("ollama_webhook", "http://homeassistant.local:8123/api/webhook/ollama_chat")

        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json={"text": user_input}, headers={"Content-Type": "application/json"}, timeout=20)
            response.raise_for_status()

        return {"success": True, "message": "Sent successfully", "input": user_input}

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
                message = await asyncio.wait_for(websocket.receive_text(), timeout=30)
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