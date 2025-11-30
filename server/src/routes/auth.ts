import { Router } from 'express';
import { getDb } from '../lib/db.js';
import bcrypt from 'bcryptjs';

export const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  // Support bcrypt hash and gracefully handle legacy/plain text passwords to avoid 500s
  let ok = false;
  const stored: unknown = (user as any).password_hash ?? (user as any).password;
  try {
    if (typeof stored === 'string' && /^\$2[aby]?\$/.test(stored)) {
      ok = bcrypt.compareSync(password, stored);
    } else if (typeof stored === 'string') {
      // Fallback: legacy plain-text match, then upgrade to bcrypt hash
      ok = stored === password;
      if (ok && !(user as any).password_hash) {
        const newHash = bcrypt.hashSync(password, 10);
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, (user as any).id]);
      }
    } else {
      ok = false;
    }
  } catch {
    ok = false;
  }

  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

  (req.session as any).user = { id: (user as any).id, username: (user as any).username, role: (user as any).role };
  res.json({ ok: true, user: (req.session as any).user });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  const user = (req.session as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ ok: true, user });
});