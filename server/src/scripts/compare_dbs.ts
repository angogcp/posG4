import sqlite3 from 'sqlite3';
import path from 'path';
import { getDb } from '../lib/db.js';

async function checkData() {
  // Check Local DB
  console.log('--- Local SQLite DB ---');
  const localDbPath = path.join(process.cwd(), 'data', 'pos.sqlite3');
  
  const localDb = new sqlite3.Database(localDbPath);
  
  const tables = ['users', 'products', 'orders', 'categories'];
  
  const queryLocal = (table: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      localDb.get(`SELECT count(*) as c FROM ${table}`, (err, row: any) => {
        if (err) reject(err);
        else resolve(row ? row.c : 0);
      });
    });
  };

  for (const table of tables) {
    try {
      const count = await queryLocal(table);
      console.log(`${table}: ${count}`);
    } catch (e) {
      console.log(`${table}: table not found or error`);
    }
  }
  
  localDb.close();

  // Check Turso DB
  console.log('\n--- Turso Remote DB ---');
  const tursoDb = getDb();
  try {
    for (const table of tables) {
      try {
        const result = await tursoDb.all(`SELECT count(*) as c FROM ${table}`);
        const count = result[0] ? (result[0] as any).c : 0; 
        console.log(`${table}: ${count}`);
      } catch (e) {
        console.log(`${table}: error ${e.message}`);
      }
    }
  } catch (e) {
    console.error('Error checking Turso DB:', e);
  }
}

checkData();
