# routes/utils.py
import os
from fastapi import Request, HTTPException
from routes.globals import connected_clients

def validate_connection(request: Request):
    """
    Ensures only clients with an active WebSockets connection can make API POST requests.

    Args:
        request (Request): The incoming FastAPI request instance.
    """
    client_ip = request.client.host
    if not any(ip == client_ip for _, ip in connected_clients):
        raise HTTPException(status_code=403, detail="Unauthorized: WebSocket connection required.")

def secure_delete(file_path, passes=3):
    """
    Securely deletes a file by overwriting its content with random chars before deletion.

    Args:
        file_path (str): Path to the file intended for secure deletion.
        passes (int): Number of passes to overwrite file before deletion.
    """
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