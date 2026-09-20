# Use official lightweight Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5173

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN prisma generate

# Copy application files
COPY server.py .
COPY dashboard/ ./dashboard/
COPY data/ ./data/

# Expose port
EXPOSE 5173

# Run production WSGI server
CMD ["sh", "-c", "gunicorn -w 2 -b 0.0.0.0:${PORT:-5173} server:app"]
