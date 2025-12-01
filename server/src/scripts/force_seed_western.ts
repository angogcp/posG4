
import { getDb } from '../lib/db.js';

async function run() {
  console.log('Force seeding Western Sauce...');
  const db = getDb();
  
  try {
    // 1. Ensure Modifier exists
    let modifier = await db.get('SELECT * FROM modifiers WHERE name = ?', ['Western Sauce']);
    if (!modifier) {
      console.log('Creating Western Sauce modifier...');
      const res = await db.run(`
        INSERT INTO modifiers (name, selection_type, min_choices, max_choices, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['Western Sauce', 'multiple', 0, null, 10, 1]);
      modifier = { id: res.lastID };
    } else {
      console.log('Western Sauce modifier already exists (ID: ' + modifier.id + ').');
    }

    // 2. Ensure Options exist
    const options = [
      'mushroom', 'black pepper', 'mint', 'basil', 'white sauce', 'tomato', 'parsley'
    ];
    
    for (let i = 0; i < options.length; i++) {
      const name = options[i];
      const existing = await db.get('SELECT * FROM modifier_options WHERE modifier_id = ? AND name = ?', [modifier.id, name]);
      if (!existing) {
        console.log(`Adding option: ${name}`);
        await db.run(`
          INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?)
        `, [modifier.id, name, 0, i, 1]);
      } else {
        console.log(`Option ${name} already exists.`);
      }
    }

    // 3. Assign to all categories
    console.log('Assigning to all categories...');
    const categories = await db.all('SELECT id FROM categories');
    for (const cat of categories) {
      const assignment = await db.get('SELECT * FROM modifier_assignments WHERE modifier_id = ? AND entity_type = ? AND entity_id = ?', 
        [modifier.id, 'category', cat.id]);
      
      if (!assignment) {
        await db.run(`
          INSERT INTO modifier_assignments (modifier_id, entity_type, entity_id)
          VALUES (?, ?, ?)
        `, [modifier.id, 'category', cat.id]);
        console.log(`Assigned to category ${cat.id}`);
      }
    }
    
    console.log('Done!');
  } catch (e) {
    console.error(e);
  }
}

run();
