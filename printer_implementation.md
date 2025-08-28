# 热敏打印机双模式实现方案

## 一、架构设计

### 1.1 打印模式选择

系统支持两种打印模式：
- **直连模式**：Android客户端直接通过WiFi连接网络打印机
- **代理模式**：Android客户端通过Windows服务端连接打印机（USB/Serial/WiFi）

### 1.2 打印流程设计

```
用户触发打印
     ↓
检查打印机配置
     ↓
┌─────────────────┐
│  打印模式判断    │
└─────────────────┘
     ↓         ↓
  直连模式    代理模式
     ↓         ↓
 WiFi打印   服务端打印
```

## 二、Flutter客户端实现

### 2.1 打印服务抽象接口

```dart
// lib/core/services/printer_service.dart
abstract class PrinterService {
  Future<bool> isConnected();
  Future<bool> connect();
  Future<void> disconnect();
  Future<bool> printReceipt(ReceiptData data);
  Future<List<PrinterInfo>> discoverPrinters();
}

// 打印机信息模型
class PrinterInfo {
  final String id;
  final String name;
  final String ipAddress;
  final PrinterType type;
  final ConnectionType connectionType;
  
  const PrinterInfo({
    required this.id,
    required this.name,
    required this.ipAddress,
    required this.type,
    required this.connectionType,
  });
}

enum PrinterType { thermal, inkjet, laser }
enum ConnectionType { wifi, usb, serial, bluetooth }

// 小票数据模型
class ReceiptData {
  final String storeName;
  final String storeAddress;
  final String storePhone;
  final String orderNo;
  final DateTime timestamp;
  final List<ReceiptItem> items;
  final double totalAmount;
  final double discountAmount;
  final double paidAmount;
  final String paymentMethod;
  final String? footer;
  
  const ReceiptData({
    required this.storeName,
    required this.storeAddress,
    required this.storePhone,
    required this.orderNo,
    required this.timestamp,
    required this.items,
    required this.totalAmount,
    required this.discountAmount,
    required this.paidAmount,
    required this.paymentMethod,
    this.footer,
  });
}

class ReceiptItem {
  final String name;
  final int quantity;
  final double unitPrice;
  final double totalPrice;
  
  const ReceiptItem({
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });
}
```

### 2.2 WiFi直连打印实现

```dart
// lib/core/services/wifi_printer_service.dart
import 'dart:io';
import 'dart:typed_data';
import 'package:network_info_plus/network_info_plus.dart';

class WiFiPrinterService implements PrinterService {
  Socket? _socket;
  String? _printerIP;
  int _printerPort = 9100; // 默认热敏打印机端口
  
  @override
  Future<bool> connect() async {
    try {
      if (_printerIP == null) return false;
      
      _socket = await Socket.connect(_printerIP!, _printerPort);
      return _socket != null;
    } catch (e) {
      AppLogger.error('WiFi printer connection failed: $e');
      return false;
    }
  }
  
  @override
  Future<void> disconnect() async {
    try {
      await _socket?.close();
      _socket = null;
    } catch (e) {
      AppLogger.error('WiFi printer disconnect failed: $e');
    }
  }
  
  @override
  Future<bool> isConnected() async {
    return _socket != null;
  }
  
  @override
  Future<List<PrinterInfo>> discoverPrinters() async {
    final List<PrinterInfo> printers = [];
    
    try {
      // 获取当前网络信息
      final info = NetworkInfo();
      final wifiIP = await info.getWifiIP();
      
      if (wifiIP == null) return printers;
      
      // 扫描同网段的打印机
      final subnet = wifiIP.substring(0, wifiIP.lastIndexOf('.'));
      
      for (int i = 1; i <= 254; i++) {
        final ip = '$subnet.$i';
        
        try {
          final socket = await Socket.connect(ip, _printerPort, 
              timeout: const Duration(milliseconds: 500));
          
          // 发送测试命令
          socket.add([0x1B, 0x76]); // ESC v - 获取打印机状态
          
          await Future.delayed(const Duration(milliseconds: 100));
          
          printers.add(PrinterInfo(
            id: ip,
            name: 'Network Printer ($ip)',
            ipAddress: ip,
            type: PrinterType.thermal,
            connectionType: ConnectionType.wifi,
          ));
          
          await socket.close();
        } catch (e) {
          // 忽略连接失败的IP
        }
      }
    } catch (e) {
      AppLogger.error('Printer discovery failed: $e');
    }
    
    return printers;
  }
  
  @override
  Future<bool> printReceipt(ReceiptData data) async {
    try {
      if (_socket == null) {
        final connected = await connect();
        if (!connected) return false;
      }
      
      final commands = _generatePrintCommands(data);
      _socket!.add(commands);
      
      await Future.delayed(const Duration(milliseconds: 500));
      return true;
    } catch (e) {
      AppLogger.error('WiFi print failed: $e');
      return false;
    }
  }
  
  // 生成ESC/POS打印命令
  Uint8List _generatePrintCommands(ReceiptData data) {
    final List<int> commands = [];
    
    // 初始化打印机
    commands.addAll([0x1B, 0x40]); // ESC @ - 初始化
    
    // 设置字符集为UTF-8
    commands.addAll([0x1B, 0x74, 0x06]); // ESC t 6
    
    // 店铺信息 - 居中加粗
    commands.addAll([0x1B, 0x61, 0x01]); // ESC a 1 - 居中对齐
    commands.addAll([0x1B, 0x45, 0x01]); // ESC E 1 - 加粗
    commands.addAll(data.storeName.codeUnits);
    commands.addAll([0x0A]); // 换行
    
    commands.addAll([0x1B, 0x45, 0x00]); // ESC E 0 - 取消加粗
    commands.addAll(data.storeAddress.codeUnits);
    commands.addAll([0x0A]);
    commands.addAll('电话: ${data.storePhone}'.codeUnits);
    commands.addAll([0x0A, 0x0A]);
    
    // 订单信息
    commands.addAll([0x1B, 0x61, 0x00]); // ESC a 0 - 左对齐
    commands.addAll('订单号: ${data.orderNo}'.codeUnits);
    commands.addAll([0x0A]);
    commands.addAll('时间: ${_formatDateTime(data.timestamp)}'.codeUnits);
    commands.addAll([0x0A]);
    
    // 分割线
    commands.addAll('--------------------------------'.codeUnits);
    commands.addAll([0x0A]);
    
    // 商品列表
    commands.addAll('商品名称    数量  单价   小计'.codeUnits);
    commands.addAll([0x0A]);
    commands.addAll('--------------------------------'.codeUnits);
    commands.addAll([0x0A]);
    
    for (final item in data.items) {
      final line = '${item.name.padRight(12)} ${item.quantity.toString().padLeft(2)} '
          '${item.unitPrice.toStringAsFixed(2).padLeft(6)} '
          '${item.totalPrice.toStringAsFixed(2).padLeft(6)}';
      commands.addAll(line.codeUnits);
      commands.addAll([0x0A]);
    }
    
    // 分割线
    commands.addAll('--------------------------------'.codeUnits);
    commands.addAll([0x0A]);
    
    // 金额信息
    commands.addAll('小计: ${data.totalAmount.toStringAsFixed(2)}'.codeUnits);
    commands.addAll([0x0A]);
    
    if (data.discountAmount > 0) {
      commands.addAll('优惠: -${data.discountAmount.toStringAsFixed(2)}'.codeUnits);
      commands.addAll([0x0A]);
    }
    
    commands.addAll([0x1B, 0x45, 0x01]); // 加粗
    commands.addAll('实付: ${data.paidAmount.toStringAsFixed(2)}'.codeUnits);
    commands.addAll([0x1B, 0x45, 0x00]); // 取消加粗
    commands.addAll([0x0A]);
    
    commands.addAll('支付方式: ${data.paymentMethod}'.codeUnits);
    commands.addAll([0x0A, 0x0A]);
    
    // 底部信息
    if (data.footer != null) {
      commands.addAll([0x1B, 0x61, 0x01]); // 居中
      commands.addAll(data.footer!.codeUnits);
      commands.addAll([0x0A]);
    }
    
    // 切纸
    commands.addAll([0x0A, 0x0A, 0x0A]);
    commands.addAll([0x1D, 0x56, 0x42, 0x00]); // GS V B 0 - 切纸
    
    return Uint8List.fromList(commands);
  }
  
  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-'
        '${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:'
        '${dateTime.minute.toString().padLeft(2, '0')}:'
        '${dateTime.second.toString().padLeft(2, '0')}';
  }
  
  void setPrinterIP(String ip) {
    _printerIP = ip;
  }
  
  void setPrinterPort(int port) {
    _printerPort = port;
  }
}
```

### 2.3 服务端代理打印实现

```dart
// lib/core/services/server_printer_service.dart
class ServerPrinterService implements PrinterService {
  final ApiService _apiService;
  
  ServerPrinterService(this._apiService);
  
  @override
  Future<bool> connect() async {
    try {
      final response = await _apiService.get('/api/printer/status');
      return response['connected'] == true;
    } catch (e) {
      AppLogger.error('Server printer connection check failed: $e');
      return false;
    }
  }
  
  @override
  Future<void> disconnect() async {
    try {
      await _apiService.post('/api/printer/disconnect');
    } catch (e) {
      AppLogger.error('Server printer disconnect failed: $e');
    }
  }
  
  @override
  Future<bool> isConnected() async {
    return await connect();
  }
  
  @override
  Future<List<PrinterInfo>> discoverPrinters() async {
    try {
      final response = await _apiService.get('/api/printer/discover');
      final List<dynamic> printersData = response['printers'] ?? [];
      
      return printersData.map((data) => PrinterInfo(
        id: data['id'],
        name: data['name'],
        ipAddress: data['ipAddress'] ?? '',
        type: PrinterType.values.firstWhere(
          (e) => e.name == data['type'],
          orElse: () => PrinterType.thermal,
        ),
        connectionType: ConnectionType.values.firstWhere(
          (e) => e.name == data['connectionType'],
          orElse: () => ConnectionType.usb,
        ),
      )).toList();
    } catch (e) {
      AppLogger.error('Server printer discovery failed: $e');
      return [];
    }
  }
  
  @override
  Future<bool> printReceipt(ReceiptData data) async {
    try {
      final response = await _apiService.post('/api/printer/print', data: {
        'storeName': data.storeName,
        'storeAddress': data.storeAddress,
        'storePhone': data.storePhone,
        'orderNo': data.orderNo,
        'timestamp': data.timestamp.toIso8601String(),
        'items': data.items.map((item) => {
          'name': item.name,
          'quantity': item.quantity,
          'unitPrice': item.unitPrice,
          'totalPrice': item.totalPrice,
        }).toList(),
        'totalAmount': data.totalAmount,
        'discountAmount': data.discountAmount,
        'paidAmount': data.paidAmount,
        'paymentMethod': data.paymentMethod,
        'footer': data.footer,
      });
      
      return response['success'] == true;
    } catch (e) {
      AppLogger.error('Server print failed: $e');
      return false;
    }
  }
}
```

### 2.4 打印服务管理器

```dart
// lib/core/services/printer_manager.dart
enum PrintMode { direct, proxy }

class PrinterManager {
  static final PrinterManager _instance = PrinterManager._internal();
  factory PrinterManager() => _instance;
  PrinterManager._internal();
  
  PrinterService? _currentService;
  PrintMode _currentMode = PrintMode.proxy;
  
  // 初始化打印服务
  Future<void> initialize(PrintMode mode) async {
    _currentMode = mode;
    
    switch (mode) {
      case PrintMode.direct:
        _currentService = WiFiPrinterService();
        break;
      case PrintMode.proxy:
        _currentService = ServerPrinterService(ApiService());
        break;
    }
  }
  
  // 获取当前打印服务
  PrinterService? get currentService => _currentService;
  
  // 获取当前打印模式
  PrintMode get currentMode => _currentMode;
  
  // 切换打印模式
  Future<void> switchMode(PrintMode mode) async {
    if (_currentMode != mode) {
      await _currentService?.disconnect();
      await initialize(mode);
    }
  }
  
  // 打印小票
  Future<bool> printReceipt(ReceiptData data) async {
    if (_currentService == null) {
      AppLogger.error('Printer service not initialized');
      return false;
    }
    
    try {
      final connected = await _currentService!.isConnected();
      if (!connected) {
        final connectResult = await _currentService!.connect();
        if (!connectResult) {
          AppLogger.error('Failed to connect to printer');
          return false;
        }
      }
      
      return await _currentService!.printReceipt(data);
    } catch (e) {
      AppLogger.error('Print receipt failed: $e');
      return false;
    }
  }
  
  // 发现打印机
  Future<List<PrinterInfo>> discoverPrinters() async {
    if (_currentService == null) return [];
    return await _currentService!.discoverPrinters();
  }
}
```

## 三、.NET服务端实现

### 3.1 打印机控制器

```csharp
// POS.Server/Controllers/PrinterController.cs
using Microsoft.AspNetCore.Mvc;
using POS.Core.Services;
using POS.Core.Models;

[ApiController]
[Route("api/[controller]")]
public class PrinterController : ControllerBase
{
    private readonly IPrinterService _printerService;
    private readonly ILogger<PrinterController> _logger;
    
    public PrinterController(IPrinterService printerService, ILogger<PrinterController> logger)
    {
        _printerService = printerService;
        _logger = logger;
    }
    
    [HttpGet("status")]
    public async Task<ActionResult> GetPrinterStatus()
    {
        try
        {
            var isConnected = await _printerService.IsConnectedAsync();
            return Ok(new { connected = isConnected });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting printer status");
            return StatusCode(500, new { error = "Failed to get printer status" });
        }
    }
    
    [HttpGet("discover")]
    public async Task<ActionResult> DiscoverPrinters()
    {
        try
        {
            var printers = await _printerService.DiscoverPrintersAsync();
            return Ok(new { printers });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error discovering printers");
            return StatusCode(500, new { error = "Failed to discover printers" });
        }
    }
    
    [HttpPost("connect")]
    public async Task<ActionResult> ConnectPrinter([FromBody] ConnectPrinterRequest request)
    {
        try
        {
            var success = await _printerService.ConnectAsync(request.PrinterId, request.ConnectionType);
            return Ok(new { success });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error connecting to printer");
            return StatusCode(500, new { error = "Failed to connect to printer" });
        }
    }
    
    [HttpPost("disconnect")]
    public async Task<ActionResult> DisconnectPrinter()
    {
        try
        {
            await _printerService.DisconnectAsync();
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disconnecting printer");
            return StatusCode(500, new { error = "Failed to disconnect printer" });
        }
    }
    
    [HttpPost("print")]
    public async Task<ActionResult> PrintReceipt([FromBody] PrintReceiptRequest request)
    {
        try
        {
            var receiptData = new ReceiptData
            {
                StoreName = request.StoreName,
                StoreAddress = request.StoreAddress,
                StorePhone = request.StorePhone,
                OrderNo = request.OrderNo,
                Timestamp = request.Timestamp,
                Items = request.Items.Select(i => new ReceiptItem
                {
                    Name = i.Name,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    TotalPrice = i.TotalPrice
                }).ToList(),
                TotalAmount = request.TotalAmount,
                DiscountAmount = request.DiscountAmount,
                PaidAmount = request.PaidAmount,
                PaymentMethod = request.PaymentMethod,
                Footer = request.Footer
            };
            
            var success = await _printerService.PrintReceiptAsync(receiptData);
            return Ok(new { success });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error printing receipt");
            return StatusCode(500, new { error = "Failed to print receipt" });
        }
    }
}

// 请求模型
public class ConnectPrinterRequest
{
    public string PrinterId { get; set; } = string.Empty;
    public string ConnectionType { get; set; } = string.Empty;
}

public class PrintReceiptRequest
{
    public string StoreName { get; set; } = string.Empty;
    public string StoreAddress { get; set; } = string.Empty;
    public string StorePhone { get; set; } = string.Empty;
    public string OrderNo { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public List<PrintReceiptItemRequest> Items { get; set; } = new();
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string? Footer { get; set; }
}

public class PrintReceiptItemRequest
{
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
}
```

### 3.2 打印服务接口和实现

```csharp
// POS.Core/Services/IPrinterService.cs
using POS.Core.Models;

namespace POS.Core.Services;

public interface IPrinterService
{
    Task<bool> IsConnectedAsync();
    Task<bool> ConnectAsync(string printerId, string connectionType);
    Task DisconnectAsync();
    Task<bool> PrintReceiptAsync(ReceiptData data);
    Task<List<PrinterInfo>> DiscoverPrintersAsync();
}

// POS.Infrastructure/Services/WindowsPrinterService.cs
using System.Drawing;
using System.Drawing.Printing;
using System.Management;
using POS.Core.Services;
using POS.Core.Models;

public class WindowsPrinterService : IPrinterService
{
    private PrintDocument? _printDocument;
    private string? _currentPrinterId;
    private ReceiptData? _currentReceiptData;
    
    public async Task<bool> IsConnectedAsync()
    {
        return await Task.FromResult(_currentPrinterId != null);
    }
    
    public async Task<bool> ConnectAsync(string printerId, string connectionType)
    {
        try
        {
            _currentPrinterId = printerId;
            _printDocument = new PrintDocument();
            _printDocument.PrinterSettings.PrinterName = printerId;
            
            return await Task.FromResult(_printDocument.PrinterSettings.IsValid);
        }
        catch
        {
            return false;
        }
    }
    
    public async Task DisconnectAsync()
    {
        _printDocument?.Dispose();
        _printDocument = null;
        _currentPrinterId = null;
        await Task.CompletedTask;
    }
    
    public async Task<List<PrinterInfo>> DiscoverPrintersAsync()
    {
        var printers = new List<PrinterInfo>();
        
        try
        {
            // 获取系统安装的打印机
            foreach (string printerName in PrinterSettings.InstalledPrinters)
            {
                var printerSettings = new PrinterSettings { PrinterName = printerName };
                if (printerSettings.IsValid)
                {
                    printers.Add(new PrinterInfo
                    {
                        Id = printerName,
                        Name = printerName,
                        Type = "thermal", // 假设为热敏打印机
                        ConnectionType = "usb", // 默认USB连接
                        IsOnline = printerSettings.IsPlotter == false
                    });
                }
            }
            
            // 通过WMI获取更详细的打印机信息
            using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_Printer");
            foreach (ManagementObject printer in searcher.Get())
            {
                var name = printer["Name"]?.ToString();
                var portName = printer["PortName"]?.ToString();
                
                var existingPrinter = printers.FirstOrDefault(p => p.Name == name);
                if (existingPrinter != null)
                {
                    // 根据端口名判断连接类型
                    if (portName?.StartsWith("USB") == true)
                        existingPrinter.ConnectionType = "usb";
                    else if (portName?.StartsWith("COM") == true)
                        existingPrinter.ConnectionType = "serial";
                    else if (portName?.Contains(".") == true) // IP地址
                        existingPrinter.ConnectionType = "wifi";
                }
            }
        }
        catch (Exception ex)
        {
            // 记录错误但不抛出异常
            Console.WriteLine($"Error discovering printers: {ex.Message}");
        }
        
        return await Task.FromResult(printers);
    }
    
    public async Task<bool> PrintReceiptAsync(ReceiptData data)
    {
        if (_printDocument == null || _currentPrinterId == null)
            return false;
        
        try
        {
            _currentReceiptData = data;
            _printDocument.PrintPage += PrintDocument_PrintPage;
            
            await Task.Run(() => _printDocument.Print());
            
            _printDocument.PrintPage -= PrintDocument_PrintPage;
            return true;
        }
        catch
        {
            return false;
        }
    }
    
    private void PrintDocument_PrintPage(object sender, PrintPageEventArgs e)
    {
        if (_currentReceiptData == null || e.Graphics == null)
            return;
        
        var graphics = e.Graphics;
        var font = new Font("Arial", 9);
        var boldFont = new Font("Arial", 9, FontStyle.Bold);
        var titleFont = new Font("Arial", 12, FontStyle.Bold);
        
        float yPosition = 10;
        const float leftMargin = 10;
        const float lineHeight = 15;
        
        // 店铺信息
        var titleSize = graphics.MeasureString(_currentReceiptData.StoreName, titleFont);
        graphics.DrawString(_currentReceiptData.StoreName, titleFont, Brushes.Black, 
            (e.PageBounds.Width - titleSize.Width) / 2, yPosition);
        yPosition += lineHeight * 2;
        
        graphics.DrawString(_currentReceiptData.StoreAddress, font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        graphics.DrawString($"电话: {_currentReceiptData.StorePhone}", font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight * 2;
        
        // 订单信息
        graphics.DrawString($"订单号: {_currentReceiptData.OrderNo}", font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        graphics.DrawString($"时间: {_currentReceiptData.Timestamp:yyyy-MM-dd HH:mm:ss}", font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight * 2;
        
        // 分割线
        graphics.DrawString(new string('-', 40), font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        // 商品列表标题
        graphics.DrawString("商品名称    数量  单价   小计", font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        graphics.DrawString(new string('-', 40), font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        // 商品列表
        foreach (var item in _currentReceiptData.Items)
        {
            var itemLine = $"{item.Name.PadRight(12)} {item.Quantity.ToString().PadLeft(2)} " +
                          $"{item.UnitPrice:F2}  {item.TotalPrice:F2}";
            graphics.DrawString(itemLine, font, Brushes.Black, leftMargin, yPosition);
            yPosition += lineHeight;
        }
        
        // 分割线
        graphics.DrawString(new string('-', 40), font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        // 金额信息
        graphics.DrawString($"小计: {_currentReceiptData.TotalAmount:F2}", font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        if (_currentReceiptData.DiscountAmount > 0)
        {
            graphics.DrawString($"优惠: -{_currentReceiptData.DiscountAmount:F2}", font, Brushes.Black, leftMargin, yPosition);
            yPosition += lineHeight;
        }
        
        graphics.DrawString($"实付: {_currentReceiptData.PaidAmount:F2}", boldFont, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight;
        
        graphics.DrawString($"支付方式: {_currentReceiptData.PaymentMethod}", font, Brushes.Black, leftMargin, yPosition);
        yPosition += lineHeight * 2;
        
        // 底部信息
        if (!string.IsNullOrEmpty(_currentReceiptData.Footer))
        {
            var footerSize = graphics.MeasureString(_currentReceiptData.Footer, font);
            graphics.DrawString(_currentReceiptData.Footer, font, Brushes.Black, 
                (e.PageBounds.Width - footerSize.Width) / 2, yPosition);
        }
        
        // 释放资源
        font.Dispose();
        boldFont.Dispose();
        titleFont.Dispose();
    }
}
```

### 3.3 依赖注入配置

```csharp
// POS.Server/Program.cs 添加服务注册
builder.Services.AddScoped<IPrinterService, WindowsPrinterService>();
```

## 四、使用示例

### 4.1 Flutter客户端使用

```dart
// 初始化打印管理器
final printerManager = PrinterManager();

// 设置为直连模式
await printerManager.initialize(PrintMode.direct);

// 或设置为代理模式
// await printerManager.initialize(PrintMode.proxy);

// 发现打印机
final printers = await printerManager.discoverPrinters();

// 连接打印机（直连模式需要设置IP）
if (printerManager.currentMode == PrintMode.direct) {
  final wifiService = printerManager.currentService as WiFiPrinterService;
  wifiService.setPrinterIP('192.168.1.100');
}

// 打印小票
final receiptData = ReceiptData(
  storeName: '测试商店',
  storeAddress: '测试地址123号',
  storePhone: '123-456-7890',
  orderNo: 'ORDER001',
  timestamp: DateTime.now(),
  items: [
    ReceiptItem(name: '可乐', quantity: 2, unitPrice: 3.5, totalPrice: 7.0),
    ReceiptItem(name: '薯片', quantity: 1, unitPrice: 5.0, totalPrice: 5.0),
  ],
  totalAmount: 12.0,
  discountAmount: 0.0,
  paidAmount: 12.0,
  paymentMethod: '现金',
  footer: '谢谢惠顾！',
);

final success = await printerManager.printReceipt(receiptData);
if (success) {
  print('打印成功');
} else {
  print('打印失败');
}
```

## 五、配置说明

### 5.1 Flutter依赖包

在 `pubspec.yaml` 中添加：

```yaml
dependencies:
  network_info_plus: ^4.0.0
  
dev_dependencies:
  # 其他依赖...
```

### 5.2 .NET NuGet包

在服务端项目中添加：

```xml
<PackageReference Include="System.Drawing.Common" Version="7.0.0" />
<PackageReference Include="System.Management" Version="7.0.0" />
```

### 5.3 权限配置

在 `android/app/src/main/AndroidManifest.xml` 中添加：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

这个实现方案提供了完整的双模式打印功能，支持Android客户端直连WiFi打印机和通过Windows服务端代理打印两种方式。