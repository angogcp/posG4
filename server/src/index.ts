import express from 'express';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { router as authRouter } from './routes/auth.js';
import { router as productsRouter } from './routes/products.js';
import { router as categoriesRouter } from './routes/categories.js';
import { router as ordersRouter } from './routes/orders.js';
import { router as usersRouter } from './routes/users.js';
import { router as reportsRouter } from './routes/reports.js';
import { router as couponsRouter } from './routes/coupons.js';
import { initDb, getDb } from './lib/db.js';
import { requireAuth } from './middleware/auth.js';
import { router as modifiersRouter } from './routes/modifiers.js';
import printRouter from './routes/print.js';

const SQLiteStore = SQLiteStoreFactory(session);

const app = express();
const PORT = process.env.PORT || 4000;

// Basic security and parsing
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// CORS: during development allow Vite dev server on 5173/5186/5190 and 127.0.0.1 variants
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5176',
  'http://localhost:5186',
  'http://localhost:5190',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5186',
  'http://127.0.0.1:5190',
  // Allow Capacitor/Ionic default scheme and host during mobile runtime
  'capacitor://localhost',
  'ionic://localhost'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed =
      allowedOrigins.includes(origin) ||
      // Allow typical LAN hosts and emulator loopback
      /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|10\.0\.3\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origin);
    callback(null, allowed);
  },
  credentials: true
}));

// Ensure sessions data directory exists
const dataDir = path.join(process.cwd(), 'data');
try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {
  // ignore if exists or cannot create; connect-sqlite3 may still handle
}

// Sessions
app.use(
  session({
    store: (new (SQLiteStore as any)({ db: 'sessions.sqlite', dir: dataDir }) as unknown) as session.Store,
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Initialize DB and routes
initDb();

// Settings endpoints
app.get('/api/settings', requireAuth, async (_req, res) => {
  const db = getDb();
  const rows = await db.all('SELECT key, value FROM settings');
  const obj: Record<string, string> = {};
  for (const r of rows as any[]) obj[(r as any).key] = (r as any).value;
  res.json(obj);
});

app.post('/api/settings', requireAuth, async (req, res) => {
  const db = getDb();
  const entries = Object.entries(req.body || {}) as [string, string][];
  try {
    for (const [k, v] of entries) {
      await db.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, v ?? '']);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/modifiers', modifiersRouter);
app.use('/api/print', printRouter);
app.use('/api/printers', printRouter);

// Serve built frontend if available (for same-origin mobile/web usage)
try {
  const webDist = path.resolve(process.cwd(), '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(webDist, 'index.html'));
    });
  }
} catch (e) {
  // ignore static serve errors in dev
}

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});