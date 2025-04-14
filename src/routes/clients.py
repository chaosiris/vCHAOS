# routes/clients.py
import asyncio
import os
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.responses import JSONResponse
from routes.settings import load_settings
from routes.chatHistory import process_chat_history
from routes.globals import connected_clients, pending_deletions
from routes.utils import validate_connection

router = APIRouter()

config = load_settings()
LOG_LEVEL = config.get("backend", {}).get("logging", {}).get("level", "ERROR").upper()
SAVE_CHAT_HISTORY = bool(config.get("frontend", {}).get("save-chat-history", True))

# Initialize logging framework
logging.basicConfig(level=LOG_LEVEL, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time communication with connected clients.
    Clients must maintain an active WebSocket connection to receive updates/access certain endpoints.

    Args:
        websocket (WebSocket): WebSocket connection instance.

    Behavior:
        - Initiates WebSocket connection.
        - Tracks active clients and removes stale connections.
        - Handles incoming messages and processes chat history deletions.
        - Sends a keep-alive 'ping' message every 60 seconds.
        - Cleans up disconnected clients upon connection loss.
    """
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

@router.get("/api/clients")
async def get_connected_clients(_: None = Depends(validate_connection)):
    """
    Retrieve list of active WebSocket clients.

    Args:
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: A JSON response containing client IP addresses.
    """
    return JSONResponse({"clients": [{"ip": ip} for _, ip in connected_clients]})

@router.get("/api/client_count")
async def get_client_count():
    """
    Retrieve the count of active WebSocket clients.

    Returns:
        JSONResponse: A JSON response containing the total number of connected clients.
    """
    return JSONResponse({"count": len(connected_clients)})

@router.post("/api/disconnect_client")
async def disconnect_client(request: Request, _: None = Depends(validate_connection)):
    """
    Remotely/manually disconnect a specific WebSocket client by sending a 'disconnect_client' message.
    Clients disconnected through this function must refresh the web page to reconnect to the WebSocket.

    Args:
        request (Request): JSON request body containing the client IP to be disconnected.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success message if the client is successfully disconnected.
        404 error if the client IP is not found in 'connected_clients'.
        500 error for further exceptions.
    """
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