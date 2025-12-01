import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../middleware/auth.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
export const router = Router();

// GET /api/orders with filters and pagination
router.get('/', async (req, res) => {
  const db = getDb();


  // Parse query params
  const qRaw = (req.query.q ?? '').toString().trim();
  const startDate = (req.query.start_date ?? '').toString().trim(); // format: YYYY-MM-DD
  const endDate = (req.query.end_date ?? '').toString().trim();     // format: YYYY-MM-DD
  const statusParam = (req.query.status ?? '').toString().trim();   // e.g. "open,preparing"
  const paymentStatus = (req.query.payment_status ?? '').toString().trim(); // 'paid' | 'unpaid'

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

  if (paymentStatus === 'paid') {
    where.push('paid_amount >= total_amount');
  } else if (paymentStatus === 'unpaid') {
    where.push('paid_amount < total_amount');
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

router.get('/:id', async (req, res) => {
  const db = getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [(order as any).id]);
  res.json({ ok: true, data: { order, items } });
});

// POST /api/orders - Create a new order
router.post('/', async (req, res) => {
  const { items, discount_amount = 0, tax_amount = 0, payment_method, paid_amount, status: order_status, table_number, pax } = req.body as any;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const db = getDb();
  let userId = (req.session as any)?.user?.id;

  // Fallback for Vercel or no-auth mode: use the first admin or any user
  if (!userId) {
    const adminUser = await db.get('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
    if (adminUser) {
      userId = (adminUser as any).id;
    } else {
      const anyUser = await db.get('SELECT id FROM users LIMIT 1');
      userId = (anyUser as any)?.id;
    }
  }
  
  // If still no user (empty DB?), use 0 or 1 as fallback (though constraints might fail)
  if (!userId) userId = 1; 

  const subtotal = items.reduce((sum: number, it: any) => sum + it.quantity * it.unit_price, 0);
  const total = Math.max(0, subtotal - discount_amount + tax_amount);
  const orderNo = `POS-${nanoid()}`;
  const statusToUse = (order_status && typeof order_status === 'string') ? order_status : 'completed';

  try {
    const insertOrderSql = `
      INSERT INTO orders (order_number, user_id, subtotal, discount_amount, tax_amount, total_amount, paid_amount, payment_method, status, table_number, pax)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const orderResult = await db.run(insertOrderSql, [orderNo, userId, subtotal, discount_amount, tax_amount, total, paid_amount, payment_method, statusToUse, table_number || null, pax || 0]);
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
    console.error('Failed to create order:', err);
    res.status(500).json({ error: 'Failed to create order: ' + (err as Error).message });
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

// Process payment for an order
router.post('/:id/pay', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { paid_amount, payment_method } = req.body as any;

  if (paid_amount == null || !payment_method) {
    return res.status(400).json({ error: 'paid_amount and payment_method are required' });
  }

  const db = getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    // For LibSQL over HTTP, transactions might behave differently or not be supported in the same way
    // Check if we can just run the updates sequentially.
    // If using @libsql/client with HTTP, 'BEGIN' might not work as expected if not using interactive tx.
    // But let's try to remove explicit transaction control if it fails, or use executeMultiple.
    
    // Option 1: Use batch/multiple if possible, but here we have logic.
    // Option 2: Just run commands sequentially. If one fails, we might have partial state, 
    // but for this simple app it's better than failing completely.
    
    // await db.run('BEGIN TRANSACTION');

    // Update order with payment details and status
    await db.run(
      'UPDATE orders SET paid_amount = ?, payment_method = ?, status = ? WHERE id = ?',
      [paid_amount, payment_method, 'completed', id]
    );

    // Insert into payments table
    await db.run(
      'INSERT INTO payments (order_id, amount, method) VALUES (?, ?, ?)',
      [id, paid_amount, payment_method]
    );

    // await db.run('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    // await db.run('ROLLBACK');
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Payment processing failed: ' + (err as any).message });
  }
});

// Add items to existing order
router.post('/:id/items', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { items, subtotal = 0, tax_amount = 0, total_amount = 0, discount_amount = 0 } = req.body as any;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const db = getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    // await db.run('BEGIN TRANSACTION');

    // Insert new items
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
          // Ignore invalid json
        }
      }

      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, total_price, options_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, it.product_id, it.product_code, it.product_name, it.quantity, it.unit_price, it.quantity * it.unit_price, optionsStr, 'pending']
      );
    }

    // Update order totals
    await db.run(
      `UPDATE orders 
       SET subtotal = subtotal + ?, 
           tax_amount = tax_amount + ?, 
           total_amount = total_amount + ?,
           discount_amount = discount_amount + ?
       WHERE id = ?`,
      [subtotal, tax_amount, total_amount, discount_amount, id]
    );

    // await db.run('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    // await db.run('ROLLBACK');
    console.error('Failed to add items to order:', err);
    res.status(500).json({ error: 'Failed to add items to order' });
  }
});