#!/usr/bin/env python3
"""
Test script to demonstrate logging and dummy data functionality
"""
import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.utils.logging import setup_logging, get_logger
from app.utils.dummy_data import (
    generate_dummy_start_response,
    generate_dummy_page_response,
    is_dummy_processing_id
)
from app.services.ai_client import AIServiceClient

async def test_logging():
    """Test the logging functionality"""
    print("🧪 Testing Logging System")
    print("=" * 50)
    
    # Setup logging
    logger = setup_logging(level="DEBUG", log_to_console=True, log_to_file=False)
    
    # Test different log levels
    logger.debug("🔍 This is a debug message")
    logger.info("ℹ️ This is an info message")
    logger.warning("⚠️ This is a warning message")
    logger.error("❌ This is an error message")
    logger.critical("💥 This is a critical message")
    
    # Test specific loggers
    ai_logger = get_logger("ai_client")
    ai_logger.info("🤖 AI client logger test")
    
    pdf_logger = get_logger("pdf_processor")
    pdf_logger.info("📄 PDF processor logger test")

async def test_dummy_data():
    """Test the dummy data generation"""
    print("\n🧪 Testing Dummy Data Generation")
    print("=" * 50)
    
    logger = get_logger("test")
    
    # Test dummy start response
    logger.info("Generating dummy start response...")
    start_response = generate_dummy_start_response("test_document.pdf")
    logger.info(f"Processing ID: {start_response['processing_id']}")
    logger.info(f"First page title: {start_response['result']['drawing_title']}")
    
    # Test dummy page response
    processing_id = start_response['processing_id']
    logger.info(f"Generating dummy page response for page 2...")
    page_response = generate_dummy_page_response(processing_id, 2)
    logger.info(f"Page 2 title: {page_response['result']['drawing_title']}")
    
    # Test ID checking
    logger.info(f"Is dummy ID: {is_dummy_processing_id(processing_id)}")

async def test_ai_client():
    """Test the AI client with fallback"""
    print("\n🧪 Testing AI Client with Fallback")
    print("=" * 50)
    
    logger = get_logger("test")
    
    # Create AI client
    ai_client = AIServiceClient()
    
    # Test health check (should fail since no AI service running)
    logger.info("Testing AI service health check...")
    health = await ai_client.check_service_health()
    logger.info(f"AI service available: {health}")
    
    # Test start processing (should fallback to dummy data)
    logger.info("Testing start processing with fallback...")
    fake_pdf_content = b"fake pdf content for testing"
    result = await ai_client.start_processing(fake_pdf_content, "test.pdf")
    logger.info(f"Start processing result: {result['status']}")
    logger.info(f"Processing ID: {result['processing_id']}")
    
    # Test get page metadata
    logger.info("Testing page metadata retrieval...")
    processing_id = result['processing_id']
    page_result = await ai_client.get_page_metadata(processing_id, 1)
    logger.info(f"Page metadata result: {page_result['status']}")

async def main():
    """Run all tests"""
    print("🚀 PDF Processing API - Logging & Dummy Data Test")
    print("=" * 60)
    
    await test_logging()
    await test_dummy_data()
    await test_ai_client()
    
    print("\n✅ All tests completed!")
    print("📝 Check the logs/ directory for log files")

if __name__ == "__main__":
    asyncio.run(main()) 