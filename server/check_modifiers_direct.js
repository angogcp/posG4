import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const logFile = path.join(process.cwd(), 'check_output_direct.txt');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function main() {
  fs.writeFileSync(logFile, 'Starting direct check...\n');
  try {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    log('URL present: ' + !!url);
    log('Token present: ' + !!authToken);

    if (!url) {
        throw new Error('No DB URL');
    }

    const client = createClient({ url, authToken });
    log('Client created');

    const tables = ['modifiers', 'modifier_options', 'modifier_assignments'];
    for (const t of tables) {
      try {
        const rs = await client.execute(`SELECT COUNT(*) as c FROM ${t}`);
        log(`${t} count: ${rs.rows[0].c}`);
      } catch (err) {
        log(`Error querying ${t}: ${err.message}`);
      }
    }
    
    // Check if modifiers table has data but maybe 'is_active' is 0?
    const rs2 = await client.execute(`SELECT * FROM modifiers LIMIT 5`);
    log('Modifiers data: ' + JSON.stringify(rs2.rows));

    client.close();
  } catch (e) {
    log('Error: ' + e.message);
  }
}

main();
