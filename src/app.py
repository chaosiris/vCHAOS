import os
import shutil
import time
import asyncio
import json
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

# Using FastAPI/WebSockets + Uvicorn for this project
app = FastAPI()

# Monitor shared folder with Piper's Docker instance for new .wav files
watched_dir = "C:/piper/data"
output_dir = "static/audio"
os.makedirs(output_dir, exist_ok=True)

processed_files = set()
connected_clients = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print("Client connected")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received WebSocket message: {data}")
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print("Client disconnected")

async def monitor_wav_files():
    print("Monitoring .wav files in", watched_dir)
    while True:
        for root, _, files in os.walk(watched_dir):
            for filename in files:
                if filename.endswith(".wav") and filename not in processed_files:
                    file_path = os.path.join(root, filename)
                    
                    if os.path.isfile(file_path):
                        print(f"New .wav file detected: {filename}")
                        
                        try:
                            dest_path = os.path.join(output_dir, filename)
                            shutil.move(file_path, dest_path)
                            print(f"Moved {filename} to {output_dir}")

                            time.sleep(1)

                            processed_files.add(filename)

                            message = json.dumps({"type": "new_audio", "audio_file": f"/audio/{filename}"})
                            await send_to_clients(message)

                        except Exception as e:
                            print(f"Failed to move or copy {filename}: {e}")

        await asyncio.sleep(1)

# Send .wav file to frontend
async def send_to_clients(message: str):
    disconnected_clients = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception as e:
            print(f"Client disconnected: {e}")
            disconnected_clients.add(client) 

    for client in disconnected_clients:
        connected_clients.remove(client)

app.mount("/", StaticFiles(directory="static", html=True), name="static")

async def start_polling():
    asyncio.create_task(monitor_wav_files())

@app.on_event("startup")
async def startup_event():
    await start_polling()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=11405, log_level="info", log_config=None)
