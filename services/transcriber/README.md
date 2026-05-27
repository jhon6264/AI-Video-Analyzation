# Alaws Transcriber

Railway service for extracting audio from uploaded videos and transcribing it with NVIDIA NIM `openai/whisper-large-v3`.

## Railway settings

Deploy this folder as a separate Railway service:

```text
Root Directory: services/transcriber
```

Environment variables:

```text
NVIDIA_API_KEY=your_nvidia_whisper_key
TRANSCRIBE_SERVICE_TOKEN=optional_shared_secret
NVIDIA_WHISPER_FUNCTION_ID=b702f636-f60c-4a3d-a6f4-f3568c13bd7d
```

`NVIDIA_WHISPER_FUNCTION_ID` is optional because the service has the current Whisper Large V3 function id as a default.

## API

```http
POST /transcribe
Content-Type: application/json
Authorization: Bearer <TRANSCRIBE_SERVICE_TOKEN>

{
  "mediaUrl": "https://worker.example.com/api/media/uploads/video.mp4",
  "languageCode": "en-US"
}
```

Response:

```json
{
  "transcript": "transcribed speech",
  "rawOutput": "raw NVIDIA Riva output"
}
```
