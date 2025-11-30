
import { getDb } from '../src/lib/db.js';
import fs from 'fs';
import path from 'path';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

async function importWestern() {
  try {
    const db = getDb();
    const jsonPath = path.join(process.cwd(), '../web/menulist/Western.json');
    console.log(`Reading JSON from ${jsonPath}...`);
    
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(rawData);
    
    // Get 'Western' category ID
    const category = await db.get("SELECT id FROM categories WHERE name LIKE 'Western%'");
    if (!category) {
      console.error('Category "Western" not found. Please run seed_categories.ts first.');
      return;
    }
    const categoryId = category.id;
    console.log(`Found Category "Western" with ID: ${categoryId}`);

    const blocks = data.pdf_info[0].para_blocks;
    let count = 0;

    for (const block of blocks) {
      // We are looking for blocks that contain text which ends with a price number
      if (block.type === 'text' || block.type === 'title') {
        // Sometimes titles might be products if misclassified, but usually 'text'.
        // Let's look at lines/spans.
        for (const line of block.lines) {
          for (const span of line.spans) {
            const text = span.content.trim();
            // Regex to match "Name Price"
            // Matches anything followed by space and a number (integer or decimal) at the end
            const match = text.match(/^(.*)\s+(\d+(\.\d+)?)$/);
            
            if (match) {
              const name = match[1].trim();
              const price = parseFloat(match[2]);
              
              // Generate a code
              const code = `WES-${nanoid()}`;
              
              console.log(`Importing: ${name} - $${price}`);
              
              await db.run(
                'INSERT INTO products (code, name, category_id, price, is_active) VALUES (?, ?, ?, ?, ?)',
                [code, name, categoryId, price, 1]
              );
              count++;
            }
          }
        }
      }
    }

    console.log(`Successfully imported ${count} products into Western category.`);
  } catch (err) {
    console.error('Error importing products:', err);
  }
}

importWestern();
