
import { getDb } from '../src/lib/db.js';

const categories = [
  'Bread & Wok fried',
  'Western',
  'Japanese Flavor 1',
  'Japanese Flavor 2',
  'Noodles & Rice',
  'Hot Pot',
  'Snacks',
  'Beverages'
];

async function seed() {
  try {
    const db = getDb();
    console.log('Seeding categories...');

    // Optional: Check if categories already exist or just insert.
    // Since we just cleaned up, we can insert.
    // But to be safe, we can insert only if not exists or just append.
    // Given the cleanup, we expect table to be empty or we want these to be added.

    for (let i = 0; i < categories.length; i++) {
      const name = categories[i];
      console.log(`Adding category: ${name}`);
      await db.run(
        'INSERT INTO categories (name, sort_order, is_active) VALUES (?, ?, ?)',
        [name, i + 1, 1]
      );
    }

    console.log('Categories seeded successfully!');
  } catch (err) {
    console.error('Error seeding categories:', err);
  }
}

seed();
