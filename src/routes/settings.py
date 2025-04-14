# routes/settings.py
import json
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from routes.utils import validate_connection
from ruamel.yaml import YAML

yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=4, offset=2)

router = APIRouter()
settings_file = "settings.yaml"
model_dict_file = "model_dict.json"

def load_settings(file_path=settings_file):
    """
    Loads configuration settings from the 'settings_file' defined above.
    For backend purposes.

    Args:
        file_path (str): Path to the YAML file containing configuration settings.

    Returns:
        dict: Dictionary containing the settings loaded from the YAML file.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.load(f)
    except FileNotFoundError:
        print("Error: settings.yaml not found, using defaults.")
        return {}

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

@router.get("/api/get_settings")
async def get_settings():
    """
    Retrieve frontend settings from the 'settings_file' defined above.
    For frontend purposes.

    Returns:
        JSONResponse: The frontend settings in JSON format.
        404 error if 'settings_file' is not found.
        500 error for further exceptions.
    """
    try:
        with open(settings_file, "r", encoding="utf-8") as f:
            settings = yaml.load(f)

        return JSONResponse(settings.get("frontend", {}))

    except FileNotFoundError:
        return JSONResponse({"error": "settings_file not found"}, status_code=404)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/api/update_settings")
async def update_settings(request: Request, _: None = Depends(validate_connection)):
    """
    Update settings in the 'settings_file' defined above.

    Args:
        request (Request): Reqwuest containing the updated settings data in JSON format.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success message if update is successful.
        Always returns 200 OK status code to ensure graceful handling.
        If an exception occurs, an error message will be returned.
    """
    try:
        data = await request.json()
        validate_settings(data)
        yaml_data = load_settings()

        for key, value in data.items():
            if isinstance(value, dict) and key in yaml_data:
                yaml_data[key].update(value)

        with open(settings_file, "w", encoding="utf-8") as f:
            yaml.dump(yaml_data, f)

        return {"success": True, "message": "Settings updated successfully"}

    except HTTPException as e:
        return {"success": False, "error": e.detail}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/api/get_models")
async def get_model_dict():
    """
    Retrieve list of Live2D models from the 'model_dict_file' defined above.

    Returns:
        JSONResponse: List of Live2D models and corresponding properties in JSON format.
        404 error if 'model_dict_file' is not found.
        500 error for further exceptions.
    """
    try:
        with open(model_dict_file, "r", encoding="utf-8") as f:
            all_models = json.load(f)

        filtered_models = []
        for m in all_models:
            name = m.get("name")
            path = m.get("file_path")
            if name and path:
                filtered_models.append({
                    "name": name,
                    "file_path": path,
                    "kScale": m.get("kScale", 0.2),
                    "xOffset": m.get("xOffset", 0),
                    "yOffset": m.get("yOffset", 0),
                    "idleMotion": m.get("idleMotion", "idle"),
                    "idleMotionCount": m.get("idleMotionCount", 1),
                    "tapMotion": m.get("tapMotion", "tap"),
                    "tapMotionCount": m.get("tapMotionCount", 1)
                })

        return JSONResponse(filtered_models)

    except FileNotFoundError:
        return JSONResponse({"error": "model_dict.json not found"}, status_code=404)
    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON format in model_dict.json"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)