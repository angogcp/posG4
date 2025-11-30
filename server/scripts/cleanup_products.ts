
import { getDb } from '../src/lib/db.js';

async function cleanupProducts() {
  try {
    const db = getDb();
    console.log('Cleaning up ONLY product items...');

    // We keep categories and modifiers definitions, but remove products and their assignments
    // entity_type = 'product'
    console.log('Deleting product modifier assignments...');
    await db.run("DELETE FROM modifier_assignments WHERE entity_type = 'product'");
    
    console.log('Deleting products...');
    await db.run('DELETE FROM products');
    
    // Reset sequence for products
    console.log('Resetting product sequence...');
    await db.run("DELETE FROM sqlite_sequence WHERE name = 'products'");

    console.log('Products cleaned up! Categories and Modifiers remain intact.');
  } catch (err) {
    console.error('Error cleaning products:', err);
  }
}

cleanupProducts();
