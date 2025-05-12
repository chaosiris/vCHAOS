"""Event handler for clients of the server."""
import argparse
import json
import logging
import math
import os
import wave
import shutil
import http.client
import ssl
from typing import Any, Dict, Optional

from wyoming.audio import AudioChunk, AudioStart, AudioStop
from wyoming.event import Event
from wyoming.info import Describe, Info
from wyoming.server import AsyncEventHandler
from wyoming.tts import Synthesize

from .process import PiperProcessManager

_LOGGER = logging.getLogger(__name__)
_cached_settings = None
_last_mtime = None

def load_backend_app_settings(filepath="/settings.yaml"):
    global _cached_settings, _last_mtime

    try:
        mtime = os.path.getmtime(filepath)
        if _cached_settings is not None and _last_mtime == mtime:
            return _cached_settings

        result = {
            "host": "host.docker.internal",
            "port": 11405,
            "protocol": "http",
            "multicast": False
        }

        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()

        inside_backend = False
        inside_app = False
        indent_level = None

        for line in lines:
            if not line.strip() or line.strip().startswith("#"):
                continue

            if line.strip().startswith("backend:"):
                inside_backend = True
                continue

            if inside_backend and line.strip().startswith("app:"):
                inside_app = True
                indent_level = len(line) - len(line.lstrip())
                continue

            if inside_app:
                if len(line) - len(line.lstrip()) <= indent_level:
                    break

                key, _, value = line.partition(":")
                key = key.strip()
                value = value.split("#", 1)[0].strip().strip('"').strip("'")

                if key == "host":
                    result["host"] = value
                elif key == "port":
                    try:
                        result["port"] = int(value)
                    except ValueError:
                        pass
                elif key == "protocol":
                    result["protocol"] = value.lower()
                elif key == "multicast":
                    result["multicast"] = value.lower() == "true"

        _cached_settings = result
        _last_mtime = mtime
        return result

    except Exception as e:
        print(f"Error reading settings.yaml: {e}")
        return {
            "host": "host.docker.internal",
            "port": 11405,
            "protocol": "http",
            "multicast": False
        }

class PiperEventHandler(AsyncEventHandler):
    def __init__(
        self,
        wyoming_info: Info,
        cli_args: argparse.Namespace,
        process_manager: PiperProcessManager,
        *args,
        **kwargs,
    ) -> None:
        super().__init__(*args, **kwargs)

        self.cli_args = cli_args
        self.wyoming_info_event = wyoming_info.event()
        self.process_manager = process_manager

    async def handle_event(self, event: Event) -> bool:
        if Describe.is_type(event.type):
            await self.write_event(self.wyoming_info_event)
            _LOGGER.debug("Sent info")
            return True

        if not Synthesize.is_type(event.type):
            _LOGGER.warning("Unexpected event: %s", event)
            return True

        synthesize = Synthesize.from_event(event)
        _LOGGER.debug(synthesize)

        raw_text = synthesize.text
        text = " ".join(raw_text.strip().splitlines())

        if self.cli_args.auto_punctuation and text:
            if text[-1] not in self.cli_args.auto_punctuation:
                text += self.cli_args.auto_punctuation[0]

        async with self.process_manager.processes_lock:
            _LOGGER.debug("synthesize: raw_text=%s, text='%s'", raw_text, text)
            voice_name = None
            voice_speaker = None
            if synthesize.voice is not None:
                voice_name = synthesize.voice.name
                voice_speaker = synthesize.voice.speaker

            piper_proc = await self.process_manager.get_process(voice_name=voice_name)
            assert piper_proc.proc.stdin is not None
            assert piper_proc.proc.stdout is not None

            input_obj = {"text": text}
            if voice_speaker is not None:
                speaker_id = piper_proc.get_speaker_id(voice_speaker)
                if speaker_id is not None:
                    input_obj["speaker_id"] = speaker_id
                else:
                    _LOGGER.warning("No speaker '%s' for voice '%s'", voice_speaker, voice_name)

            _LOGGER.debug("input: %s", input_obj)
            piper_proc.proc.stdin.write((json.dumps(input_obj, ensure_ascii=False) + "\n").encode())
            await piper_proc.proc.stdin.drain()

            output_path = (await piper_proc.proc.stdout.readline()).decode().strip()
            _LOGGER.debug(output_path)

        client_count = 0
        backend_settings = load_backend_app_settings()
        protocol = backend_settings["protocol"]
        host = backend_settings["host"]
        multicast = backend_settings["multicast"]
        if (host == "0.0.0.0" or host == "127.0.0.1"):
            host = "host.docker.internal"
        port = backend_settings["port"]

        try:
            if protocol == "https":
                context = ssl._create_unverified_context()
                conn = http.client.HTTPSConnection(host, port, context=context)
            else:
                conn = http.client.HTTPConnection(host, port)

            conn.request("GET", "/api/client_count")
            response = conn.getresponse()

            if response.status == 200:
                data = response.read()
                result = json.loads(data.decode())
                client_count = result.get("count", 0)

        except Exception as e:
            _LOGGER.warning(f"Unable to contact backend: {e}")

        if client_count != 0:
            # Define output directory
            destination_dir = "/output"
            text_output_path = os.path.join(destination_dir, os.path.basename(output_path).replace(".wav", ".txt"))

            with open(text_output_path, "w", encoding="utf-8") as text_file:
                text_file.write(text)
                _LOGGER.info(f"Saved Ollama output text to {text_output_path}")

            destination_path = os.path.join(destination_dir, os.path.basename(output_path))
            os.makedirs(destination_dir, exist_ok=True)
            if multicast:
                shutil.copy(output_path, destination_path)
                _LOGGER.info(f"Copied .wav file to {destination_path}")
            else:
                shutil.move(output_path, destination_path)
                _LOGGER.info(f"Moved .wav file to {destination_path}")

            # Notify FastAPI backend
            self.notify_backend(destination_path)

            # Generate an empty placeholder `.wav` file
            if not multicast:
                with open(output_path, "wb") as empty_wav:
                    empty_wav.write(
                        b"RIFF" b"\x2C\x00\x00\x00" b"WAVE" b"fmt " b"\x10\x00\x00\x00"
                        b"\x01\x00" b"\x01\x00" b"\x22\x56\x00\x00" b"\x44\xAC\x00\x00"
                        b"\x02\x00" b"\x10\x00" b"data" b"\x00\x00\x00\x00"
                    )

        wav_file: wave.Wave_read = wave.open(output_path, "rb")
        with wav_file:
            rate = wav_file.getframerate()
            width = wav_file.getsampwidth()
            channels = wav_file.getnchannels()

            await self.write_event(AudioStart(rate=rate, width=width, channels=channels).event())

            audio_bytes = wav_file.readframes(wav_file.getnframes())
            bytes_per_sample = width * channels
            bytes_per_chunk = bytes_per_sample * self.cli_args.samples_per_chunk
            num_chunks = int(math.ceil(len(audio_bytes) / bytes_per_chunk))

            for i in range(num_chunks):
                offset = i * bytes_per_chunk
                chunk = audio_bytes[offset: offset + bytes_per_chunk]
                await self.write_event(AudioChunk(audio=chunk, rate=rate, width=width, channels=channels).event())

        await self.write_event(AudioStop().event())
        _LOGGER.info("Completed request")

        os.unlink(output_path)
        return True

    def notify_backend(self, audio_path: str):
        """Writes a notification file to signal the FastAPI backend."""
        notification_file = "/output/new_audio.json"
        message = {"type": "new_audio", "audio_file": f"/output/{os.path.basename(audio_path)}"}
        
        try:
            with open(notification_file, "w", encoding="utf-8") as f:
                json.dump(message, f)
            _LOGGER.info(f"Wrote notification file: {notification_file}")
        except Exception as e:
            _LOGGER.error(f"Failed to write notification file: {e}")
