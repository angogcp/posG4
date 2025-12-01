import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const router = Router();

// List users (admin only)
router.get('/', async (_req, res) => {
  const db = getDb();
  const rows = await db.all('SELECT id, username, role, is_active, created_at FROM users ORDER BY id');
  res.json({ ok: true, data: rows });
});

// Get user by id (admin only)
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const db = getDb();
  const row = await db.get('SELECT id, username, role, is_active, created_at FROM users WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, data: row });
});

// Create user (admin only)
router.post('/', async (req, res) => {
  const { username, password, role, is_active } = req.body as { username?: string; password?: string; role?: string; is_active?: number };
  const uname = (username || '').trim();
  const r = (role || 'cashier').trim();
  const active = typeof is_active === 'number' ? (is_active ? 1 : 0) : 1;
  if (!uname || !password) return res.status(400).json({ error: 'Missing username or password' });
  if (!['admin', 'cashier'].includes(r)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const db = getDb();
    const result = await db.run('INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, ?)', [uname, hash, r, active]);
    const created = await db.get('SELECT id, username, role, is_active, created_at FROM users WHERE id = ?', [result.lastID]);
    res.json({ ok: true, data: created });
  } catch (e: any) {
    if (String(e?.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { username, password, role, is_active } = req.body as { username?: string; password?: string; role?: string; is_active?: number };

  const updates: string[] = [];
  const params: any[] = [];
  if (typeof username === 'string' && username.trim()) { updates.push('username = ?'); params.push(username.trim()); }
  if (typeof role === 'string' && ['admin', 'cashier'].includes(role)) { updates.push('role = ?'); params.push(role); }
  if (typeof is_active === 'number') { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (typeof password === 'string' && password.length) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const db = getDb();
    params.push(id);
    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await db.get('SELECT id, username, role, is_active, created_at FROM users WHERE id = ?', [id]);
    res.json({ ok: true, data: row });
  } catch (e: any) {
    if (String(e?.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Soft delete (disable) user (admin only)
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const db = getDb();
  await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  res.json({ ok: true });
});