FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV RIVA_CLIENT_DIR=/opt/riva-python-clients

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && git clone --depth 1 https://github.com/nvidia-riva/python-clients.git "$RIVA_CLIENT_DIR"

COPY app.py .

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
