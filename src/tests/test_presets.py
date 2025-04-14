# tests/test_presets.py
import pytest
import json
from unittest.mock import patch, mock_open
from routes import presets

# Test GET /api/get_presets
def test_get_presets_success(client, setup_websocket):
    """Test successful retrieval of presets"""
    mock_data = json.dumps([
        {"name": "Preset1", "prompt": "Hello World"},
        {"name": "Preset2", "prompt": "Another Prompt"}
    ])
    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.get("/api/get_presets")
    
    assert response.status_code == 200
    assert response.json() == json.loads(mock_data)

@pytest.mark.asyncio
async def test_get_presets_not_list(client, setup_websocket):
    """Test handling when 'preset_file' contains invalid non-list data"""
    mock_data = json.dumps({"name": "Only name but no prompt (dict instead of list)"})
    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.get("/api/get_presets")

    assert response.status_code == 200
    assert response.json() == []

def test_get_presets_file_missing(client, setup_websocket):
    """Test handling when 'preset_file' is missing"""
    with patch("os.path.exists", return_value=False):
        response = client.get("/api/get_presets")

    assert response.status_code == 200
    assert response.json() == []

def test_get_presets_invalid_json(client, setup_websocket):
    """Test handling when 'preset_file' contains invalid JSON format"""
    with patch("builtins.open", mock_open(read_data="invalid json")), \
         patch("os.path.exists", return_value=True):

        response = client.get("/api/get_presets")
    
    assert response.status_code == 500
    assert response.json() == {"error": "Invalid JSON format"}

@pytest.mark.asyncio
async def test_get_presets_exception(client, setup_websocket):
    """Test API response when an exception occurs"""
    with patch("builtins.open", side_effect=Exception("Unexpected error")), \
         patch("os.path.exists", return_value=True):
        response = client.get("/api/get_presets")

    assert response.status_code == 500
    assert response.json() == {"error": "Unexpected error"}

# Test POST /api/save_presets
@pytest.mark.asyncio
async def test_save_preset_new(client, setup_websocket):
    """Test successful saving of a new preset"""
    mock_data = json.dumps([
        {"name": "Preset1", "prompt": "Hello World"}
    ])

    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/save_preset", json={"name": "Preset2", "prompt": "New Prompt"})
    
    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Preset saved successfully"}

@pytest.mark.asyncio
async def test_save_preset_update(client, setup_websocket):
    """Test successful updating of a new preset"""
    mock_data = json.dumps([
        {"name": "Preset1", "prompt": "Old Prompt"}
    ])

    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/save_preset", json={"name": "Preset1", "prompt": "Updated Prompt"})
    
    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Preset saved successfully"}

@pytest.mark.asyncio
async def test_save_preset_creates_new_file(client, setup_websocket):
    """Test that save_preset creates a new 'preset_file' if missing."""
    with patch("os.path.exists", return_value=False), \
         patch("builtins.open", mock_open()) as mock_file:

        response = client.post("/api/save_preset", json={"name": "Preset1", "prompt": "Hello World"})

    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Preset saved successfully"}

@pytest.mark.asyncio
async def test_save_preset_missing_fields(client, setup_websocket):
    """Test API response when required fields name and prompt are missing"""
    with patch("os.path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data="[]")):

        response = client.post("/api/save_preset", json={"name": "", "prompt": ""})

    assert response.status_code == 400
    assert response.json() == {"success": False, "error": "Both name and prompt are required."}

@pytest.mark.asyncio
async def test_save_preset_not_list(client, setup_websocket):
    """Test API response when 'preset_file' contains valid JSON but not a list"""
    mock_data = json.dumps({"name": "Only name but no prompt"})
    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/save_preset", json={"name": "Preset1", "prompt": "Hello World"})

    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Preset saved successfully"}

@pytest.mark.asyncio
async def test_save_preset_json_decode_error(client, setup_websocket):
    """Test API response when a JSON decode error occurs"""
    with patch("builtins.open", mock_open(read_data="invalid json")), \
         patch("os.path.exists", return_value=True):
        response = client.post("/api/save_preset", json={"name": "Preset1", "prompt": "Hello World"})

    assert response.status_code == 200

@pytest.mark.asyncio
async def test_save_preset_exception(client, setup_websocket):
    """Test API response when an exception occurs"""
    with patch("builtins.open", side_effect=Exception("Unexpected write error")), \
         patch("os.path.exists", return_value=True):
        response = client.post("/api/save_preset", json={"name": "Preset1", "prompt": "Hello World"})

    assert response.status_code == 500
    assert response.json() == {"success": False, "error": "Unexpected write error"}

# Test DELETE /api/delete_presets
@pytest.mark.asyncio
async def test_delete_presets_success(client, setup_websocket):
    """Test successful deletion of a preset"""
    mock_data = json.dumps([
        {"name": "Preset1", "prompt": "Hello World"},
        {"name": "Preset2", "prompt": "Another Prompt"}
    ])

    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/delete_presets", json={"names": ["Preset1"]})
    
    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Deleted 1 preset successfully."}

@pytest.mark.asyncio
async def test_delete_presets_not_found(client, setup_websocket):
    """Test API response when the provided preset is not in the 'preset_file'"""
    mock_data = json.dumps([
        {"name": "Preset1", "prompt": "Hello World"}
    ])

    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/delete_presets", json={"names": ["NonexistentPreset"]})
    
    assert response.status_code == 404
    assert response.json() == {"success": False, "error": "No matching presets found."}

@pytest.mark.asyncio
async def test_delete_presets_file_missing(client, setup_websocket):
    """Test API response when 'preset_file' is missing"""
    with patch("os.path.exists", return_value=False):
        response = client.post("/api/delete_presets", json={"names": ["Preset1"]})

    assert response.status_code == 404
    assert response.json() == {"success": False, "error": "Preset file not found"}

@pytest.mark.asyncio
async def test_delete_presets_not_list(client, setup_websocket):
    """Test API response when 'preset_file' contains valid JSON but not a list"""
    mock_data = json.dumps({"name": "Only name but no prompt"})
    
    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/delete_presets", json={"names": ["Preset1"]})

    assert response.status_code == 404
    assert response.json() == {"success": False, "error": "No matching presets found."}

@pytest.mark.asyncio
async def test_delete_presets_json_decode_error(client, setup_websocket):
    """Test API response when a JSON decode error occurs"""
    with patch("builtins.open", mock_open(read_data="invalid json")), \
         patch("os.path.exists", return_value=True):
        response = client.post("/api/delete_presets", json={"names": ["Preset1"]})

    assert response.status_code == 404
    assert response.json() == {"success": False, "error": "No matching presets found."}

@pytest.mark.asyncio
async def test_delete_presets_no_names_provided(client, setup_websocket):
    """Test deleting presets when no names are provided (it should delete all presets)"""
    mock_data = json.dumps([
        {"name": "Preset1", "prompt": "Hello World"},
        {"name": "Preset2", "prompt": "Another Prompt"}
    ])

    with patch("builtins.open", mock_open(read_data=mock_data)), \
         patch("os.path.exists", return_value=True):

        response = client.post("/api/delete_presets", json={})

    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Deleted 2 presets successfully."}

@pytest.mark.asyncio
async def test_delete_presets_exception(client, setup_websocket):
    """Test API response when an exception occurs"""
    with patch("builtins.open", side_effect=Exception("Unexpected file error")), \
         patch("os.path.exists", return_value=True):
        response = client.post("/api/delete_presets", json={"names": ["Preset1"]})

    assert response.status_code == 500
    assert response.json() == {"success": False, "error": "Unexpected file error"}