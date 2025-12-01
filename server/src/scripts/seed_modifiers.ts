import { getDb, initDb } from '../lib/db.js';

async function seedModifiers() {
  await initDb();
  const db = getDb();

  // Check if any modifiers exist
  const countRow = await db.get('SELECT COUNT(*) as cnt FROM modifiers');
  const count = (countRow as any)?.cnt || 0;
  
  if (count > 0) {
    console.log('Modifiers already exist. Skipping seed.');
    return;
  }

  console.log('Seeding modifiers...');

  // 1. Create "Sugar Level" modifier
  let res = await db.run(
    `INSERT INTO modifiers (name, description, selection_type, min_choices, max_choices, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Sugar Level', 'Choose sweetness level', 'single', 1, 1, 10, 1]
  );
  const sugarId = res.lastID;

  const sugarOptions = [
    { name: '0% No Sugar', price: 0, sort: 1 },
    { name: '30% Less Sugar', price: 0, sort: 2 },
    { name: '50% Half Sugar', price: 0, sort: 3 },
    { name: '70% Less Sugar', price: 0, sort: 4 },
    { name: '100% Normal Sugar', price: 0, sort: 5 }
  ];
  
  for (const opt of sugarOptions) {
    await db.run(
      `INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
      [sugarId, opt.name, opt.price, opt.sort, 1]
    );
  }

  // 2. Create "Ice Level" modifier
  res = await db.run(
    `INSERT INTO modifiers (name, description, selection_type, min_choices, max_choices, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Ice Level', 'Choose ice amount', 'single', 1, 1, 20, 1]
  );
  const iceId = res.lastID;

  const iceOptions = [
    { name: 'No Ice', price: 0, sort: 1 },
    { name: 'Less Ice', price: 0, sort: 2 },
    { name: 'Normal Ice', price: 0, sort: 3 },
    { name: 'More Ice', price: 0, sort: 4 }
  ];

  for (const opt of iceOptions) {
    await db.run(
      `INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
      [iceId, opt.name, opt.price, opt.sort, 1]
    );
  }

  // 3. Create "Toppings" modifier
  res = await db.run(
    `INSERT INTO modifiers (name, description, selection_type, min_choices, max_choices, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['Toppings', 'Add extra toppings', 'multiple', 0, 5, 30, 1]
  );
  const toppingId = res.lastID;

  const toppingOptions = [
    { name: 'Pearl', price: 1.5, sort: 1 },
    { name: 'Coconut Jelly', price: 1.5, sort: 2 },
    { name: 'Pudding', price: 2.0, sort: 3 },
    { name: 'Red Bean', price: 2.0, sort: 4 }
  ];

  for (const opt of toppingOptions) {
    await db.run(
      `INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order, is_active) VALUES (?, ?, ?, ?, ?)`,
      [toppingId, opt.name, opt.price, opt.sort, 1]
    );
  }

  console.log('Seeding completed.');
}

seedModifiers().catch(err => console.error(err));
