import { initDb, getDb } from '../lib/db.js';

async function checkModifiers() {
  await initDb();
  const db = getDb();
  
  console.log('Checking modifiers table...');
  const modifiers = await db.all('SELECT * FROM modifiers');
  console.log(`Found ${modifiers.length} modifiers:`);
  modifiers.forEach((m: any) => {
    console.log(`- [${m.id}] ${m.name} (Active: ${m.is_active})`);
  });

  if (modifiers.length > 0) {
    const firstId = (modifiers[0] as any).id;
    console.log(`\nChecking options for modifier ${firstId}...`);
    const options = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ?', [firstId]);
    console.log(`Found ${options.length} options:`);
    options.forEach((o: any) => {
        console.log(`  - ${o.name} (Price: ${o.price_delta})`);
    });
  }
}

checkModifiers().catch(console.error);
