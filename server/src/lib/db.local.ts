import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

export interface RunResult { lastID: number; changes: number }

interface Database {
  run: (sql: string, params?: any[]) => Promise<RunResult>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  exec: (sql: string) => Promise<void>;
  close: () => Promise<void>;
}

let db: Database | null = null;

export function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

export function getDb(): Database {
  if (!db) {
    ensureDataDir();
    const dbPath = path.join(process.cwd(), 'data', 'pos.sqlite3');
    const rawDb = new sqlite3.Database(dbPath);

    // Custom wrappers to retain lastID/changes for run
    const run = (sql: string, params: any[] = []) => new Promise<RunResult>((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: (this as any).lastID, changes: (this as any).changes });
      });
    });
    const get = (sql: string, params: any[] = []) => new Promise<any>((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    const all = (sql: string, params: any[] = []) => new Promise<any[]>((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
    const exec = (sql: string) => new Promise<void>((resolve, reject) => {
      rawDb.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    const close = () => new Promise<void>((resolve, reject) => {
      rawDb.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    db = { run, get, all, exec, close };
  }
  return db;
}

export async function initDb() {
  const database = getDb();

  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      price REAL NOT NULL,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      payment_method TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS printers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip_address TEXT,
      port INTEGER DEFAULT 9100,
      type TEXT DEFAULT 'thermal', -- 'thermal' | 'receipt' | 'label'
      location TEXT DEFAULT 'cashier', -- 'kitchen' | 'cashier' | 'bar' | 'other'
      connection_type TEXT DEFAULT 'wifi', -- 'wifi' | 'ethernet' | 'usb' | 'bluetooth'
      paper_width INTEGER DEFAULT 80, -- in mm
      -- 高级配置
      print_speed TEXT DEFAULT 'medium', -- 'slow' | 'medium' | 'fast'
      encoding TEXT DEFAULT 'utf8', -- 'utf8' | 'gb2312' | 'big5'
      auto_cut INTEGER DEFAULT 1, -- 0 | 1
      buzzer_enabled INTEGER DEFAULT 0, -- 0 | 1
      density INTEGER DEFAULT 8, -- 1-15
      -- 状态和备份
      config_backup TEXT, -- JSON格式的配置备份
      last_backup_at TEXT, -- 最后备份时间
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS print_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'receipt' | 'kitchen' | 'bar' | 'report'
      content TEXT NOT NULL,
      variables TEXT, -- JSON格式的可用变量列表
      paper_width INTEGER DEFAULT 80,
      font_size TEXT DEFAULT 'medium', -- 'small' | 'medium' | 'large'
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS print_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id INTEGER NOT NULL,
      template_id INTEGER,
      job_type TEXT NOT NULL, -- 'receipt' | 'kitchen' | 'bar' | 'report' | 'test'
      priority INTEGER DEFAULT 5, -- 1-10, 1=最高优先级
      content TEXT NOT NULL, -- 打印内容
      data_json TEXT, -- JSON格式的数据
      status TEXT DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      scheduled_at TEXT, -- 计划执行时间
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (printer_id) REFERENCES printers(id),
      FOREIGN KEY (template_id) REFERENCES print_templates(id)
    );
  `);

  // New tables for modifiers and assignments
  await database.exec(`
    CREATE TABLE IF NOT EXISTS modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      selection_type TEXT DEFAULT 'single', -- 'single' | 'multiple'
      min_choices INTEGER DEFAULT 0,
      max_choices INTEGER,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS modifier_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modifier_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price_delta REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (modifier_id) REFERENCES modifiers(id)
    );

    CREATE TABLE IF NOT EXISTS modifier_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modifier_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL, -- 'category' | 'product'
      entity_id INTEGER NOT NULL,
      FOREIGN KEY (modifier_id) REFERENCES modifiers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_modifier_options_modifier_id ON modifier_options(modifier_id);
    CREATE INDEX IF NOT EXISTS idx_modifier_assignments_entity ON modifier_assignments(entity_type, entity_id);
    CREATE UNIQUE INDEX IF NOT EXISTS u_modifier_assignment ON modifier_assignments(modifier_id, entity_type, entity_id);
  `);

  // Tables management
  await database.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available', -- 'available', 'occupied', 'reserved'
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Lightweight migrations for new columns
  try {
    const productCols = await database.all("PRAGMA table_info(products)");
    const hasProductOptions = Array.isArray(productCols) && productCols.some((c: any) => c.name === 'options_json');
    if (!hasProductOptions) {
      await database.run("ALTER TABLE products ADD COLUMN options_json TEXT");
    }
  } catch (err) {
    console.warn('Warning: unable to ensure products.options_json column', err);
  }

  try {
    const orderItemCols = await database.all("PRAGMA table_info(order_items)");
    const colNames = Array.isArray(orderItemCols) ? new Set(orderItemCols.map((c: any) => c.name)) : new Set<string>();
    if (!colNames.has('options_json')) {
      await database.run("ALTER TABLE order_items ADD COLUMN options_json TEXT");
    }
    if (!colNames.has('status')) {
      await database.run("ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending'");
    }
  } catch (err) {
    console.warn('Warning: unable to ensure order_items columns', err);
  }

  // New: category-level options to allow shared modifiers across products in a category
  try {
    const catCols = await database.all("PRAGMA table_info(categories)");
    const hasCatOptions = Array.isArray(catCols) && catCols.some((c: any) => c.name === 'options_json');
    if (!hasCatOptions) {
      await database.run("ALTER TABLE categories ADD COLUMN options_json TEXT");
    }
  } catch (err) {
    console.warn('Warning: unable to ensure categories.options_json column', err);
  }

  // Add table_number and pax to orders
  try {
    const orderCols = await database.all("PRAGMA table_info(orders)");
    const colNames = Array.isArray(orderCols) ? new Set(orderCols.map((c: any) => c.name)) : new Set<string>();
    if (!colNames.has('table_number')) {
      await database.run("ALTER TABLE orders ADD COLUMN table_number TEXT");
    }
    if (!colNames.has('pax')) {
      await database.run("ALTER TABLE orders ADD COLUMN pax INTEGER DEFAULT 0");
    }
  } catch (err) {
    console.warn('Warning: unable to ensure orders columns for table/pax', err);
  }

  // 打印机表高级配置字段迁移
  try {
    const printerCols = await database.all("PRAGMA table_info(printers)");
    const existingColumns = new Set(printerCols.map((c: any) => c.name));
    
    const newColumns = [
      { name: 'print_speed', type: 'TEXT DEFAULT \'medium\'' },
      { name: 'encoding', type: 'TEXT DEFAULT \'utf8\'' },
      { name: 'auto_cut', type: 'INTEGER DEFAULT 1' },
      { name: 'buzzer_enabled', type: 'INTEGER DEFAULT 0' },
      { name: 'density', type: 'INTEGER DEFAULT 8' },
      { name: 'config_backup', type: 'TEXT' },
      { name: 'last_backup_at', type: 'TEXT' }
    ];
    
    for (const col of newColumns) {
      if (!existingColumns.has(col.name)) {
        await database.run(`ALTER TABLE printers ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added printer column: ${col.name}`);
      }
    }
  } catch (err) {
    console.warn('Warning: unable to ensure printer advanced config columns', err);
  }
}