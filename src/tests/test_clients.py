# tests/test_clients.py
import pytest
import json
import asyncio
from fastapi.websockets import WebSocket
from unittest.mock import AsyncMock, patch, MagicMock
from routes.globals import connected_clients, pending_deletions

# Test WebSocket endpoint /ws
@pytest.mark.asyncio
async def test_websocket_connection(client):
    """Test WebSocket client connection and disconnection"""
    with client.websocket_connect("/ws") as websocket:
        websocket.send_text("test message")

@pytest.mark.asyncio
async def test_cleanup_stale_clients(client):
    """Test cleanup of stale WebSocket clients"""
    with client.websocket_connect("/ws") as stale_websocket:
        connected_clients.add((stale_websocket, "testclient"))

        with client.websocket_connect("/ws") as new_websocket:
            await asyncio.sleep(0.2)

            stale_clients = {client for client in connected_clients if client[1] == "testclient"}

            for stale_client in stale_clients:
                connected_clients.discard(stale_client)

            assert (stale_websocket, "testclient") not in connected_clients
            
@pytest.mark.asyncio
async def test_websocket_exception(client):
    """Test WebSocket response if an exception occurs"""
    with client.websocket_connect("/ws") as websocket:
        websocket.send_bytes(b"\xFF\xFF\xFF\xFF") # Corrupted binary data
        await asyncio.sleep(0.2)

# Test GET /api/clients
def test_get_connected_clients(client, setup_websocket):
    """Test retrieval of set of active WebSocket clients"""
    
    connected_clients.update({(None, "192.168.1.1"), (None, "192.168.1.2")})
    response = client.get("/api/clients")

    assert response.status_code == 200
    assert set([client["ip"] for client in response.json()["clients"]]) >= {"192.168.1.1", "192.168.1.2"}

# Test GET /api/client_count
def test_get_client_count(client):
    """Test retrieval of number of active WebSocket clients"""
    connected_clients.clear()
    connected_clients.update({(None, "192.168.1.1"), (None, "192.168.1.2")})
    
    response = client.get("/api/client_count")

    assert response.status_code == 200
    assert response.json() == {"count": 2}

    connected_clients.clear()

# Test POST /api/disconnect_client
@pytest.mark.asyncio
async def test_disconnect_client_success(client, setup_websocket):
    """Test manually disconnecting a WebSocket client"""

    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.send_text = AsyncMock()
    mock_websocket.close = AsyncMock()

    connected_clients.add((mock_websocket, "192.168.1.3"))
    
    response = client.post("/api/disconnect_client", json={"ip": "192.168.1.3"})

    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Client 192.168.1.3 disconnected."}

    assert (mock_websocket, "192.168.1.3") not in connected_clients

@pytest.mark.asyncio
async def test_disconnect_client_not_found(client, setup_websocket):
    """Test failure when disconnecting a nonexistent WebSocket client"""

    response = client.post("/api/disconnect_client", json={"ip": "192.168.1.3"})

    assert response.status_code == 404
    assert response.json() == {"success": False, "error": "Client not found."}

@pytest.mark.asyncio
async def test_disconnect_client_exception(client, setup_websocket):
    """Test handling of unexpected exceptions during client disconnection"""

    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.send_text = AsyncMock()
    mock_websocket.close = AsyncMock()

    connected_clients.add((mock_websocket, "192.168.1.3"))
    
    with patch.object(mock_websocket, "close", side_effect=Exception("Unexpected error")):
        response = client.post("/api/disconnect_client", json={"ip": "192.168.1.3"})

    assert response.status_code == 500
    assert response.json() == {"success": False, "error": "Unexpected error"}

    connected_clients.discard((mock_websocket, "192.168.1.3"))