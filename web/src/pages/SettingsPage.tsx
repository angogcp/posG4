import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Printer, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Settings,
  Store,
  Building,
  MapPin,
  Phone,
  Percent,
  Save,
  Ticket,
  Plus,
  Activity,
  FileText,
  Type,
  Copy,
  Move,
  Image,
  Scissors
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PrinterManagement from '../components/PrinterManagement';
import PrintTemplateManager from '../components/PrintTemplateManager';
import PrintQueueManager from '../components/PrintQueueManager';

interface PrinterInfo {
  id: string;
  name: string;
  ip_address?: string;
  port?: number;
  type?: string;
  location?: string;
  connection_type?: string;
  is_active?: boolean;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('store');
  // Coupons state
  type CouponItem = { code: string; type: 'percent' | 'amount'; value: number; label?: string; enabled: boolean; _origCode?: string };
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [newCoupon, setNewCoupon] = useState<CouponItem>({ code: '', type: 'percent', value: 0, label: '', enabled: true });
  const [savingCouponKey, setSavingCouponKey] = useState<string | null>(null);
  const [couponSaved, setCouponSaved] = useState<string | null>(null);
  
  // Printer settings state
  const [thermalPrintEnabled, setThermalPrintEnabled] = useState(() => {
    return localStorage.getItem('thermalPrintEnabled') === 'true';
  });
  const [printerStatus, setPrinterStatus] = useState<'connected' | 'disconnected' | 'checking'>('disconnected');
  const [availablePrinters, setAvailablePrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printerSettings, setPrinterSettings] = useState({
    paperWidth: '80mm',
    fontSize: 'normal',
    printLogo: false,
    autoCut: true,
    copies: 1,
    margins: { top: 2, right: 2, bottom: 2, left: 2 }
  });

  useEffect(() => {
    axios.get('/api/settings').then(r => {
      const data = r.data || {};
      setName(data['store.name'] || data.name || '');
      setAddress(data['store.address'] || data.address || '');
      setPhone(data['store.phone'] || data.phone || '');
      setTaxRate(data['tax.rate'] || '');
      // parse coupons
      const items: CouponItem[] = [];
      Object.entries(data as Record<string, string | number | undefined>).forEach(([k, v]) => {
        if (k.startsWith('coupon.')) {
          const code = k.replace(/^coupon\./, '').toUpperCase();
          const parsed = parseCouponValue(String(v ?? ''));
          if (parsed) {
            items.push({ code, type: parsed.type, value: parsed.value, label: parsed.label, enabled: true, _origCode: code });
          } else {
            items.push({ code, type: 'percent', value: 0, label: '', enabled: false, _origCode: code });
          }
        }
      });
      setCoupons(items);
    });
    
    // Load printer settings
    const savedPrinter = localStorage.getItem('selectedPrinter') || '';
    setSelectedPrinter(savedPrinter);
    
    const savedSettings = localStorage.getItem('printerSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setPrinterSettings(prev => ({
          ...prev,
          ...parsed,
          margins: { top: 2, right: 2, bottom: 2, left: 2, ...(parsed?.margins || {}) },
          copies: Number.isFinite(Number(parsed?.copies)) && Number(parsed?.copies) > 0 ? Number(parsed.copies) : 1
        }));
      } catch (e) {
        console.error('Failed to parse printer settings:', e);
      }
    }
    
    // Check printer status on load
    if (thermalPrintEnabled) {
      checkPrinterStatus();
      fetchAvailablePrinters();
    }
  }, []);

  function parseCouponValue(val: string): { type: 'percent' | 'amount'; value: number; label?: string } | null {
    try {
      const obj = JSON.parse(val);
      if ((obj?.type === 'percent' || obj?.type === 'amount') && typeof obj?.value === 'number') {
        return { type: obj.type, value: obj.value, label: obj.label };
      }
    } catch {
      // ignore
    }
    const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(val);
    if (m) return { type: 'percent', value: parseFloat(m[1]) };
    if (!isNaN(Number(val)) && val.trim() !== '') return { type: 'amount', value: Number(val) };
    return null;
  }

  async function save() {
    await axios.post('/api/settings', {
      'store.name': name,
      'store.address': address,
      'store.phone': phone,
      'tax.rate': taxRate
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveCoupon(item: CouponItem, prevCode?: string) {
    const code = (item.code || '').toUpperCase().trim();
    if (!code) return;
    setSavingCouponKey(code);
    const payload: Record<string, string> = {};
    const key = `coupon.${code}`;
    if (item.enabled && Number(item.value) > 0) {
      payload[key] = JSON.stringify({ type: item.type, value: Number(item.value), label: item.label || undefined });
    } else {
      payload[key] = '';
    }
    if (prevCode && prevCode.toUpperCase() !== code) {
      payload[`coupon.${prevCode.toUpperCase()}`] = '';
    }
    await axios.post('/api/settings', payload);
    setCouponSaved(code);
    setTimeout(() => setCouponSaved(null), 1500);
    // reload coupons
    const r = await axios.get('/api/settings');
    const data = r.data || {};
    const items: CouponItem[] = [];
    Object.entries(data as Record<string, string | number | undefined>).forEach(([k, v]) => {
      if (k.startsWith('coupon.')) {
        const c = k.replace(/^coupon\./, '').toUpperCase();
        const p = parseCouponValue(String(v ?? ''));
        if (p) items.push({ code: c, type: p.type, value: p.value, label: p.label, enabled: true, _origCode: c });
        else items.push({ code: c, type: 'percent', value: 0, label: '', enabled: false, _origCode: c });
      }
    });
    setCoupons(items);
    setSavingCouponKey(null);
  }

  async function disableCoupon(code: string) {
    const key = `coupon.${code.toUpperCase()}`;
    await axios.post('/api/settings', { [key]: '' });
    setCoupons(prev => prev.map(c => c.code.toUpperCase() === code.toUpperCase() ? { ...c, enabled: false } : c));
  }

  function addNewCoupon() {
    const code = newCoupon.code.trim().toUpperCase();
    if (!code) return;
    saveCoupon({ ...newCoupon, code });
    setNewCoupon({ code: '', type: 'percent', value: 0, label: '', enabled: true });
  }

  // Printer functions
  const checkPrinterStatus = async () => {
    setPrinterStatus('checking');
    try {
      const response = await fetch('/api/print/status');
      if (response.ok) {
        const data = await response.json();
        setPrinterStatus(data.connected ? 'connected' : 'disconnected');
      } else {
        setPrinterStatus('disconnected');
      }
    } catch (error) {
      console.error('Failed to check printer status:', error);
      setPrinterStatus('disconnected');
    }
  };

  const fetchAvailablePrinters = async () => {
    try {
      const response = await fetch('/api/printers');
      if (response.ok) {
        const data = await response.json();
        const allPrinters = data.data || data || [];
        setAvailablePrinters(Array.isArray(allPrinters) ? allPrinters : []);
      }
    } catch (error) {
      console.error('Failed to fetch available printers:', error);
    }
  };

  const handleTestPrint = async () => {
    try {
      const response = await fetch('/api/print/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printer: selectedPrinter,
          settings: printerSettings
        })
      });
      
      if (response.ok) {
        alert('Test print sent successfully!');
      } else {
        alert('Test print failed. Please check printer connection.');
      }
    } catch (error) {
      console.error('Test print failed:', error);
      alert('Test print failed. Please check printer connection.');
    }
  };

  const savePrinterSettings = () => {
    localStorage.setItem('thermalPrintEnabled', thermalPrintEnabled.toString());
    localStorage.setItem('selectedPrinter', selectedPrinter);
    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
    alert('Printer settings saved!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">系统设置</h1>
              <p className="text-sm text-neutral-500">
                配置您的商店设置和首选项
              </p>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('store')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'store'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  商店信息
                </div>
              </button>
              <button
                onClick={() => setActiveTab('coupons')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'coupons'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  优惠券管理
                </div>
              </button>
              <button
                onClick={() => setActiveTab('printers')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'printers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  打印机管理
                </div>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  模板管理
                </div>
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'queue'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  打印队列
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'printers' && <PrinterManagement />}
        {activeTab === 'templates' && <PrintTemplateManager />}
        {activeTab === 'queue' && <PrintQueueManager />}
        
        {/* Store and Coupon tabs - simplified for now */}
        {activeTab === 'store' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">商店信息设置</h2>
            <p className="text-gray-600">商店基本信息配置功能</p>
          </div>
        )}
        
        {activeTab === 'coupons' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">优惠券管理</h2>
            <p className="text-gray-600">优惠券和促销代码管理功能</p>
          </div>
        )}
      </div>
    </div>
  );
}