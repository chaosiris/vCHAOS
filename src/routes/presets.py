# routes/presets.py
import os
import json
from fastapi import APIRouter, Request, Depends, Query, Body, HTTPException
from fastapi.responses import JSONResponse
from routes.utils import validate_connection

router = APIRouter()
preset_file = "presets.json"

@router.get("/api/get_presets")
async def get_presets(_: None = Depends(validate_connection)):
    """
    Retrieve list of presets from the 'preset_file' defined above.

    Args:
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: List of presets in JSON format.
        500 error if JSON file is invalid, missing, or any further exceptions.
    """
    try:
        if not os.path.exists(preset_file):
            return JSONResponse([], status_code=200)

        with open(preset_file, "r", encoding="utf-8") as f:
            presets = json.load(f)

        if not isinstance(presets, list):
            return JSONResponse([], status_code=200)

        return JSONResponse(presets)

    except json.JSONDecodeError:
        return JSONResponse({"error": "Invalid JSON format"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/api/save_preset")
async def save_preset(request: Request, _: None = Depends(validate_connection)):
    """
    Save a new preset or update an existing preset.

    Args:
        request (Request): JSON request body containing preset details.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success message if the preset is saved.
        400 error if required fields are missing.
        500 error for further exceptions.
    """
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        prompt = data.get("prompt", "").strip()

        if not name or not prompt:
            return JSONResponse({"success": False, "error": "Both name and prompt are required."}, status_code=400)

        # Input sanitization
        name = name.replace("<", "&lt;").replace(">", "&gt;").replace("=", "&#x3D;")
        prompt = prompt.replace("<", "&lt;").replace(">", "&gt;").replace("=", "&#x3D;")

        if not os.path.exists(preset_file):
            with open(preset_file, "w", encoding="utf-8") as f:
                json.dump([], f)

        with open(preset_file, "r", encoding="utf-8") as f:
            try:
                presets = json.load(f)
                if not isinstance(presets, list):
                    presets = []
            except json.JSONDecodeError:
                presets = []

        existing_preset = next((p for p in presets if p["name"] == name), None)

        if existing_preset:
            existing_preset["prompt"] = prompt
        else:
            presets.append({"name": name, "prompt": prompt})

        with open(preset_file, "w", encoding="utf-8") as f:
            json.dump(presets, f, indent=4)

        return {"success": True, "message": "Preset saved successfully"}

    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

@router.post("/api/delete_presets")
async def delete_presets(request: Request, _: None = Depends(validate_connection)):
    """
    Delete selected or all presets from 'preset_file' defined above.

    Args:
        request (Request): JSON request body containing name(s) of presets to be deleted.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success message if deletion is successful.
        404 error if 'preset_file' is missing or the specified preset name does not exist.
        500 error for further exceptions.
    """
    try:
        data = await request.json()
        names_to_delete = data.get("names", [])

        if not os.path.exists(preset_file):
            return JSONResponse({"success": False, "error": "Preset file not found"}, status_code=404)

        with open(preset_file, "r", encoding="utf-8") as f:
            try:
                presets = json.load(f)
                if not isinstance(presets, list):
                    presets = []
            except json.JSONDecodeError:
                presets = []

        if not names_to_delete:
            filtered_presets = []
        else:
            sanitized_names_to_delete = [name.replace("<", "&lt;").replace(">", "&gt;").replace("=", "&#x3D;") for name in names_to_delete]

            filtered_presets = [
                preset for preset in presets
                if preset["name"].lower() not in [n.lower() for n in sanitized_names_to_delete]
            ]

        if len(filtered_presets) == len(presets):
            return JSONResponse({"success": False, "error": "No matching presets found."}, status_code=404)

        with open(preset_file, "w", encoding="utf-8") as f:
            json.dump(filtered_presets, f, indent=4)

        total = len(presets) - len(filtered_presets)
        total_suffix = "preset" if total == 1 else "presets"

        return {"success": True, "message": f"Deleted {total} {total_suffix} successfully."}

    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)