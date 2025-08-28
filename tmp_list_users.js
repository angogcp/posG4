const path = require('path');
const sqlite3 = require('./server/node_modules/sqlite3');

function listDb(dbPath) {
  return new Promise((resolve, reject) => {
    const full = path.resolve(dbPath);
    const db = new sqlite3.Database(full, (err) => {
      if (err) return reject(err);
      db.all("SELECT id, username, role, is_active, length(password_hash) AS phlen, substr(password_hash,1,20) AS ph_prefix FROM users", [], (e, rows) => {
        if (e) { db.close(); return reject(e); }
        console.log(`DB: ${full}`);
        console.table(rows || []);
        db.close();
        resolve(rows);
      });
    });
  });
}

(async () => {
  try {
    await listDb('./data/pos.sqlite3');
  } catch (e) {
    console.error('Error reading root data DB:', e.message);
  }
  try {
    await listDb('./server/data/pos.sqlite3');
  } catch (e) {
    console.error('Error reading server data DB:', e.message);
  }
})();