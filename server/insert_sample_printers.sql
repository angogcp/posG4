-- 插入示例打印机数据
INSERT OR IGNORE INTO printers (id, name, ip_address, port, type, location, connection_type, paper_width, is_active) VALUES
(1, '收银台打印机', '192.168.1.100', 9100, 'thermal', 'cashier', 'wifi', 80, 1),
(2, '厨房打印机', '192.168.1.101', 9100, 'thermal', 'kitchen', 'wifi', 80, 1),
(3, '吧台打印机', '192.168.1.102', 9100, 'receipt', 'bar', 'ethernet', 58, 1),
(4, '标签打印机', '192.168.1.103', 9100, 'label', 'cashier', 'usb', 40, 1);