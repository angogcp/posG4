import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const router = Router();

// GET /api/tables - List all tables
router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const showInactive = req.query.include_inactive === 'true';
  
  let sql = 'SELECT * FROM tables';
  const params: any[] = [];
  
  if (!showInactive) {
    sql += ' WHERE is_active = 1';
  }
  
  sql += ' ORDER BY name ASC';
  
  try {
    const rows = await db.all(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('Failed to list tables:', err);
    res.status(500).json({ error: 'Failed to list tables' });
  }
});

// GET /api/tables/:id - Get a single table
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid ID' });
  
  const db = getDb();
  try {
    const row = await db.get('SELECT * FROM tables WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Table not found' });
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('Failed to get table:', err);
    res.status(500).json({ error: 'Failed to get table' });
  }
});

// POST /api/tables - Create a new table
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, capacity, status } = req.body as any;
  
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Table name is required' });
  }
  
  const cap = Number(capacity);
  const safeCap = Number.isFinite(cap) && cap > 0 ? cap : 4;
  const safeStatus = ['available', 'occupied', 'reserved'].includes(status) ? status : 'available';
  
  const db = getDb();
  try {
    const result = await db.run(
      'INSERT INTO tables (name, capacity, status, is_active) VALUES (?, ?, ?, 1)',
      [name.trim(), safeCap, safeStatus]
    );
    const row = await db.get('SELECT * FROM tables WHERE id = ?', [result.lastID]);
    res.json({ ok: true, data: row });
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Table name already exists' });
    }
    console.error('Failed to create table:', err);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/tables/:id - Update a table
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid ID' });
  
  const { name, capacity, status, is_active } = req.body as any;
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (name !== undefined) {
    if (typeof name === 'string' && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    } else {
      return res.status(400).json({ error: 'Invalid name' });
    }
  }
  
  if (capacity !== undefined) {
    const cap = Number(capacity);
    if (Number.isFinite(cap) && cap > 0) {
      updates.push('capacity = ?');
      params.push(cap);
    } else {
      return res.status(400).json({ error: 'Invalid capacity' });
    }
  }
  
  if (status !== undefined) {
    if (['available', 'occupied', 'reserved'].includes(status)) {
      updates.push('status = ?');
      params.push(status);
    }
  }
  
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  
  updates.push("updated_at = datetime('now')");
  
  if (updates.length === 1) { // Only updated_at
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  const db = getDb();
  try {
    params.push(id);
    await db.run(`UPDATE tables SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await db.get('SELECT * FROM tables WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Table not found' });
    res.json({ ok: true, data: row });
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'Table name already exists' });
    }
    console.error('Failed to update table:', err);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// DELETE /api/tables/:id - Soft delete a table
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid ID' });
  
  const db = getDb();
  try {
    await db.run("UPDATE tables SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete table:', err);
    res.status(500).json({ error: 'Failed to delete table' });
  }
});
