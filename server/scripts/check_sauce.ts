import { getDb } from '../src/lib/db';

async function checkModifierOptions() {
  const db = getDb();
  
  // Get the Sauce modifier
  const modifier = await db.get("SELECT * FROM modifiers WHERE name = 'Sauce'");
  if (!modifier) {
    console.log("Modifier 'Sauce' not found!");
    return;
  }
  console.log("Found Modifier:", modifier);

  // Get options for this modifier
  const options = await db.all("SELECT * FROM modifier_options WHERE modifier_id = ?", [modifier.id]);
  console.log("Options found:", options.length);
  options.forEach(o => console.log(`- ${o.name} (id: ${o.id})`));
}

checkModifierOptions();
