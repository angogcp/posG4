import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const router = Router();

// Utilities
function parseNumber(val: any, fallback: number | null = null): number | null {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// CRUD: modifiers
router.get('/', async (req, res) => {
  const db = getDb();
  const q = String((req.query.q as string) || '').trim();
  const includeInactive = String(req.query.include_inactive || '1') === '1';
  const sort = (req.query.sort as string) || 'sort_order';
  const order = ((req.query.order as string) || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 50)));

  const allowedSort = new Set(['sort_order', 'name', 'id']);
  const sortCol = allowedSort.has(sort) ? sort : 'sort_order';

  const where: string[] = [];
  const params: any[] = [];
  if (!includeInactive) { where.push('is_active = 1'); }
  if (q) { where.push('name LIKE ?'); params.push(`%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const totalRow = await db.get(`SELECT COUNT(*) as cnt FROM modifiers ${whereSql}`, params);
    const total = Number((totalRow as any)?.cnt || 0);
    const offset = (page - 1) * pageSize;
    const rows = await db.all(
      `SELECT * FROM modifiers ${whereSql} ORDER BY ${sortCol} ${order}, id ${order} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const pages = Math.max(1, Math.ceil(total / pageSize));
    res.json({ ok: true, data: rows, pagination: { total, page, pageSize, pages } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list modifiers' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const mod = await db.get('SELECT * FROM modifiers WHERE id = ?', [id]);
  if (!mod) return res.status(404).json({ error: 'Modifier not found' });
  const options = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ? AND is_active = 1 ORDER BY sort_order, id', [id]);
  const assignments = await db.all('SELECT * FROM modifier_assignments WHERE modifier_id = ? ORDER BY id', [id]);
  res.json({ ok: true, data: { ...mod, options, assignments } });
});

router.post('/', async (req, res) => {
  const { name, description, selection_type = 'single', min_choices = 0, max_choices = null, sort_order = 0, is_active = 1 } = req.body as any;
  if (!name || String(name).trim() === '') return res.status(400).json({ error: 'Name is required' });
  if (!['single', 'multiple'].includes(selection_type)) return res.status(400).json({ error: 'Invalid selection_type' });

  const db = getDb();
  const result = await db.run(
    `INSERT INTO modifiers (name, description, selection_type, min_choices, max_choices, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [String(name).trim(), description || null, selection_type, parseNumber(min_choices, 0), max_choices != null ? Number(max_choices) : null, parseNumber(sort_order, 0), is_active ? 1 : 0]
  );
  const created = await db.get('SELECT * FROM modifiers WHERE id = ?', [result.lastID]);
  res.json({ ok: true, data: created });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, selection_type, min_choices, max_choices, sort_order, is_active } = req.body as any;

  const updates: string[] = [];
  const params: any[] = [];
  function set(sql: string, val: any) { updates.push(sql); params.push(val); }

  if (name != null) set('name = ?', String(name).trim());
  if (description !== undefined) set('description = ?', description || null);
  if (selection_type != null) {
    if (!['single', 'multiple'].includes(selection_type)) return res.status(400).json({ error: 'Invalid selection_type' });
    set('selection_type = ?', selection_type);
  }
  if (min_choices != null) set('min_choices = ?', parseNumber(min_choices, 0));
  if (max_choices !== undefined) set('max_choices = ?', max_choices != null ? Number(max_choices) : null);
  if (sort_order != null) set('sort_order = ?', parseNumber(sort_order, 0));
  if (is_active != null) set('is_active = ?', is_active ? 1 : 0);

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const db = getDb();
  await db.run(`UPDATE modifiers SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
  const updated = await db.get('SELECT * FROM modifiers WHERE id = ?', [id]);
  if (!updated) return res.status(404).json({ error: 'Modifier not found' });
  res.json({ ok: true, data: updated });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  await db.run('UPDATE modifiers SET is_active = 0 WHERE id = ?', [id]);
  res.json({ ok: true });
});

// Options management
router.get('/:id/options', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const rows = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ? ORDER BY sort_order, id', [id]);
  res.json({ ok: true, data: rows });
});

router.post('/:id/options', requireAuth, requireRole('admin'), async (req, res) => {
  const modifier_id = Number(req.params.id);
  const { name, price_delta = 0, sort_order = 0, is_active = 1 } = req.body as any;
  if (!name || String(name).trim() === '') return res.status(400).json({ error: 'Name is required' });
  const db = getDb();
  const result = await db.run(
    `INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
    [modifier_id, String(name).trim(), Number(price_delta) || 0, Number(sort_order) || 0, is_active ? 1 : 0]
  );
  const created = await db.get('SELECT * FROM modifier_options WHERE id = ?', [result.lastID]);
  res.json({ ok: true, data: created });
});

router.put('/options/:optionId', requireAuth, requireRole('admin'), async (req, res) => {
  const optionId = Number(req.params.optionId);
  const { name, price_delta, sort_order, is_active } = req.body as any;
  const updates: string[] = [];
  const params: any[] = [];
  if (name != null) { updates.push('name = ?'); params.push(String(name).trim()); }
  if (price_delta != null) { updates.push('price_delta = ?'); params.push(Number(price_delta) || 0); }
  if (sort_order != null) { updates.push('sort_order = ?'); params.push(Number(sort_order) || 0); }
  if (is_active != null) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const db = getDb();
  await db.run(`UPDATE modifier_options SET ${updates.join(', ')} WHERE id = ?`, [...params, optionId]);
  const updated = await db.get('SELECT * FROM modifier_options WHERE id = ?', [optionId]);
  if (!updated) return res.status(404).json({ error: 'Option not found' });
  res.json({ ok: true, data: updated });
});

router.delete('/options/:optionId', requireAuth, requireRole('admin'), async (req, res) => {
  const optionId = Number(req.params.optionId);
  const db = getDb();
  await db.run('UPDATE modifier_options SET is_active = 0 WHERE id = ?', [optionId]);
  res.json({ ok: true });
});

// Assignments
router.get('/:id/assignments', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const rows = await db.all('SELECT * FROM modifier_assignments WHERE modifier_id = ? ORDER BY id', [id]);
  res.json({ ok: true, data: rows });
});

router.post('/:id/assign', requireAuth, requireRole('admin'), async (req, res) => {
  const modifier_id = Number(req.params.id);
  const { entity_type, entity_id } = req.body as { entity_type?: string; entity_id?: number };
  if (!['category', 'product'].includes(String(entity_type))) return res.status(400).json({ error: 'Invalid entity_type' });
  const db = getDb();
  try {
    const result = await db.run(
      `INSERT INTO modifier_assignments (modifier_id, entity_type, entity_id) VALUES (?, ?, ?)`,
      [modifier_id, entity_type, Number(entity_id)]
    );
    const created = await db.get('SELECT * FROM modifier_assignments WHERE id = ?', [result.lastID]);
    res.json({ ok: true, data: created });
  } catch (e: any) {
    if (String(e?.message || '').includes('UNIQUE')) return res.status(400).json({ error: 'Already assigned' });
    res.status(500).json({ error: 'Failed to assign modifier' });
  }
});

router.delete('/:id/assign', requireAuth, requireRole('admin'), async (req, res) => {
  const modifier_id = Number(req.params.id);
  const { entity_type, entity_id } = req.body as { entity_type?: string; entity_id?: number };
  const db = getDb();
  await db.run(`DELETE FROM modifier_assignments WHERE modifier_id = ? AND entity_type = ? AND entity_id = ?`, [modifier_id, entity_type, Number(entity_id)]);
  res.json({ ok: true });
});

// Effective modifiers for product
router.get('/effective/product/:productId', requireAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  const db = getDb();
  const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const categoryId = (product as any).category_id as number | null;

  let modsFromCategory: any[] = [];
  if (categoryId) {
    modsFromCategory = await db.all(
      `SELECT m.* FROM modifier_assignments ma
       JOIN modifiers m ON m.id = ma.modifier_id
       WHERE ma.entity_type = 'category' AND ma.entity_id = ? AND m.is_active = 1
       ORDER BY m.sort_order, m.id`,
      [categoryId]
    );
  }

  const modsFromProduct = await db.all(
    `SELECT m.* FROM modifier_assignments ma
     JOIN modifiers m ON m.id = ma.modifier_id
     WHERE ma.entity_type = 'product' AND ma.entity_id = ? AND m.is_active = 1
     ORDER BY m.sort_order, m.id`,
    [productId]
  );

  // Union by id
  const map = new Map<number, any>();
  for (const m of [...modsFromCategory, ...modsFromProduct]) map.set(m.id, m);
  const mods = Array.from(map.values());

  // Attach options
  const result: any[] = [];
  for (const m of mods) {
    const options = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ? AND is_active = 1 ORDER BY sort_order, id', [m.id]);
    result.push({ ...m, options });
  }

  res.json({ ok: true, data: result });
});