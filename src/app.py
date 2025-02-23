import json
import os
import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Using FastAPI/WebSockets + Uvicorn for real-time communication
app = FastAPI()
connected_clients = set()
notification_file = "./output/new_audio.json"

@app.get("/")
async def serve_root():
    return FileResponse("static/index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    client_ip = websocket.client.host
    logger.info(f"Client {client_ip} connected")

    try:
        while True:
            message = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            logger.info(f"Received WebSocket message from {client_ip}: {message}")
    except asyncio.TimeoutError:
        logger.warning(f"Client {client_ip} timed out (no activity)")
    except WebSocketDisconnect:
        logger.info(f"Client {client_ip} disconnected")
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

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/live2d_models", StaticFiles(directory="live2d_models"), name="live2d_models")
app.mount("/output", StaticFiles(directory="output"), name="output")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=11405, log_level="info")