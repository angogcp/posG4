import { initDb, getDb } from '../lib/db.js';

async function assignWesternSauce() {
  await initDb();
  const db = getDb();

  // 1. Find Modifier
  const modifier = await db.get('SELECT id, name FROM modifiers WHERE name = ?', ['Western Sauce']);
  if (!modifier) {
    console.error('Western Sauce modifier not found!');
    return;
  }
  const modId = (modifier as any).id;
  console.log(`Found Modifier: ${modId} (${(modifier as any).name})`);

  // 2. Find Categories
  const categories = await db.all('SELECT id, name FROM categories');
  if (!categories || categories.length === 0) {
    console.log('No categories found to assign to.');
    return;
  }
  console.log(`Found ${categories.length} categories.`);

  // 3. Assign to each category
  for (const cat of categories) {
    const catId = (cat as any).id;
    const catName = (cat as any).name;
    
    // Check if already assigned
    const existing = await db.get(
      'SELECT id FROM modifier_assignments WHERE modifier_id = ? AND entity_type = ? AND entity_id = ?',
      [modId, 'category', catId]
    );

    if (existing) {
      console.log(`Already assigned to category "${catName}" (${catId}). Skipping.`);
    } else {
      await db.run(
        'INSERT INTO modifier_assignments (modifier_id, entity_type, entity_id) VALUES (?, ?, ?)',
        [modId, 'category', catId]
      );
      console.log(`Assigned to category "${catName}" (${catId}).`);
    }
  }
  console.log('Assignment complete.');
}

assignWesternSauce().catch(console.error);
