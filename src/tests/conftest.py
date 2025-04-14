# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app import app
from routes.globals import connected_clients

@pytest.fixture(scope="module")
def client():
    """Creates a test client for the FastAPI app."""
    return TestClient(app)

@pytest.fixture
def setup_websocket(client):
    """Create WebSocket connection and register the client."""
    user_ip = "127.0.0.1"

    with client.websocket_connect("/ws") as websocket:
        connected_clients.add((websocket, user_ip))
        yield websocket

    connected_clients.discard((websocket, user_ip))