import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
export const router = Router();

// GET /api/orders with filters and pagination
router.get('/', requireAuth, async (req, res) => {
  const db = getDb();

  // Parse query params
  const qRaw = (req.query.q ?? '').toString().trim();
  const startDate = (req.query.start_date ?? '').toString().trim(); // format: YYYY-MM-DD
  const endDate = (req.query.end_date ?? '').toString().trim();     // format: YYYY-MM-DD
  const statusParam = (req.query.status ?? '').toString().trim();   // e.g. "open,preparing"

  let page = parseInt((req.query.page ?? '1').toString(), 10);
  let pageSize = parseInt((req.query.pageSize ?? '20').toString(), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 200) pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Build WHERE clauses
  const where: string[] = [];
  const params: any[] = [];

  if (qRaw) {
    // Match by order_number (case-insensitive like)
    where.push('LOWER(order_number) LIKE ?');
    params.push(`%${qRaw.toLowerCase()}%`);
  }

  // created_at is stored as SQLite datetime string; compare by date range
  if (startDate) {
    // include the entire start day
    where.push("datetime(created_at) >= datetime(? || ' 00:00:00')");
    params.push(startDate);
  }
  if (endDate) {
    // include the entire end day
    where.push("datetime(created_at) <= datetime(? || ' 23:59:59')");
    params.push(endDate);
  }

  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) {
      where.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Total count
  const totalRow = await db.get(`SELECT COUNT(*) as cnt FROM orders ${whereSql}`, params);
  const total = (totalRow as any)?.cnt ?? 0;

  // Paged data
  const rows = await db.all(
    `SELECT * FROM orders ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  res.json({ ok: true, data: rows, total, page, pageSize });
});

router.get('/:id', requireAuth, async (req, res) => {
  const db = getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [(order as any).id]);
  res.json({ ok: true, data: { order, items } });
});

router.post('/', requireAuth, async (req, res) => {
  const { items, discount_amount = 0, tax_amount = 0, payment_method, paid_amount, status: order_status } = req.body as any;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const db = getDb();
  const userId = (req.session as any).user.id;

  const subtotal = items.reduce((sum: number, it: any) => sum + it.quantity * it.unit_price, 0);
  const total = Math.max(0, subtotal - discount_amount + tax_amount);
  const orderNo = `POS-${nanoid()}`;
  const statusToUse = (order_status && typeof order_status === 'string') ? order_status : 'completed';

  try {
    const insertOrderSql = `
      INSERT INTO orders (order_number, user_id, subtotal, discount_amount, tax_amount, total_amount, paid_amount, payment_method, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const orderResult = await db.run(insertOrderSql, [orderNo, userId, subtotal, discount_amount, tax_amount, total, paid_amount, payment_method, statusToUse]);
    const orderId = orderResult.lastID;

    for (const it of items) {
      let optionsStr: string | null = null;
      if (it.options_json !== undefined) {
        try {
          if (typeof it.options_json === 'string') {
            if (it.options_json.trim() !== '') { JSON.parse(it.options_json); optionsStr = it.options_json; }
          } else {
            optionsStr = JSON.stringify(it.options_json);
          }
        } catch (e) {
          return res.status(400).json({ error: 'Item options_json must be valid JSON' });
        }
      }

      const itemStatus = typeof it.status === 'string' ? it.status : (statusToUse === 'completed' ? 'done' : 'pending');

      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, total_price, options_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, it.product_id, it.product_code, it.product_name, it.quantity, it.unit_price, it.quantity * it.unit_price, optionsStr, itemStatus]
      );
    }

    // Create payment record only if paid_amount is provided and method specified
    if (paid_amount != null && payment_method) {
      await db.run(`INSERT INTO payments (order_id, amount, method) VALUES (?, ?, ?)`, [orderId, paid_amount, payment_method]);
    }

    res.json({ ok: true, data: { order_id: orderId, order_number: orderNo, total_amount: total, status: statusToUse } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status
router.put('/:id/status', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as any;
  if (!status || typeof status !== 'string') return res.status(400).json({ error: 'status is required' });
  const db = getDb();
  const result = await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ ok: true });
});

// Update order item status
router.put('/:orderId/items/:itemId/status', requireAuth, async (req, res) => {
  const orderId = Number(req.params.orderId);
  const itemId = Number(req.params.itemId);
  const { status } = req.body as any;
  if (!status || typeof status !== 'string') return res.status(400).json({ error: 'status is required' });
  const db = getDb();
  // Ensure item belongs to order
  const item = await db.get('SELECT * FROM order_items WHERE id = ? AND order_id = ?', [itemId, orderId]);
  if (!item) return res.status(404).json({ error: 'Order item not found' });
  await db.run('UPDATE order_items SET status = ? WHERE id = ?', [status, itemId]);
  res.json({ ok: true });
});