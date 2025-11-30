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
  Scissors,
  Trash2,
  Edit,
  DollarSign
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import PrinterManagement from '../components/PrinterManagement';
import PrintTemplateManager from '../components/PrintTemplateManager';
import PrintQueueManager from '../components/PrintQueueManager';
import TableManagement from '../components/TableManagement';

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
  const { reloadSettings, formatCurrency, currencySymbol } = useSettings();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('store');
  // Coupons state
  type CouponItem = { code: string; type: 'percent' | 'amount'; value: number; label?: string; enabled: boolean; _origCode?: string };
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [newCoupon, setNewCoupon] = useState<CouponItem>({ code: '', type: 'percent', value: 0, label: '', enabled: true });
  const [savingCouponKey, setSavingCouponKey] = useState<string | null>(null);
  const [couponSaved, setCouponSaved] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/settings').then(r => {
      const data = r.data || {};
      setName(data['store.name'] || data.name || '');
      setAddress(data['store.address'] || data.address || '');
      setPhone(data['store.phone'] || data.phone || '');
      setTaxRate(data['tax.rate'] || '');
      setCurrency(data['store.currency'] || 'USD');
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
      'tax.rate': taxRate,
      'store.currency': currency
    });
    await reloadSettings();
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

  return (
    <div className="min-h-screen bg-neutral-50 p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{t('settings.title') || 'Settings'}</h1>
            <p className="text-neutral-500">Manage your store preferences and devices</p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
          {[
            { id: 'store', icon: Store, label: 'Store Info' },
            { id: 'tables', icon: MapPin, label: 'Table Management' },
            { id: 'coupons', icon: Ticket, label: 'Coupons' },
            { id: 'printers', icon: Printer, label: 'Printers' },
            { id: 'templates', icon: FileText, label: 'Templates' },
            { id: 'queue', icon: Activity, label: 'Print Queue' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all
                ${activeTab === tab.id 
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-200' 
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'}
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 lg:p-8">
          {activeTab === 'tables' && <TableManagement />}
          {activeTab === 'printers' && <PrinterManagement />}
          {activeTab === 'templates' && <PrintTemplateManager />}
          {activeTab === 'queue' && <PrintQueueManager />}
          
          {activeTab === 'store' && (
            <div className="max-w-2xl space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Store Information</h2>
                  <p className="text-sm text-neutral-500">Basic details shown on receipts</p>
                </div>
                <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center">
                  <Building className="w-5 h-5 text-primary-600" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Store Name</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input 
                      value={name} onChange={e => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      placeholder="e.g. My Awesome Cafe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input 
                      value={address} onChange={e => setAddress(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      placeholder="e.g. 123 Main St, City"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input 
                      value={phone} onChange={e => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      placeholder="e.g. +1 234 567 890"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Tax Rate (%)</label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input 
                      type="number" step="0.1"
                      value={taxRate} onChange={e => setTaxRate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Currency</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <select 
                      value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all appearance-none"
                    >
                      <option value="USD">US Dollar ($)</option>
                      <option value="EUR">Euro (€)</option>
                      <option value="GBP">British Pound (£)</option>
                      <option value="MYR">Malaysian Ringgit (RM)</option>
                      <option value="JPY">Japanese Yen (¥)</option>
                      <option value="CNY">Chinese Yuan (¥)</option>
                      <option value="SGD">Singapore Dollar (S$)</option>
                      <option value="AUD">Australian Dollar (A$)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={save}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition-all font-medium shadow-lg shadow-primary-200"
                  >
                    {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {saved ? 'Saved Successfully' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Coupons & Discounts</h2>
                  <p className="text-sm text-neutral-500">Manage promo codes and automatic discounts</p>
                </div>
                <div className="w-10 h-10 bg-accent-50 rounded-full flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-accent-600" />
                </div>
              </div>

              {/* Add New Coupon */}
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-4">
                <h3 className="font-medium text-neutral-900 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create New Coupon
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input 
                    placeholder="Code (e.g. SAVE10)" 
                    value={newCoupon.code} 
                    onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                    className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                  />
                  <div className="flex gap-2">
                    <select 
                      value={newCoupon.type} 
                      onChange={e => setNewCoupon({...newCoupon, type: e.target.value as any})}
                      className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="amount">Fixed Amount ({currencySymbol})</option>
                    </select>
                    <input 
                      type="number" 
                      placeholder="Value" 
                      value={newCoupon.value || ''} 
                      onChange={e => setNewCoupon({...newCoupon, value: parseFloat(e.target.value)})}
                      className="w-24 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                    />
                  </div>
                  <input 
                    placeholder="Label (Optional)" 
                    value={newCoupon.label || ''} 
                    onChange={e => setNewCoupon({...newCoupon, label: e.target.value})}
                    className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
                  />
                  <button 
                    onClick={addNewCoupon}
                    disabled={!newCoupon.code || !newCoupon.value}
                    className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-accent-200"
                  >
                    Add Coupon
                  </button>
                </div>
              </div>

              {/* Coupon List */}
              <div className="space-y-3">
                {coupons.filter(c => c.enabled).map((c, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl hover:border-accent-300 transition-colors group">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Percent className="w-5 h-5 text-accent-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-neutral-900">{c.code}</span>
                          <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded-md font-medium">
                            {c.type === 'percent' ? `${c.value}% OFF` : `-${formatCurrency(c.value)}`}
                          </span>
                        </div>
                        {c.label && <p className="text-sm text-neutral-500">{c.label}</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 sm:mt-0 w-full sm:w-auto justify-end">
                      {couponSaved === c.code && <span className="text-xs text-success-600 font-medium mr-2">Saved!</span>}
                      <button 
                        onClick={() => disableCoupon(c.code)}
                        className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                        title="Delete Coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {coupons.filter(c => c.enabled).length === 0 && (
                  <div className="text-center py-12 text-neutral-400">
                    <Ticket className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No active coupons</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
