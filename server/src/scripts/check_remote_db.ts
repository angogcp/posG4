
import { getDb } from '../lib/db.js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from server directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkRemoteDb() {
  try {
    console.log('Connecting to DB...');
    const db = getDb();
    
    console.log('Checking products count...');
    const products = await db.all('SELECT count(*) as count FROM products');
    console.log('Products count:', products[0].count);

    console.log('Checking categories count...');
    const categories = await db.all('SELECT count(*) as count FROM categories');
    console.log('Categories count:', categories[0].count);
    
    const sample = await db.all('SELECT id, name FROM products LIMIT 3');
    console.log('Sample products:', sample);

  } catch (error) {
    console.error('Error checking DB:', error);
  }
}

checkRemoteDb();
