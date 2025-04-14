# tests/test_settings.py
import pytest
import json
from unittest.mock import mock_open, patch
from fastapi import HTTPException
from routes import settings
from ruamel.yaml import YAML

yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=4, offset=2)

# Mock files
mock_settings_yaml = """
    backend:
        app:
            host: 0.0.0.0
            port: 11405
            protocol: http
            multicast: true
        logging:
            level: ERROR
        urls:
            ollama_webhook: http://homeassistant.local:8123/api/webhook/ollama_chat
            whisper_host: 127.0.0.1
            whisper_port: 10300

    frontend:
        show-sent-prompts: true
        enable-idle-motion: true
        enable-tap-motion: true
        enable-prompt-repeat: true
        enable-mouth-scaling: true
        enable-voice-input: true
        save-chat-history: true
        adaptive-background: true
        timeout: 180
        model-name: shizuku
    """
mock_model_dict_json = """
    [
        {
            "name": "Model1",
            "file_path": "./live2d_models/model1/model1.model3.json",
            "kScale": 0.2,
            "xOffset": 0,
            "yOffset": 0,
            "idleMotion": "idle",
            "idleMotionCount": 1,
            "tapMotion": "tap",
            "tapMotionCount": 1
        },
        {
            "name": "Model2",
            "file_path": "./live2d_models/model2/model2.model3.json",
            "kScale": 0.5,
            "xOffset": 100,
            "yOffset": 200
        }
    ]
    """

# Test load_settings()
def test_load_settings_success(client):
    """Test successful YAML settings load"""
    with patch("builtins.open", mock_open(read_data=mock_settings_yaml)):
        config = settings.load_settings()
        assert config["frontend"]["timeout"] == 180
        assert config["frontend"]["model-name"] == "shizuku"

def test_load_settings_file_not_found(client):
    """Test handling when settings.yaml is missing"""
    with patch("builtins.open", side_effect=FileNotFoundError):
        config = settings.load_settings()
        assert config == {}

# Test GET /api/get_settings
def test_get_settings_success(client):
    """Test retrieving frontend settings via API"""
    with patch("builtins.open", mock_open(read_data=mock_settings_yaml)):
        response = client.get("/api/get_settings")
        assert response.status_code == 200
        # Endpoint only gets the frontend settings hence frontend key is not needed
        assert "backend" not in response.json() 
        assert "frontend" not in response.json()
        assert response.json()["show-sent-prompts"] is True
        assert response.json()["enable-idle-motion"] is True
        assert response.json()["enable-tap-motion"] is True
        assert response.json()["enable-prompt-repeat"] is True
        assert response.json()["enable-mouth-scaling"] is True
        assert response.json()["save-chat-history"] is True
        assert response.json()["adaptive-background"] is True
        assert response.json()["timeout"] == 180
        assert response.json()["model-name"] == "shizuku"

def test_get_settings_file_not_found(client):
    """Test API response when settings file is missing"""
    with patch("builtins.open", side_effect=FileNotFoundError):
        response = client.get("/api/get_settings")
        assert response.status_code == 404
        assert response.json()["error"] == "settings_file not found"

def test_get_settings_exception(client):
    """Test API response when an exception occurs"""
    with patch("builtins.open", side_effect=Exception("Unexpected failure")):
        response = client.get("/api/get_settings")
        assert response.status_code == 500
        assert "Unexpected failure" in response.json()["error"]

# Test POST /api/update_settings
def test_update_settings_success(client, setup_websocket):
    """Test updating all frontend settings using a mock file."""
    
    updated_settings = {
        "frontend": {
            "show-sent-prompts": False,
            "enable-idle-motion": False,
            "timeout": 300,
            "model-name": "new-model"
        }
    }

    with patch("builtins.open", mock_open(read_data=mock_settings_yaml)) as mock_file:
        response = client.post("/api/update_settings", json=updated_settings)

        assert response.status_code == 200
        assert response.json()["success"] is True

        assert mock_file().write.call_count > 0
        written_data = "".join(call.args[0] for call in mock_file().write.call_args_list)
        parsed_yaml = yaml.load(written_data)

        assert parsed_yaml["frontend"]["timeout"] == 300
        assert parsed_yaml["frontend"]["model-name"] == "new-model"

def test_update_settings_file_write_error(client, setup_websocket):
    """Test API response when writing to settings_file fails"""
    with patch("builtins.open", side_effect=OSError("File write failed")):
        response = client.post("/api/update_settings", json={})

        assert response.status_code == 200
        assert response.json()["success"] is False
        assert "File write failed" in response.json()["error"]

def test_update_settings_validation_error(client, setup_websocket):
    """Test API response when a HTTPException occurs"""
    with patch("routes.settings.validate_settings", side_effect=HTTPException(status_code=400, detail="Invalid settings")):
        response = client.post("/api/update_settings", json={"frontend": {"timeout": "invalid"}})

        assert response.status_code == 200
        assert response.json()["success"] is False
        assert response.json()["error"] == "Invalid settings"

def test_update_settings_invalid_key(client, setup_websocket):
    """Test updating settings by adding an invalid key"""
    
    updated_settings = {
        "new_category": {
            "new-setting": "new-value"
        }
    }

    response = client.post("/api/update_settings", json=updated_settings)
    
    assert response.status_code == 200
    assert response.json()["success"] is False

def test_update_settings_httpexception(client, setup_websocket):
    """Test API response when a HTTPException occurs"""
    with patch("routes.settings.load_settings", side_effect=HTTPException(status_code=500, detail="Unexpected failure")):
        response = client.post("/api/update_settings", json={})
        assert response.status_code == 200
        assert response.json()["success"] is False

def test_update_settings_exception(client, setup_websocket):
    """Test API response when an exception occurs"""
    with patch("routes.settings.load_settings", side_effect=Exception("Unexpected failure")):
        response = client.post("/api/update_settings", json={})
        assert response.status_code == 200
        assert response.json()["success"] is False

# Test validate_settings()
def test_validate_settings_invalid_category():
    """Test validation failure for an invalid category"""
    with pytest.raises(HTTPException) as exc_info:
        settings.validate_settings({"invalid_category": {"timeout": 180}})

    assert exc_info.value.status_code == 400
    assert "Invalid category" in exc_info.value.detail

def test_validate_settings_invalid_key():
    """Test validation failure for an invalid setting key"""
    with pytest.raises(HTTPException) as exc_info:
        settings.validate_settings({"frontend": {"fake_setting": True}})

    assert exc_info.value.status_code == 400
    assert "Invalid setting" in exc_info.value.detail

def test_validate_settings_invalid_type():
    """Test validation failure for incorrect data type"""
    with pytest.raises(HTTPException) as exc_info:
        settings.validate_settings({"frontend": {"timeout": "not_a_number"}})

    assert exc_info.value.status_code == 400
    assert "Invalid type for timeout" in exc_info.value.detail

def test_validate_settings_invalid_timeout():
    """Test validation failure for timeout value outside allowed range"""
    with pytest.raises(HTTPException) as exc_info:
        settings.validate_settings({"frontend": {"timeout": 999}})

    assert exc_info.value.status_code == 400
    assert "Timeout value must be between 30 and 600" in exc_info.value.detail

# Test GET /api/get_models
def test_get_models_success(client):
    """Test retrieving models list"""
    with patch("builtins.open", mock_open(read_data=mock_model_dict_json)):
        response = client.get("/api/get_models")
        assert response.status_code == 200
        assert response.json()[0]["name"] == "Model1"
        assert response.json()[0]["file_path"] == "./live2d_models/model1/model1.model3.json"
        assert response.json()[0]["kScale"] == 0.2
        assert response.json()[0]["xOffset"] == 0
        assert response.json()[0]["yOffset"] == 0
        assert response.json()[0]["idleMotion"] == "idle"
        assert response.json()[0]["idleMotionCount"] == 1
        assert response.json()[0]["tapMotion"] == "tap"
        assert response.json()[0]["tapMotionCount"] == 1
        assert response.json()[1]["name"] == "Model2"
        assert response.json()[1]["file_path"] == "./live2d_models/model2/model2.model3.json"
        assert response.json()[1]["kScale"] == 0.5
        assert response.json()[1]["xOffset"] == 100
        assert response.json()[1]["yOffset"] == 200
        # Should still return default values even if not specified
        assert response.json()[1]["idleMotion"] == "idle"
        assert response.json()[1]["idleMotionCount"] == 1
        assert response.json()[1]["tapMotion"] == "tap"
        assert response.json()[1]["tapMotionCount"] == 1

def test_get_models_file_not_found(client):
    """Test API response when model_dict.json is missing"""
    with patch("builtins.open", side_effect=FileNotFoundError):
        response = client.get("/api/get_models")
        assert response.status_code == 404
        assert response.json()["error"] == "model_dict.json not found"

def test_get_models_invalid_json(client):
    """Test API response when model_dict.json contains invalid/malformed JSON"""
    invalid_model_dict_json = """
    [
        {
            "name": "Model1",
            "file_path": "./live2d_models/model1/model1.model3.json",
            "kScale": 0.2,
            "xOffset": 0,
            "yOffset": 0,
    """
    with patch("builtins.open", mock_open(read_data=invalid_model_dict_json)):
        response = client.get("/api/get_models")
        assert response.status_code == 500
        assert response.json()["error"] == "Invalid JSON format in model_dict.json"

def test_get_models_exception(client):
    """Test API response when an exception occurs"""
    with patch("builtins.open", side_effect=Exception("Unexpected failure")):
        response = client.get("/api/get_models")
        assert response.status_code == 500
        assert "Unexpected failure" in response.json()["error"]