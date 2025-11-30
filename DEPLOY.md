# Deployment Guide

## Vercel Deployment

This project consists of a **Web Frontend** (React/Vite) and a **Node.js Backend** (Express).

### ⚠️ Important Limitation: SQLite Database
The backend currently uses **SQLite**, which stores data in a local file (`server/data/pos.sqlite3`).
**Vercel Serverless Functions do not support persistent local file storage.**
If you deploy the backend to Vercel, the database will reset every time the server restarts (which happens frequently in serverless environments).

### Recommended Deployment Strategy

1.  **Frontend (Web)**: Deploy to **Vercel**.
2.  **Backend (Server)**: Deploy to a VPS or a platform that supports persistent storage (e.g., Render, Railway, DigitalOcean, or a standard VM) OR migrate the database to a cloud provider (like Supabase, PlanetScale, or Vercel Postgres).

### How to Deploy Frontend to Vercel

1.  Push this repository to GitHub/GitLab/Bitbucket.
2.  Import the project in Vercel.
3.  **Project Settings**:
    *   **Root Directory**: Select `web`.
    *   **Framework Preset**: Vite.
    *   **Build Command**: `npm run build`.
    *   **Output Directory**: `dist`.
4.  **Environment Variables**:
    *   If your backend is hosted elsewhere, you need to configure the API proxy.
    *   Edit `web/vercel.json` to point to your live backend URL:
        ```json
        {
          "rewrites": [
            {
              "source": "/api/(.*)",
              "destination": "https://YOUR-LIVE-BACKEND.com/api/$1"
            },
            {
              "source": "/(.*)",
              "destination": "/index.html"
            }
          ]
        }
        ```

### Quick Start for Demo (Frontend Only)

If you just want to see the UI on Vercel:
1.  Deploy the `web` folder as described above.
2.  Note that API calls (Login, Menu, Orders) will fail without a running backend.

### Cleaning Up Data

Before deployment, you can run the cleanup script to remove test orders:
```bash
cd server
npm run tsx scripts/cleanup_orders.ts
```
(This has already been run for you).
