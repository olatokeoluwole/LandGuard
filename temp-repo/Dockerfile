FROM python:3.10-slim

WORKDIR /app

# Ensure we have the latest pip
RUN pip install --upgrade pip

# Copy ONLY the requirements file first (this helps with caching)
COPY requirements.txt .

# Force a clean install of everything in the text file
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code
COPY . .

# Start the application 
CMD uvicorn api:app --host 0.0.0.0 --port ${PORT:-8080}
