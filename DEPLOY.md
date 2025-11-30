# Deployment Guide

## Vercel Deployment (Frontend)

This project consists of a **Web Frontend** (React/Vite) and a **Node.js Backend** (Express).

### ⚠️ Important Limitation: SQLite Database
The backend currently uses **SQLite**, which stores data in a local file (`server/data/pos.sqlite3`).
**Vercel Serverless Functions do not support persistent local file storage.**
If you deploy the backend to Vercel, the database will reset every time the server restarts.

### Recommended Backend Solutions

See **[BACKEND_ALTERNATIVES.md](./BACKEND_ALTERNATIVES.md)** for detailed free options including:
1.  **Turso** (Cloud SQLite) - *Best for Vercel*
2.  **Fly.io** (Docker + Persistent Volume)
3.  **Oracle Cloud** (Free VPS)

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
