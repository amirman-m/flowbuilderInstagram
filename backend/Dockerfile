FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .

# Install PyTorch CPU version explicitly
RUN pip install --no-cache-dir torch==2.8.0 

# Install other dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy model download script first to leverage Docker cache
COPY download_model.py .

# Pre-download the language detection model during build
#RUN python download_model.py

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
