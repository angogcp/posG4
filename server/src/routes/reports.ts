import { Router } from 'express';
import { getDb } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const router = Router();

// GET /api/reports/sales?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Admin-only sales analytics: totals, daily series, payments breakdown, top products
router.get('/sales', requireAuth, requireRole('admin'), async (req, res) => {
  const db = getDb();

  const startDate = (req.query.start_date ?? '').toString().trim();
  const endDate = (req.query.end_date ?? '').toString().trim();

  const where: string[] = [];
  const params: any[] = [];

  if (startDate) {
    where.push("datetime(created_at) >= datetime(? || ' 00:00:00')");
    params.push(startDate);
  }
  if (endDate) {
    where.push("datetime(created_at) <= datetime(? || ' 23:59:59')");
    params.push(endDate);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const totals = await db.get(
      `SELECT 
        COUNT(*) AS orders_count,
        COALESCE(SUM(subtotal), 0) AS subtotal,
        COALESCE(SUM(discount_amount), 0) AS discount_amount,
        COALESCE(SUM(tax_amount), 0) AS tax_amount,
        COALESCE(SUM(total_amount), 0) AS total_amount,
        COALESCE(SUM(paid_amount), 0) AS paid_amount
      FROM orders ${whereSql}`,
      params
    );

    const byDay = await db.all(
      `SELECT strftime('%Y-%m-%d', created_at) AS day,
              COALESCE(SUM(total_amount), 0) AS total,
              COUNT(*) AS orders
       FROM orders ${whereSql}
       GROUP BY day
       ORDER BY day ASC`,
      params
    );

    const byPayment = await db.all(
      `SELECT COALESCE(payment_method, 'unknown') AS method,
              COALESCE(SUM(total_amount), 0) AS total,
              COUNT(*) AS orders
       FROM orders ${whereSql}
       GROUP BY method
       ORDER BY total DESC`,
      params
    );

    // top products by quantity and amount
    const itemsWhereSql = whereSql ? whereSql.replace(/\bcreated_at\b/g, 'o.created_at') : '';
    const topProducts = await db.all(
      `SELECT oi.product_id,
              oi.product_code,
              oi.product_name,
              COALESCE(SUM(oi.quantity), 0) AS quantity,
              COALESCE(SUM(oi.total_price), 0) AS amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       ${itemsWhereSql}
       GROUP BY oi.product_id, oi.product_code, oi.product_name
       ORDER BY quantity DESC, amount DESC
       LIMIT 10`,
      params
    );

    res.json({ ok: true, data: { totals, byDay, byPayment, topProducts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load sales reports' });
  }
});