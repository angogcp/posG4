import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';

export const router = Router();

// Validate a coupon code; looks up settings keys coupon.<CODE> (JSON),
// falls back to built-in examples: SAVE10 => 10% off, OFF5 => $5 off
router.post('/validate', async (req, res) => {
  const { code } = req.body as { code?: string };
  const trimmed = (code || '').toString().trim().toUpperCase();
  if (!trimmed) return res.status(400).json({ error: 'Missing code' });

  // Load coupon definitions from settings if present
  const db = getDb();
  let coupon: { code: string; type: 'percent' | 'amount'; value: number; label?: string } | null = null;
  try {
    const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'coupon.%'");
    const map = new Map<string, { type: 'percent' | 'amount'; value: number; label?: string }>();
    for (const r of rows as any[]) {
      const key: string = (r as any).key;
      const val: string = (r as any).value ?? '';
      const c = key.replace(/^coupon\./, '').toUpperCase();
      try {
        const parsed = JSON.parse(val);
        if (parsed && (parsed.type === 'percent' || parsed.type === 'amount') && typeof parsed.value === 'number') {
          map.set(c, { type: parsed.type, value: parsed.value, label: parsed.label });
        }
      } catch {
        // support value like "10%" or "5" as simple strings
        const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(val);
        if (m) {
          map.set(c, { type: 'percent', value: parseFloat(m[1]) });
        } else if (!isNaN(Number(val))) {
          map.set(c, { type: 'amount', value: Number(val) });
        }
      }
    }

    // Built-in defaults if none configured
    if (!map.size) {
      map.set('SAVE10', { type: 'percent', value: 10, label: '10% off' });
      map.set('OFF5', { type: 'amount', value: 5, label: '$5 off' });
    }

    const found = map.get(trimmed);
    if (found) {
      coupon = { code: trimmed, ...found } as any;
    }
  } catch (e) {
    // Fallback: built-ins
    if (trimmed === 'SAVE10') coupon = { code: 'SAVE10', type: 'percent', value: 10, label: '10% off' };
    if (trimmed === 'OFF5') coupon = { code: 'OFF5', type: 'amount', value: 5, label: '$5 off' };
  }

  if (!coupon) return res.status(404).json({ error: 'Invalid coupon' });
  return res.json({ ok: true, data: coupon });
});