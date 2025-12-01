import 'dotenv/config';
import { getDb, initDb } from './src/lib/db.js';
import * as fs from 'fs';
import * as path from 'path';

const logFile = path.join(process.cwd(), 'check_result.txt');

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function check() {
  try {
    fs.writeFileSync(logFile, 'Starting check...\n');
    await initDb();
    const db = getDb();
    
    const tables = ['modifiers', 'modifier_options', 'modifier_assignments'];
    for (const t of tables) {
      const row = await db.get(`SELECT COUNT(*) as c FROM ${t}`);
      log(`${t}: ${(row as any).c}`);
    }

    const mods = await db.all('SELECT * FROM modifiers LIMIT 5');
    log('Sample modifiers: ' + JSON.stringify(mods, null, 2));
    
  } catch (e: any) {
    log('Error: ' + e.message + '\n' + e.stack);
  }
}

check();
