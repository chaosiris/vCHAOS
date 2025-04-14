# tests/test_app.py
import pytest
import asyncio
import json
from fastapi.websockets import WebSocket, WebSocketDisconnect
from routes.globals import connected_clients
from app import send_voice, send_to_clients
from unittest.mock import patch, AsyncMock, MagicMock

# Test GET /
def test_root_endpoint(client):
    """Test if the root endpoint serves index.html"""
    response = client.get("/")
    assert response.status_code == 200

# Test POST /api/send_prompt
def test_send_prompt(client, setup_websocket):
    """Ensure WebSocket connection exists before sending API request"""
    response = client.post("/api/send_prompt", json={"text": "Hello"})
    assert response.status_code == 200

def test_send_prompt_empty(client, setup_websocket):
    """Test API response with empty input"""
    response = client.post("/api/send_prompt", json={"text": ""})
    assert response.status_code == 200
    assert response.json()["success"] is False

def test_send_prompt_disconnected(client):
    """Test API response without an active WebSocket connection"""
    response = client.post("/api/send_prompt", json={"text": ""})
    assert response.status_code == 403

# Test POST /api/send_prompt
@pytest.mark.asyncio
async def test_send_voice_success(client, setup_websocket):
    """Test successful audio transcription"""
    mock_audio_file = MagicMock()
    mock_audio_file.read = AsyncMock(return_value=b"fake audio data")

    mock_transcript = MagicMock()
    mock_transcript.text = "Test transcription"

    with patch("app.AsyncTcpClient") as mock_client, \
         patch("app.Transcript.from_event", return_value=mock_transcript), \
         patch("app.asyncio.create_subprocess_exec") as mock_ffmpeg:

        mock_ffmpeg.return_value.communicate = AsyncMock(return_value=(b"converted audio", None))
        mock_ffmpeg.return_value.returncode = 0

        mock_client.return_value.__aenter__.return_value.write_event = AsyncMock()
        mock_client.return_value.__aenter__.return_value.read_event = AsyncMock(return_value="fake event")

        response = await send_voice(audio=mock_audio_file)

        assert response["success"] is True
        assert response["transcription"] == "Test transcription"

@pytest.mark.asyncio
async def test_send_voice_ffmpeg_conversion_failure(client, setup_websocket):
    """Test FFmpeg failure handling"""
    mock_audio_file = MagicMock()
    mock_audio_file.read = AsyncMock(return_value=b"fake audio data")

    with patch("app.asyncio.create_subprocess_exec") as mock_ffmpeg:
        mock_ffmpeg.return_value.communicate = AsyncMock(return_value=(b"", None))
        mock_ffmpeg.return_value.returncode = 1

        response = await send_voice(audio=mock_audio_file)

        assert response.status_code == 500

@pytest.mark.asyncio
async def test_send_voice_exception(client, setup_websocket):
    """Test API response if an exception occurs"""
    mock_audio_file = MagicMock()
    mock_audio_file.read = AsyncMock(side_effect=Exception("Unexpected error"))

    response = await send_voice(audio=mock_audio_file)

    assert response.status_code == 500

# Test send_to_clients()
@pytest.mark.asyncio
async def test_send_to_clients_success():
    """Test sending messages to all active WebSocket clients successfully"""
    mock_websocket_1 = MagicMock(spec=WebSocket)
    mock_websocket_1.send_text = AsyncMock()
    
    mock_websocket_2 = MagicMock(spec=WebSocket)
    mock_websocket_2.send_text = AsyncMock()

    connected_clients.add((mock_websocket_1, "192.168.1.1"))
    connected_clients.add((mock_websocket_2, "192.168.1.2"))

    message = json.dumps({"event": "test", "data": "message"})

    await send_to_clients(message)

    mock_websocket_1.send_text.assert_called_with(message)
    mock_websocket_2.send_text.assert_called_with(message)

    connected_clients.clear()

@pytest.mark.asyncio
async def test_send_to_clients_disconnection():
    """Test handling of disconnected WebSocket clients"""
    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.send_text = AsyncMock(side_effect=WebSocketDisconnect)

    connected_clients.add((mock_websocket, "192.168.1.3"))

    message = json.dumps({"event": "test", "data": "message"})

    await send_to_clients(message)

    assert (mock_websocket, "192.168.1.3") not in connected_clients

    connected_clients.clear()

@pytest.mark.asyncio
async def test_send_to_clients_exception():
    """Test API response if an exception occurs during message send"""
    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.send_text = AsyncMock(side_effect=Exception("Unexpected error"))

    connected_clients.add((mock_websocket, "192.168.1.4"))

    message = json.dumps({"event": "test", "data": "message"})

    await send_to_clients(message)
    assert (mock_websocket, "192.168.1.4") not in connected_clients

    connected_clients.clear()
