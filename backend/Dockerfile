FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PORT=8080

WORKDIR /app

COPY pyproject.toml README.md /app/
COPY backend /app/backend
COPY eval /app/eval

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --retries "$PIP_RETRIES" --timeout "$PIP_DEFAULT_TIMEOUT" --upgrade pip \
    && pip install --no-cache-dir --retries "$PIP_RETRIES" --timeout "$PIP_DEFAULT_TIMEOUT" .

EXPOSE 8080

CMD ["uvicorn", "backend.session.server:app", "--host", "0.0.0.0", "--port", "8080"]
