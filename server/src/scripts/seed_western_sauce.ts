import { getDb, initDb } from '../lib/db.js';

async function seedWesternSauce() {
  await initDb();
  const db = getDb();

  const modifierName = 'Western Sauce';
  
  // Check if exists
  const existing = await db.get('SELECT id FROM modifiers WHERE name = ?', [modifierName]);
  if (existing) {
    console.log(`Modifier "${modifierName}" already exists (ID: ${(existing as any).id}). Skipping.`);
    return;
  }

  console.log(`Creating modifier "${modifierName}"...`);

  // Create Modifier
  // selection_type: 'single' (choose one sauce)
  const res = await db.run(
    `INSERT INTO modifiers (name, description, selection_type, min_choices, max_choices, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [modifierName, 'Choose your sauce', 'single', 0, 1, 50, 1]
  );
  const modifierId = res.lastID;

  const options = [
    { name: 'Mushroom', price: 0 },
    { name: 'Black Pepper', price: 0 },
    { name: 'Mint', price: 0 },
    { name: 'Basil', price: 0 },
    { name: 'White Sauce', price: 0 },
    { name: 'Tomato', price: 0 },
    { name: 'Parsley', price: 0 }
  ];

  let sort = 1;
  for (const opt of options) {
    await db.run(
      `INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
      [modifierId, opt.name, opt.price, sort++, 1]
    );
  }

  console.log('Done.');
}

seedWesternSauce().catch(console.error);
