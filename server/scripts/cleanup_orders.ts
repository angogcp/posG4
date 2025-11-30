
import { getDb } from '../src/lib/db.js';

async function cleanupOrders() {
  try {
    const db = getDb();
    console.log('Cleaning up orders and kitchen display data...');

    // Delete in order of dependency
    console.log('Deleting order_items...');
    await db.run('DELETE FROM order_items');
    
    console.log('Deleting payments...');
    await db.run('DELETE FROM payments');

    console.log('Deleting orders...');
    await db.run('DELETE FROM orders');

    // Reset auto-increment counters for these tables
    console.log('Resetting sequences...');
    await db.run("DELETE FROM sqlite_sequence WHERE name IN ('orders', 'order_items', 'payments')");

    console.log('Orders cleanup complete! Kitchen display should be empty.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

cleanupOrders();
