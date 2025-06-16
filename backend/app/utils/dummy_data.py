"""
Dummy data generator for AI metadata when the service is unavailable
"""
import random
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Sample drawing titles and types
DRAWING_TITLES = [
    "Floor Plan - Level 1",
    "Electrical Layout - Main Distribution",
    "Site Plan - Phase 1 Development", 
    "Structural Foundation Plan",
    "HVAC System Layout",
    "Fire Safety Plan",
    "Landscape Design - Entrance",
    "Parking Layout - Section A",
    "Mechanical Room Details",
    "Emergency Exit Plan",
    "Plumbing Riser Diagram",
    "Building Elevation - North Face",
    "Cross Section - Assembly Hall",
    "Detail Drawing - Wall Assembly",
    "Roof Plan - Building Complex"
]

DRAWING_PREFIXES = ["A", "S", "E", "M", "P", "L", "FP", "C"]
REVISION_DESCRIPTIONS = [
    "Initial issue for review",
    "Updated per client comments",
    "Revised structural details",
    "Code compliance updates",
    "Design development changes",
    "Final construction documents",
    "As-built revisions",
    "Permit submission updates",
    "Contractor coordination changes",
    "Field verification updates"
]

def generate_dummy_processing_id() -> str:
    """Generate a dummy processing ID for AI service simulation"""
    return f"dummy_{uuid.uuid4().hex[:8]}"

def generate_dummy_metadata(page_number: int, filename: str = "sample.pdf") -> Dict[str, Any]:
    """
    Generate realistic dummy metadata for a PDF page
    
    Args:
        page_number: The page number (1-based)
        filename: The PDF filename for context
    
    Returns:
        Dictionary containing dummy AI metadata
    """
    
    # Generate drawing number
    prefix = random.choice(DRAWING_PREFIXES)
    number_part = f"{random.randint(100, 999)}"
    drawing_number = f"{prefix}-{number_part}"
    
    # Generate title
    title = random.choice(DRAWING_TITLES)
    if page_number > 1:
        title += f" - Sheet {page_number}"
    
    # Generate revision history (1-4 revisions)
    num_revisions = random.randint(1, 4)
    revisions = []
    
    base_date = datetime.now() - timedelta(days=random.randint(30, 365))
    
    for i in range(num_revisions):
        revision_date = base_date + timedelta(days=random.randint(0, 30))
        revisions.append({
            "revision_id": chr(65 + i),  # A, B, C, D
            "revision_description": random.choice(REVISION_DESCRIPTIONS),
            "revision_date": revision_date.strftime("%Y-%m-%d")
        })
        base_date = revision_date + timedelta(days=random.randint(1, 14))
    
    return {
        "drawing_title": title,
        "drawing_number": drawing_number,
        "revision_history": revisions,
        "confidence_score": round(random.uniform(0.75, 0.95), 2),
        "source": "dummy_data",
        "processing_time": round(random.uniform(0.5, 2.0), 2)
    }

def generate_dummy_start_response(filename: str) -> Dict[str, Any]:
    """
    Generate dummy response for AI processing start
    
    Args:
        filename: PDF filename
    
    Returns:
        Dictionary mimicking AI service start response
    """
    processing_id = generate_dummy_processing_id()
    first_page_data = generate_dummy_metadata(1, filename)
    
    return {
        "processing_id": processing_id,
        "status": "started",
        "result": first_page_data,
        "estimated_pages": random.randint(1, 20),
        "message": "Processing started with dummy data (AI service unavailable)"
    }

def generate_dummy_page_response(processing_id: str, page_number: int) -> Dict[str, Any]:
    """
    Generate dummy response for AI page processing
    
    Args:
        processing_id: The processing ID
        page_number: Page number (1-based)
    
    Returns:
        Dictionary mimicking AI service page response
    """
    
    # Simulate some processing delay for realism
    processing_time = random.uniform(0.3, 1.5)
    
    result = generate_dummy_metadata(page_number)
    
    return {
        "processing_id": processing_id,
        "page_number": page_number,
        "status": "completed",
        "result": result,
        "processing_time": round(processing_time, 2),
        "message": f"Page {page_number} processed with dummy data"
    }

def is_dummy_processing_id(processing_id: str) -> bool:
    """Check if a processing ID is from dummy data"""
    return processing_id.startswith("dummy_") 