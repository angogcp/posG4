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
import { router as tablesRouter } from './routes/tables.js';
import { router as customerRouter } from './routes/customer.js';
import printRouter from './routes/print.js';

// Helper to load SQLiteStore conditionally (safe for Vercel)
let SQLiteStore: any;
try {
  SQLiteStore = SQLiteStoreFactory(session);
} catch (e) {
  console.log('Could not load connect-sqlite3, will fallback to MemoryStore');
}

const app = express();
const PORT = process.env.PORT || 4000;
const isVercel = process.env.VERCEL === '1';

// Debug Middleware - Log all requests
app.use((req, res, next) => {
  if (isVercel) {
    console.log(`[Request] ${req.method} ${req.url}`);
  }
  next();
});

// Basic security and parsing
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5176',
  'http://localhost:5186',
  'http://localhost:5190',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5186',
  'http://127.0.0.1:5190',
  'capacitor://localhost',
  'ionic://localhost'
];

// Add Vercel domain to allowed origins dynamically if needed, or rely on same-origin
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isVercel && origin.endsWith('.vercel.app')) return callback(null, true);
    const allowed =
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|10\.0\.3\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origin);
    callback(null, allowed);
  },
  credentials: true
}));

// Ensure sessions data directory exists (only locally)
const dataDir = isVercel ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
try {
  if (!fs.existsSync(dataDir) && !isVercel) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (e) {}

// Sessions
let sessionStore: session.Store;
if (isVercel || !SQLiteStore) {
  sessionStore = new session.MemoryStore();
} else {
  sessionStore = new (SQLiteStore as any)({ db: 'sessions.sqlite', dir: dataDir }) as unknown as session.Store;
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isVercel ? 'none' : 'lax',
      secure: isVercel,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, env: process.env.NODE_ENV }));

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const db = getDb();
    const count = await db.all('SELECT count(*) as c FROM products');
    res.json({
      ok: true,
      env: {
        VERCEL: process.env.VERCEL,
        HAS_DB_URL: !!process.env.TURSO_DATABASE_URL
      },
      db_check: count,
      url: req.url
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Initialize DB
try {
  initDb();
} catch(e) {
  console.error('Failed to init DB:', e);
}

// Routes
app.get('/api/settings', async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.all('SELECT key, value FROM settings');
    const obj: Record<string, string> = {};
    for (const r of rows as any[]) obj[(r as any).key] = (r as any).value;
    res.json(obj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/settings', async (req, res) => {
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
app.use('/api/tables', tablesRouter);
app.use('/api/customer', customerRouter);
app.use('/api/print', printRouter);
app.use('/api/printers', printRouter);

// Serve uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve built frontend if available
try {
  // Adjust path for Vercel structure vs Local
  // On Vercel, process.cwd() is the root, and web/dist might be there
  const webDist = path.resolve(process.cwd(), '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(webDist, 'index.html'));
    });
  }
} catch (e) {
  // ignore
}

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Catch-all for debugging 404s on API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API Endpoint not found: ${req.originalUrl}` });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
