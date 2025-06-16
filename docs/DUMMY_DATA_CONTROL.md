# 🎭 Dummy Data Control Guide

This guide explains how to control when dummy data is used in the PDF Processing API, ensuring production safety while maintaining development flexibility.

## 🎯 Overview

The PDF Processing API includes intelligent fallback to dummy data when the AI service is unavailable. This feature can be controlled through environment variables to prevent dummy data from accidentally leaking into production.

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Production Safe |
|----------|-------------|---------|-----------------|
| `ENVIRONMENT` | Deployment environment | `development` | `production` |
| `DEBUG` | Enable debug logging | `false` | `false` |
| `ALLOW_DUMMY_DATA` | Allow fallback to dummy data | `true` in dev, `false` in prod | `false` |
| `FORCE_DUMMY_DATA` | Always use dummy data (testing) | `false` | `false` |

### Configuration Logic

```python
# Default behavior:
ALLOW_DUMMY_DATA = "true" if DEBUG else "false"

# Production safety:
if ENVIRONMENT == "production" and ALLOW_DUMMY_DATA == "true":
    raise ValueError("🚨 Dummy data not allowed in production!")
```

## 🚀 Usage Examples

### 1. Development Mode
```bash
export ENVIRONMENT=development
export DEBUG=true
export ALLOW_DUMMY_DATA=true
export FORCE_DUMMY_DATA=false

python main.py
```

**Behavior:**
- ✅ AI service available → Use real AI
- ✅ AI service down → Fallback to dummy data
- ✅ Detailed logging enabled

### 2. Testing Mode
```bash
export ENVIRONMENT=testing
export DEBUG=false
export ALLOW_DUMMY_DATA=true
export FORCE_DUMMY_DATA=true

python main.py
```

**Behavior:**
- 🎭 Always use dummy data (consistent testing)
- ✅ No dependency on AI service
- ✅ Reproducible test results

### 3. Production Mode (Safe)
```bash
export ENVIRONMENT=production
export DEBUG=false
export ALLOW_DUMMY_DATA=false
export FORCE_DUMMY_DATA=false

python main.py
```

**Behavior:**
- ✅ AI service available → Use real AI
- ❌ AI service down → **Return error** (no dummy data)
- ✅ Production safety validation

### 4. Production Mode (Unsafe - Blocked)
```bash
export ENVIRONMENT=production
export ALLOW_DUMMY_DATA=true  # This will cause startup failure!

python main.py
```

**Result:**
```
🚨 PRODUCTION SAFETY ERROR: Dummy data is enabled in production!
Set ALLOW_DUMMY_DATA=false or ENVIRONMENT=production
```

## 📋 Configuration Templates

### Development (.env.development)
```bash
ENVIRONMENT=development
DEBUG=true
ALLOW_DUMMY_DATA=true
FORCE_DUMMY_DATA=false
HOST=127.0.0.1
PORT=8080
AI_SERVICE_URL=http://127.0.0.1:5000
```

### Production (.env.production) 
```bash
ENVIRONMENT=production
DEBUG=false
ALLOW_DUMMY_DATA=false
FORCE_DUMMY_DATA=false
HOST=0.0.0.0
PORT=8080
AI_SERVICE_URL=http://ai-service:5000
```

### Testing (.env.testing)
```bash
ENVIRONMENT=testing
DEBUG=false
ALLOW_DUMMY_DATA=true
FORCE_DUMMY_DATA=true
HOST=127.0.0.1
PORT=8080
```

## 🔍 Logging Output

### Development Mode (AI Service Down)
```
🚀 Starting AI processing for: document.pdf
🔌 AI service unavailable: ConnectError
📋 Falling back to dummy data for development
✅ AI processing started: dummy_a1b2c3d4
```

### Production Mode (AI Service Down)
```
🚀 Starting AI processing for: document.pdf
🚨 AI service unavailable in PRODUCTION and dummy data is disabled!
❌ Error: AI service required in production but unavailable
```

### Testing Mode (Forced Dummy)
```
🚀 Starting AI processing for: document.pdf
🎭 FORCE_DUMMY_DATA=true - using dummy data
✅ AI processing started: dummy_a1b2c3d4
```

## 🛡️ Production Safety Features

### 1. Startup Validation
- Automatically validates configuration on startup
- Prevents server from starting with unsafe production config
- Clear error messages for misconfigurations

### 2. Runtime Protection
- AI client respects configuration settings
- No accidental dummy data usage in production
- Explicit error handling when AI service fails

### 3. Clear Logging
- Dummy data usage is clearly logged
- Production safety violations are highlighted
- Easy to identify when dummy data is being used

## 🧪 Testing

Run the configuration test suite:

```bash
cd backend
python test_config_modes.py
```

Expected output:
```
✅ PASS Development Mode
✅ PASS Testing Mode  
✅ PASS Production Mode (Safe)
❌ FAIL Production Mode (UNSAFE - should fail)
```

## 🎯 Best Practices

### For Development
1. **Use `ALLOW_DUMMY_DATA=true`** for flexibility
2. **Monitor logs** to see when dummy data is used
3. **Test with real AI service** periodically

### For Testing
1. **Use `FORCE_DUMMY_DATA=true`** for consistency
2. **Disable AI service dependency** in CI/CD
3. **Test both dummy and real data paths**

### For Production
1. **Always set `ALLOW_DUMMY_DATA=false`**
2. **Set `ENVIRONMENT=production`** explicitly
3. **Monitor AI service health** closely
4. **Have AI service redundancy**

## 🚨 Common Pitfalls

### ❌ Accidental Production Dummy Data
```bash
# DON'T DO THIS IN PRODUCTION
export ALLOW_DUMMY_DATA=true
export ENVIRONMENT=production  # Will fail validation!
```

### ❌ Silent Failures
```bash
# Missing explicit configuration
# Will use defaults (may not be what you want)
python main.py
```

### ✅ Explicit Configuration
```bash
# Always be explicit about your intentions
export ENVIRONMENT=production
export ALLOW_DUMMY_DATA=false
export DEBUG=false
python main.py
```

## 📞 Troubleshooting

### Problem: Server won't start
**Error:** `🚨 PRODUCTION SAFETY ERROR: Dummy data is enabled in production!`

**Solution:** Set `ALLOW_DUMMY_DATA=false` for production deployment

### Problem: AI service failures cause errors
**Error:** `AI service required in production but unavailable`

**Solutions:**
1. Fix AI service connectivity
2. Enable dummy data fallback (if appropriate for your use case)
3. Implement AI service redundancy

### Problem: Inconsistent test results
**Solution:** Use `FORCE_DUMMY_DATA=true` in testing environments

## 📚 Related Documentation

- [Configuration Guide](./CONFIGURATION.md)
- [Logging Guide](./LOGGING.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./API.md) 