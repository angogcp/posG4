
import fs from 'fs';
import path from 'path';
import { getDb } from '../src/lib/db';

const INPUT_FILE = path.resolve(process.cwd(), '../web/menulist/Western.json');

async function importWestern() {
  const db = getDb();

  // 1. Find or Create Category "Western"
  let categoryId: number;
  const cat = await db.get("SELECT id FROM categories WHERE name = 'Western'");
  if (cat) {
    categoryId = cat.id;
    console.log(`Found existing category 'Western' (ID: ${categoryId})`);
  } else {
    const info = await db.run("INSERT INTO categories (name, sort_order, is_active) VALUES ('Western', 10, 1)");
    categoryId = info.lastID;
    console.log(`Created new category 'Western' (ID: ${categoryId})`);
  }

  // 2. Read and Parse JSON
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`File not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
  const data = JSON.parse(rawData);

  if (!data.pdf_info || !data.pdf_info[0] || !data.pdf_info[0].para_blocks) {
    console.error('Invalid JSON structure: missing pdf_info/para_blocks');
    process.exit(1);
  }

  const blocks = data.pdf_info[0].para_blocks;
  let count = 0;

  // 3. Iterate and Extract
  for (const block of blocks) {
    if (block.type === 'text' && block.lines) {
      for (const line of block.lines) {
        for (const span of line.spans) {
            if (span.type === 'text' && span.content) {
                const text = span.content.trim();
                
                // Regex to match "Name Price" e.g., "chicken chop 鸡扒 16"
                const match = text.match(/^(.*?)\s+(\d+(\.\d+)?)$/);
                
                if (match) {
                    const name = match[1].trim();
                    const price = parseFloat(match[2]);
                    
                    if (name.length > 2 && price > 0) {
                        try {
                            const code = name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);
                            await db.run(
                              "INSERT INTO products (name, price, category_id, is_active, code) VALUES (?, ?, ?, 1, ?)", 
                              [name, price, categoryId, code]
                            );
                            console.log(`Imported: ${name} - ${price}`);
                            count++;
                        } catch (e) {
                            console.error(`Failed to import ${name}:`, e);
                        }
                    }
                }
            }
        }
      }
    }
  }

  console.log(`Import complete. Added ${count} products to 'Western'.`);
}

importWestern();
