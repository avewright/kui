# 🎯 EASY START GUIDE

## 🧹 Step 1: Clean Up (Optional)
If you have old folders confusing you, run:
```bash
# Windows
.\cleanup.ps1

# Mac/Linux  
./cleanup.sh
```

## 📁 What You Have Now

**Only 4 folders matter:**

```
📁 api/       ← Backend server (processes PDFs, talks to AI)
📁 frontend/  ← Website you see in browser
📁 vllm/      ← AI model deployment 
📁 scripts/   ← Easy commands to start everything
```

**That's it!** Everything else can be ignored.

## 🚀 Step 2: Start Everything

### Super Easy Way (Recommended)
```bash
# Setup once
./scripts/setup.sh

# Start everything 
./scripts/start.sh
```

### Docker Way (Even Easier)
```bash
docker-compose up
```

### Manual Way (If you want control)
```bash
# Terminal 1: Start AI model
cd vllm
python deploy.py --model llava-1.5-7b

# Terminal 2: Start backend  
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Terminal 3: Start website
cd frontend  
npm install
npm run dev
```

## 🎮 Step 3: Use It

1. Go to **http://localhost:3000**
2. **Drop a PDF** on the page
3. **Tell it what to extract** (title, date, etc.)
4. **Click "Process"**
5. **Download results** as JSON

## ❓ Problems?

- **Port busy?** Kill processes: `lsof -ti:3000,8080,8000 | xargs kill`
- **Model won't load?** Need 8GB+ GPU memory
- **Can't install?** Check you have Python 3.8+ and Node 18+

## 🎉 You're Done!

Your document extraction system is now:
- ✅ Clean and organized
- ✅ Easy to deploy  
- ✅ Ready to extract data from PDFs
- ✅ Powered by modern AI models

**Enjoy!** 🚀 