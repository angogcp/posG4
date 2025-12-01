import axios from 'axios';
import fs from 'fs';

async function checkModifiersApi() {
  const url = 'http://localhost:4001/api/modifiers';
  const logPath = 'check_api_modifiers.log';
  const log = (msg: string) => {
      console.log(msg);
      fs.appendFileSync(logPath, msg + '\n');
  };

  log(`Fetching modifiers from ${url}...`);
  
  try {
    const res = await axios.get(url);
    log('Response status: ' + res.status);
    log('Response data: ' + JSON.stringify(res.data, null, 2));
    
    if (res.data.ok && Array.isArray(res.data.data)) {
        log(`Found ${res.data.data.length} modifiers via API.`);
        const western = res.data.data.find((m: any) => m.name === 'Western Sauce');
        if (western) {
            log('Western Sauce modifier found!');
        } else {
            log('Western Sauce modifier NOT found.');
        }
    } else {
        log('API returned unexpected structure or empty list.');
    }
  } catch (e: any) {
    log('API Error: ' + e.message);
    if (e.response) {
        log('Status: ' + e.response.status);
        log('Data: ' + JSON.stringify(e.response.data));
    }
  }
}

checkModifiersApi().catch(console.error);
