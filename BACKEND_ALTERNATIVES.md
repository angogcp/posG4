# Backend Hosting Alternatives (Free)

Since your application uses **SQLite**, standard serverless platforms (like Vercel) will **reset your database** on every restart. You have two main paths:

1.  **Keep SQLite** but use a host with persistent disks.
2.  **Move the Database** to a cloud provider (e.g., Turso) and keep the backend on Vercel.

---

## Option 1: Turso (Recommended for Vercel Users)

**Turso** is a SQLite-compatible database that runs in the cloud. It has a generous free tier (9GB storage).

### How to Migrate:
1.  Sign up at [turso.tech](https://turso.tech).
2.  Create a database and get the **Database URL** and **Auth Token**.
3.  In your `server` folder:
    ```bash
    npm install @libsql/client dotenv
    ```
4.  Replace your `server/src/lib/db.ts` with the code provided in `server/src/lib/db-turso-example.ts`.
5.  Set your environment variables in Vercel:
    *   `TURSO_DATABASE_URL=...`
    *   `TURSO_AUTH_TOKEN=...`
6.  Deploy your backend to Vercel (same as frontend) or keep it separate.

---

## Option 2: Fly.io (Recommended for "No Code Changes")

**Fly.io** allows you to run Docker containers with persistent storage volumes.

### How to Deploy:
1.  Install `flyctl` (Fly CLI).
2.  Sign up (requires credit card for identity, but has a free allowance).
3.  In the `server` directory, run:
    ```bash
    fly launch
    ```
4.  When asked about a database, say **No** (since you use SQLite file).
5.  Add a persistent volume for the data folder:
    ```bash
    fly volumes create pos_data --region <your-region> --size 1
    ```
6.  Update `fly.toml` to mount the volume:
    ```toml
    [mounts]
    source = "pos_data"
    destination = "/app/data"
    ```
7.  `fly deploy`

---

## Option 3: Render + External DB

**Render** has a free tier for Node.js web services.
*   **Warning:** The free tier spins down (sleeps) after inactivity, causing a 50-second delay on the next request.
*   **Database:** You CANNOT use local SQLite on Render Free Tier (it disappears). You must use **Turso** (Option 1) or **Neon** (Postgres).

---

## Option 4: Oracle Cloud "Always Free"

**Oracle Cloud** offers a very powerful free VPS (ARM Ampere, 4 CPUs, 24GB RAM).
*   **Pros:** It's a full server. You can run everything (Node, SQLite, Nginx) exactly like on your local machine.
*   **Cons:** Sign-up can be difficult (cards often rejected), and you need to manage the Linux server yourself (SSH, updates, security).

---

## Summary Recommendation

*   **Simplest Setup:** **Fly.io** (Uses your existing code + Docker).
*   **Best Performance/Modern:** **Turso + Vercel** (Splits DB to cloud, Backend to Serverless).
