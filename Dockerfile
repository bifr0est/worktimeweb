# Use an official Python runtime as a parent image
FROM python:3.13-alpine

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1 
ENV PYTHONUNBUFFERED 1      
ENV FLASK_APP=app:app       
ENV FLASK_DEBUG=0           
ENV TIMEZONE=Europe/Vienna  

# Set the working directory in the container
WORKDIR /app

# Install Python dependencies
# Copy only requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose the port the app runs on (should match Gunicorn command)
EXPOSE 5000

# Command to run the application using Gunicorn
# Increase workers based on your server's CPU cores if needed (e.g., workers = cpu_cores * 2 + 1)
CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:5000", "app:app"]