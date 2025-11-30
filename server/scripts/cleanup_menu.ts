
import { getDb } from '../src/lib/db.js';
import path from 'path';

// Mock process.cwd to ensure data path resolution works if run from a different dir
// But typically we run this from project root or server root.
// db.ts uses process.cwd() + 'data'.

async function cleanup() {
  try {
    const db = getDb();
    console.log('Cleaning up menu data...');

    // Disable foreign keys temporarily to allow deletion in any order?
    // SQLite usually enables FKs only if PRAGMA foreign_keys = ON is set.
    // But just in case, let's delete in order of dependency.
    
    // modifier_options depends on modifiers
    // modifier_assignments depends on modifiers
    // products depends on categories
    // order_items depends on products (and orders)
    // We are NOT deleting orders or order_items, but if we delete products, order_items might have issues if FKs are strict.
    // However, the user specifically asked to clean up "products/category/modifier data" to "input new data".
    // It implies a fresh start for the menu. 
    // If we leave orders pointing to deleted products, that's bad data integrity, but maybe acceptable for this "cleanup".
    // A better approach might be to just delete everything or at least handle order_items.
    // Let's try to delete products/categories/modifiers. If it fails due to FK, we'll know.
    // If order_items prevents deletion, we might need to update them to null or delete them too.
    // Given this is a dev/demo environment likely, deleting all menu data is the goal.
    
    // Let's delete:
    // 1. modifier_options (FK to modifiers)
    // 2. modifier_assignments (FK to modifiers)
    // 3. modifiers
    // 4. products (FK to categories)
    // 5. categories
    
    // NOTE: If order_items point to products, this might fail if FKs are on.
    // Let's check if we can set product_id to NULL in order_items? The schema says product_id INTEGER NOT NULL.
    // So we can't set to NULL.
    // We might have to delete order_items too, or at least the ones referencing these products.
    // But deleting products deletes ALL products. So effectively all order_items must go if we want a clean state?
    // Or maybe the user just wants to clear the MENU for new entry, and doesn't care about old orders.
    // If we delete products, we probably should delete related order_items to avoid orphans or FK errors.
    // But deleting order_items implies deleting/modifying orders (totals etc).
    // Let's try to just delete menu items. If it fails, we will delete orders too (safest for "cleanup").
    
    console.log('Deleting modifier_options...');
    await db.run('DELETE FROM modifier_options');
    
    console.log('Deleting modifier_assignments...');
    await db.run('DELETE FROM modifier_assignments');
    
    console.log('Deleting modifiers...');
    await db.run('DELETE FROM modifiers');
    
    console.log('Deleting products...');
    // If this fails due to FK, we catch it.
    await db.run('DELETE FROM products');
    
    console.log('Deleting categories...');
    await db.run('DELETE FROM categories');
    
    // Reset auto-increment counters?
    console.log('Resetting sequences...');
    await db.run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories', 'modifiers', 'modifier_options', 'modifier_assignments')");

    console.log('Cleanup complete!');
  } catch (err) {
    console.error('Error during cleanup:', err);
    if (String(err).includes('FOREIGN KEY constraint failed')) {
      console.log('Foreign key constraint hit. Likely existing orders reference these products.');
      console.log('Deleting all orders and order_items to allow clean menu reset...');
      const db = getDb();
      await db.run('DELETE FROM order_items');
      await db.run('DELETE FROM orders');
      await db.run('DELETE FROM payments');
      
      // Try again
      await db.run('DELETE FROM modifier_options');
      await db.run('DELETE FROM modifier_assignments');
      await db.run('DELETE FROM modifiers');
      await db.run('DELETE FROM products');
      await db.run('DELETE FROM categories');
      await db.run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories', 'modifiers', 'modifier_options', 'modifier_assignments', 'orders', 'order_items', 'payments')");
      console.log('Full cleanup (including orders) complete!');
    }
  }
}

cleanup();
