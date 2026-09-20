# Deployment Guide: Flight Delay Intelligence Dashboard

This guide covers the best ways to deploy the Flight Delay Analysis & OCC Intelligence application to production.

---

## Architecture Overview
- **Backend**: Python Flask (`server.py`) powered by `gunicorn`.
- **Database**: Cloud Neon PostgreSQL via Prisma schema (`prisma/schema.prisma`) with all 598,700 records indexed (with local SQLite fallback).
- **Frontend**: Vanilla HTML5, CSS3, ES6 JavaScript served directly by Flask from `dashboard/`.
- **AI Engine**: OpenRouter API (`openai/gpt-4o-mini`) via environment variable `OPENROUTER_API_KEY`.

---

## Method 1: Render.com (Recommended — Fastest & Easiest)

Render can build and run the app directly from your GitHub repository.

### Steps:
1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Flight Delay Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/flight-delay-analysis.git
   git push -u origin main
   ```
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Name**: `flight-delay-dashboard`
   - **Environment**: `Python 3`
   - **Region**: Any (e.g. Oregon, Frankfurt)
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 2 -b 0.0.0.0:$PORT server:app`
5. Under **Environment Variables**, add:
   - Key: `OPENROUTER_API_KEY`
   - Value: `<your-openrouter-api-key>`
6. Click **Deploy Web Service**.
   - Your dashboard will be live at `https://flight-delay-dashboard.onrender.com`.

---

## Method 2: Railway.app

1. Go to [Railway](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**.
2. Select your repository. Railway will detect `requirements.txt` and `Procfile` (or `Dockerfile`) automatically.
3. In the project **Variables** tab, add:
   - `OPENROUTER_API_KEY`: `<your-openrouter-api-key>`
4. In the **Settings** tab, click **Generate Domain** to get your public URL.

---

## Method 3: Docker Container (Any Cloud / AWS / GCP Cloud Run / DigitalOcean)

A production-ready [Dockerfile](file:///Users/adithya/Documents/Flight-delay-analysis/Dockerfile) and [.dockerignore](file:///Users/adithya/Documents/Flight-delay-analysis/.dockerignore) are included in the repository.

### 1. Build the Docker Image:
```bash
docker build -t flight-delay-dashboard:latest .
```

### 2. Run Locally or on a Server:
```bash
docker run -d \
  -p 5173:5173 \
  -e OPENROUTER_API_KEY="your_openrouter_api_key_here" \
  --name flight_app \
  flight-delay-dashboard:latest
```
Access at `http://localhost:5173`.

### 3. Deploy to Google Cloud Run:
```bash
gcloud builds submit --tag gcr.io/<PROJECT-ID>/flight-delay-dashboard
gcloud run deploy flight-delay-dashboard \
  --image gcr.io/<PROJECT-ID>/flight-delay-dashboard \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars OPENROUTER_API_KEY="your_key"
```

---

## Method 4: Ubuntu / Debian Linux VPS (EC2, Linode, DigitalOcean)

If deploying to a traditional virtual machine:

### 1. Clone and Setup Environment:
```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nginx git
git clone https://github.com/<your-username>/flight-delay-analysis.git /var/www/flight-delay
cd /var/www/flight-delay
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Systemd Service (`/etc/systemd/system/flight-delay.service`):
```ini
[Unit]
Description=Flight Delay Analytics & OCC Dashboard
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/flight-delay
Environment="PATH=/var/www/flight-delay/venv/bin"
Environment="OPENROUTER_API_KEY=your_key_here"
ExecStart=/var/www/flight-delay/venv/bin/gunicorn -w 3 -b 127.0.0.1:5173 server:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable flight-delay
sudo systemctl start flight-delay
```

### 3. Configure Nginx Reverse Proxy (`/etc/nginx/sites-available/flight-delay`):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
Enable site and add SSL:
```bash
sudo ln -s /etc/nginx/sites-available/flight-delay /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Important Deployment Notes

1. **Database Size Optimized (< 100 MB)**:
   `data/flights.db` is VACUUMed and optimized to **98.36 MB**, allowing standard `git push` without needing Git LFS or external database servers.
2. **OpenRouter API Key**:
   Set `OPENROUTER_API_KEY` as an environment variable in your deployment platform settings. The server automatically reads it on startup.
3. **Dynamic Port**:
   `server.py` listens on `os.environ.get("PORT", 5173)` to accommodate automated port assignment across Render, Railway, Heroku, and Google Cloud Run.
