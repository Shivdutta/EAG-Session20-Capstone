# syntax=docker/dockerfile:1
FROM python:3.12-slim

# Faster Python & unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# If you have local packages (e.g., sip_ui_binding/) importable from root
ENV PYTHONPATH=/app:${PYTHONPATH}

WORKDIR /app

# 1) Install deps first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 2) Copy all app code (fastapi_sip_service.py + any packages) into /app
COPY . .

EXPOSE 8000

# 3) Start FastAPI (entry file is at repo root)
CMD ["uvicorn", "fastapi_sip_service:app", "--host", "0.0.0.0", "--port", "8000"]
