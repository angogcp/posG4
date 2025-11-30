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
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-neutral-200 rounded"></div>
            <div className="h-4 bg-neutral-200 rounded"></div>
            <div className="h-4 bg-neutral-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
            <Printer className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">{t('printers.management')}</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          {t('printers.addPrinter')}
        </button>
      </div>

      {/* Printer Form */}
      {showForm && (
        <div className="card p-6 border-primary-100 ring-4 ring-primary-50/50">
          <h3 className="text-lg font-bold text-neutral-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-primary-500 rounded-full"></div>
            {editingPrinter ? t('printers.editPrinter') : t('printers.addPrinter')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t('printers.name')} <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder={t('printers.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t('printers.type')} <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="input"
                >
                  <option value="thermal">{t('printers.thermal')}</option>
                  <option value="inkjet">{t('printers.inkjet')}</option>
                  <option value="laser">{t('printers.laser')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t('printers.location')} <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as any })}
                  className="input"
                >
                  <option value="kitchen">{t('printers.kitchen')}</option>
                  <option value="cashier">{t('printers.cashier')}</option>
                  <option value="bar">{t('printers.bar')}</option>
                  <option value="other">{t('printers.other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t('printers.connectionType')} <span className="text-danger-500">*</span>
                </label>
                <select
                  value={formData.connection_type}
                  onChange={(e) => setFormData({ ...formData, connection_type: e.target.value as any })}
                  className="input"
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
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    {t('printers.ipAddress')}
                  </label>
                  <input
                    type="text"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="input"
                    placeholder="192.168.1.100"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t('printers.port')}
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 9100 })}
                  className="input"
                  placeholder="9100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  {t('printers.paperWidth')} (mm)
                </label>
                <select
                  value={formData.paper_width}
                  onChange={(e) => setFormData({ ...formData, paper_width: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={58}>58mm</option>
                  <option value={80}>80mm</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingPrinter ? t('common.update') : t('common.create')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-ghost"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printers List */}
      <div className="grid grid-cols-1 gap-4">
        {printers.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Printer className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">{t('printers.noPrinters')}</h3>
            <p className="text-neutral-500">{t('printers.addFirst') || 'Add your first printer to get started'}</p>
          </div>
        ) : (
          printers.map((printer) => (
            <div key={printer.id} className="card p-5 hover:border-primary-200 transition-all duration-300 group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-neutral-900">{printer.name}</h3>
                    <div className="flex items-center gap-2">
                      {printer.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-success-50 text-success-700 border border-success-100">
                          <Check className="w-3 h-3" />
                          {t('common.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                          <X className="w-3 h-3" />
                          {t('common.inactive')}
                        </span>
                      )}
                      {/* Printer Status */}
                      {renderPrinterStatus(printer)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-neutral-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-neutral-400" />
                      <span>{t(`printers.${printer.type}`)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getLocationIcon()}
                      <span>{t(`printers.${printer.location}`)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getConnectionIcon(printer.connection_type)}
                      <span>{t(`printers.${printer.connection_type}`)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-neutral-100 px-1.5 rounded text-xs">{printer.paper_width}mm</span>
                    </div>
                  </div>

                  {printer.ip_address && (
                    <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 inline-flex px-3 py-1.5 rounded-lg border border-neutral-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-success-500"></div>
                      {t('printers.ipAddress')}: <span className="font-mono">{printer.ip_address}:{printer.port}</span>
                    </div>
                  )}
                  
                  {printer.health?.lastError && (
                    <div className="mt-3 text-sm text-danger-600 bg-danger-50 rounded-lg p-3 border border-danger-100 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold">Error:</span> {printer.health.lastError}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(printer)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => testConnection(printer.id)}
                      disabled={testingPrinter === printer.id}
                      className="p-2 text-success-600 hover:bg-success-50 rounded-xl transition-colors disabled:opacity-50"
                      title={t('printers.testConnection')}
                    >
                      <Activity className={`w-4 h-4 ${testingPrinter === printer.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => diagnose(printer.id)}
                      disabled={diagnosingPrinter === printer.id}
                      className="p-2 text-warning-600 hover:bg-warning-50 rounded-xl transition-colors disabled:opacity-50"
                      title={t('printers.diagnose')}
                    >
                      <Wrench className={`w-4 h-4 ${diagnosingPrinter === printer.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(printer.id)}
                      className="p-2 text-danger-600 hover:bg-danger-50 rounded-xl transition-colors text-right"
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