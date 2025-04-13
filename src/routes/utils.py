# routes/utils.py
from fastapi import Request, HTTPException
from routes.globals import connected_clients

def validate_settings(data):
    """
    Validates received data when updating settings to ensure correct file structure and data type.
    Args:
        data (dict): JSON object containing the updated settings.
    """
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