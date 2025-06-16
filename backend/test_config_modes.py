#!/usr/bin/env python3
"""
Test script to demonstrate different configuration modes for dummy data control
"""
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def test_config_mode(env_vars):
    """Test a specific configuration mode"""
    print(f"\n{'='*60}")
    print(f"Testing Configuration: {env_vars.get('ENVIRONMENT', 'default')}")
    print('='*60)
    
    # Set environment variables
    for key, value in env_vars.items():
        os.environ[key] = value
    
    # Import config (this will read the environment variables)
    import importlib
    if 'config' in sys.modules:
        importlib.reload(sys.modules['config'])
    
    from config import (
        ENVIRONMENT, DEBUG, ALLOW_DUMMY_DATA, FORCE_DUMMY_DATA,
        IS_PRODUCTION, validate_production_config
    )
    
    print(f"🌍 Environment: {ENVIRONMENT}")
    print(f"🔧 Debug: {DEBUG}")
    print(f"🎭 Allow Dummy Data: {ALLOW_DUMMY_DATA}")
    print(f"🎭 Force Dummy Data: {FORCE_DUMMY_DATA}")
    print(f"🏭 Is Production: {IS_PRODUCTION}")
    
    try:
        config_status = validate_production_config()
        print("✅ Configuration validation: PASSED")
        return True
    except ValueError as e:
        print(f"❌ Configuration validation: FAILED")
        print(f"   Error: {e}")
        return False

def main():
    """Test different configuration modes"""
    print("🧪 PDF Processing API - Configuration Mode Testing")
    
    # Test configurations
    test_configs = [
        {
            "name": "Development Mode",
            "env": {
                "ENVIRONMENT": "development",
                "DEBUG": "true",
                "ALLOW_DUMMY_DATA": "true",
                "FORCE_DUMMY_DATA": "false"
            }
        },
        {
            "name": "Testing Mode",
            "env": {
                "ENVIRONMENT": "testing", 
                "DEBUG": "false",
                "ALLOW_DUMMY_DATA": "true",
                "FORCE_DUMMY_DATA": "true"
            }
        },
        {
            "name": "Production Mode (Safe)",
            "env": {
                "ENVIRONMENT": "production",
                "DEBUG": "false", 
                "ALLOW_DUMMY_DATA": "false",
                "FORCE_DUMMY_DATA": "false"
            }
        },
        {
            "name": "Production Mode (UNSAFE - should fail)",
            "env": {
                "ENVIRONMENT": "production",
                "DEBUG": "false",
                "ALLOW_DUMMY_DATA": "true",  # This should cause validation to fail
                "FORCE_DUMMY_DATA": "false"
            }
        }
    ]
    
    results = []
    for config in test_configs:
        print(f"\n🧪 {config['name']}")
        success = test_config_mode(config['env'])
        results.append((config['name'], success))
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print('='*60)
    
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {name}")
    
    print(f"\n💡 Key Points:")
    print(f"   • Development: Dummy data allowed for easier development")
    print(f"   • Testing: Force dummy data for consistent test results")
    print(f"   • Production: Dummy data blocked to prevent data leaks")
    print(f"   • Configuration validation prevents unsafe production deployments")

if __name__ == "__main__":
    main() 