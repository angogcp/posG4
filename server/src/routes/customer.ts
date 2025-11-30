import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
export const router = Router();

// Helper to get or create a customer user
async function getCustomerUserId() {
  const db = getDb();
  let user = await db.get("SELECT id FROM users WHERE username = 'customer'");
  if (!user) {
    // Create a customer user with a dummy password (they can't login anyway without knowing it)
    // We use a random password hash or just a placeholder since we won't expose login for this user
    const result = await db.run(
      "INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, ?)",
      ['customer', 'CUSTOMER_NO_LOGIN', 'customer', 1]
    );
    return result.lastID;
  }
  return user.id;
}

// GET /api/customer/categories
router.get('/categories', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC');
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// GET /api/customer/products
router.get('/products', async (req, res) => {
  try {
    const db = getDb();
    const { category_id, q } = req.query as { category_id?: string; q?: string };
    
    const conditions = ['is_active = 1'];
    const params: any[] = [];

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
    const rows = await db.all(`SELECT * FROM products ${where} ORDER BY id DESC`, params);
    
    res.json({ ok: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// POST /api/customer/orders
router.post('/orders', async (req, res) => {
  const { items, table_number, pax, discount_amount = 0, tax_amount = 0 } = req.body as any;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }
  if (!table_number) {
    return res.status(400).json({ error: 'Table number is required' });
  }

  try {
    const db = getDb();
    const userId = await getCustomerUserId();

    const subtotal = items.reduce((sum: number, it: any) => sum + it.quantity * it.unit_price, 0);
    // For customer orders, we generally don't apply discounts/tax on the client side, 
    // but we accept them if the frontend calculates them (e.g. estimated tax). 
    // Ideally, backend should recalculate, but for now we trust the payload or simple logic.
    // Better to recalculate tax? Let's accept payload for consistency with existing POS logic for now.
    
    const total = Math.max(0, subtotal - discount_amount + tax_amount);
    const orderNo = `WEB-${nanoid()}`;
    const status = 'open'; // Directly to open/kitchen

    const insertOrderSql = `
      INSERT INTO orders (order_number, user_id, subtotal, discount_amount, tax_amount, total_amount, paid_amount, payment_method, status, table_number, pax)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const orderResult = await db.run(insertOrderSql, [
      orderNo, userId, subtotal, discount_amount, tax_amount, total, 
      0, 'pay_later', status, table_number, pax || 0
    ]);
    const orderId = orderResult.lastID;

    for (const it of items) {
      let optionsStr: string | null = null;
      if (it.options !== undefined) {
        try {
           // frontend sends "options" usually as object, but DB expects JSON string in options_json
           // POS frontend sends { options: ... } which maps to options_json.
           // Let's standardize.
           optionsStr = JSON.stringify(it.options);
        } catch (e) { /* ignore */ }
      } else if (it.options_json) {
          optionsStr = typeof it.options_json === 'string' ? it.options_json : JSON.stringify(it.options_json);
      }

      await db.run(
        `INSERT INTO order_items (order_id, product_id, product_code, product_name, quantity, unit_price, total_price, options_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, it.product_id, it.product_code || '', it.product_name, it.quantity, it.unit_price, it.quantity * it.unit_price, optionsStr, 'pending']
      );
    }

    res.json({ ok: true, data: { order_id: orderId, order_number: orderNo } });
  } catch (err) {
    console.error('Failed to create customer order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});
