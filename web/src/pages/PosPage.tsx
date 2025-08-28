import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  QrCode, 
  CreditCard, 
  Banknote, 
  Printer, 
  Receipt, 
  X,
  Package,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Category { id: number; name: string; options_json?: any }
interface Product { id: number; name: string; price: number; category_id: number; code?: string; options_json?: any }
interface CartItem { product: Product; qty: number; unitPrice: number; options?: any; optionsText?: string }

export default function PosPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // Scan/Code input
  const [scanCode, setScanCode] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const [taxRatePct, setTaxRatePct] = useState<number>(0);
  const [storeName, setStoreName] = useState<string>('');
  const [storeAddress, setStoreAddress] = useState<string>('');
  const [storePhone, setStorePhone] = useState<string>('');
  // Auto print after checkout
  const [autoPrint, setAutoPrint] = useState<boolean>(false);
  // Thermal printer status
  const [printerStatus, setPrinterStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [thermalPrintEnabled, setThermalPrintEnabled] = useState<boolean>(true);

  // Options modal state
  type OptionGroup = { name: string; required?: boolean; max_select?: number; options?: { name: string; price_delta?: number }[] };
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [optionProd, setOptionProd] = useState<Product | null>(null);
  const [groupSelections, setGroupSelections] = useState<Record<number, number[]>>({});
  const [liveGroups, setLiveGroups] = useState<Record<number, OptionGroup[]>>({});

  // Re-print last receipt
  interface Order { id: number; order_no?: string; order_number?: string; total_amount: number; created_at: string; subtotal?: number; discount_amount?: number; tax_amount?: number; paid_amount?: number; payment_method?: string }
  interface OrderItem { id: number; product_name: string; quantity: number; unit_price: number; total_price: number; options_json?: any }
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastDetail, setLastDetail] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    axios.get('/api/categories').then(r => setCategories(r.data.data || r.data));
    axios.get('/api/products').then(r => setProducts(r.data.data || r.data));
    axios.get('/api/settings').then(r => {
      const raw = (r.data?.data ?? r.data);
      if (Array.isArray(raw)) {
        const map = raw.reduce<Record<string, string>>((m, it: any) => {
          if (it && it.key != null) m[String(it.key)] = String(it.value ?? '');
          return m;
        }, {});
        const rate = parseFloat(map['tax.rate'] ?? '0');
        setTaxRatePct(isNaN(rate) ? 0 : Math.max(0, rate));
        setStoreName(map['store.name'] || map['name'] || '');
        setStoreAddress(map['store.address'] || map['address'] || '');
        setStorePhone(map['store.phone'] || map['phone'] || '');
      } else {
        const rate = parseFloat((r.data && r.data['tax.rate']) ?? '0');
        setTaxRatePct(isNaN(rate) ? 0 : Math.max(0, rate));
      }
    }).catch(()=>{});
    // init autoPrint from localStorage
    try {
      const v = localStorage.getItem('pos.autoPrint');
      if (v === '1' || v === 'true') setAutoPrint(true);
      const thermalEnabled = localStorage.getItem('pos.thermalPrintEnabled');
      if (thermalEnabled === '0' || thermalEnabled === 'false') setThermalPrintEnabled(false);
    } catch (_) { /* ignore */ }
    // Check printer status
    checkPrinterStatus();
  }, []);

  // Check thermal printer status
  async function checkPrinterStatus() {
    try {
      const response = await axios.get('/api/print/status');
      const status = response.data?.status;
      setPrinterStatus(status === 'ready' ? 'connected' : 'disconnected');
    } catch (error) {
      setPrinterStatus('disconnected');
    }
  }

  // Print receipt using thermal printer API
  async function printThermalReceipt(orderData: { order: Order; items: OrderItem[] }) {
    if (!thermalPrintEnabled || printerStatus !== 'connected') {
      return false; // Fall back to browser print
    }
    
    try {
      const receiptData = {
        store: {
          name: storeName || 'Store',
          address: storeAddress || '',
          phone: storePhone || ''
        },
        order: {
          id: orderData.order.id,
          number: orderData.order.order_number || orderData.order.order_no || orderData.order.id.toString(),
          date: new Date(orderData.order.created_at).toLocaleString(),
          subtotal: orderData.order.subtotal ?? 0,
          discount: orderData.order.discount_amount ?? 0,
          tax: orderData.order.tax_amount ?? 0,
          total: orderData.order.total_amount ?? 0,
          paid: orderData.order.paid_amount ?? 0,
          payment_method: orderData.order.payment_method || 'cash'
        },
        items: orderData.items.map(item => ({
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          options: item.options_json
        }))
      };
      
      // Attach printer selection and settings (includes copies and margins)
      try {
        const selectedPrinter = localStorage.getItem('selectedPrinter') || '';
        const settingsRaw = localStorage.getItem('printerSettings');
        const parsedSettings = settingsRaw ? JSON.parse(settingsRaw) : {};
        (receiptData as any).printer = selectedPrinter;
        (receiptData as any).settings = parsedSettings;
      } catch (_) {}
      
      await axios.post('/api/print/receipt', receiptData);
      return true; // Successfully printed
    } catch (error) {
      console.error('Thermal print failed:', error);
      return false; // Fall back to browser print
    }
  }

  // Focus effect moved below after showCheckout declaration

  const filtered = useMemo(() => {
    let p = products;
    if (activeCat !== 'all') p = p.filter(x => x.category_id === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      p = p.filter(x => x.name.toLowerCase().includes(q));
    }
    return p;
  }, [products, activeCat, query]);

  async function handleScanSubmit() {
    const code = scanCode.trim();
    if (!code) return;
    // Try local exact match by code first
    let prod = products.find(p => (p.code || '').toLowerCase() === code.toLowerCase());
    if (!prod) {
      try {
        const r = await axios.get('/api/products/search', { params: { q: code } });
        const arr = r.data?.data || r.data;
        if (Array.isArray(arr) && arr.length > 0) {
          // Prefer exact code match from server response; otherwise take first
          prod = arr.find((x: any) => (x.code || '').toLowerCase() === code.toLowerCase()) || arr[0];
        }
      } catch (_) {
        // ignore network error; will show not found
      }
    }
    if (prod) {
      await addToCart(prod as any);
      setMessage(`Added ${prod.name}`);
    } else {
      setMessage(`Product code "${code}" not found`);
    }
    setScanCode('');
    // Re-focus for next scan
    scanInputRef.current?.focus();
  }

  function addCartItem(prod: Product, unitPrice: number, options?: any, optionsText?: string) {
    setCart(prev => {
      // If no options, keep old merge-by-productId behavior; if options present, treat as distinct line item
      if (!options) {
        const idx = prev.findIndex(ci => ci.product.id === prod.id && !ci.options);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
          return copy;
        }
      }
      return [...prev, { product: prod, qty: 1, unitPrice, options, optionsText }];
    });
  }

  function parseGroups(val: any): OptionGroup[] {
    try {
      if (!val) return [];
      if (typeof val === 'string') {
        const t = val.trim();
        if (!t) return [];
        const parsed = JSON.parse(t);
        return Array.isArray(parsed) ? parsed : [];
      }
      if (Array.isArray(val)) return val as OptionGroup[];
      if (typeof val === 'object') return Array.isArray((val as any).groups) ? (val as any).groups : [];
      return [];
    } catch { return []; }
  }

  function effectiveGroupsForProduct(prod: Product): OptionGroup[] {
    const live = liveGroups[prod.id];
    if (live && live.length > 0) return live;
    const prodGroups = parseGroups((prod as any).options_json);
    if (prodGroups.length > 0) return prodGroups;
    const cat = categories.find(c => c.id === prod.category_id);
    const catGroups = cat ? parseGroups((cat as any).options_json) : [];
    return catGroups;
  }

  async function addToCart(prod: Product) {
    // Try server-side effective modifiers first
    let groups: OptionGroup[] = [];
    try {
      const r = await axios.get(`/api/products/${prod.id}/modifiers`);
      const mods = r.data?.data || r.data;
      if (Array.isArray(mods)) {
        groups = mods.map((m: any) => {
          const max = (m.max_choices != null) ? Number(m.max_choices) : (m.selection_type === 'single' ? 1 : Math.max(1, Array.isArray(m.options) ? m.options.length : 1));
          const required = Number(m.min_choices || 0) > 0;
          const opts = (Array.isArray(m.options) ? m.options : []).map((o: any) => ({ name: String(o.name || ''), price_delta: Number(o.price_delta || 0) }));
          return { name: String(m.name || ''), required, max_select: max, options: opts } as OptionGroup;
        }).filter((g: OptionGroup) => g && g.name);
      }
    } catch (_) {
      // ignore and fallback
    }
    if (groups.length > 0) {
      setLiveGroups(prev => ({ ...prev, [prod.id]: groups }));
    }

    const eff = groups.length > 0 ? groups : effectiveGroupsForProduct(prod);
    if (eff.length > 0) {
      // open options modal
      setOptionProd(prod);
      const initSel: Record<number, number[]> = {};
      eff.forEach((g, gi) => {
        const maxSel = Math.max(1, g.max_select || 0);
        if (g.required && maxSel === 1 && Array.isArray(g.options) && g.options.length > 0) {
          initSel[gi] = [0];
        }
      });
      setGroupSelections(initSel);
      setOptionsModalOpen(true);
      return;
    }
    addCartItem(prod, prod.price);
  }

  function updateQty(index: number, qty: number) {
    setCart(prev => prev.map((ci, i) => i === index ? { ...ci, qty: Math.max(1, qty) } : ci));
  }

  function removeItem(indexOrId: number) {
    // Try treat as index first if in range, else remove by product id and first occurrence
    setCart(prev => {
      if (indexOrId >= 0 && indexOrId < prev.length) {
        const copy = [...prev];
        copy.splice(indexOrId, 1);
        return copy;
      }
      return prev.filter(ci => ci.product.id !== indexOrId);
    });
  }

  const subtotal = useMemo(() => cart.reduce((s, ci) => s + ci.unitPrice * ci.qty, 0), [cart]);

  // Checkout modal state and computed values
  const [showCheckout, setShowCheckout] = useState(false);
  // Keep scan input focused during POS operations (except when modal is open)
  useEffect(() => {
    if (!showCheckout && !optionsModalOpen) scanInputRef.current?.focus();
  }, [showCheckout, optionsModalOpen]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; type: 'amount'|'percent'; value: number; label?: string }|null>(null);
  const [paid, setPaid] = useState<string>('');

  const discountAmount = useMemo(() => {
    if (couponApplied) {
      if (couponApplied.type === 'percent') return Math.min(subtotal, subtotal * (couponApplied.value/100));
      return Math.min(subtotal, couponApplied.value);
    }
    const v = parseFloat(discountInput || '0');
    if (isNaN(v) || v <= 0) return 0;
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, v));
      return (subtotal * pct) / 100;
    }
    return Math.min(subtotal, v);
  }, [discountInput, discountType, subtotal, couponApplied]);

  const taxAmount = useMemo(() => {
    const taxable = Math.max(0, subtotal - discountAmount);
    return (taxable * Math.max(0, taxRatePct)) / 100;
  }, [subtotal, discountAmount, taxRatePct]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  const paidNum = useMemo(() => {
    const n = parseFloat(paid || '0');
    return isNaN(n) ? 0 : Math.max(0, n);
  }, [paid]);

  const change = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(0, paidNum - total);
  }, [paymentMethod, paidNum, total]);

  async function getOrderDetail(orderId: number): Promise<{ order: Order; items: OrderItem[] } | null> {
    try {
      const r = await axios.get(`/api/orders/${orderId}`);
      const d = r.data?.data || r.data;
      if (d && d.order && d.items) {
        return d;
      }
    } catch (_e) {
      // ignore
    }
    return null;
  }

  async function printOrderById(orderId: number) {
    const orderDetail = await getOrderDetail(orderId);
    if (orderDetail) {
      setLastDetail(orderDetail);
      setTimeout(() => window.print(), 50);
    }
  }

  async function handleCheckout() {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    setMessage(null);
    try {
      const items = cart.map((ci) => ({
        product_id: ci.product.id,
        product_code: ci.product.code ?? '',
        product_name: ci.product.name,
        quantity: ci.qty,
        unit_price: ci.unitPrice,
        options_json: ci.options ? ci.options : undefined,
      }));
      const payload = {
        items,
        discount_amount: Math.max(0, discountAmount) || 0,
        tax_amount: Math.max(0, taxAmount) || 0,
        payment_method: paymentMethod,
        paid_amount: paymentMethod === 'cash' ? paidNum : total
      };
      const r = await axios.post('/api/orders', payload);
      const data = r.data?.data || {};
      setMessage(`Order ${data.order_number || data.order_id || ''} placed. Total $${(data.total_amount ?? total).toFixed(2)}${paymentMethod==='cash' ? ` • Change $${change.toFixed(2)}` : ''}`);
      const newOrderId = typeof data.order_id === 'number' ? data.order_id : null;
      setLastOrderId(newOrderId);
      setCart([]);
      setShowCheckout(false);
      setDiscountInput('0'); setDiscountType('amount'); setPaid(''); setPaymentMethod('cash');
      setCouponCode(''); setCouponApplied(null);
      // Auto print if enabled
      if (autoPrint && newOrderId) {
        setTimeout(async () => {
          // Try thermal printer first, fall back to browser print
          const orderDetail = await getOrderDetail(newOrderId);
          if (orderDetail) {
            const thermalSuccess = await printThermalReceipt(orderDetail);
            if (!thermalSuccess) {
              // Fall back to browser print
              setLastDetail(orderDetail);
              setTimeout(() => window.print(), 50);
            }
          }
        }, 150);
      }
      setShowCheckout(false);
      // removed obsolete reprint timeout
      // printLastOrder();
    } catch (e:any) {
      alert('Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleReprint() {
    if (!lastOrderId) return;
    const orderDetail = await getOrderDetail(lastOrderId);
    if (orderDetail) {
      // Try thermal printer first, fall back to browser print
      const thermalSuccess = await printThermalReceipt(orderDetail);
      if (!thermalSuccess) {
        setLastDetail(orderDetail);
        // wait a tick for DOM to render receipt content
        setTimeout(() => window.print(), 50);
      }
    }
  }

  // Option modal helpers
  function currentGroups(): OptionGroup[] {
    if (!optionProd) return [];
    return effectiveGroupsForProduct(optionProd);
  }
  const optionBasePrice = optionProd?.price ?? 0;
  const optionDelta = useMemo(() => {
    const groups = currentGroups();
    let sum = 0;
    groups.forEach((g, gi) => {
      const sel = groupSelections[gi] || [];
      sel.forEach(oi => {
        const opt = g.options?.[oi];
        if (opt && typeof opt.price_delta === 'number') sum += opt.price_delta;
      });
    });
    return sum;
  }, [groupSelections, optionProd]);
  const optionPrice = optionBasePrice + optionDelta;

  function toggleSelect(gi: number, oi: number) {
    setGroupSelections(prev => {
      const g = currentGroups()[gi];
      const maxSel = Math.max(1, g?.max_select || 0);
      const prevSel = prev[gi] ? [...prev[gi]] : [];
      const has = prevSel.includes(oi);
      if (maxSel <= 1) {
        return { ...prev, [gi]: has ? [] : [oi] };
      }
      if (has) {
        return { ...prev, [gi]: prevSel.filter(x => x !== oi) };
      }
      if (prevSel.length >= maxSel) {
        // replace oldest selection to respect max
        prevSel.shift();
      }
      return { ...prev, [gi]: [...prevSel, oi] };
    });
  }

  const optionConfirmDisabled = useMemo(() => {
    const groups = currentGroups();
    // if any required group has no selection
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (g?.required && (!groupSelections[gi] || groupSelections[gi].length === 0)) {
        return true;
      }
    }
    return false;
  }, [groupSelections, optionProd]);

  function confirmOptions() {
    if (!optionProd) return;
    const groups = currentGroups();
    const selectedGroups = groups.map((g, gi) => {
      const selIdx = groupSelections[gi] || [];
      const selected = selIdx.map(i => g.options?.[i]).filter(Boolean) as { name: string; price_delta?: number }[];
      return { name: g.name, selected };
    });
    const optionsObj = { groups: selectedGroups };
    const textParts: string[] = [];
    selectedGroups.forEach(g => {
      if (g.selected.length > 0) {
        textParts.push(`${g.name}: ${g.selected.map(o => o.name).join(', ')}`);
      }
    });
    const optionsText = textParts.join(' | ');
    addCartItem(optionProd, optionPrice, optionsObj, optionsText);
    setOptionsModalOpen(false);
    setOptionProd(null);
    setGroupSelections({});
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product Selection Area */}
        <div className="lg:col-span-8 space-y-4">
          {/* Category Tabs & Search */}
          <div className="card p-4">
            <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <button 
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeCat === 'all' 
                      ? 'bg-primary-100 text-primary-800 shadow-sm' 
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`} 
                  onClick={() => setActiveCat('all')}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  {t('pos.all')}
                </button>
                {categories.map(c => (
                  <button 
                    key={c.id} 
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeCat === c.id 
                        ? 'bg-primary-100 text-primary-800 shadow-sm' 
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`} 
                    onClick={() => setActiveCat(c.id)}
                  >
                    <Tag className="w-4 h-4 inline mr-2" />
                    {c.name}
                  </button>
                ))}
              </div>
              
              {/* Search Controls */}
              <div className="flex gap-3 flex-1 lg:flex-initial lg:w-auto">
                <div className="relative flex-1 lg:w-52">
                  <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    ref={scanInputRef}
                    value={scanCode}
                    onChange={e=>setScanCode(e.target.value)}
                    onKeyDown={e=>{ if (e.key === 'Enter') { e.preventDefault(); void handleScanSubmit(); } }}
                    placeholder={t('pos.scanPlaceholder')}
                    className="input pl-10 text-sm"
                  />
                </div>
                <div className="relative flex-1 lg:w-52">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input 
                    value={query} 
                    onChange={e=>setQuery(e.target.value)} 
                    placeholder={t('common.search')} 
                    className="input pl-10 text-sm" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="card p-6">
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
              {filtered.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => { void addToCart(p); }} 
                  className="group relative bg-white border border-neutral-200 rounded-2xl p-3 sm:p-4 hover:shadow-lg hover:border-primary-200 hover:-translate-y-1 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 active:scale-95"
                >
                  {/* Product Image Placeholder */}
                  <div className="w-full aspect-square bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-xl mb-2 sm:mb-3 flex items-center justify-center group-hover:from-primary-50 group-hover:to-primary-100 transition-all duration-300">
                    <Package className="w-6 h-6 sm:w-8 sm:h-8 text-neutral-400 group-hover:text-primary-500 transition-colors duration-300" />
                  </div>
                  
                  {/* Product Info */}
                  <div className="space-y-1">
                    <h3 className="font-semibold text-neutral-900 text-sm leading-tight group-hover:text-primary-700 transition-colors duration-200 line-clamp-2">
                      {p.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-base sm:text-lg font-bold text-primary-600">
                        ${p.price.toFixed(2)}
                      </span>
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-0 group-hover:scale-100">
                        <Plus className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-primary-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </button>
              ))}
            </div>
            
            {/* Empty State */}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-600 mb-2">No products found</h3>
                <p className="text-neutral-500">Try adjusting your search or category filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Shopping Cart */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card flex flex-col h-[calc(100vh-8rem)]">
            {/* Cart Header */}
            <div className="p-4 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900">{t('pos.cart')}</h2>
                    <p className="text-sm text-neutral-500">
                      {cart.length === 0 ? 'Empty cart' : `${cart.length} item${cart.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                
                {/* Clear Cart Button */}
                {cart.length > 0 && (
                  <button 
                    onClick={() => setCart([])} 
                    className="p-2 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-all duration-200"
                    title="Clear cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-20 h-20 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                    <ShoppingCart className="w-10 h-10 text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-600 mb-2">{t('pos.noItems')}</h3>
                  <p className="text-neutral-500 text-sm">Select products to add them to your cart</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((ci, index) => (
                    <div key={index} className="group bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-md hover:border-primary-200 transition-all duration-200">
                      <div className="flex items-start space-x-3">
                        {/* Product Image Placeholder */}
                        <div className="w-12 h-12 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-neutral-400" />
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-neutral-900 text-sm mb-1 truncate">
                            {ci.product.name}
                          </h4>
                          {ci.optionsText && (
                            <p className="text-xs text-neutral-600 mb-2 bg-neutral-50 px-2 py-1 rounded-lg">
                              {ci.optionsText}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-600">
                              ${ci.unitPrice.toFixed(2)} each
                            </span>
                            <span className="text-lg font-bold text-primary-600">
                              ${(ci.unitPrice * ci.qty).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => updateQty(index, ci.qty - 1)}
                            disabled={ci.qty <= 1}
                            className="w-8 h-8 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors duration-200"
                          >
                            <Minus className="w-4 h-4 text-neutral-600" />
                          </button>
                          <input 
                            type="number" 
                            min={1} 
                            className="w-16 text-center border border-neutral-200 rounded-lg px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" 
                            value={ci.qty} 
                            onChange={e => updateQty(index, parseInt(e.target.value || '1'))}
                          />
                          <button 
                            onClick={() => updateQty(index, ci.qty + 1)}
                            className="w-8 h-8 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center justify-center transition-colors duration-200"
                          >
                            <Plus className="w-4 h-4 text-neutral-600" />
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => removeItem(index)}
                          className="p-2 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                          title="Remove item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Cart Summary & Actions */}
            <div className="border-t border-neutral-200 p-4 space-y-4">
              {/* Price Summary */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-600 font-medium">{t('pos.subtotal')}</span>
                  <span className="text-xl font-bold text-neutral-900">${subtotal.toFixed(2)}</span>
                </div>
                
                {/* Status Message */}
                {message && (
                  <div className="flex items-center space-x-2 p-3 bg-primary-50 border border-primary-200 rounded-xl animate-slide-down">
                    <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    <span className="text-sm text-primary-800 font-medium">{message}</span>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <button 
                  disabled={cart.length === 0 || checkingOut} 
                  onClick={() => setShowCheckout(true)} 
                  className={`w-full btn btn-lg group ${
                    cart.length === 0 || checkingOut 
                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed' 
                      : 'btn-primary'
                  }`}
                >
                  {checkingOut ? (
                    <>
                      <div className="spinner w-5 h-5" />
                      <span>{t('pos.processing')}</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      <span>{t('pos.checkout')}</span>
                      <span className="ml-auto font-bold">${subtotal.toFixed(2)}</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleReprint}
                  disabled={!lastOrderId}
                  className={`w-full btn btn-secondary group ${
                    !lastOrderId ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={!lastOrderId ? t('pos.noRecentOrder') : t('pos.printLastReceipt')}
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('pos.reprintLastReceipt')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="modal-backdrop flex items-center justify-center p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">{t('pos.checkout')}</h2>
                    <p className="text-sm text-neutral-500">Complete your order</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCheckout(false)}
                  className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Order Summary */}
              <div className="bg-neutral-50 rounded-2xl p-4">
                <h3 className="font-semibold text-neutral-900 mb-3 flex items-center">
                  <Receipt className="w-4 h-4 mr-2 text-neutral-600" />
                  Order Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{t('pos.subtotal')}</span>
                    <span className="font-medium text-neutral-900">${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-success-600">
                      <span>{t('pos.discount')}</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-600">{t('pos.tax')}</span>
                    <span className="font-medium text-neutral-900">+${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-neutral-900">{t('pos.total')}</span>
                      <span className="text-primary-600">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discount & Coupon Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-neutral-700">
                    <Tag className="w-4 h-4 inline mr-2" />
                    {t('pos.discount')}
                  </label>
                  <div className="flex gap-2">
                    <select 
                      value={discountType} 
                      onChange={e=>setDiscountType(e.target.value as 'amount'|'percent')} 
                      className="input w-20" 
                      disabled={!!couponApplied}
                    >
                      <option value="amount">$</option>
                      <option value="percent">%</option>
                    </select>
                    <input 
                      type="number" 
                      min={0} 
                      step={0.01} 
                      value={discountInput} 
                      onChange={e=>setDiscountInput(e.target.value)} 
                      className="input flex-1" 
                      disabled={!!couponApplied}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-neutral-700">
                    {t('pos.taxRate')} (%)
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    step={0.01} 
                    value={taxRatePct} 
                    onChange={e=>setTaxRatePct(Math.max(0, parseFloat(e.target.value||'0')))} 
                    className="input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Coupon Code */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-neutral-700">
                  {t('pos.couponCode')}
                </label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={couponCode} 
                    onChange={e=>setCouponCode(e.target.value)} 
                    placeholder={t('pos.couponPlaceholder')} 
                    className="input flex-1"
                  />
                  <button 
                    className="btn btn-secondary px-6" 
                    onClick={async()=>{
                      const code = couponCode.trim();
                      if (!code) return;
                      try {
                        const r = await axios.post('/api/coupons/validate', { code });
                        if (r.data?.data) {
                          setCouponApplied(r.data.data);
                        }
                      } catch (err:any) {
                        alert(err?.response?.data?.error || t('pos.invalidCoupon'));
                        setCouponApplied(null);
                      }
                    }}
                  >
                    {t('pos.apply')}
                  </button>
                  <button 
                    className="btn btn-ghost" 
                    onClick={()=>{ setCouponApplied(null); setCouponCode(''); }}
                  >
                    {t('pos.clear')}
                  </button>
                </div>
                {couponApplied && (
                  <div className="flex items-center space-x-2 p-3 bg-success-50 border border-success-200 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-success-600" />
                    <span className="text-sm text-success-800">
                      Applied: <strong>{couponApplied?.code}</strong> 
                      {couponApplied?.label ? ` (${couponApplied?.label})` : 
                        couponApplied?.type==='percent' ? ` (${couponApplied?.value}% off)` : ` ($${couponApplied?.value} off)`}
                    </span>
                  </div>
                )}
              </div>
              {/* Payment Method */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-neutral-700">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  {t('pos.paymentMethod')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 border-2 rounded-2xl transition-all duration-200 text-center ${
                      paymentMethod === 'cash' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <Banknote className="w-6 h-6 mx-auto mb-2" />
                    <div className="font-medium">{t('pos.cash')}</div>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 border-2 rounded-2xl transition-all duration-200 text-center ${
                      paymentMethod === 'card' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                    }`}
                  >
                    <CreditCard className="w-6 h-6 mx-auto mb-2" />
                    <div className="font-medium">{t('pos.card')}</div>
                  </button>
                </div>
              </div>

              {/* Cash Payment Details */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3 p-4 bg-neutral-50 rounded-2xl">
                  <label className="block text-sm font-semibold text-neutral-700">
                    <Banknote className="w-4 h-4 inline mr-2" />
                    {t('pos.cashReceived')}
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    step={0.01} 
                    value={paid} 
                    onChange={e=>setPaid(e.target.value)} 
                    className="input text-lg" 
                    placeholder="0.00"
                    autoFocus
                  />
                  <div className="flex justify-between items-center p-3 bg-white rounded-xl border">
                    <span className="text-neutral-600 font-medium">{t('pos.change')}</span>
                    <span className={`text-lg font-bold ${
                      change >= 0 ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      ${Math.abs(change).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Print Settings */}
              <div className="space-y-4 p-4 bg-neutral-50 rounded-2xl">
                <h4 className="font-semibold text-neutral-900 flex items-center">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Settings
                </h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      id="auto-print" 
                      type="checkbox" 
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" 
                      checked={autoPrint} 
                      onChange={(e)=>{ setAutoPrint(e.target.checked); try { localStorage.setItem('pos.autoPrint', e.target.checked ? '1' : '0'); } catch(_){} }} 
                    />
                    <span className="text-sm font-medium text-neutral-700">{t('pos.autoPrint')}</span>
                  </label>
                  
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <input 
                        id="thermal-print" 
                        type="checkbox" 
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" 
                        checked={thermalPrintEnabled} 
                        onChange={(e)=>{ setThermalPrintEnabled(e.target.checked); try { localStorage.setItem('pos.thermalPrintEnabled', e.target.checked ? '1' : '0'); } catch(_){} }} 
                      />
                      <span className="text-sm font-medium text-neutral-700">{t('pos.useThermalPrinter')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        printerStatus === 'connected' ? 'bg-success-100 text-success-700' :
                        printerStatus === 'disconnected' ? 'bg-danger-100 text-danger-700' :
                        'bg-warning-100 text-warning-700'
                      }`}>
                        {printerStatus === 'connected' ? `● ${t('printer.connected')}` :
                         printerStatus === 'disconnected' ? `● ${t('printer.disconnected')}` :
                         `● ${t('printer.checking')}`}
                      </span>
                      <button 
                        onClick={checkPrinterStatus}
                        className="btn btn-ghost btn-sm"
                      >
                        {t('common.refresh')}
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end space-x-3">
              <button 
                className="btn btn-secondary px-6" 
                onClick={() => setShowCheckout(false)}
              >
                <X className="w-4 h-4" />
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkingOut || (paymentMethod==='cash' && paidNum < total)}
                className={`btn btn-lg px-8 ${
                  checkingOut || (paymentMethod==='cash' && paidNum < total) 
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed' 
                    : 'btn-success'
                }`}
              >
                {checkingOut ? (
                  <>
                    <div className="spinner w-5 h-5" />
                    <span>{t('pos.processing')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>{t('pos.confirmPayment')}</span>
                    <span className="ml-2 font-bold">${total.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {optionsModalOpen && optionProd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setOptionsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b font-semibold">{t('pos.selectOptions')} — {optionProd?.name}</div>
            <div className="p-4 space-y-3">
              {(currentGroups()).map((g, gi) => (
                <div key={gi} className="border rounded p-2">
                  <div className="font-medium text-sm mb-1">
                    {g.name} {g.required ? <span className="text-red-600">*</span> : null}
                    {g.max_select && g.max_select > 1 ? <span className="ml-2 text-xs text-gray-500">up to {g.max_select}</span> : null}
                  </div>
                  <div className="space-y-1">
                    {(g.options || []).map((opt, oi) => {
                      const sel = groupSelections[gi] || [];
                      const checked = sel.includes(oi);
                      const multi = (g.max_select || 1) > 1;
                      return (
                        <label key={oi} className="flex items-center gap-2 text-sm">
                          <input type={multi ? 'checkbox' : 'radio'} checked={checked} onChange={()=>toggleSelect(gi, oi)} />
                          <span>{opt.name}</span>
                          <span className="text-xs text-gray-600">{typeof opt.price_delta === 'number' && opt.price_delta !== 0 ? (opt.price_delta > 0 ? `(+${opt.price_delta.toFixed(2)})` : `(${opt.price_delta.toFixed(2)})`) : ''}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex justify-between font-medium">
                <span>{t('pos.price')}</span>
                <span>${optionPrice.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button className="px-4 py-2 border rounded" onClick={() => { setOptionsModalOpen(false); setOptionProd(null); setGroupSelections({}); }}>{t('common.cancel')}</button>
              <button className={`px-4 py-2 rounded text-white ${optionConfirmDisabled ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`} disabled={optionConfirmDisabled} onClick={confirmOptions}>{t('pos.addToCart')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt (hidden on screen, visible on print) */}
      <div id="receipt-print" ref={receiptRef} style={{ display: 'none' }}>
        {lastDetail && (
          <div style={{ width: '80mm', margin: '0 auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{storeName || t('pos.store')}</div>
              {storeAddress ? <div style={{ whiteSpace: 'pre-wrap' }}>{storeAddress}</div> : null}
              {storePhone ? <div>Tel: {storePhone}</div> : null}
            </div>
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <div>{t('pos.order')}: {lastDetail?.order.order_number || lastDetail?.order.order_no || lastDetail?.order.id}</div>
              <div>{t('pos.date')}: {new Date(lastDetail?.order.created_at || '').toLocaleString()}</div>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
            <div style={{ fontSize: 12 }}>
              {lastDetail?.items.map(it => {
                let options: any = null;
                try {
                  if (typeof it.options_json === 'string' && it.options_json.trim()) options = JSON.parse(it.options_json);
                  else if (typeof it.options_json === 'object' && it.options_json) options = it.options_json;
                } catch {}
                return (
                  <div key={it.id} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ flex: 1, paddingRight: 6 }}>{it.product_name}</span>
                      <span style={{ width: 40, textAlign: 'right' }}>{it.quantity}x</span>
                      <span style={{ width: 60, textAlign: 'right' }}>${it.unit_price.toFixed(2)}</span>
                      <span style={{ width: 70, textAlign: 'right' }}>${it.total_price.toFixed(2)}</span>
                    </div>
                    {options && Array.isArray(options.groups) && options.groups.length > 0 && (
                      <div style={{ marginLeft: 8, fontSize: 11, color: '#444' }}>
                        {options.groups.map((g: any, gi: number) => (
                          g && Array.isArray(g.selected) && g.selected.length > 0 ? (
                            <div key={gi}>- {g.name}: {g.selected.map((o: any) => o.name).join(', ')}</div>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
            <div style={{ fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('pos.subtotal')}</span>
                <span>${(lastDetail?.order.subtotal ?? 0).toFixed(2)}</span>
              </div>
              {(lastDetail?.order.discount_amount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('pos.discount')}</span>
                  <span>-${(lastDetail?.order.discount_amount ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(lastDetail?.order.tax_amount ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('pos.tax')}</span>
                  <span>+${(lastDetail?.order.tax_amount ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 4 }}>
                <span>{t('pos.total')}</span>
                <span>${(lastDetail?.order.total_amount ?? 0).toFixed(2)}</span>
              </div>
              {typeof lastDetail?.order.paid_amount === 'number' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Paid</span>
                    <span>${(lastDetail?.order.paid_amount ?? 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {((lastDetail?.order.paid_amount ?? 0) - (lastDetail?.order.total_amount ?? 0)) >= 0 ? (
                      <>
                        <span>Change</span>
                        <span>${(((lastDetail?.order.paid_amount ?? 0) - (lastDetail?.order.total_amount ?? 0))).toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <span>Due</span>
                        <span>${(Math.abs(((lastDetail?.order.paid_amount ?? 0) - (lastDetail?.order.total_amount ?? 0)))).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </>
              )}
              <div style={{ marginTop: 8 }}>Payment: {(lastDetail?.order.payment_method || '-').toString()}</div>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
            <div style={{ textAlign: 'center', fontSize: 12, marginTop: 6 }}>{t('pos.thankYou')}</div>
          </div>
        )}
      </div>
    </div>
  );
}