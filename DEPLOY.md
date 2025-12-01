# Deploying POS G4 to Vercel (Single Project)

Since you want to deploy the entire application as a single Vercel project, we have configured the repository to handle both the Backend (API) and Frontend (Web) in one go.

## Prerequisites

1.  A Vercel account.
2.  A Turso database (already set up).
3.  The project pushed to a GitHub repository.

## Deployment Steps

1.  **Log in to Vercel** and click **"Add New..."** -> **"Project"**.
2.  **Import** your GitHub repository.
3.  **Configure Project**:
    *   **Project Name**: e.g., `pos-g4`
    *   **Root Directory**: Leave it as `./` (the default root).
    *   **Framework Preset**: Vercel should detect **Vite** (because of `web/vite.config.ts` and `vercel.json` settings). If not, select **Vite**.
    *   **Build Command**: `npm run build` (Default - this will build both server and web).
    *   **Output Directory**: `web/dist` (We configured this in `vercel.json`).
    *   **Environment Variables**: Add the following:
        *   `TURSO_DATABASE_URL`: (Your Turso DB URL)
        *   `TURSO_AUTH_TOKEN`: (Your Turso Auth Token)
        *   `SESSION_SECRET`: (A random string)
        *   `VERCEL`: `1`
4.  **Deploy**.

## How it Works

*   **Frontend**: The `web` folder is built and served as static files.
*   **Backend**: The `api/index.ts` file acts as the entry point for Vercel Serverless Functions, which imports your Express app from `server/src/index.ts`.
*   **Routing**: Requests to `/api/*` are routed to the backend function, while all other requests are served by the frontend.

## Troubleshooting

*   **Build Fails**: Check the build logs. Ensure `npm install` is successfully installing dependencies for both server and web (the `postinstall` script handles this).
*   **500 Server Error on Login**: Check your Environment Variables (Turso credentials).
*   **Database Errors**: Ensure your Turso database is active.
