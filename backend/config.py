"""Configuration settings for the PDF Processing API"""

import os
from typing import List

# Server Configuration
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8080"))

# Environment Detection
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT in ["production", "prod"]
IS_DEVELOPMENT = ENVIRONMENT in ["development", "dev", "local"]

# AI Service Configuration
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:5000")
AI_SERVICE_TIMEOUT = int(os.getenv("AI_SERVICE_TIMEOUT", "30"))

# Dummy Data Configuration
# In development, allow dummy data by default; in production, require explicit setting
ALLOW_DUMMY_DATA = os.getenv("ALLOW_DUMMY_DATA", "true" if not IS_PRODUCTION else "false").lower() == "true"
FORCE_DUMMY_DATA = os.getenv("FORCE_DUMMY_DATA", "false").lower() == "true"

# CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",  # Alternative dev port
]

# File Processing Configuration
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
SUPPORTED_FORMATS = ["pdf"]

# PDF Processing Configuration
PDF_IMAGE_DPI = 150  # Quality for PDF to image conversion
PDF_IMAGE_FORMAT = "PNG"

def validate_production_config():
    """Validate configuration for production safety"""
    if IS_PRODUCTION:
        if ALLOW_DUMMY_DATA:
            raise ValueError(
                "🚨 PRODUCTION SAFETY ERROR: Dummy data is enabled in production! "
                "Set ALLOW_DUMMY_DATA=false or ENVIRONMENT=production"
            )
        if DEBUG:
            print("⚠️  WARNING: Debug mode is enabled in production!")
    
    # Log configuration status
    config_status = {
        "environment": ENVIRONMENT,
        "debug": DEBUG,
        "allow_dummy_data": ALLOW_DUMMY_DATA,
        "force_dummy_data": FORCE_DUMMY_DATA,
        "ai_service_url": AI_SERVICE_URL
    }
    return config_status