import { getDb } from '../src/lib/db';

async function addSauceModifier() {
  const db = getDb();
  console.log('Adding "Sauce" modifier...');

  // 1. Create Modifier Group
  // Assuming 'single' selection for sauce (pick one)
  const modResult = await db.run(
    "INSERT INTO modifiers (name, selection_type, min_choices, max_choices) VALUES (?, ?, ?, ?)",
    ['Sauce', 'single', 0, 1]
  );
  const modifierId = modResult.lastID;
  console.log(`Created modifier group 'Sauce' (ID: ${modifierId})`);

  // 2. Add Options
  const options = [
    'mushroom', 
    'black pepper', 
    'mint', 
    'basil', 
    'white sauce', 
    'tomato', 
    'parsley'
  ];
  
  for (let i = 0; i < options.length; i++) {
    await db.run(
      "INSERT INTO modifier_options (modifier_id, name, price_delta, sort_order) VALUES (?, ?, ?, ?)",
      [modifierId, options[i], 0, i]
    );
    console.log(`Added option: ${options[i]}`);
  }

  // 3. Assign to 'Western' Category
  // This ensures all items in Western category get this modifier
  const cat = await db.get("SELECT id FROM categories WHERE name = 'Western'");
  if (cat) {
    try {
      await db.run(
        "INSERT INTO modifier_assignments (modifier_id, entity_type, entity_id) VALUES (?, ?, ?)",
        [modifierId, 'category', cat.id]
      );
      console.log(`Assigned 'Sauce' to category 'Western' (ID: ${cat.id})`);
    } catch (e) {
      console.log('Assignment likely already exists or failed:', e);
    }
  } else {
    console.warn("Category 'Western' not found. Modifier created but not assigned.");
  }
  
  console.log('Done!');
}

addSauceModifier();
