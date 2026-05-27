import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, HttpUrl


NVIDIA_GRPC_SERVER = "grpc.nvcf.nvidia.com:443"
DEFAULT_FUNCTION_ID = "b702f636-f60c-4a3d-a6f4-f3568c13bd7d"
MAX_VIDEO_BYTES = 75 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 180


class TranscribeRequest(BaseModel):
    mediaUrl: HttpUrl
    languageCode: str = "en-US"


class TranscribeResponse(BaseModel):
    transcript: str
    rawOutput: str


app = FastAPI(title="Alaws Transcriber")


@app.get("/")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "alaws-transcriber"}


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    request: TranscribeRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> TranscribeResponse:
    service_token = os.environ.get("TRANSCRIBE_SERVICE_TOKEN")

    if service_token and authorization != f"Bearer {service_token}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    api_key = os.environ.get("NVIDIA_API_KEY")

    if not api_key:
        raise HTTPException(status_code=500, detail="NVIDIA_API_KEY is not configured")

    with tempfile.TemporaryDirectory() as temp_dir:
        video_path = Path(temp_dir) / "input_media"
        audio_path = Path(temp_dir) / "audio.wav"

        await download_media(str(request.mediaUrl), video_path)
        extract_audio(video_path, audio_path)
        raw_output = run_whisper(audio_path, api_key, request.languageCode)
        transcript = clean_transcript(raw_output)

        if not transcript:
            raise HTTPException(status_code=502, detail="Whisper returned no transcript")

        return TranscribeResponse(transcript=transcript, rawOutput=raw_output)


async def download_media(media_url: str, output_path: Path) -> None:
    total = 0

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True) as client:
        async with client.stream("GET", media_url) as response:
            response.raise_for_status()

            with output_path.open("wb") as file:
                async for chunk in response.aiter_bytes():
                    total += len(chunk)

                    if total > MAX_VIDEO_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail="Video is too large for transcription",
                        )

                    file.write(chunk)


def extract_audio(video_path: Path, audio_path: Path) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        str(audio_path),
    ]
    run_command(command, "Could not extract audio from video")


def run_whisper(audio_path: Path, api_key: str, language_code: str) -> str:
    function_id = os.environ.get("NVIDIA_WHISPER_FUNCTION_ID", DEFAULT_FUNCTION_ID)
    script_path = (
        Path(os.environ.get("RIVA_CLIENT_DIR", "/opt/riva-python-clients"))
        / "scripts"
        / "asr"
        / "transcribe_file_offline.py"
    )
    command = [
        "python",
        str(script_path),
        "--server",
        NVIDIA_GRPC_SERVER,
        "--use-ssl",
        "--metadata",
        "function-id",
        function_id,
        "--metadata",
        "authorization",
        f"Bearer {api_key}",
        "--language-code",
        language_code,
        "--automatic-punctuation",
        "--input-file",
        str(audio_path),
    ]

    return run_command(command, "NVIDIA Whisper transcription failed")


def run_command(command: list[str], error_message: str) -> str:
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or error_message).strip()
        raise HTTPException(status_code=502, detail=detail[:1000]) from error
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=504, detail=error_message) from error

    return (result.stdout or result.stderr or "").strip()


def clean_transcript(output: str) -> str:
    lines = []

    for line in output.splitlines():
        stripped = line.strip()

        if not stripped:
            continue

        if stripped.lower().startswith(("timestamps", "confidence", "final")):
            continue

        stripped = re.sub(r"^\[\d+(?:\.\d+)?s?\s*-\s*\d+(?:\.\d+)?s?\]\s*", "", stripped)
        lines.append(stripped)

    return " ".join(lines).strip()
