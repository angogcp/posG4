
import sqlite3 from 'sqlite3';
import path from 'path';

const localDbPath = path.join(process.cwd(), 'data', 'pos.sqlite3');
const db = new sqlite3.Database(localDbPath);

db.all('SELECT count(*) as count FROM products', (err, rows: any[]) => {
    if (err) console.error(err);
    else console.log('Local Products Count:', rows[0].count);
    db.close();
});
