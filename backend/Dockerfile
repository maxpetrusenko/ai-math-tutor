FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY pyproject.toml README.md /app/
COPY backend /app/backend
COPY eval /app/eval

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8080

CMD ["uvicorn", "backend.session.server:app", "--host", "0.0.0.0", "--port", "8080"]
