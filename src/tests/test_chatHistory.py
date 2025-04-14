# tests/test_chatHistory.py
import os
import pytest
import json
import shutil
import asyncio
from unittest.mock import mock_open, patch, MagicMock
from routes import chatHistory, utils

# Test GET /api/get_chat_history
def test_get_chat_history(client, setup_websocket):
    """Test successful retrieval of chat history"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("builtins.open", new_callable=mock_open, read_data="This is a chat preview..."):

        response = client.get("/api/get_history")

        assert response.status_code == 200
        history = response.json()

        assert len(history) == 1
        assert history[0]["txt"] == "/output/1234567890123456789.txt"
        assert history[0]["wav"] == "/output/1234567890123456789.wav"
        assert "preview_text" in history[0]

def test_get_chat_history_preview_truncation(client, setup_websocket):
    """Test that long preview texts are correctly truncated with '...'"""
    mock_text = "a" * 80
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("builtins.open", mock_open(read_data=mock_text)):

        response = client.get("/api/get_history")
        history = response.json()

    assert response.status_code == 200
    assert history[0]["preview_text"].endswith("...")

def test_get_chat_history_oserror(client, setup_websocket):
    """Test API response when an OSError occurs when getting chat history"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("builtins.open", side_effect=OSError("File read error")):

        response = client.get("/api/get_history")
    
    assert response.status_code == 200
    assert response.json()[0]["preview_text"] == "Error loading text."

def test_get_chat_history_exception(client, setup_websocket):
    """Test API response when an exception occurs"""
    with patch("os.listdir", side_effect=Exception("Unexpected error")):
        response = client.get("/api/get_history")
    
    assert response.status_code == 500
    assert "error" in response.json()

def test_get_chat_history_search(client, setup_websocket):
    """Test filtering chat history using a search query"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("builtins.open", mock_open(read_data="This chat contains the keyword search")):

        response = client.get("/api/get_history?search=keyword")

        assert response.status_code == 200
        history = response.json()

        assert len(history) == 1
        assert "keyword" in history[0]["preview_text"]

def test_get_chat_history_search_oserror(client, setup_websocket):
    """Test API response when an OSError occurs during search filtering"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("builtins.open", side_effect=OSError("File read error")):

        response = client.get("/api/get_history?search=test")
    
    assert response.status_code == 200
    assert len(response.json()) == 0

# Test POST /api/archive_chat_history
def test_archive_chat_history(client, setup_websocket):
    """Test archiving chat history successfully"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("os.path.isfile", return_value=True), \
         patch("os.scandir") as mock_scandir, \
         patch("shutil.move") as mock_move:

        response = client.post("/api/archive_chat_history", json={"filenames": ["1234567890123456789.txt", "1234567890123456789.wav"]})
        print(response.json())
        assert response.status_code == 200
        assert "Archived" in response.json()["message"]
        expected_txt_path = os.path.normpath("output/1234567890123456789.txt")
        expected_archived_txt_path = os.path.normpath("archived/1234567890123456789.txt")
        expected_wav_path = os.path.normpath("output/1234567890123456789.wav")
        expected_archived_wav_path = os.path.normpath("archived/1234567890123456789.wav")
        mock_move.assert_any_call(expected_txt_path, expected_archived_txt_path)
        mock_move.assert_any_call(expected_wav_path, expected_archived_wav_path)

# Test DELETE /api/delete_chat_history
def test_delete_chat_history(client, setup_websocket):
    """Test deleting chat history successfully"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("os.path.isfile", return_value=True), \
         patch("os.scandir") as mock_scandir, \
         patch("routes.utils.secure_delete") as mock_delete:

        response = client.request("DELETE", "/api/delete_chat_history", json={"filenames": ["1234567890123456789.txt", "1234567890123456789.wav"]})
        assert response.status_code == 200
        assert "Deleted" in response.json()["message"]

# Test process_chat_history()
@pytest.mark.asyncio
async def test_process_chat_history():
    """Test archiving chat history when filenames are explicitly provided"""
    with patch("os.listdir", return_value=["1234567890123456789.txt", "1234567890123456789.wav"]), \
         patch("os.path.isfile", return_value=True), \
         patch("os.scandir") as mock_scandir, \
         patch("shutil.move") as mock_move:

        filenames = ["1234567890123456789.txt", "1234567890123456789.wav"]
        response = await chatHistory.process_chat_history("archive", filenames)

        assert response["success"] is True
        assert "Archived" in response["message"]

@pytest.mark.asyncio
async def test_process_chat_history_invalid():
    """Test that files with invalid regex/extensions are skipped"""
    filenames = ["1234567890123456789.txt", "1234567890123456789.mp3"]
    with patch("os.scandir") as mock_scandir, \
         patch("os.path.isfile", return_value=True), \
         patch("shutil.move") as mock_move:

        response = await chatHistory.process_chat_history("archive", filenames)

        assert response["success"] is True
        assert "Archived 1 chat history files" in response["message"]

@pytest.mark.asyncio
async def test_process_chat_history_no_valid_files():
    """Test API response when no valid files exist to process"""
    filenames = ["invalid.txt", "not_a_real_file.wav"]
    response = await chatHistory.process_chat_history("archive", filenames)
    assert response["success"] is False
    assert response["message"] == "No valid chat history files to archive."

@pytest.mark.asyncio
async def test_process_chat_history_exception():
    """Test API response when an exception occurs"""
    filenames = ["1234567890123456789.txt", "1234567890123456789.wav"]
    with patch("os.scandir") as mock_scandir, \
         patch("os.path.isfile", return_value=True), \
         patch("shutil.move", side_effect=Exception("Archive failed")) as mock_move:

        response = await chatHistory.process_chat_history("archive", filenames)
        assert response["success"] is False
        assert "Failed to archive" in response["error"]

# Test secure_delete()
@pytest.fixture
def temp_file():
    """Create a temporary file for testing secure_delete()"""
    test_file = "test_secure_delete.txt"
    with open(test_file, "w") as f:
        f.write("Sensitive Data")
    
    yield test_file
    
    if os.path.exists(test_file):
        os.remove(test_file)

def test_secure_delete_file_exists(temp_file):
    """Test if secure_delete() properly deletes a file"""
    
    assert os.path.exists(temp_file)
    
    utils.secure_delete(temp_file)
    
    assert not os.path.exists(temp_file)

def test_secure_delete_oserror(temp_file):
    """Test if secure_delete() correctly handles an OSError exception"""
    with patch("builtins.open", side_effect=OSError("File modification error")), \
         patch("builtins.print") as mock_print:
        utils.secure_delete(temp_file)
    
    mock_print.assert_called_with(f"Error securely deleting {temp_file}: File modification error")