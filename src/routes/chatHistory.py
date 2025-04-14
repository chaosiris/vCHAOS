# routes/chatHistory.py
import os
import re
import shutil
from fastapi import APIRouter, Query, Depends, Body, HTTPException
from fastapi.responses import JSONResponse
from routes.utils import validate_connection, secure_delete

router = APIRouter()

@router.get("/api/get_history")
async def get_chat_history(search: str = Query(default=None, description="Search query for filtering history"), _: None = Depends(validate_connection)):
    """
    Retrieve list of chat history files from the 'output' directory.

    Args:
        search (str): Parameter to filter chat history entries based on text content.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: List of chat history entries, including relevant text and audio files.
        500 error for further exceptions.
    """
    try:
        files = os.listdir("output")
        history = []

        for file in files:
            if file.endswith(".txt"):
                wav_file = file.replace(".txt", ".wav")
                if wav_file in files:
                    match = re.search(r"(\d{13})", file)
                    timestamp = int(match.group(1)) if match else int(os.path.getmtime(f"output/{file}") * 1000)

                    # Load preview text from .txt file (first 80 chars)
                    try:
                        with open(f"output/{file}", "r", encoding="utf-8") as f:
                            preview_text = f.read(80).strip()
                            if len(preview_text) == 80:
                                preview_text += "..."
                    except Exception:
                        preview_text = "Error loading text."

                    history_entry = {
                        "txt": f"/output/{file}",
                        "wav": f"/output/{wav_file}",
                        "timestamp": timestamp,
                        "preview_text": preview_text,
                    }

                    if search:
                        try:
                            with open(f"output/{file}", "r", encoding="utf-8") as f:
                                full_text = f.read().strip()
                        except Exception:
                            full_text = ""

                        if search.lower() not in full_text.lower():
                            continue  

                    history.append(history_entry)

        # Sort by timestamp (latest first)
        history.sort(key=lambda item: item["timestamp"], reverse=True)

        return JSONResponse(history)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@router.post("/api/archive_chat_history")
async def archive_chat_history(body=Body(default=None), _: None = Depends(validate_connection)):
    """
    Archive selected chat history files by moving them to the 'archived' directory.

    Args:
        body (dict): JSON request body containing filenames to be archived.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success or error message depending on the result of the operation.
    """
    filenames = body.get("filenames") if body else None
    return await process_chat_history("archive", filenames)

@router.delete("/api/delete_chat_history")
async def delete_chat_history(body=Body(default=None), _: None = Depends(validate_connection)):
    """
    Securely deletes selected chat history files.

    Args:
        body (dict): JSON request body containing filenames to be deleted.
        _: None: Validates whether request originates from an active WebSocket client.

    Returns:
        JSONResponse: Success or error message depending on the result of the operation.
    """
    filenames = body.get("filenames") if body else None
    return await process_chat_history("delete", filenames)

async def process_chat_history(action: str, filenames: list[str] = None):
    """
    Handle the archiving or deletion of chat history files.

    Args:
        action (str): Either "archive" or "delete" to determine the intended file operation.
        filenames (list[str]): List of filenames to process. If None/empty, all valid files will be processed.

    Returns:
        dict: A JSON response indicating the number of files processed and the result status.
    """
    os.makedirs("archived", exist_ok=True)
    wav_count = txt_count = 0
    valid_exts = {"wav", "txt"}
    filename_pattern = re.compile(r"^\d{19}\.(wav|txt)$")

    def is_valid_file(name):
        return re.fullmatch(filename_pattern, name) and os.path.isfile(os.path.join("output", name))

    files_to_process = filenames if filenames else [
        entry.name for entry in os.scandir("output")
        if entry.is_file() and re.fullmatch(filename_pattern, entry.name)
    ]

    for name in files_to_process:
        if not is_valid_file(name):
            continue

        ext = name.rsplit(".", 1)[-1]
        if ext not in valid_exts:
            continue

        path = os.path.join("output", name)
        try:
            if action == "archive":
                shutil.move(path, os.path.join("archived", name))
            elif action == "delete":
                secure_delete(path)

            if ext == "wav":
                wav_count += 1
            elif ext == "txt":
                txt_count += 1
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to {action} {name}: {str(e)}"
            }

    total = wav_count + txt_count
    return {
        "success": total > 0,
        "message": (
            f"{action.capitalize()}d {total} chat history files "
            f"({wav_count} .wav, {txt_count} .txt)."
            if total else f"No valid chat history files to {action}."
        )
    }