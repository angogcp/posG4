import sqlite3 from 'sqlite3';
import path from 'path';
import { getDb } from '../lib/db.js';

async function migrate() {
  console.log('Starting migration from Local SQLite to Turso...');

  const localDbPath = path.join(process.cwd(), 'data', 'pos.sqlite3');
  const localDb = new sqlite3.Database(localDbPath);
  const tursoDb = getDb();

  const queryLocal = (sql: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      localDb.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  const tables = [
    'users',
    'categories',
    'products',
    'orders',
    'order_items',
    'payments',
    'settings',
    'printers',
    'print_templates'
  ];

  try {
    // Disable foreign key constraints temporarily if possible, or just delete in reverse order
    // Turso/LibSQL doesn't always support disabling FK easily via client, but we can delete child tables first.
    
    console.log('Cleaning up Turso DB...');
    await tursoDb.exec('DELETE FROM order_items');
    await tursoDb.exec('DELETE FROM payments');
    await tursoDb.exec('DELETE FROM orders');
    await tursoDb.exec('DELETE FROM products');
    await tursoDb.exec('DELETE FROM categories');
    await tursoDb.exec('DELETE FROM users');
    await tursoDb.exec('DELETE FROM settings');
    await tursoDb.exec('DELETE FROM printers');
    await tursoDb.exec('DELETE FROM print_templates');
    
    // Reset sequences if possible (sqlite_sequence), but simpler to just insert with explicit IDs.
    try {
        await tursoDb.exec('DELETE FROM sqlite_sequence');
    } catch (e: any) {
        console.log('Could not clear sqlite_sequence (might be fine):', e.message);
    }

    for (const table of tables) {
      console.log(`Migrating ${table}...`);
      let rows = [];
      try {
        rows = await queryLocal(`SELECT * FROM ${table}`);
      } catch (e) {
        console.log(`  Skipping ${table} (not found in local or empty)`);
        continue;
      }

      if (rows.length === 0) {
        console.log(`  No records in ${table}`);
        continue;
      }

      console.log(`  Found ${rows.length} records in ${table}`);

      // Construct INSERT statement
      // We assume all columns match.
      if (rows.length > 0) {
        const keys = Object.keys(rows[0]);
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;

        // Batch insert might be better, but let's do one by one for simplicity and error reporting
        // Or parallelize slightly.
        let successCount = 0;
        for (const row of rows) {
            const values = keys.map(k => row[k]);
            try {
                await tursoDb.run(sql, values);
                successCount++;
            } catch (e: any) {
                console.error(`  Failed to insert into ${table}:`, e.message);
            }
        }
        console.log(`  Successfully migrated ${successCount}/${rows.length} records for ${table}`);
      }
    }

    console.log('Migration completed successfully.');

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    localDb.close();
  }
}

migrate();
