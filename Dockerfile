# Use an official Python runtime as a parent image
FROM python:3.13-slim

# Set the working directory
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the rest of the code
COPY . /app

# Expose the port the app runs on
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]
