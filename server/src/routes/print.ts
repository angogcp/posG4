import express, { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../lib/db.js';

type Request = express.Request;
type Response = express.Response;

const router = Router();

// 打印机状态接口
interface PrinterInfo {
  id: string;
  name: string;
  ip_address?: string;
  port?: number;
  type: 'thermal' | 'receipt' | 'label';
  location: 'kitchen' | 'cashier' | 'bar' | 'other';
  connection_type: 'wifi' | 'ethernet' | 'usb' | 'bluetooth';
  paper_width?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // 高级配置
  print_speed?: string;
  encoding?: string;
  auto_cut?: boolean;
  buzzer_enabled?: boolean;
  density?: number;
  config_backup?: string;
  last_backup_at?: string;
}

// 数据库打印机接口
interface DbPrinter {
  id: number;
  name: string;
  ip_address?: string;
  port: number;
  type: string;
  location: string;
  connection_type: string;
  paper_width: number;
  // 高级配置
  print_speed?: string;
  encoding?: string;
  auto_cut?: number;
  buzzer_enabled?: number;
  density?: number;
  config_backup?: string;
  last_backup_at?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// 小票数据接口
interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  orderNo: string;
  timestamp: string;
  items: ReceiptItem[];
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  paymentMethod: string;
  footer?: string;
}

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// 模拟打印机状态（实际项目中应该连接真实打印机）
let isConnected = false;
let currentPrinter: PrinterInfo | null = null;

// 辅助函数：将数据库打印机转换为API格式
function dbPrinterToApi(dbPrinter: DbPrinter): PrinterInfo {
  return {
    id: dbPrinter.id.toString(),
    name: dbPrinter.name,
    ip_address: dbPrinter.ip_address,
    port: dbPrinter.port,
    type: dbPrinter.type as 'thermal' | 'receipt' | 'label',
    location: dbPrinter.location as 'kitchen' | 'cashier' | 'bar' | 'other',
    connection_type: dbPrinter.connection_type as 'wifi' | 'ethernet' | 'usb' | 'bluetooth',
    paper_width: dbPrinter.paper_width,
    is_active: dbPrinter.is_active === 1,
    created_at: dbPrinter.created_at,
    updated_at: dbPrinter.updated_at,
    // 高级配置
    print_speed: dbPrinter.print_speed,
    encoding: dbPrinter.encoding,
    auto_cut: dbPrinter.auto_cut === 1,
    buzzer_enabled: dbPrinter.buzzer_enabled === 1,
    density: dbPrinter.density,
    config_backup: dbPrinter.config_backup,
    last_backup_at: dbPrinter.last_backup_at
  };
}

// 获取所有打印机
async function getAllPrinters(): Promise<PrinterInfo[]> {
  const db = getDb();
  const dbPrinters = await db.all('SELECT * FROM printers WHERE is_active = 1 ORDER BY location, name') as DbPrinter[];
  return dbPrinters.map(dbPrinterToApi);
}

// 打印机健康状态缓存
interface PrinterHealthStatus {
  printerId: string;
  isOnline: boolean;
  lastCheck: string;
  responseTime?: number;
  errorCount: number;
  lastError?: string;
}

const printerHealthCache = new Map<string, PrinterHealthStatus>();

// 检查打印机连接健康状态
async function checkPrinterHealth(printer: PrinterInfo): Promise<PrinterHealthStatus> {
  const startTime = Date.now();
  let isOnline = false;
  let responseTime = 0;
  let lastError: string | undefined;
  
  try {
    if (printer.connection_type === 'wifi' || printer.connection_type === 'ethernet') {
      // 网络打印机：尝试TCP连接测试
      const net = require('net');
      const socket = new net.Socket();
      
      const connectionPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 3000); // 3秒超时
        
        socket.connect(printer.port || 9100, printer.ip_address, () => {
          clearTimeout(timeout);
          responseTime = Date.now() - startTime;
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', (err) => {
          clearTimeout(timeout);
          lastError = err.message;
          socket.destroy();
          resolve(false);
        });
      });
      
      isOnline = await connectionPromise;
    } else {
      // USB/蓝牙打印机：标记为在线（实际项目中需要系统级检测）
      isOnline = true;
      responseTime = Date.now() - startTime;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Unknown error';
    isOnline = false;
  }
  
  const existingStatus = printerHealthCache.get(printer.id) || { 
    printerId: printer.id, 
    isOnline: false, 
    lastCheck: '', 
    errorCount: 0 
  };
  
  const healthStatus: PrinterHealthStatus = {
    printerId: printer.id,
    isOnline,
    lastCheck: new Date().toISOString(),
    responseTime: isOnline ? responseTime : undefined,
    errorCount: isOnline ? 0 : existingStatus.errorCount + 1,
    lastError
  };
  
  printerHealthCache.set(printer.id, healthStatus);
  return healthStatus;
}

// GET /api/print/status - 获取打印机状态（增强版）
router.get('/status', async (req: Request, res: Response) => {
  try {
    const allPrinters = await getAllPrinters();
    const statusPromises = allPrinters.map(async (printer) => {
      const health = await checkPrinterHealth(printer);
      return {
        ...printer,
        health
      };
    });
    
    const printerStatuses = await Promise.all(statusPromises);
    
    res.json({
      success: true,
      connected: isConnected,
      currentPrinter,
      printers: printerStatuses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting printer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printer status'
    });
  }
});

// GET /api/print/printers - 获取可用打印机列表
router.get('/printers', async (req: Request, res: Response) => {
  try {
    const printers = await getAllPrinters();
    res.json({
      success: true,
      printers,
      count: printers.length
    });
  } catch (error) {
    console.error('Error getting printer list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printer list'
    });
  }
});

// GET /printers - 直接获取打印机数组（用于前端兼容）
router.get('/', async (req: Request, res: Response) => {
  try {
    const printers = await getAllPrinters();
    res.json(printers);
  } catch (error) {
    console.error('Error getting printer list:', error);
    res.status(500).json([]);
  }
});

// GET /api/print/health/:id - 获取单个打印机健康状态
router.get('/health/:id', async (req: Request, res: Response) => {
  try {
    const printerId = req.params.id;
    const printers = await getAllPrinters();
    const printer = printers.find(p => p.id === printerId);
    
    if (!printer) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }
    
    const health = await checkPrinterHealth(printer);
    
    res.json({
      success: true,
      printer,
      health
    });
  } catch (error) {
    console.error('Error checking printer health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check printer health'
    });
  }
});

// POST /api/print/connect - 连接打印机
router.post('/connect', [
  body('printerId').notEmpty().withMessage('Printer ID is required'),
  body('connectionType').isIn(['wifi', 'ethernet', 'usb', 'bluetooth']).withMessage('Invalid connection type')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { printerId, connectionType } = req.body;
    
    // 查找打印机
    const printers = await getAllPrinters();
    const printer = printers.find(p => p.id === printerId);
    if (!printer) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }

    if (!printer.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Printer is inactive'
      });
    }

    // 模拟连接过程
    currentPrinter = printer;
    isConnected = true;

    res.json({
      success: true,
      message: 'Connected to printer successfully',
      printer: currentPrinter
    });
  } catch (error) {
    console.error('Error connecting to printer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to printer'
    });
  }
});

// POST /api/print/test-connection - 测试打印机连接
router.post('/test-connection', [
  body('printerId').notEmpty().withMessage('Printer ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { printerId } = req.body;
    const printers = await getAllPrinters();
    const printer = printers.find(p => p.id === printerId);
    
    if (!printer) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }

    // 执行连接测试
    const testResults = {
      pingTest: false,
      portTest: false,
      escPosTest: false,
      responseTime: 0,
      errorMessage: ''
    };

    try {
      if (printer.connection_type === 'wifi' || printer.connection_type === 'ethernet') {
        // 1. Ping测试（简化版TCP连接测试）
        const startTime = Date.now();
        const net = require('net');
        
        const pingPromise = new Promise<boolean>((resolve) => {
          const socket = new net.Socket();
          const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
          }, 2000);
          
          socket.connect(printer.port || 9100, printer.ip_address, () => {
            clearTimeout(timeout);
            testResults.responseTime = Date.now() - startTime;
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', (err) => {
            clearTimeout(timeout);
            testResults.errorMessage = err.message;
            socket.destroy();
            resolve(false);
          });
        });
        
        testResults.pingTest = await pingPromise;
        testResults.portTest = testResults.pingTest;

        // 2. ESC/POS命令测试
        if (testResults.portTest) {
          const escPosPromise = new Promise<boolean>((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
              socket.destroy();
              resolve(false);
            }, 3000);
            
            socket.connect(printer.port || 9100, printer.ip_address, () => {
              // 发送简单的ESC/POS状态查询命令
              const statusCommand = Buffer.from([0x10, 0x04, 0x01]); // DLE EOT n (查询打印机状态)
              socket.write(statusCommand);
              
              // 等待响应
              socket.on('data', (data: any) => {
                clearTimeout(timeout);
                socket.destroy();
                resolve(true);
              });
            });
            
            socket.on('error', () => {
              clearTimeout(timeout);
              socket.destroy();
              resolve(false);
            });
          });
          
          testResults.escPosTest = await escPosPromise;
        }
      } else {
        // USB/蓝牙打印机：标记为通过（实际项目中需要系统级检测）
        testResults.pingTest = true;
        testResults.portTest = true;
        testResults.escPosTest = true;
      }
    } catch (error) {
      testResults.errorMessage = error instanceof Error ? error.message : 'Test failed';
    }

    res.json({
      success: true,
      printer,
      testResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing printer connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test printer connection'
    });
  }
});
router.post('/disconnect', (req: Request, res: Response) => {
  try {
    isConnected = false;
    currentPrinter = null;

    res.json({
      success: true,
      message: 'Disconnected from printer successfully'
    });
  } catch (error) {
    console.error('Error disconnecting printer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect printer'
    });
  }
});

// POST /api/print/diagnosis - 打印机诊断工具
router.post('/diagnosis', [
  body('printerId').notEmpty().withMessage('Printer ID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { printerId } = req.body;
    const printers = await getAllPrinters();
    const printer = printers.find(p => p.id === printerId);
    
    if (!printer) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }

    // 执行全面诊断
    const diagnosis = {
      printer,
      health: await checkPrinterHealth(printer),
      connectivity: {
        canPing: false,
        canConnect: false,
        responseTime: 0,
        errorMessage: ''
      },
      escpos: {
        supportsStatusQuery: false,
        supportsCutCommand: false,
        supportsTextPrint: false
      },
      paperStatus: {
        hasError: false,
        isPaperOut: false,
        isCoverOpen: false
      },
      recommendations: [] as string[]
    };

    // 连接性诊断
    if (printer.connection_type === 'wifi' || printer.connection_type === 'ethernet') {
      try {
        const net = require('net');
        const startTime = Date.now();
        
        const connectPromise = new Promise<boolean>((resolve) => {
          const socket = new net.Socket();
          const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
          }, 3000);
          
          socket.connect(printer.port || 9100, printer.ip_address, () => {
            clearTimeout(timeout);
            diagnosis.connectivity.responseTime = Date.now() - startTime;
            diagnosis.connectivity.canConnect = true;
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', (err) => {
            clearTimeout(timeout);
            diagnosis.connectivity.errorMessage = err.message;
            socket.destroy();
            resolve(false);
          });
        });
        
        diagnosis.connectivity.canPing = await connectPromise;
        diagnosis.connectivity.canConnect = diagnosis.connectivity.canPing;
        
        // ESC/POS命令支持测试
        if (diagnosis.connectivity.canConnect) {
          const escPosTests = await Promise.all([
            testEscPosCommand(printer, [0x10, 0x04, 0x01]), // 状态查询
            testEscPosCommand(printer, [0x1D, 0x56, 0x00]), // 切纸命令
            testEscPosCommand(printer, Buffer.from('\n\nTest\n\n', 'utf8')) // 文本打印
          ]);
          
          diagnosis.escpos.supportsStatusQuery = escPosTests[0];
          diagnosis.escpos.supportsCutCommand = escPosTests[1];
          diagnosis.escpos.supportsTextPrint = escPosTests[2];
        }
      } catch (error) {
        diagnosis.connectivity.errorMessage = error instanceof Error ? error.message : 'Connectivity test failed';
      }
    } else {
      // USB/蓝牙打印机：模拟诊断结果
      diagnosis.connectivity.canPing = true;
      diagnosis.connectivity.canConnect = true;
      diagnosis.escpos.supportsStatusQuery = true;
      diagnosis.escpos.supportsCutCommand = true;
      diagnosis.escpos.supportsTextPrint = true;
    }

    // 生成建议
    if (!diagnosis.connectivity.canConnect) {
      diagnosis.recommendations.push('检查网络连接和打印机IP地址配置');
      diagnosis.recommendations.push('确保打印机电源已打开且处于就绪状态');
    }
    
    if (diagnosis.connectivity.responseTime > 1000) {
      diagnosis.recommendations.push('网络响应较慢，建议检查网络质量');
    }
    
    if (!diagnosis.escpos.supportsStatusQuery) {
      diagnosis.recommendations.push('打印机可能不支持ESC/POS协议，请检查打印机型号');
    }
    
    if (diagnosis.health.errorCount > 3) {
      diagnosis.recommendations.push('打印机在近期出现多次错误，建议重启打印机或联系技术支持');
    }

    res.json({
      success: true,
      diagnosis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during printer diagnosis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to diagnose printer'
    });
  }
});

// 辅助函数：测试ESC/POS命令
async function testEscPosCommand(printer: PrinterInfo, command: Buffer | number[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const net = require('net');
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 2000);
      
      socket.connect(printer.port || 9100, printer.ip_address, () => {
        const commandBuffer = Buffer.isBuffer(command) ? command : Buffer.from(command);
        socket.write(commandBuffer);
        
        // 等待短暂的响应时间
        setTimeout(() => {
          clearTimeout(timeout);
          socket.destroy();
          resolve(true);
        }, 500);
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(false);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

// POST /api/print/test - 测试打印
router.post('/test', (req: Request, res: Response) => {
  try {
    if (!isConnected || !currentPrinter) {
      return res.status(400).json({
        success: false,
        error: 'No printer connected'
      });
    }

    const { printer, settings } = req.body || {};
    const copies = Math.min(5, Math.max(1, Number(settings?.copies) || 1));
    const margins = { top: 2, right: 2, bottom: 2, left: 2, ...(settings?.margins || {}) };

    // 模拟测试打印
    console.log(`Test print sent to printer: ${currentPrinter.name}`);
    console.log('Test print options:', { requested_printer: printer, copies, margins, settings });
    console.log('Test print content:');
    console.log('================================');
    console.log('         测试打印页面');
    console.log('================================');
    console.log('打印机名称:', currentPrinter.name);
    console.log('连接类型:', currentPrinter.connection_type);
    console.log('打印时间:', new Date().toLocaleString('zh-CN'));
    console.log('================================');
    console.log('        测试打印成功');
    console.log('================================');

    res.json({
      success: true,
      message: 'Test print completed successfully',
      printer: currentPrinter.name,
      copies,
      margins,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during test print:', error);
    res.status(500).json({
      success: false,
      error: 'Test print failed'
    });
  }
});

// POST /api/print/receipt - 打印小票（支持智能路由）
router.post('/receipt', [
  // validators remain for legacy payload, but will be bypassed when an alternative receipt shape is provided
  body('order_id').optional().isInt().withMessage('Order ID must be int'),
  body('items').optional().isArray().withMessage('Items must be an array'),
  body('total').optional().isFloat({ min: 0 }).withMessage('Total must be non-negative')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const hasAltShape = req.body && req.body.order && Array.isArray(req.body.items);
      if (!hasAltShape) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }
    }

    const { order_id, items, total, customer_info, use_smart_routing = true } = req.body;
    
    const orderIdNormalized: number | null = typeof order_id === 'number' ? order_id : (req.body?.order?.id ?? null);
    const itemsNormalized: any[] = Array.isArray(items) && items.length ? items : (Array.isArray(req.body?.items) ? req.body.items : []);
    const totalNormalized: number = typeof total === 'number' ? total : (req.body?.order?.total_amount ?? req.body?.order?.total ?? req.body?.total_amount ?? 0);

    const printer = req.body?.printer;
    const settings = req.body?.settings || {};
    const copies = Math.min(5, Math.max(1, Number(settings?.copies) || 1));
    const margins = { top: 2, right: 2, bottom: 2, left: 2, ...(settings?.margins || {}) };

    // 如果启用智能路由且items包含product_id，则使用智能打印
    if (use_smart_routing && itemsNormalized.length > 0 && itemsNormalized[0].product_id) {
      // 转换为智能打印格式
      const order_items = itemsNormalized.map((item: any) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price ?? item.unit_price ?? 0
      }));
      
      const db = getDb();
      
      // 获取所有活跃的打印机
      const activePrinters = await getAllPrinters();
      if (activePrinters.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No active printers available'
        });
      }
      
      // 按打印机分组订单项目
      const printerGroups: Record<number, any[]> = {};
      
      for (const item of order_items) {
        const printerIds = await getPrinterConfigForProduct(db, item.product_id);
        
        // 如果没有配置打印机，使用默认打印机（第一个活跃的打印机）
        const targetPrinterIds = printerIds.length > 0 ? printerIds : [activePrinters[0].id];
        
        for (const printerId of targetPrinterIds) {
          if (!printerGroups[printerId]) {
            printerGroups[printerId] = [];
          }
          printerGroups[printerId].push(item);
        }
      }
      
      // 为每个打印机生成打印任务
      const printResults = [] as any[];
      
      for (const [printerIdStr, groupItems] of Object.entries(printerGroups)) {
        const printerId = parseInt(printerIdStr);
        const printerInfo = activePrinters.find(p => p.id === printerId.toString());
        
        if (!printerInfo) {
          console.warn(`Printer ${printerId} not found or inactive`);
          continue;
        }
        
        // 构建该打印机的小票数据
        const receiptData = {
          order_id: orderIdNormalized,
          items: groupItems.map((item: any) => ({
            name: item.name || `Product ${item.product_id}`,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
          })),
          total: (groupItems as any[]).reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0),
          customer_info,
          printer_location: printerInfo.location,
          timestamp: new Date().toISOString(),
          copies,
          margins
        };
        
        // 模拟打印操作
        console.log(`Smart printing to ${printerInfo.name} (${printerInfo.location}) with options:`, { copies, margins, requested_printer: printer });
        console.log('Receipt data:', receiptData);
        
        printResults.push({
          printer_id: printerId,
          printer_name: printerInfo.name,
          printer_location: printerInfo.location,
          items_count: (groupItems as any[]).length,
          total_amount: (receiptData as any).total,
          status: 'success',
          printed_at: new Date().toISOString(),
          copies
        });
      }
      
      res.json({
        success: true,
        message: `Receipt printed to ${printResults.length} printer(s) using smart routing`,
        order_id: orderIdNormalized,
        print_results: printResults,
        routing_type: 'smart',
        copies,
        margins
      });
      
    } else {
      // 传统打印模式：打印到默认打印机
      console.log('Traditional printing receipt with options:', { copies, margins, requested_printer: printer });
      console.log('Traditional printing receipt payload:', {
        order_id: orderIdNormalized,
        items: itemsNormalized,
        total: totalNormalized,
        customer_info,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Receipt printed successfully',
        order_id: orderIdNormalized,
        printed_at: new Date().toISOString(),
        routing_type: 'traditional',
        copies,
        margins
      });
    }
    
  } catch (error) {
    console.error('Error printing receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to print receipt'
    });
  }
});

// ==================== 打印机管理 CRUD 接口 ====================

// GET /api/print/manage/printers - 获取所有打印机（包括非活跃的）
router.get('/manage/printers', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const dbPrinters = await db.all('SELECT * FROM printers ORDER BY location, name') as DbPrinter[];
    const printers = dbPrinters.map(dbPrinterToApi);
    
    res.json({
      success: true,
      printers,
      count: printers.length
    });
  } catch (error) {
    console.error('Error getting all printers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printers'
    });
  }
});

// POST /api/print/manage/printers - 创建新打印机
router.post('/manage/printers', [
  body('name').notEmpty().withMessage('Printer name is required'),
  body('type').isIn(['thermal', 'receipt', 'label']).withMessage('Invalid printer type'),
  body('location').isIn(['kitchen', 'cashier', 'bar', 'other']).withMessage('Invalid location'),
  body('connection_type').isIn(['wifi', 'ethernet', 'usb', 'bluetooth']).withMessage('Invalid connection type'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('paper_width').optional().isInt({ min: 58, max: 112 }).withMessage('Paper width must be between 58mm and 112mm'),
  body('print_speed').optional().isIn(['slow', 'medium', 'fast']).withMessage('Invalid print speed'),
  body('encoding').optional().isIn(['utf8', 'gb2312', 'big5']).withMessage('Invalid encoding'),
  body('density').optional().isInt({ min: 1, max: 15 }).withMessage('Density must be between 1 and 15')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { 
      name, ip_address, port = 9100, type, location, connection_type, paper_width = 80,
      print_speed = 'medium', encoding = 'utf8', auto_cut = true, buzzer_enabled = false, density = 8
    } = req.body;
    
    const db = getDb();
    const result = await db.run(
      `INSERT INTO printers (name, ip_address, port, type, location, connection_type, paper_width, 
       print_speed, encoding, auto_cut, buzzer_enabled, density, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [name, ip_address, port, type, location, connection_type, paper_width, 
       print_speed, encoding, auto_cut ? 1 : 0, buzzer_enabled ? 1 : 0, density]
    );

    const newPrinter = await db.get('SELECT * FROM printers WHERE id = ?', [result.lastID]) as DbPrinter;
    
    res.status(201).json({
      success: true,
      message: 'Printer created successfully',
      printer: dbPrinterToApi(newPrinter)
    });
  } catch (error) {
    console.error('Error creating printer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create printer'
    });
  }
});

// PUT /api/print/manage/printers/:id - 更新打印机
router.put('/manage/printers/:id', [
  body('name').notEmpty().withMessage('Printer name is required'),
  body('type').isIn(['thermal', 'receipt', 'label']).withMessage('Invalid printer type'),
  body('location').isIn(['kitchen', 'cashier', 'bar', 'other']).withMessage('Invalid location'),
  body('connection_type').isIn(['wifi', 'ethernet', 'usb', 'bluetooth']).withMessage('Invalid connection type'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
  body('paper_width').optional().isInt({ min: 58, max: 112 }).withMessage('Paper width must be between 58mm and 112mm'),
  body('print_speed').optional().isIn(['slow', 'medium', 'fast']).withMessage('Invalid print speed'),
  body('encoding').optional().isIn(['utf8', 'gb2312', 'big5']).withMessage('Invalid encoding'),
  body('density').optional().isInt({ min: 1, max: 15 }).withMessage('Density must be between 1 and 15')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const printerId = parseInt(req.params.id);
    const { 
      name, ip_address, port = 9100, type, location, connection_type, paper_width = 80, is_active = true,
      print_speed = 'medium', encoding = 'utf8', auto_cut = true, buzzer_enabled = false, density = 8
    } = req.body;
    
    const db = getDb();
    
    // 检查打印机是否存在
    const existingPrinter = await db.get('SELECT id FROM printers WHERE id = ?', [printerId]);
    if (!existingPrinter) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }

    await db.run(
      `UPDATE printers SET name = ?, ip_address = ?, port = ?, type = ?, location = ?, connection_type = ?, 
       paper_width = ?, print_speed = ?, encoding = ?, auto_cut = ?, buzzer_enabled = ?, density = ?,
       is_active = ?, updated_at = datetime('now') WHERE id = ?`,
      [name, ip_address, port, type, location, connection_type, paper_width, 
       print_speed, encoding, auto_cut ? 1 : 0, buzzer_enabled ? 1 : 0, density,
       is_active ? 1 : 0, printerId]
    );

    const updatedPrinter = await db.get('SELECT * FROM printers WHERE id = ?', [printerId]) as DbPrinter;
    
    res.json({
      success: true,
      message: 'Printer updated successfully',
      printer: dbPrinterToApi(updatedPrinter)
    });
  } catch (error) {
    console.error('Error updating printer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update printer'
    });
  }
});

// DELETE /api/print/manage/printers/:id - 删除打印机（软删除）
router.delete('/manage/printers/:id', async (req: Request, res: Response) => {
  try {
    const printerId = parseInt(req.params.id);
    
    const db = getDb();
    
    // 检查打印机是否存在
    const existingPrinter = await db.get('SELECT id FROM printers WHERE id = ?', [printerId]);
    if (!existingPrinter) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }

    // 软删除：设置为非活跃状态
    await db.run(
      'UPDATE printers SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?',
      [printerId]
    );
    
    res.json({
      success: true,
      message: 'Printer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting printer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete printer'
    });
  }
});

// GET /api/print/manage/printers/:id - 获取单个打印机详情
router.get('/manage/printers/:id', async (req: Request, res: Response) => {
  try {
    const printerId = parseInt(req.params.id);
    
    const db = getDb();
    const dbPrinter = await db.get('SELECT * FROM printers WHERE id = ?', [printerId]) as DbPrinter;
    
    if (!dbPrinter) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found'
      });
    }
    
    res.json({
      success: true,
      printer: dbPrinterToApi(dbPrinter)
    });
  } catch (error) {
    console.error('Error getting printer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printer'
    });
  }
});

// ==================== 智能打印路由接口 ====================

// 获取商品/分类的打印机配置
async function getPrinterConfigForProduct(db: any, productId: number): Promise<number[]> {
  // 首先获取商品的打印机配置
  const product = await db.get('SELECT options_json, category_id FROM products WHERE id = ?', [productId]);
  if (!product) return [];
  
  let printerIds: number[] = [];
  
  // 检查商品级别的打印机配置
  if (product.options_json) {
    try {
      const options = JSON.parse(product.options_json);
      if (options.printers && Array.isArray(options.printers)) {
        printerIds = options.printers;
      }
    } catch (e) {
      console.warn('Failed to parse product options_json:', e);
    }
  }
  
  // 如果商品没有配置打印机，则继承分类的配置
  if (printerIds.length === 0 && product.category_id) {
    const category = await db.get('SELECT options_json FROM categories WHERE id = ?', [product.category_id]);
    if (category && category.options_json) {
      try {
        const options = JSON.parse(category.options_json);
        if (options.printers && Array.isArray(options.printers)) {
          printerIds = options.printers;
        }
      } catch (e) {
        console.warn('Failed to parse category options_json:', e);
      }
    }
  }
  
  return printerIds;
}

// POST /api/print/smart-print - 智能打印路由
router.post('/smart-print', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('order_items').isArray().withMessage('Order items must be an array'),
  body('order_items.*.product_id').isInt().withMessage('Product ID is required for each item'),
  body('order_items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('order_items.*.price').isFloat({ min: 0 }).withMessage('Price must be non-negative')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { order_id, order_items, customer_info = {} } = req.body;
    
    const db = getDb();
    
    // 获取所有活跃的打印机
    const activePrinters = await getAllPrinters();
    if (activePrinters.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active printers available'
      });
    }
    
    // 按打印机分组订单项目
    const printerGroups: { [printerId: number]: any[] } = {};
    
    for (const item of order_items) {
      const printerIds = await getPrinterConfigForProduct(db, item.product_id);
      
      // 如果没有配置打印机，使用默认打印机（第一个活跃的打印机）
      const targetPrinterIds = printerIds.length > 0 ? printerIds : [activePrinters[0].id];
      
      for (const printerId of targetPrinterIds) {
        if (!printerGroups[printerId]) {
          printerGroups[printerId] = [];
        }
        printerGroups[printerId].push(item);
      }
    }
    
    // 为每个打印机生成打印任务
    const printResults = [];
    
    for (const [printerIdStr, items] of Object.entries(printerGroups)) {
      const printerId = parseInt(printerIdStr);
      const printer = activePrinters.find(p => p.id === printerId.toString());
      
      if (!printer) {
        console.warn(`Printer ${printerId} not found or inactive`);
        continue;
      }
      
      // 构建该打印机的小票数据
      const receiptData = {
        order_id,
        items: items.map(item => ({
          name: item.name || `Product ${item.product_id}`,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        })),
        total: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        customer_info,
        printer_location: printer.location,
        timestamp: new Date().toISOString()
      };
      
      // 模拟打印操作
      console.log(`Printing to ${printer.name} (${printer.location}):`, receiptData);
      
      printResults.push({
        printer_id: printerId,
        printer_name: printer.name,
        printer_location: printer.location,
        items_count: items.length,
        total_amount: receiptData.total,
        status: 'success',
        printed_at: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: `Successfully printed to ${printResults.length} printer(s)`,
      print_results: printResults,
      total_printers: printResults.length
    });
    
  } catch (error) {
    console.error('Error in smart print:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process smart print'
    });
  }
});

// GET /api/print/product-printers/:productId - 获取商品的打印机配置
router.get('/product-printers/:productId', async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.productId);
    
    const db = getDb();
    const printerIds = await getPrinterConfigForProduct(db, productId);
    
    // 获取打印机详情
    const printers = [];
    for (const printerId of printerIds) {
      const dbPrinter = await db.get('SELECT * FROM printers WHERE id = ? AND is_active = 1', [printerId]) as DbPrinter;
      if (dbPrinter) {
        printers.push(dbPrinterToApi(dbPrinter));
      }
    }
    
    res.json({
      success: true,
      product_id: productId,
      printers,
      count: printers.length
    });
  } catch (error) {
    console.error('Error getting product printers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product printers'
    });
  }
});

export default router;

// ==================== 模板管理 API ====================

interface PrintTemplate {
  id: number;
  name: string;
  type: 'receipt' | 'kitchen' | 'bar' | 'report';
  content: string;
  variables: string[];
  paper_width: number;
  font_size: 'small' | 'medium' | 'large';
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbTemplate {
  id: number;
  name: string;
  type: string;
  content: string;
  variables: string;
  paper_width: number;
  font_size: string;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// 辅助函数：数据库模板转换为API格式
function dbTemplateToApi(dbTemplate: DbTemplate): PrintTemplate {
  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    type: dbTemplate.type as 'receipt' | 'kitchen' | 'bar' | 'report',
    content: dbTemplate.content,
    variables: dbTemplate.variables ? JSON.parse(dbTemplate.variables) : [],
    paper_width: dbTemplate.paper_width,
    font_size: dbTemplate.font_size as 'small' | 'medium' | 'large',
    is_default: dbTemplate.is_default === 1,
    is_active: dbTemplate.is_active === 1,
    created_at: dbTemplate.created_at,
    updated_at: dbTemplate.updated_at
  };
}

// GET /api/print/templates - 获取所有模板
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const dbTemplates = await db.all('SELECT * FROM print_templates ORDER BY type, is_default DESC, name') as DbTemplate[];
    const templates = dbTemplates.map(dbTemplateToApi);
    
    res.json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

// GET /api/print/templates/:id - 获取单个模板
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const db = getDb();
    const dbTemplate = await db.get('SELECT * FROM print_templates WHERE id = ?', [templateId]) as DbTemplate;
    
    if (!dbTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      template: dbTemplateToApi(dbTemplate)
    });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template'
    });
  }
});

// POST /api/print/templates - 创建新模板
router.post('/templates', [
  body('name').notEmpty().withMessage('Template name is required'),
  body('type').isIn(['receipt', 'kitchen', 'bar', 'report']).withMessage('Invalid template type'),
  body('content').notEmpty().withMessage('Template content is required'),
  body('paper_width').optional().isInt({ min: 58, max: 112 }).withMessage('Paper width must be between 58mm and 112mm'),
  body('font_size').optional().isIn(['small', 'medium', 'large']).withMessage('Invalid font size')
], async (req: Request, res: Response) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors.array()
      });
    }

    const { name, type, content, paper_width = 80, font_size = 'medium', is_default = false } = req.body;
    const db = getDb();
    
    // 如果设置为默认模板，先取消其他同类型模板的默认状态
    if (is_default) {
      await db.run('UPDATE print_templates SET is_default = 0 WHERE type = ?', [type]);
    }
    
    // 提取模板中的变量
    const variablePattern = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      if (!variables.includes(match[0])) {
        variables.push(match[0]);
      }
    }
    
    const result = await db.run(
      `INSERT INTO print_templates (name, type, content, variables, paper_width, font_size, is_default, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [name, type, content, JSON.stringify(variables), paper_width, font_size, is_default ? 1 : 0]
    );

    const newTemplate = await db.get('SELECT * FROM print_templates WHERE id = ?', [result.lastID]) as DbTemplate;
    
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template: dbTemplateToApi(newTemplate)
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

// PUT /api/print/templates/:id - 更新模板
router.put('/templates/:id', [
  body('name').notEmpty().withMessage('Template name is required'),
  body('type').isIn(['receipt', 'kitchen', 'bar', 'report']).withMessage('Invalid template type'),
  body('content').notEmpty().withMessage('Template content is required'),
  body('paper_width').optional().isInt({ min: 58, max: 112 }).withMessage('Paper width must be between 58mm and 112mm'),
  body('font_size').optional().isIn(['small', 'medium', 'large']).withMessage('Invalid font size')
], async (req: Request, res: Response) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors.array()
      });
    }

    const templateId = parseInt(req.params.id);
    const { name, type, content, paper_width = 80, font_size = 'medium', is_default = false, is_active = true } = req.body;
    const db = getDb();
    
    // 检查模板是否存在
    const existingTemplate = await db.get('SELECT id FROM print_templates WHERE id = ?', [templateId]);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    // 如果设置为默认模板，先取消其他同类型模板的默认状态
    if (is_default) {
      await db.run('UPDATE print_templates SET is_default = 0 WHERE type = ? AND id != ?', [type, templateId]);
    }
    
    // 提取模板中的变量
    const variablePattern = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      if (!variables.includes(match[0])) {
        variables.push(match[0]);
      }
    }

    await db.run(
      `UPDATE print_templates SET name = ?, type = ?, content = ?, variables = ?, paper_width = ?, 
       font_size = ?, is_default = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
      [name, type, content, JSON.stringify(variables), paper_width, font_size, 
       is_default ? 1 : 0, is_active ? 1 : 0, templateId]
    );

    const updatedTemplate = await db.get('SELECT * FROM print_templates WHERE id = ?', [templateId]) as DbTemplate;
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      template: dbTemplateToApi(updatedTemplate)
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
});

// DELETE /api/print/templates/:id - 删除模板
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const db = getDb();
    
    // 检查模板是否存在
    const existingTemplate = await db.get('SELECT id FROM print_templates WHERE id = ?', [templateId]);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // 删除模板
    await db.run('DELETE FROM print_templates WHERE id = ?', [templateId]);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template'
    });
  }
});

// ==================== 打印队列管理 API ====================

interface PrintJob {
  id: number;
  printer_id: number;
  template_id?: number;
  job_type: 'receipt' | 'kitchen' | 'bar' | 'report' | 'test';
  priority: number;
  content: string;
  data_json?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface DbPrintJob {
  id: number;
  printer_id: number;
  template_id?: number;
  job_type: string;
  priority: number;
  content: string;
  data_json?: string;
  status: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// 辅助函数：数据库打印任务转换为API格式
function dbPrintJobToApi(dbJob: DbPrintJob): PrintJob {
  return {
    id: dbJob.id,
    printer_id: dbJob.printer_id,
    template_id: dbJob.template_id,
    job_type: dbJob.job_type as 'receipt' | 'kitchen' | 'bar' | 'report' | 'test',
    priority: dbJob.priority,
    content: dbJob.content,
    data_json: dbJob.data_json ? JSON.parse(dbJob.data_json) : null,
    status: dbJob.status as 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    error_message: dbJob.error_message,
    retry_count: dbJob.retry_count,
    max_retries: dbJob.max_retries,
    scheduled_at: dbJob.scheduled_at,
    started_at: dbJob.started_at,
    completed_at: dbJob.completed_at,
    created_at: dbJob.created_at,
    updated_at: dbJob.updated_at
  };
}

// 打印队列处理器
class PrintQueueProcessor {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.processingInterval) return;
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 5000); // 每5秒检查一次队列
    
    console.log('Print queue processor started');
  }

  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('Print queue processor stopped');
  }

  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    try {
      const db = getDb();
      
      // 获取待处理的任务（按优先级和创建时间排序）
      const pendingJobs = await db.all(
        `SELECT * FROM print_queue 
         WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
         ORDER BY priority ASC, created_at ASC 
         LIMIT 5`
      ) as DbPrintJob[];
      
      for (const job of pendingJobs) {
        await this.processJob(job);
      }
      
      // 处理失败的任务重试
      const failedJobs = await db.all(
        `SELECT * FROM print_queue 
         WHERE status = 'failed' AND retry_count < max_retries
         AND datetime('now') > datetime(updated_at, '+' || (retry_count * 30) || ' seconds')
         ORDER BY priority ASC, created_at ASC 
         LIMIT 3`
      ) as DbPrintJob[];
      
      for (const job of failedJobs) {
        await this.retryJob(job);
      }
      
    } catch (error) {
      console.error('Error processing print queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: DbPrintJob) {
    const db = getDb();
    
    try {
      // 更新状态为处理中
      await db.run(
        'UPDATE print_queue SET status = ?, started_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
        ['processing', job.id]
      );
      
      // 模拟打印操作（实际项目中需要实现真实的打印功能）
      console.log(`Processing print job ${job.id}:`, job.job_type, job.printer_id);
      console.log('Print content:', job.content);
      
      // 模拟打印时间
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 随机模拟成功/失败（实际中依据打印机响应决定）
      const isSuccess = Math.random() > 0.1; // 90%成功率
      
      if (isSuccess) {
        await db.run(
          'UPDATE print_queue SET status = ?, completed_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
          ['completed', job.id]
        );
        console.log(`Print job ${job.id} completed successfully`);
      } else {
        throw new Error('Print failed: Printer not responding');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Print job ${job.id} failed:`, errorMessage);
      
      await db.run(
        'UPDATE print_queue SET status = ?, error_message = ?, updated_at = datetime(\'now\') WHERE id = ?',
        ['failed', errorMessage, job.id]
      );
    }
  }

  private async retryJob(job: DbPrintJob) {
    const db = getDb();
    
    try {
      console.log(`Retrying print job ${job.id} (attempt ${job.retry_count + 1})`);
      
      await db.run(
        'UPDATE print_queue SET status = ?, retry_count = retry_count + 1, error_message = NULL, updated_at = datetime(\'now\') WHERE id = ?',
        ['pending', job.id]
      );
      
    } catch (error) {
      console.error(`Failed to retry print job ${job.id}:`, error);
    }
  }
}

// 初始化打印队列处理器
const printQueueProcessor = new PrintQueueProcessor();
printQueueProcessor.start();

// GET /api/print/queue - 获取打印队列
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const { status, printer_id, limit = 50, offset = 0 } = req.query;
    const db = getDb();
    
    let query = 'SELECT pq.*, p.name as printer_name FROM print_queue pq LEFT JOIN printers p ON pq.printer_id = p.id WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND pq.status = ?';
      params.push(status);
    }
    
    if (printer_id) {
      query += ' AND pq.printer_id = ?';
      params.push(printer_id);
    }
    
    query += ' ORDER BY pq.priority ASC, pq.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const jobs = await db.all(query, params) as (DbPrintJob & { printer_name: string })[];
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM print_queue WHERE 1=1';
    const countParams: any[] = [];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    if (printer_id) {
      countQuery += ' AND printer_id = ?';
      countParams.push(printer_id);
    }
    
    const countResult = await db.get(countQuery, countParams) as { total: number };
    
    res.json({
      success: true,
      jobs: jobs.map(job => ({
        ...dbPrintJobToApi(job),
        printer_name: job.printer_name
      })),
      total: countResult.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error getting print queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get print queue'
    });
  }
});

// POST /api/print/queue - 添加打印任务到队列
router.post('/queue', [
  body('printer_id').isInt().withMessage('Printer ID is required'),
  body('job_type').isIn(['receipt', 'kitchen', 'bar', 'report', 'test']).withMessage('Invalid job type'),
  body('content').notEmpty().withMessage('Print content is required'),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10')
], async (req: Request, res: Response) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors.array()
      });
    }

    const {
      printer_id, template_id, job_type, priority = 5, content, data_json,
      max_retries = 3, scheduled_at
    } = req.body;
    
    const db = getDb();
    
    // 检查打印机是否存在
    const printer = await db.get('SELECT id FROM printers WHERE id = ? AND is_active = 1', [printer_id]);
    if (!printer) {
      return res.status(404).json({
        success: false,
        error: 'Printer not found or inactive'
      });
    }
    
    const result = await db.run(
      `INSERT INTO print_queue (printer_id, template_id, job_type, priority, content, data_json, 
       max_retries, scheduled_at, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [printer_id, template_id, job_type, priority, content, 
       data_json ? JSON.stringify(data_json) : null, max_retries, scheduled_at]
    );

    const newJob = await db.get(
      'SELECT pq.*, p.name as printer_name FROM print_queue pq LEFT JOIN printers p ON pq.printer_id = p.id WHERE pq.id = ?', 
      [result.lastID]
    ) as DbPrintJob & { printer_name: string };
    
    res.status(201).json({
      success: true,
      message: 'Print job added to queue',
      job: {
        ...dbPrintJobToApi(newJob),
        printer_name: newJob.printer_name
      }
    });
  } catch (error) {
    console.error('Error adding print job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add print job'
    });
  }
});

// PUT /api/print/queue/:id/cancel - 取消打印任务
router.put('/queue/:id/cancel', async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    const db = getDb();
    
    const job = await db.get('SELECT * FROM print_queue WHERE id = ?', [jobId]) as DbPrintJob;
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Print job not found'
      });
    }
    
    if (job.status === 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel job that is currently processing'
      });
    }
    
    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Job is already completed or cancelled'
      });
    }
    
    await db.run(
      'UPDATE print_queue SET status = ?, updated_at = datetime(\'now\') WHERE id = ?',
      ['cancelled', jobId]
    );
    
    res.json({
      success: true,
      message: 'Print job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling print job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel print job'
    });
  }
});

// DELETE /api/print/queue/:id - 删除打印任务
router.delete('/queue/:id', async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    const db = getDb();
    
    const job = await db.get('SELECT * FROM print_queue WHERE id = ?', [jobId]) as DbPrintJob;
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Print job not found'
      });
    }
    
    if (job.status === 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete job that is currently processing'
      });
    }
    
    await db.run('DELETE FROM print_queue WHERE id = ?', [jobId]);
    
    res.json({
      success: true,
      message: 'Print job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting print job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete print job'
    });
  }
});

// ==================== 配置备份和恢复 ====================

// POST /api/print/backup-config - 备份所有打印机配置
router.post('/backup-config', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const printers = await db.all('SELECT * FROM printers') as DbPrinter[];
    
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      printers: printers.map(printer => ({
        ...dbPrinterToApi(printer),
        // 包含所有配置信息
        advancedConfig: {
          print_speed: printer.print_speed || 'medium',
          encoding: printer.encoding || 'utf8',
          auto_cut: printer.auto_cut === 1,
          buzzer_enabled: printer.buzzer_enabled === 1,
          density: printer.density || 8
        }
      }))
    };
    
    // 保存备份到数据库
    for (const printer of printers) {
      await db.run(
        'UPDATE printers SET config_backup = ?, last_backup_at = datetime(\'now\') WHERE id = ?',
        [JSON.stringify(backupData), printer.id]
      );
    }
    
    res.json({
      success: true,
      message: 'Configuration backup created successfully',
      backup: backupData,
      printers_count: printers.length
    });
  } catch (error) {
    console.error('Error creating configuration backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create configuration backup'
    });
  }
});

// POST /api/print/restore-config - 恢复打印机配置
router.post('/restore-config', [
  body('backup').notEmpty().withMessage('Backup data is required')
], async (req: Request, res: Response) => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors.array()
      });
    }

    const { backup, overwrite = false } = req.body;
    
    if (!backup.version || !backup.printers || !Array.isArray(backup.printers)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup format'
      });
    }

    const db = getDb();
    let restoredCount = 0;
    let skippedCount = 0;
    const restoreErrors: string[] = [];
    
    for (const printerBackup of backup.printers) {
      try {
        const { name, ip_address, port, type, location, connection_type, paper_width, advancedConfig } = printerBackup;
        
        // 检查是否已存在同名打印机
        const existingPrinter = await db.get('SELECT id FROM printers WHERE name = ?', [name]);
        
        if (existingPrinter && !overwrite) {
          skippedCount++;
          continue;
        }
        
        const configData = {
          name,
          ip_address: ip_address || null,
          port: port || 9100,
          type: type || 'thermal',
          location: location || 'cashier',
          connection_type: connection_type || 'wifi',
          paper_width: paper_width || 80,
          print_speed: advancedConfig?.print_speed || 'medium',
          encoding: advancedConfig?.encoding || 'utf8',
          auto_cut: advancedConfig?.auto_cut ? 1 : 0,
          buzzer_enabled: advancedConfig?.buzzer_enabled ? 1 : 0,
          density: advancedConfig?.density || 8
        };
        
        if (existingPrinter && overwrite) {
          // 更新现有打印机
          await db.run(
            `UPDATE printers SET ip_address = ?, port = ?, type = ?, location = ?, connection_type = ?, 
             paper_width = ?, print_speed = ?, encoding = ?, auto_cut = ?, buzzer_enabled = ?, density = ?, 
             updated_at = datetime('now') WHERE name = ?`,
            [configData.ip_address, configData.port, configData.type, configData.location, 
             configData.connection_type, configData.paper_width, configData.print_speed, 
             configData.encoding, configData.auto_cut, configData.buzzer_enabled, configData.density, name]
          );
        } else {
          // 创建新打印机
          await db.run(
            `INSERT INTO printers (name, ip_address, port, type, location, connection_type, paper_width, 
             print_speed, encoding, auto_cut, buzzer_enabled, density, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
            [configData.name, configData.ip_address, configData.port, configData.type, configData.location,
             configData.connection_type, configData.paper_width, configData.print_speed, configData.encoding,
             configData.auto_cut, configData.buzzer_enabled, configData.density]
          );
        }
        
        restoredCount++;
      } catch (error) {
        restoreErrors.push(`Failed to restore printer ${printerBackup.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    res.json({
      success: true,
      message: `Configuration restored successfully. ${restoredCount} printers restored, ${skippedCount} skipped.`,
      restored_count: restoredCount,
      skipped_count: skippedCount,
      errors: restoreErrors.length > 0 ? restoreErrors : undefined
    });
  } catch (error) {
    console.error('Error restoring configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore configuration'
    });
  }
});

// GET /api/print/export-config - 导出所有打印机配置为JSON文件
router.get('/export-config', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const printers = await db.all('SELECT * FROM printers WHERE is_active = 1') as DbPrinter[];
    
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      system: 'POS G433',
      printers: printers.map(printer => {
        const apiPrinter = dbPrinterToApi(printer);
        return {
          ...apiPrinter,
          advancedConfig: {
            print_speed: printer.print_speed || 'medium',
            encoding: printer.encoding || 'utf8',
            auto_cut: printer.auto_cut === 1,
            buzzer_enabled: printer.buzzer_enabled === 1,
            density: printer.density || 8
          }
        };
      })
    };
    
    // 设置响应头以下载JSON文件
    const filename = `pos_printer_config_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export configuration'
    });
  }
});