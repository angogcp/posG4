import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { category_id, include_inactive } = req.query as { category_id?: string; include_inactive?: string };
  const db = getDb();
  // Build base WHERE clause depending on include_inactive
  const activeClause = include_inactive ? '' : 'is_active = 1 AND ';
  let rows;
  if (category_id) {
    rows = await db.all(`SELECT * FROM products WHERE ${activeClause} category_id = ? ORDER BY id DESC`, [Number(category_id)]);
  } else {
    rows = await db.all(`SELECT * FROM products ${include_inactive ? '' : 'WHERE is_active = 1'} ORDER BY id DESC`, []);
  }
  res.json({ ok: true, data: rows });
});

router.get('/search', requireAuth, async (req, res) => {
  const { q, category_id, include_inactive, page, pageSize } = req.query as {
    q?: string;
    category_id?: string;
    include_inactive?: string;
    page?: string;
    pageSize?: string;
  };
  const db = getDb();

  // Build dynamic WHERE clause
  const conditions: string[] = [];
  const params: any[] = [];

  // By default, only include active records unless include_inactive is specified
  if (!include_inactive) {
    conditions.push('is_active = 1');
  }

  if (category_id) {
    conditions.push('category_id = ?');
    params.push(Number(category_id));
  }

  if (q && String(q).trim() !== '') {
    conditions.push('(name LIKE ? OR code LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const p = Math.max(1, Number(page) || 1);
  // Default pageSize to 50 to preserve previous behavior (LIMIT 50)
  const psRaw = Number(pageSize) || 50;
  const ps = Math.max(1, Math.min(100, psRaw));
  const offset = (p - 1) * ps;

  try {
    const countRow = await db.get(`SELECT COUNT(*) as cnt FROM products ${where}`, params) as any;
    const total = Number(countRow?.cnt ?? 0);
    const rows = await db.all(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, ps, offset]);

    res.json({ ok: true, data: rows, pagination: { total, page: p, pageSize: ps, pages: Math.max(1, Math.ceil(total / ps)) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Fetch single product by id
router.get('/:id', requireAuth, async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const row = await db.get('SELECT * FROM products WHERE id = ?', [id]);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true, data: row });
});

// Create product
router.post('/', requireAuth, async (req, res) => {
  const { code, name, category_id, price, image_url, is_active, options_json } = req.body as any;
  if (!code || !name || price == null) return res.status(400).json({ error: 'Missing required fields: code, name, price' });
  const priceNum = Number(price);
  if (!(priceNum >= 0)) return res.status(400).json({ error: 'Price must be a non-negative number' });
  const catId = category_id != null && category_id !== '' ? Number(category_id) : null;

  let optionsStr: string | null = null;
  if (options_json !== undefined) {
    try {
      // Accept object/array -> stringify; string -> validate JSON or set null if empty
      if (typeof options_json === 'string') {
        if (options_json.trim() === '') {
          optionsStr = null;
        } else {
          JSON.parse(options_json); // validate
          optionsStr = options_json;
        }
      } else {
        optionsStr = JSON.stringify(options_json);
      }
    } catch (e) {
      return res.status(400).json({ error: 'options_json must be valid JSON' });
    }
  }

  try {
    const db = getDb();
    const result = await db.run(
      `INSERT INTO products (code, name, category_id, price, image_url, is_active, created_at, updated_at, options_json)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
      [String(code).trim(), String(name).trim(), catId, priceNum, image_url || null, is_active != null ? (is_active ? 1 : 0) : 1, optionsStr]
    );
    const newRow = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
    res.json({ ok: true, data: newRow });
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE') && String(err?.message || '').includes('code')) {
      return res.status(400).json({ error: 'Product code must be unique' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { code, name, category_id, price, image_url, is_active, options_json } = req.body as any;
  const fields: string[] = [];
  const params: any[] = [];

  function setField(sql: string, value: any) {
    fields.push(sql);
    params.push(value);
  }

  if (code != null) setField('code = ?', String(code).trim());
  if (name != null) setField('name = ?', String(name).trim());
  if (category_id !== undefined) setField('category_id = ?', category_id != null && category_id !== '' ? Number(category_id) : null);
  if (price != null) {
    const priceNum = Number(price);
    if (!(priceNum >= 0)) return res.status(400).json({ error: 'Price must be a non-negative number' });
    setField('price = ?', priceNum);
  }
  if (image_url !== undefined) setField('image_url = ?', image_url || null);
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
    } catch (e) {
      return res.status(400).json({ error: 'options_json must be valid JSON' });
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const db = getDb();
    await db.run(`UPDATE products SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...params, id]);
    const row = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true, data: row });
  } catch (err: any) {
    if (String(err?.message || '').includes('UNIQUE') && String(err?.message || '').includes('code')) {
      return res.status(400).json({ error: 'Product code must be unique' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Soft delete (disable) product
router.delete('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const db = getDb();
    const result = await db.run(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    const row = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disable product' });
  }
});

// Effective modifiers for a product: union of category + product assignments
router.get('/:id/modifiers', requireAuth, async (req, res) => {
  const productId = Number(req.params.id);
  const db = getDb();
  const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const categoryId = (product as any).category_id as number | null;

  let modsFromCategory: any[] = [];
  if (categoryId) {
    modsFromCategory = await db.all(
      `SELECT m.*, 'category' as source FROM modifier_assignments ma
       JOIN modifiers m ON m.id = ma.modifier_id
       WHERE ma.entity_type = 'category' AND ma.entity_id = ? AND m.is_active = 1
       ORDER BY m.sort_order, m.id`,
      [categoryId]
    );
  }

  const modsFromProduct = await db.all(
    `SELECT m.*, 'product' as source FROM modifier_assignments ma
     JOIN modifiers m ON m.id = ma.modifier_id
     WHERE ma.entity_type = 'product' AND ma.entity_id = ? AND m.is_active = 1
     ORDER BY m.sort_order, m.id`,
    [productId]
  );

  const map = new Map<number, any>();
  for (const m of [...modsFromCategory, ...modsFromProduct]) map.set(m.id, m);
  const mods = Array.from(map.values());

  const result: any[] = [];
  for (const m of mods) {
    const options = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ? AND is_active = 1 ORDER BY sort_order, id', [m.id]);
    result.push({ ...m, options });
  }

  res.json({ ok: true, data: result });
});