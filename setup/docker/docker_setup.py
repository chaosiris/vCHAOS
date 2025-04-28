import os
import subprocess
import platform

commands = [
    "docker-compose -p vchaos -f piper-compose.yaml up -d",
    "docker-compose -p vchaos -f whisper-compose.yaml up -d"
]

def is_docker_running():
    try:
        subprocess.run(["docker", "info"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError:
        return False

if not is_docker_running():
    print("- Docker is either not installed or not running. Please check and try again.")
    exit(1)

for cmd in commands:
    print(f"> Running: {cmd}")
    subprocess.run(cmd, shell=True, check=True)

print("> docker_setup.py completed successfully.")
