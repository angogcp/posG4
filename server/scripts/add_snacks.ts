
import { getDb } from '../src/lib/db';

function generateCode(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const rawData = `
Snacks-french fried 炸薯条 	 6 
Snacks-wedges 炸薯块 	 7 
Snacks-fishfinger QQ鱼块 	 7 
Snacks-thai fishcake 泰式鱼饼 	 6.5 
Snacks-fried wanton 炸云吞 	 12 
Snacks-chicken wings 炸鸡翅 	 6.5 
Snacks-ikan bilis 酸辣鱼仔 	 7 
Snacks-mini snackplate 迷你拼盘 	 22 
Snacks-prawn roll 虾卷 	 10 
Snacks-chicken karaage 唐扬鸡 	 8.5 
Snacks-gyoza 煎饺 	 8 
Snacks-SABA fish 盐烧鲭鱼 	 15 
Snacks-tonkatsu 炸猪排 	 19 
Snacks-chicken katsu 炸鸡排 	 16 
Snacks-edamame 毛豆 	 6 
Snacks-yakitori 串烧鸡肉 	 9 
Snacks-chicken BBQ 蒙古烤鸡 	 16 
Snacks-pork BBQ 泰烤五花 	 19 
Snacks-lamb BBQ 蒙古烤羊 	 24 
Snacks-smoke duck 烤烟鸭 	 10 
Snacks-salmon head 三文鱼头 	 24 
Salad-vege salad 蔬果沙拉 	 8 
Salad-smokeduck salad 烟鸭沙拉 	 8 
Salad-thai salad 泰式沙拉 	 8 
Salad-thai okra 泰式秋葵 	 6.5 
Salad-chinese okra 刹椒秋葵 	 6.5 
Salad-fried enogi 乱草金针 	 6 
Salad-coleslaw 凉拌蔬菜 	 6.5 
Salad-broccori 香脆西兰花 	 10 
Others-thai taufu 泰式豆腐 	 8 
Others-fishball 乒兵鱼丸 	 7
`;

function parseLines(data: string) {
  const lines = data.trim().split('\n');
  const products: { name: string, price: number }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: Name (Price)
    // e.g. "Snacks-french fried 炸薯条 \t 6"
    // Regex: everything until the last number
    const match = trimmed.match(/^(.*?)[\s\t]+(\d+(\.\d+)?)\s*$/);
    
    if (match) {
      const name = match[1].trim();
      const price = parseFloat(match[2]);
      products.push({ name, price });
    } else {
      console.warn(`Could not parse line: ${trimmed}`);
    }
  }
  return products;
}

async function main() {
  try {
    const db = await getDb();
    const products = parseLines(rawData);
    
    console.log(`Parsed ${products.length} products.`);

    // 1. Get or Create Category "Snacks"
    let cat = await db.get('SELECT id FROM categories WHERE name = ?', 'Snacks');
    let categoryId;
    
    if (!cat) {
      console.log('Category "Snacks" not found. Creating...');
      const result = await db.run('INSERT INTO categories (name) VALUES (?)', 'Snacks');
      categoryId = result.lastID;
      console.log(`Created category "Snacks" with ID: ${categoryId}`);
    } else {
      categoryId = cat.id;
      console.log(`Found category "Snacks" with ID: ${categoryId}`);
    }

    // 2. Insert Products
    console.log(`Adding products...`);
    
    for (const p of products) {
      const code = generateCode(10);
      // Check if product exists to avoid duplicates
      const existing = await db.get('SELECT id FROM products WHERE name = ? AND category_id = ?', p.name, categoryId);
      
      if (!existing) {
        await db.run(
          'INSERT INTO products (name, price, category_id, code, is_active) VALUES (?, ?, ?, ?, 1)',
          [p.name, p.price, categoryId, code]
        );
        console.log(`Added: ${p.name}`);
      } else {
        console.log(`Skipped (exists): ${p.name}`);
      }
    }

    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
