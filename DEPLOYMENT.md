# 🚀 Deployment Guide - GlobalWeb Converter

## 📋 Step-by-Step Deployment Instructions

### 1️⃣ **Push to GitHub** (First Time Setup)

```bash
# Create a new repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/globalweb-converter.git
git branch -M main  
git push -u origin main
```

### 2️⃣ **Deploy to Railway** ⭐ (Recommended - Easiest)

**Why Railway?** 
- ✅ Free tier with generous limits
- ✅ Automatic deployments from Git
- ✅ Custom domain support
- ✅ Zero configuration needed

**Steps:**
1. Visit [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `globalweb-converter` repository
5. Railway auto-detects the Dockerfile and deploys
6. Get your live URL: `https://your-app-name.railway.app`

**⏱️ Deployment Time:** 3-5 minutes

### 3️⃣ **Deploy to Render** (Alternative)

**Why Render?**
- ✅ Good free tier (750 hours/month)
- ✅ Automatic SSL certificates
- ✅ Easy setup from Git

**Steps:**
1. Visit [Render.com](https://render.com)
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command:** `./mvnw clean package -DskipTests`
   - **Start Command:** `java -jar target/html-translator-0.0.1-SNAPSHOT.jar`
   - **Environment:** `SPRING_PROFILES_ACTIVE=production`
6. Deploy and get your URL: `https://your-app-name.onrender.com`

**⏱️ Deployment Time:** 5-8 minutes

### 4️⃣ **Deploy to Heroku** (Classic Option)

**Steps:**
1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Deploy: `git push heroku main`
5. Open: `heroku open`

### 5️⃣ **Local Docker Deployment**

```bash
# Build the image
docker build -t globalweb-converter .

# Run locally
docker run -p 8080:8080 globalweb-converter

# Access at http://localhost:8080
```

## 🔧 Environment Variables (Optional)

For production deployments, you can set these:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port (auto-set by hosting platforms) |
| `SPRING_PROFILES_ACTIVE` | `default` | Use `production` for optimized settings |

## 🌐 Custom Domain Setup

### Railway:
1. Go to your project settings
2. Add custom domain
3. Update DNS records as instructed

### Render:
1. Go to Settings → Custom Domains
2. Add your domain
3. Configure DNS with provided values

## 🚀 Sharing Your App

Once deployed, share these links:

**📱 For End Users:**
```
🌐 Live App: https://your-app-name.railway.app
📖 How to Use: Just paste HTML and click Transform!
```

**👨‍💻 For Developers:**
```
📁 Source Code: https://github.com/YOUR_USERNAME/globalweb-converter
🚀 Deploy Your Own: Click the Railway button in README
📚 Documentation: Check the README.md
```

## 🔄 Auto-Deployment Setup

Both Railway and Render support automatic deployments:

1. **Push to GitHub** → **Auto-deploys** to your hosting platform
2. Changes go live in 2-5 minutes
3. Zero downtime deployments
4. Rollback support if needed

## 📊 Monitoring Your App

### Railway Dashboard:
- View logs, metrics, and deployment history
- Monitor resource usage
- Set up custom domains

### Render Dashboard:
- Real-time logs and metrics  
- Performance monitoring
- SSL certificate management

## 🆘 Troubleshooting

### Common Issues:

**1. Build Fails:**
```bash
# Check Java version in logs
# Ensure Maven wrapper is executable
chmod +x mvnw
```

**2. App Won't Start:**
```bash
# Check if PORT environment variable is set
# Verify application-production.yml exists
```

**3. Out of Memory:**
```bash
# Add to deployment environment:
JAVA_OPTS=-Xmx512m
```

## 🎉 Success!

Once deployed, your **GlobalWeb Converter** will be live and accessible to anyone with the link!

**✅ Features Available:**
- Multi-language HTML transformation
- Smart language detection
- Professional UI with animations
- Mobile-friendly design
- Instant file downloads

**📈 Next Steps:**
- Share the link with your team
- Add custom domain (optional)
- Monitor usage in platform dashboard
- Collect user feedback and iterate

---

**🎯 Need Help?** Open an issue in your GitHub repository!