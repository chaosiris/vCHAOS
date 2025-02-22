import json
import os
import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

# Monitor shared notification file to detect if a new TTS output is generated from Piper Docker
async def monitor_notifications():
    while True:
        if os.path.exists(notification_file):
            try:
                with open(notification_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                await send_to_clients(json.dumps(data))
                os.remove(notification_file)
            except Exception as e:
                print(f"Error processing notification: {e}")

        await asyncio.sleep(1) 

# Send output to frontend
async def send_to_clients(message: str):
    for client in list(connected_clients):
        try:
            await client.send_text(message)
        except Exception:
            connected_clients.remove(client)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_notifications())

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/output", StaticFiles(directory="output"), name="output")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=11405, log_level="info")