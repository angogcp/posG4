import { initDb, getDb } from '../lib/db.js';

async function checkCategories() {
  await initDb();
  const db = getDb();
  const categories = await db.all('SELECT * FROM categories');
  console.log('Categories:', categories);
}

checkCategories().catch(console.error);
