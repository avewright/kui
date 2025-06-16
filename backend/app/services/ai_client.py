"""
AI Client Service with fallback to dummy data
"""
import asyncio
import httpx
from typing import Dict, Any, Optional
from ..utils.logging import get_logger
from ..utils.dummy_data import (
    generate_dummy_start_response,
    generate_dummy_page_response,
    is_dummy_processing_id
)

# Import config at module level to avoid circular imports
try:
    from config import ALLOW_DUMMY_DATA, FORCE_DUMMY_DATA, IS_PRODUCTION
except ImportError:
    # Fallback defaults if config not available
    ALLOW_DUMMY_DATA = True
    FORCE_DUMMY_DATA = False
    IS_PRODUCTION = False

logger = get_logger("ai_client")

class AIServiceClient:
    """Client for interacting with AI service with fallback to dummy data"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:5000", timeout: float = 30.0):
        self.base_url = base_url
        self.timeout = timeout
        self._service_available: Optional[bool] = None
        
    async def check_service_health(self) -> bool:
        """Check if the AI service is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                available = response.status_code == 200
                
            if available != self._service_available:
                if available:
                    logger.info("✅ AI service is available")
                else:
                    logger.warning("⚠️ AI service health check failed but service responded")
                    
            self._service_available = available
            return available
            
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            if self._service_available is not False:
                logger.warning(f"🔌 AI service unavailable: {type(e).__name__}")
                logger.info("📋 Falling back to dummy data for development")
                
            self._service_available = False
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error checking AI service: {e}")
            self._service_available = False
            return False
    
    async def start_processing(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Start AI processing for a PDF file
        
        Args:
            file_content: PDF file content as bytes
            filename: Original filename
            
        Returns:
            Processing start response with processing_id and first page result
        """
        logger.info(f"🚀 Starting AI processing for: {filename}")
        
        # Check if we should force dummy data
        if FORCE_DUMMY_DATA:
            logger.info("🎭 FORCE_DUMMY_DATA=true - using dummy data")
            dummy_response = generate_dummy_start_response(filename)
            logger.debug(f"Generated dummy processing_id: {dummy_response['processing_id']}")
            return dummy_response
        
        # Check service availability
        service_available = await self.check_service_health()
        
        if not service_available:
            if not ALLOW_DUMMY_DATA:
                if IS_PRODUCTION:
                    logger.error("🚨 AI service unavailable in PRODUCTION and dummy data is disabled!")
                    raise RuntimeError("AI service required in production but unavailable")
                else:
                    logger.error("❌ AI service unavailable and dummy data is disabled")
                    raise RuntimeError("AI service unavailable and dummy data fallback disabled")
            
            logger.info("📋 Using dummy data - AI service unavailable")
            dummy_response = generate_dummy_start_response(filename)
            logger.debug(f"Generated dummy processing_id: {dummy_response['processing_id']}")
            return dummy_response
        
        # Try real AI service
        try:
            files = {"file": (filename, file_content, "application/pdf")}
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                logger.debug(f"🔗 Sending request to {self.base_url}/tbe/sequential/start")
                response = await client.post(
                    f"{self.base_url}/tbe/sequential/start",
                    files=files
                )
            
            if response.status_code == 200:
                ai_data = response.json()
                logger.info(f"✅ AI processing started successfully: {ai_data.get('processing_id', 'unknown')}")
                return ai_data
            else:
                logger.warning(f"⚠️ AI service returned {response.status_code}: {response.text}")
                if ALLOW_DUMMY_DATA:
                    logger.info("📋 Falling back to dummy data")
                    return generate_dummy_start_response(filename)
                else:
                    raise RuntimeError(f"AI service error: {response.status_code} - {response.text}")
                
        except httpx.TimeoutException:
            if ALLOW_DUMMY_DATA:
                logger.warning("⏱️ AI service timeout on start - using dummy data")
                return generate_dummy_start_response(filename)
            else:
                raise RuntimeError("AI service timeout and dummy data fallback disabled")
        except httpx.ConnectError:
            if ALLOW_DUMMY_DATA:
                logger.warning("🔌 AI service connection failed - using dummy data")
                return generate_dummy_start_response(filename)
            else:
                raise RuntimeError("AI service connection failed and dummy data fallback disabled")
        except Exception as e:
            if ALLOW_DUMMY_DATA:
                logger.error(f"❌ Unexpected error calling AI service: {e}")
                logger.info("📋 Falling back to dummy data")
                return generate_dummy_start_response(filename)
            else:
                raise RuntimeError(f"AI service error: {e}")
    
    async def get_page_metadata(self, processing_id: str, page_number: int) -> Dict[str, Any]:
        """
        Get AI metadata for a specific page
        
        Args:
            processing_id: Processing ID from start_processing
            page_number: Page number (1-based)
            
        Returns:
            Page metadata response
        """
        logger.debug(f"📄 Getting metadata for page {page_number} (ID: {processing_id[:8]}...)")
        
        # Check if this is dummy data
        if is_dummy_processing_id(processing_id):
            logger.debug("📋 Using dummy data for page metadata")
            # Simulate processing delay
            await asyncio.sleep(0.1)
            return generate_dummy_page_response(processing_id, page_number)
        
        # Check service availability
        service_available = await self.check_service_health()
        
        if not service_available:
            if not ALLOW_DUMMY_DATA:
                if IS_PRODUCTION:
                    logger.error("🚨 AI service unavailable in PRODUCTION and dummy data is disabled!")
                    raise RuntimeError("AI service required in production but unavailable")
                else:
                    logger.error("❌ AI service unavailable and dummy data is disabled")
                    raise RuntimeError("AI service unavailable and dummy data fallback disabled")
            
            logger.info("📋 AI service unavailable - returning dummy data")
            return generate_dummy_page_response(processing_id, page_number)
        
        # Try real AI service with polling
        poll_delay = 2
        max_wait_seconds = 300
        deadline = asyncio.get_event_loop().time() + max_wait_seconds
        
        attempt = 1
        while asyncio.get_event_loop().time() < deadline:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(
                        f"{self.base_url}/tbe/sequential/{processing_id}/{page_number}"
                    )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"✅ Page {page_number} metadata received (attempt {attempt})")
                    return result
                
                elif response.status_code == 404:
                    # Page not ready - wait and retry
                    logger.debug(f"⏳ Page {page_number} not ready, attempt {attempt} - waiting {poll_delay}s")
                    await asyncio.sleep(poll_delay)
                    attempt += 1
                    continue
                
                elif response.status_code in [422, 503]:
                    # Service error - fallback to dummy data
                    error_msg = response.text if response.status_code == 422 else "Service unavailable"
                    logger.warning(f"⚠️ AI service error ({response.status_code}): {error_msg}")
                    if ALLOW_DUMMY_DATA:
                        logger.info("📋 Falling back to dummy data")
                        return generate_dummy_page_response(processing_id, page_number)
                    else:
                        raise RuntimeError(f"AI service error: {error_msg}")
                
                else:
                    logger.warning(f"⚠️ Unexpected AI service response: {response.status_code}")
                    if ALLOW_DUMMY_DATA:
                        return generate_dummy_page_response(processing_id, page_number)
                    else:
                        raise RuntimeError(f"Unexpected AI service response: {response.status_code}")
                    
            except httpx.TimeoutException:
                logger.warning(f"⏱️ Timeout getting page {page_number} metadata (attempt {attempt})")
                if asyncio.get_event_loop().time() >= deadline:
                    break
                await asyncio.sleep(poll_delay)
                attempt += 1
                continue
                
            except Exception as e:
                logger.error(f"❌ Error getting page {page_number} metadata: {e}")
                if asyncio.get_event_loop().time() >= deadline:
                    break
                await asyncio.sleep(poll_delay)
                attempt += 1
                continue
        
        # Timeout reached - fallback to dummy data
        logger.warning(f"⏱️ AI processing timeout for page {page_number} after {max_wait_seconds}s")
        if ALLOW_DUMMY_DATA:
            logger.info("📋 Using dummy data as fallback")
            return generate_dummy_page_response(processing_id, page_number)
        else:
            raise RuntimeError(f"AI processing timeout for page {page_number} and dummy data fallback disabled")

# Global AI client instance
ai_client = AIServiceClient() 