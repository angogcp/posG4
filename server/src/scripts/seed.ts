import { getDb } from '../lib/db.js';
import bcrypt from 'bcryptjs';

async function main() {
  const db = getDb();

  // Seed admin user
  const passwordHash = bcrypt.hashSync('admin123', 10);
  try {
    await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', passwordHash, 'admin']);
  } catch {}

  // Seed categories
  const categories = ['Coffee', 'Tea', 'Snacks'];
  for (let i = 0; i < categories.length; i++) {
    try {
      await db.run('INSERT INTO categories (name, sort_order) VALUES (?, ?)', [categories[i], i]);
    } catch {}
  }

  // Seed products
  const products = [
    { code: 'CF-001', name: 'Americano', category: 'Coffee', price: 8.0 },
    { code: 'CF-002', name: 'Latte', category: 'Coffee', price: 10.0 },
    { code: 'TE-001', name: 'Green Tea', category: 'Tea', price: 7.0 },
    { code: 'SN-001', name: 'Cookie', category: 'Snacks', price: 5.0 }
  ];

  for (const p of products) {
    const row = await db.get('SELECT id FROM categories WHERE name = ?', [p.category]) as any;
    if (!row) continue;
    try {
      await db.run('INSERT INTO products (code, name, category_id, price) VALUES (?, ?, ?, ?)', [p.code, p.name, row.id, p.price]);
    } catch {}
  }

  // Seed settings
  try {
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['store.name', 'POS G4 Cafe']);
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['store.address', '123 Main Street']);
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['store.phone', '+60 12-345 6789']);
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tax.rate', '10']);
  } catch {}

  console.log('Seed completed. Admin login: admin / admin123');
}

main();