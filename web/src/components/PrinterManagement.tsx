import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Wifi, Usb, Bluetooth, Printer, MapPin, Check, X, Activity, TestTube, Wrench, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Printer {
  id: number;
  name: string;
  ip_address?: string;
  port: number;
  type: 'thermal' | 'inkjet' | 'laser';
  location: 'kitchen' | 'cashier' | 'bar' | 'other';
  connection_type: 'wifi' | 'usb' | 'serial' | 'bluetooth' | 'ethernet';
  paper_width: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  health?: PrinterHealth;
}

interface PrinterHealth {
  printerId: string;
  isOnline: boolean;
  lastCheck: string;
  responseTime?: number;
  errorCount: number;
  lastError?: string;
}

interface PrinterFormData {
  name: string;
  ip_address: string;
  port: number;
  type: 'thermal' | 'inkjet' | 'laser';
  location: 'kitchen' | 'cashier' | 'bar' | 'other';
  connection_type: 'wifi' | 'usb' | 'serial' | 'bluetooth' | 'ethernet';
  paper_width: number;
  // 高级配置
  print_speed?: 'slow' | 'medium' | 'fast';
  encoding?: 'utf8' | 'gb2312' | 'big5';
  auto_cut?: boolean;
  buzzer_enabled?: boolean;
  density?: number; // 1-15
}

const PrinterManagement: React.FC = () => {
  const { t } = useTranslation();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<number | null>(null);
  const [diagnosingPrinter, setDiagnosingPrinter] = useState<number | null>(null);
  const [formData, setFormData] = useState<PrinterFormData>({
    name: '',
    ip_address: '',
    port: 9100,
    type: 'thermal',
    location: 'kitchen',
    connection_type: 'wifi',
    paper_width: 80,
    // 高级配置默认值
    print_speed: 'medium',
    encoding: 'utf8',
    auto_cut: true,
    buzzer_enabled: false,
    density: 8
  });

  useEffect(() => {
    fetchPrinters();
    // 定期更新打印机状态
    const interval = setInterval(() => {
      updatePrinterStatus();
    }, 30000); // 每30秒更新一次
    
    return () => clearInterval(interval);
  }, []);

  const fetchPrinters = async () => {
    try {
      const response = await fetch('/api/print/manage/printers');
      if (response.ok) {
        const data = await response.json();
        setPrinters(data.printers || []);
      }
    } catch (error) {
      console.error('Failed to fetch printers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePrinterStatus = async () => {
    try {
      const response = await fetch('/api/print/status');
      if (response.ok) {
        const data = await response.json();
        if (data.printers) {
          setPrinters(prevPrinters => 
            prevPrinters.map(printer => {
              const statusPrinter = data.printers.find((p: any) => p.id === printer.id.toString());
              return statusPrinter ? { ...printer, health: statusPrinter.health } : printer;
            })
          );
        }
      }
    } catch (error) {
      console.error('Failed to update printer status:', error);
    }
  };

  const testConnection = async (printerId: number) => {
    setTestingPrinter(printerId);
    try {
      const response = await fetch('/api/print/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ printerId: printerId.toString() })
      });
      
      if (response.ok) {
        const result = await response.json();
        const { testResults } = result;
        
        let message = '连接测试结果:\n';
        message += `Ping测试: ${testResults.pingTest ? '✓ 成功' : '✗ 失败'}\n`;
        message += `端口测试: ${testResults.portTest ? '✓ 成功' : '✗ 失败'}\n`;
        message += `ESC/POS测试: ${testResults.escPosTest ? '✓ 成功' : '✗ 失败'}\n`;
        if (testResults.responseTime) {
          message += `响应时间: ${testResults.responseTime}ms\n`;
        }
        if (testResults.errorMessage) {
          message += `错误信息: ${testResults.errorMessage}`;
        }
        
        alert(message);
      } else {
        alert('测试失败，请稍后重试');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('测试失败，请检查网络连接');
    } finally {
      setTestingPrinter(null);
    }
  };

  const diagnose = async (printerId: number) => {
    setDiagnosingPrinter(printerId);
    try {
      const response = await fetch('/api/print/diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ printerId: printerId.toString() })
      });
      
      if (response.ok) {
        const result = await response.json();
        const { diagnosis } = result;
        
        let message = '打印机诊断报告:\n\n';
        message += `连接性: ${diagnosis.connectivity.canConnect ? '✓ 正常' : '✗ 异常'}\n`;
        message += `ESC/POS支持: ${diagnosis.escpos.supportsStatusQuery ? '✓ 支持' : '✗ 不支持'}\n`;
        message += `错误次数: ${diagnosis.health.errorCount}\n`;
        
        if (diagnosis.recommendations.length > 0) {
          message += '\n建议:\n';
          diagnosis.recommendations.forEach((rec: string, index: number) => {
            message += `${index + 1}. ${rec}\n`;
          });
        }
        
        alert(message);
      } else {
        alert('诊断失败，请稍后重试');
      }
    } catch (error) {
      console.error('Diagnosis failed:', error);
      alert('诊断失败，请检查网络连接');
    } finally {
      setDiagnosingPrinter(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingPrinter 
        ? `/api/print/manage/printers/${editingPrinter.id}`
        : '/api/print/manage/printers';
      const method = editingPrinter ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchPrinters();
        resetForm();
        alert(editingPrinter ? t('printers.updateSuccess') : t('printers.createSuccess'));
      } else {
        const error = await response.json();
        alert(error.message || t('printers.operationFailed'));
      }
    } catch (error) {
      console.error('Failed to save printer:', error);
      alert(t('printers.operationFailed'));
    }
  };

  const handleEdit = (printer: Printer) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name,
      ip_address: printer.ip_address || '',
      port: printer.port,
      type: printer.type,
      location: printer.location,
      connection_type: printer.connection_type,
      paper_width: printer.paper_width
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('printers.confirmDelete'))) return;
    
    try {
      const response = await fetch(`/api/print/manage/printers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchPrinters();
        alert(t('printers.deleteSuccess'));
      } else {
        alert(t('printers.operationFailed'));
      }
    } catch (error) {
      console.error('Failed to delete printer:', error);
      alert(t('printers.operationFailed'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ip_address: '',
      port: 9100,
      type: 'thermal',
      location: 'kitchen',
      connection_type: 'wifi',
      paper_width: 80,
      // 高级配置默认值
      print_speed: 'medium',
      encoding: 'utf8',
      auto_cut: true,
      buzzer_enabled: false,
      density: 8
    });
    setEditingPrinter(null);
    setShowForm(false);
    setShowAdvanced(false);
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'wifi':
      case 'ethernet':
        return <Wifi className="w-4 h-4" />;
      case 'usb':
      case 'serial':
        return <Usb className="w-4 h-4" />;
      case 'bluetooth':
        return <Bluetooth className="w-4 h-4" />;
      default:
        return <Printer className="w-4 h-4" />;
    }
  };

  const getLocationIcon = () => <MapPin className="w-4 h-4" />;

  const renderPrinterStatus = (printer: Printer) => {
    if (!printer.health) {
      return (
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Clock className="w-3 h-3" />
          <span>检查中...</span>
        </div>
      );
    }

    const { health } = printer;
    return (
      <div className="flex items-center gap-2 text-sm">
        {health.isOnline ? (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span>在线</span>
            {health.responseTime && (
              <span className="text-gray-500">({health.responseTime}ms)</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="w-3 h-3" />
            <span>离线</span>
          </div>
        )}
        {health.errorCount > 0 && (
          <span className="text-amber-600">({health.errorCount} 错误)</span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">{t('printers.management')}</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('printers.addPrinter')}
        </button>
      </div>

      {/* Printer Form */}
      {showForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-lg font-medium mb-4">
            {editingPrinter ? t('printers.editPrinter') : t('printers.addPrinter')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('printers.name')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('printers.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('printers.type')} *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="thermal">{t('printers.thermal')}</option>
                  <option value="inkjet">{t('printers.inkjet')}</option>
                  <option value="laser">{t('printers.laser')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('printers.location')} *
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kitchen">{t('printers.kitchen')}</option>
                  <option value="cashier">{t('printers.cashier')}</option>
                  <option value="bar">{t('printers.bar')}</option>
                  <option value="other">{t('printers.other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('printers.connectionType')} *
                </label>
                <select
                  value={formData.connection_type}
                  onChange={(e) => setFormData({ ...formData, connection_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="wifi">{t('printers.wifi')}</option>
                  <option value="ethernet">{t('printers.ethernet')}</option>
                  <option value="usb">{t('printers.usb')}</option>
                  <option value="serial">{t('printers.serial')}</option>
                  <option value="bluetooth">{t('printers.bluetooth')}</option>
                </select>
              </div>
              {(formData.connection_type === 'wifi' || formData.connection_type === 'ethernet') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('printers.ipAddress')}
                  </label>
                  <input
                    type="text"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="192.168.1.100"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('printers.port')}
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('printers.paperWidth')} (mm)
                </label>
                <select
                  value={formData.paper_width}
                  onChange={(e) => setFormData({ ...formData, paper_width: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={58}>58mm</option>
                  <option value={80}>80mm</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {editingPrinter ? t('common.update') : t('common.create')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printers List */}
      <div className="space-y-4">
        {printers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Printer className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('printers.noPrinters')}</p>
          </div>
        ) : (
          printers.map((printer) => (
            <div key={printer.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{printer.name}</h3>
                    <div className="flex items-center gap-2">
                      {printer.is_active ? (
                        <div className="flex items-center gap-1">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600">{t('common.active')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <X className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">{t('common.inactive')}</span>
                        </div>
                      )}
                      {/* 打印机健康状态 */}
                      {renderPrinterStatus(printer)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Printer className="w-4 h-4" />
                      <span>{t(`printers.${printer.type}`)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getLocationIcon()}
                      <span>{t(`printers.${printer.location}`)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getConnectionIcon(printer.connection_type)}
                      <span>{t(`printers.${printer.connection_type}`)}</span>
                    </div>
                    <div>
                      <span>{printer.paper_width}mm</span>
                    </div>
                  </div>
                  {printer.ip_address && (
                    <div className="mb-2 text-sm text-gray-500">
                      {t('printers.ipAddress')}: {printer.ip_address}:{printer.port}
                    </div>
                  )}
                  {printer.health?.lastError && (
                    <div className="text-sm text-red-600 bg-red-50 rounded p-2">
                      <strong>最近错误:</strong> {printer.health.lastError}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(printer)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => testConnection(printer.id)}
                      disabled={testingPrinter === printer.id}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                      title="测试连接"
                    >
                      {testingPrinter === printer.id ? (
                        <Activity className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => diagnose(printer.id)}
                      disabled={diagnosingPrinter === printer.id}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors disabled:opacity-50"
                      title="诊断打印机"
                    >
                      {diagnosingPrinter === printer.id ? (
                        <Activity className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wrench className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(printer.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PrinterManagement;