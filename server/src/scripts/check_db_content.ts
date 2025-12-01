
import { getDb, initDb } from '../lib/db.js';
import fs from 'fs';
import path from 'path';

async function checkDb() {
  const logFile = path.join(process.cwd(), 'db_check_result.txt');
  const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
  };

  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  log('Checking database for Western Sauce modifier...');
  try {
    const db = getDb();
    // Check modifier
    const modifier = await db.get('SELECT * FROM modifiers WHERE name = ?', ['Western Sauce']);
    if (modifier) {
      log(`FOUND Modifier: ${JSON.stringify(modifier)}`);
      
      // Check options
      const options = await db.all('SELECT * FROM modifier_options WHERE modifier_id = ?', [modifier.id]);
      log(`Found ${options.length} options:`);
      options.forEach(o => log(`- ${o.name} (${o.price_delta})`));
      
      // Check assignments
      const assignments = await db.all('SELECT * FROM modifier_assignments WHERE modifier_id = ?', [modifier.id]);
      log(`Found ${assignments.length} assignments.`);
    } else {
      log('Modifier "Western Sauce" NOT FOUND in database.');
    }
    
    // List all modifiers
    const all = await db.all('SELECT * FROM modifiers');
    log(`Total modifiers in DB: ${all.length}`);
    all.forEach(m => log(`- ${m.name} (ID: ${m.id}, Active: ${m.is_active})`));

  } catch (e: any) {
    log('Error checking DB: ' + e.message);
  }
}

checkDb();
