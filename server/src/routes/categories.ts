import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();

// Fetch assigned modifiers for a category
router.get('/:id/modifiers', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const mods = await db.all(
    `SELECT m.*, 'category' as source FROM modifier_assignments ma
     JOIN modifiers m ON m.id = ma.modifier_id
     WHERE ma.entity_type = 'category' AND ma.entity_id = ? AND m.is_active = 1
     ORDER BY m.sort_order, m.id`,
    [id]
  );

  const result: any[] = [];
  for (const m of mods) {
    const options = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ? AND is_active = 1 ORDER BY sort_order, id', [m.id]);
    result.push({ ...m, options });
  }

  res.json({ ok: true, data: result });
});

router.get('/', requireAuth, async (req, res) => {
  const { include_inactive } = req.query as { include_inactive?: string };
  const db = getDb();
  const rows = include_inactive
    ? await db.all('SELECT * FROM categories ORDER BY sort_order, id')
    : await db.all('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, id');
  res.json({ ok: true, data: rows });
});

// Fetch single category by id
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const row = await getDb().get('SELECT * FROM categories WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Category not found' });
  res.json({ ok: true, data: row });
});

// Create category
router.post('/', requireAuth, async (req, res) => {
  const { name, sort_order, is_active, options_json } = req.body as any;
  if (!name || String(name).trim() === '') return res.status(400).json({ error: 'Name is required' });
  const sort = sort_order != null && sort_order !== '' ? Number(sort_order) : 0;
  if (!Number.isFinite(sort)) return res.status(400).json({ error: 'sort_order must be a number' });
  const active = is_active != null ? (is_active ? 1 : 0) : 1;

  let optionsStr: string | null = null;
  if (options_json !== undefined) {
    try {
      if (typeof options_json === 'string') {
        if (options_json.trim() === '') optionsStr = null; else { JSON.parse(options_json); optionsStr = options_json; }
      } else {
        optionsStr = JSON.stringify(options_json);
      }
    } catch (_e) {
      return res.status(400).json({ error: 'options_json must be valid JSON' });
    }
  }

  try {
    const db = getDb();
    const result = await db.run(
      `INSERT INTO categories (name, sort_order, is_active, options_json) VALUES (?, ?, ?, ?)`,
      [String(name).trim(), sort, active, optionsStr]
    );
    const newRow = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.json({ ok: true, data: newRow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, sort_order, is_active, options_json } = req.body as any;
  const fields: string[] = [];
  const params: any[] = [];

  function setField(sql: string, value: any) {
    fields.push(sql);
    params.push(value);
  }

  if (name != null) setField('name = ?', String(name).trim());
  if (sort_order !== undefined) {
    const sort = sort_order != null && sort_order !== '' ? Number(sort_order) : 0;
    if (!Number.isFinite(sort)) return res.status(400).json({ error: 'sort_order must be a number' });
    setField('sort_order = ?', sort);
  }
  if (is_active != null) setField('is_active = ?', is_active ? 1 : 0);

  if (options_json !== undefined) {
    try {
      let optionsStr: string | null;
      if (typeof options_json === 'string') {
        if (options_json.trim() === '') optionsStr = null; else { JSON.parse(options_json); optionsStr = options_json; }
      } else {
        optionsStr = JSON.stringify(options_json);
      }
      setField('options_json = ?', optionsStr);
    } catch (_e) {
      return res.status(400).json({ error: 'options_json must be valid JSON' });
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const db = getDb();
    const result = await db.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Category not found' });
    const row = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Soft delete (disable) category
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const db = getDb();
    const result = await db.run(`UPDATE categories SET is_active = 0 WHERE id = ?`, [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Category not found' });
    const row = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disable category' });
  }
});