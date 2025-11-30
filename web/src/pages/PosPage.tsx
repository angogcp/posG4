import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Menu,
  ShoppingBag,
  ChevronLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Utensils,
  MapPin,
  ChevronDown,
  List,
  LayoutGrid
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface Category { id: number; name: string; options_json?: any }
interface Product { id: number; name: string; price: number; category_id: number; code?: string; options_json?: any; image_url?: string }
interface CartItem { product: Product; qty: number; unitPrice: number; options?: any; optionsText?: string }
interface Table { id: number; name: string; capacity: number; status: 'available' | 'occupied' | 'reserved'; is_active: boolean }

export default function PosPage() {
  const { t } = useTranslation();
  const { formatCurrency, currencySymbol } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem('pos.viewMode') as 'grid' | 'list') || 'grid';
    } catch { return 'grid'; }
  });

  useEffect(() => {
    localStorage.setItem('pos.viewMode', viewMode);
  }, [viewMode]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getPlaceholderColor = (str: string) => {
    const colors = [
      'bg-red-100 text-red-600',
      'bg-orange-100 text-orange-600',
      'bg-amber-100 text-amber-600',
      'bg-yellow-100 text-yellow-600',
      'bg-lime-100 text-lime-600',
      'bg-green-100 text-green-600',
      'bg-emerald-100 text-emerald-600',
      'bg-teal-100 text-teal-600',
      'bg-cyan-100 text-cyan-600',
      'bg-sky-100 text-sky-600',
      'bg-blue-100 text-blue-600',
      'bg-indigo-100 text-indigo-600',
      'bg-violet-100 text-violet-600',
      'bg-purple-100 text-purple-600',
      'bg-fuchsia-100 text-fuchsia-600',
      'bg-pink-100 text-pink-600',
      'bg-rose-100 text-rose-600',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };



  
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
  const [currentOptions, setCurrentOptions] = useState<OptionGroup[]>([]);

  // Checkout modal state
  const [showCheckout, setShowCheckout] = useState(false);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountInput, setDiscountInput] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash');
  const [paid, setPaid] = useState('');
  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{code:string, type: 'percent'|'amount', value:number} | null>(null);
  // Order Verification
  const [orderVerified, setOrderVerified] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [pax, setPax] = useState('');

  // Re-print last receipt
  interface Order { id: number; order_no?: string; order_number?: string; total_amount: number; created_at: string; subtotal?: number; discount_amount?: number; tax_amount?: number; paid_amount?: number; payment_method?: string }
  interface OrderItem { id: number; product_name: string; quantity: number; unit_price: number; total_price: number; options_json?: any }
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastDetail, setLastDetail] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  // Mobile UI state
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Add to existing order mode
  const [activeOrder, setActiveOrder] = useState<{id: number, order_number: string} | null>(null);

  // Category scroll ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollCategories = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const currentScroll = scrollContainerRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (location.state?.orderId) {
      const oid = location.state.orderId;
      // Fetch order info to confirm
      axios.get(`/api/orders/${oid}`).then(r => {
        const o = r.data.data.order;
        setActiveOrder({ id: o.id, order_number: o.order_number || o.order_no });
        // Pre-fill table info if available
        if (o.table_number) setTableNumber(o.table_number);
        if (o.pax) setPax(o.pax.toString());
        
        // NOTE: We do NOT load existing items into cart, because we are "Adding" items.
        // But we could show a notification.
        setMessage(`Adding items to Order #${o.order_number || o.order_no}`);
      }).catch(e => {
        console.error('Failed to load active order', e);
        setMessage('Failed to load order context');
      });
      
      // Clear location state to prevent loop
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    axios.get('/api/categories').then(r => setCategories(r.data.data || r.data));
    axios.get('/api/products').then(r => setProducts(r.data.data || r.data));
    axios.get('/api/tables').then(r => setTables(r.data.data || []));
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
          const nw = [...prev];
          nw[idx] = { ...nw[idx], qty: nw[idx].qty + 1 };
          return nw;
        }
        return [...prev, { product: prod, qty: 1, unitPrice }];
      } else {
        // Always add new item for customized products (simplification)
        return [...prev, { product: prod, qty: 1, unitPrice, options, optionsText }];
      }
    });
  }

  function effectiveGroupsForProduct(p: Product): OptionGroup[] {
    // 1. If product has explicit options_json, use that
    if (p.options_json && Array.isArray(p.options_json)) {
      return p.options_json as OptionGroup[];
    }
    // 2. Else check category defaults
    if (p.category_id) {
      const cat = categories.find(c => c.id === p.category_id);
      if (cat && cat.options_json && Array.isArray(cat.options_json)) {
        return cat.options_json as OptionGroup[];
      }
    }
    return [];
  }

  async function addToCart(p: Product) {
    let groups: OptionGroup[] = [];

    // 1. Legacy options (from options_json)
    // Check product-level options_json
    if (p.options_json && Array.isArray(p.options_json)) {
      groups = [...(p.options_json as OptionGroup[])];
    } 
    // Check category-level options_json (legacy)
    else if (p.category_id) {
      const cat = categories.find(c => c.id === p.category_id);
      if (cat && cat.options_json && Array.isArray(cat.options_json)) {
        groups = [...(cat.options_json as OptionGroup[])];
      }
    }

    // 2. Fetch new modifiers from backend
    try {
      const res = await axios.get(`/api/products/${p.id}/modifiers`);
      if (res.data && res.data.ok && Array.isArray(res.data.data)) {
        const newMods = res.data.data.map((m: any) => ({
          name: m.name,
          // required if min_choices > 0
          required: (m.min_choices || 0) > 0,
          // max_select: 1 for single, else max_choices (or unlimited/high number)
          max_select: m.selection_type === 'single' ? 1 : (m.max_choices || 99),
          options: m.options.map((o: any) => ({
            name: o.name,
            price_delta: o.price_delta
          }))
        }));
        groups = [...groups, ...newMods];
      }
    } catch (e) {
      console.error("Failed to fetch modifiers", e);
    }

    if (groups.length > 0) {
      setOptionProd(p);
      setCurrentOptions(groups);
      setGroupSelections({});
      setOptionsModalOpen(true);
      return;
    }
    addCartItem(p, p.price);
  }

  function updateQty(idx: number, q: number) {
    if (q < 1) return;
    setCart(prev => {
      const nw = [...prev];
      nw[idx] = { ...nw[idx], qty: q };
      return nw;
    });
  }

  function removeItem(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  const subtotal = useMemo(() => cart.reduce((sum, it) => sum + (it.unitPrice * it.qty), 0), [cart]);

  const getQtyInCart = (productId: number) => {
    return cart.reduce((acc, item) => item.product.id === productId ? acc + item.qty : acc, 0);
  };

  // Coupon logic
  async function applyCoupon() {
    if (!couponCode.trim()) return;
    try {
      const r = await axios.post('/api/coupons/verify', { code: couponCode, subtotal });
      if (r.data?.ok) {
        setCouponApplied({ code: couponCode, type: r.data.type, value: r.data.value });
        setMessage(`Coupon ${couponCode} applied`);
      } else {
        alert('Invalid coupon');
        setCouponApplied(null);
      }
    } catch (e) {
      alert('Coupon check failed');
      setCouponApplied(null);
    }
  }

  const discountAmount = useMemo(() => {
    // If coupon applied, it overrides manual discount
    if (couponApplied) {
      if (couponApplied.type === 'percent') {
        return (subtotal * couponApplied.value) / 100;
      }
      return couponApplied.value;
    }

    // Manual discount
    const val = parseFloat(discountInput);
    if (isNaN(val) || val <= 0) return 0;
    if (discountType === 'amount') return val;
    return (subtotal * val) / 100;
  }, [subtotal, discountInput, discountType, couponApplied]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * taxRatePct) / 100;
  const total = taxableAmount + taxAmount;

  async function getOrderDetail(orderId: number) {
    try {
      const r = await axios.get(`/api/orders/${orderId}`);
      if (r.data && r.data.data) {
        const o = r.data.data;
        const items = r.data.items || [];
        return { order: o, items };
      }
    } catch (e) {
      console.error('Failed to fetch order detail', e);
    }
    return null;
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    if (!tableNumber.trim()) {
      alert('Please enter table number');
      return;
    }
    if (!pax.trim()) {
      alert('Please enter number of guests (Pax)');
      return;
    }
    if (!orderVerified) {
      alert('Please confirm the order details');
      return;
    }
    
    setCheckingOut(true);
    try {
      const items = cart.map(x => ({
        product_id: x.product.id,
        product_code: x.product.code || '',
        product_name: x.product.name,
        quantity: x.qty,
        unit_price: x.unitPrice,
        options: x.options // Pass structured options to backend
      }));
      
      if (activeOrder) {
        // Append to existing order
        await axios.post(`/api/orders/${activeOrder.id}/items`, { 
          items,
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
          discount_amount: discountAmount
        });
        setMessage(`Items added to Order #${activeOrder.order_number} successfully!`);
        setCart([]);
        setShowCheckout(false);
        // Wait a bit then go back
        setTimeout(() => navigate('/orders'), 1500);
      } else {
        // 1. Create Order
        const r = await axios.post('/api/orders', {
          items,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: total,
          table_number: tableNumber,
          pax: parseInt(pax) || 0,
          couponCode: couponApplied?.code,
          paid_amount: 0, // Not paid yet
          payment_method: 'pay_later', // Or 'unpaid'
          status: 'open' // Order sent to kitchen
        });
        const newOrderId = r.data.data?.order_id || r.data.orderId;
        
        setMessage('Order placed successfully!');
        setLastOrderId(newOrderId);
        setCart([]);
        setShowCheckout(false);
        setDiscountInput('0'); setDiscountType('amount'); setPaid(''); setPaymentMethod('cash');
        setCouponCode(''); setCouponApplied(null);
        setTableNumber(''); setPax(''); setOrderVerified(false);
        
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
      }
      setShowCheckout(false);
    } catch (e:any) {
      console.error('Order placement failed:', e);
      alert(`Order placement failed: ${e.response?.data?.error || e.message}`);
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
    return currentOptions;
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
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-4 p-4 overflow-hidden relative">
      {/* Left Side: Catalog */}
      <div className="flex-1 flex flex-col min-w-0 gap-4 h-full">
        
        {/* Categories Bar - Mobile Dropdown */}
        <div className="lg:hidden flex-shrink-0 px-1 pb-2">
          <div className="relative">
            <select
              className="w-full appearance-none bg-white border border-neutral-200 text-neutral-700 py-3 pl-4 pr-10 rounded-xl font-bold text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={activeCat}
              onChange={(e) => setActiveCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">{t('pos.all')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
              <ChevronDown className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Categories Bar - Desktop Scrollable */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 pb-2">
          <button 
            onClick={() => scrollCategories('left')}
            className="p-2 rounded-full bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 z-10 flex-shrink-0"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto no-scrollbar scroll-smooth"
          >
            <div className="flex gap-3 px-1">
              <button 
                className={`
                  flex items-center gap-2 px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all select-none flex-shrink-0
                  ${activeCat === 'all' 
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-200 scale-105' 
                    : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200'}
                `}
                onClick={() => setActiveCat('all')}
              >
                <Package className="w-4 h-4" />
                {t('pos.all')}
              </button>
              {categories.map(c => (
                <button 
                  key={c.id} 
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all select-none flex-shrink-0
                    ${activeCat === c.id 
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-200 scale-105' 
                      : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200'}
                  `}
                  onClick={() => setActiveCat(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => scrollCategories('right')}
            className="p-2 rounded-full bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 z-10 flex-shrink-0"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* Search & Barcode & View Toggle */}
        <div className="flex-shrink-0 flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input 
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              placeholder={t('pos.searchPlaceholder') || 'Search products...'}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 relative">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input 
              ref={scanInputRef}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all font-mono"
              placeholder={t('pos.scanPlaceholder') || 'Scan barcode...'}
              value={scanCode}
              onChange={e => setScanCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScanSubmit()}
            />
          </div>
          <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-primary-600' : 'text-neutral-500 hover:text-neutral-700'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-primary-600' : 'text-neutral-500 hover:text-neutral-700'}`}
              title="List View"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Grid/List */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
          {viewMode === 'grid' && activeCat === 'all' && !query.trim() ? (
            <div className="space-y-8 pb-12">
              {categories.map(cat => {
                const catProducts = products.filter(p => p.category_id === cat.id);
                if (catProducts.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h3 className="font-bold text-lg text-neutral-700 mb-3 sticky top-0 bg-neutral-50/95 backdrop-blur py-2 z-10 px-1 border-b border-neutral-200/50">
                      {cat.name}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {catProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="group relative flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 overflow-hidden text-left h-full"
                        >
                          <div className={`aspect-[4/3] relative overflow-hidden ${p.image_url ? 'bg-neutral-100' : getPlaceholderColor(p.name)}`}>
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform duration-500">
                                <Utensils className="w-12 h-12 opacity-50" />
                              </div>
                            )}
                            {getQtyInCart(p.id) > 0 && (
                              <div className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10 border border-white">
                                {getQtyInCart(p.id)}
                              </div>
                            )}
                            <div className="absolute top-2 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <div className="bg-white/90 p-1.5 rounded-full shadow-sm text-primary-600">
                                <Plus className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                          <div className="p-3 flex flex-col flex-1">
                            <h3 className="font-medium text-neutral-900 line-clamp-2 mb-1 flex-1 text-sm">{p.name}</h3>
                            <div className="flex items-baseline justify-between mt-auto">
                              <span className="text-sm font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                                {formatCurrency(p.price)}
                              </span>
                              {p.code && <span className="text-[10px] text-neutral-400 font-mono">{p.code}</span>}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pb-12">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group relative flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 overflow-hidden text-left h-full"
                  >
                    <div className={`aspect-[4/3] relative overflow-hidden ${p.image_url ? 'bg-neutral-100' : getPlaceholderColor(p.name)}`}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform duration-500">
                          <Utensils className="w-12 h-12 opacity-50" />
                        </div>
                      )}
                      {getQtyInCart(p.id) > 0 && (
                        <div className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10 border border-white">
                          {getQtyInCart(p.id)}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <div className="bg-white/90 p-1.5 rounded-full shadow-sm text-primary-600">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-medium text-neutral-900 line-clamp-2 mb-1 flex-1 text-sm">{p.name}</h3>
                      <div className="flex items-baseline justify-between mt-auto">
                        <span className="text-sm font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                          {formatCurrency(p.price)}
                        </span>
                        {p.code && <span className="text-[10px] text-neutral-400 font-mono">{p.code}</span>}
                      </div>
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-12 text-neutral-400">
                    <Package className="w-12 h-12 mb-2 opacity-50" />
                    <p>{t('pos.noItems') || 'No products found'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 pb-12">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group flex items-center bg-white rounded-xl border border-neutral-200 p-2 hover:shadow-md hover:border-primary-300 transition-all duration-200 text-left"
                  >
                    <div className={`relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 mr-4 ${p.image_url ? 'bg-neutral-100' : getPlaceholderColor(p.name)}`}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-80 group-hover:scale-110 transition-transform duration-500">
                          <Utensils className="w-6 h-6 opacity-50" />
                        </div>
                      )}
                      {getQtyInCart(p.id) > 0 && (
                        <div className="absolute top-1 left-1 bg-primary-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm border border-white">
                          {getQtyInCart(p.id)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-neutral-900 truncate text-lg">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                         {p.code && <span className="text-xs text-neutral-400 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{p.code}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 pl-4">
                      <span className="text-lg font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-lg">
                        {formatCurrency(p.price)}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-primary-100 text-primary-600 p-1.5 rounded-full">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                    <Package className="w-12 h-12 mb-2 opacity-50" />
                    <p>{t('pos.noItems') || 'No products found'}</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>
        
        {/* Mobile Cart Trigger */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
            <button 
                onClick={() => setShowMobileCart(true)}
                className="w-full bg-neutral-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between ring-1 ring-white/20 backdrop-blur-xl bg-neutral-900/90"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-primary-500 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center border-2 border-neutral-900">
                        {cart.reduce((a, b) => a + b.qty, 0)}
                    </div>
                    <span className="font-bold">View Order</span>
                </div>
                <span className="font-bold text-lg">{formatCurrency(total)}</span>
            </button>
        </div>
      </div>

      {/* Right Side: Cart */}
      <div className={`
        fixed inset-0 z-50 bg-white lg:static lg:z-auto lg:w-96 flex-shrink-0 flex flex-col lg:rounded-2xl shadow-lg border border-neutral-200 h-full overflow-hidden transition-transform duration-300
        ${showMobileCart ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
      `}>
        {/* Mobile Cart Header */}
        <div className="lg:hidden p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Current Order
            </h2>
            <button onClick={() => setShowMobileCart(false)} className="p-2 hover:bg-neutral-200 rounded-full">
                <ChevronLeft className="w-6 h-6" />
            </button>
        </div>
        {/* Cart Header */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
          {activeOrder && (
             <div className="bg-primary-100 text-primary-800 text-xs font-bold flex justify-between items-center p-2 rounded mb-3 border border-primary-200">
               <span className="flex items-center gap-1"><Plus className="w-3 h-3"/> Adding to #{activeOrder.order_number}</span>
               <button onClick={() => { setActiveOrder(null); setCart([]); }} className="hover:bg-primary-200 rounded p-0.5"><X className="w-3 h-3"/></button>
             </div>
          )}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-primary-100 p-2 rounded-lg text-primary-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-neutral-900">{activeOrder ? 'New Items' : 'Current Order'}</h2>
                <p className="text-xs text-neutral-500">{cart.length} items</p>
              </div>
            </div>
            <button 
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="text-neutral-400 hover:text-danger-600 transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 opacity-60">
              <ShoppingCart className="w-16 h-16 stroke-1" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs text-center max-w-[200px]">Select products from the left to add them to the order</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="group relative bg-white border border-neutral-100 rounded-xl p-3 hover:border-primary-200 transition-colors shadow-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate">{item.product.name}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {formatCurrency(item.unitPrice)}
                      {item.optionsText && <div className="text-primary-600 mt-1 font-medium text-[10px] leading-tight">{item.optionsText}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-neutral-900">{formatCurrency(item.unitPrice * item.qty)}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
                    <button 
                      onClick={() => updateQty(idx, item.qty - 1)}
                      className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-neutral-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium font-mono">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(idx, item.qty + 1)}
                      className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-neutral-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeItem(idx)}
                    className="p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Tax ({taxRatePct}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-neutral-900 pt-2 border-t border-neutral-200">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              disabled={cart.length === 0 || checkingOut}
              onClick={() => setShowCheckout(true)}
              className="col-span-2 btn btn-primary btn-lg w-full shadow-lg shadow-primary-200 disabled:shadow-none"
            >
              {checkingOut ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Place Order <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Options Modal */}
      {optionsModalOpen && optionProd && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <div>
                <h3 className="font-bold text-lg">{optionProd.name}</h3>
                <p className="text-sm text-neutral-500">Select options</p>
              </div>
              <button onClick={() => setOptionsModalOpen(false)} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-6">
              {currentGroups().map((g, gi) => (
                <div key={gi} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h4 className="font-medium text-neutral-900 flex items-center gap-2">
                      {g.name}
                      {g.required && <span className="text-[10px] bg-danger-100 text-danger-700 px-1.5 py-0.5 rounded-md font-bold uppercase">Required</span>}
                    </h4>
                    {g.max_select && g.max_select > 1 && (
                      <span className="text-xs text-neutral-500">Max {g.max_select}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {(g.options || []).map((opt, oi) => {
                      const sel = groupSelections[gi] || [];
                      const checked = sel.includes(oi);
                      const multi = (g.max_select || 1) > 1;
                      
                      return (
                        <label 
                          key={oi} 
                          className={`
                            flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
                            ${checked 
                              ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                              : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`
                              w-5 h-5 rounded border flex items-center justify-center transition-colors
                              ${checked 
                                ? 'bg-primary-500 border-primary-500 text-white' 
                                : 'border-neutral-300 bg-white'}
                              ${!multi && 'rounded-full'}
                            `}>
                              {checked && <CheckCircle className="w-3.5 h-3.5" />}
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={checked} 
                              onChange={() => toggleSelect(gi, oi)} 
                            />
                            <span className={checked ? 'font-medium text-primary-900' : 'text-neutral-700'}>
                              {opt.name}
                            </span>
                          </div>
                          {opt.price_delta ? (
                            <span className={`text-sm font-medium ${checked ? 'text-primary-700' : 'text-neutral-500'}`}>
                              {opt.price_delta > 0 ? '+' : ''}{formatCurrency(opt.price_delta)}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between gap-4">
              <div className="text-lg font-bold text-neutral-900">
                {formatCurrency(optionPrice)}
              </div>
              <div className="flex gap-3">
                <button 
                  className="px-4 py-2 text-neutral-600 font-medium hover:bg-neutral-200 rounded-xl transition-colors"
                  onClick={() => setOptionsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="px-6 py-2 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-200 hover:bg-primary-700 disabled:opacity-50 disabled:shadow-none transition-all"
                  onClick={confirmOptions}
                  disabled={optionConfirmDisabled}
                >
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-neutral-900">Confirm Order</h2>
              <button onClick={() => setShowCheckout(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Table Info Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Table Number *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                    {tables.length > 0 ? (
                      <select 
                        className="input w-full pl-10 appearance-none"
                        value={tableNumber}
                        onChange={e => {
                          setTableNumber(e.target.value);
                          // Auto set capacity if available
                          const t = tables.find(x => x.name === e.target.value);
                          if (t && !pax) setPax(t.capacity.toString());
                        }}
                      >
                        <option value="">Select Table...</option>
                        {tables.map(t => (
                          <option key={t.id} value={t.name}>
                            {t.name} ({t.capacity} pax) {t.status !== 'available' ? ` - ${t.status}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        className="input w-full pl-10"
                        placeholder="e.g. 5, A1"
                        value={tableNumber}
                        onChange={e => setTableNumber(e.target.value)}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Pax (Guests) *</label>
                  <input 
                    type="number"
                    className="input w-full"
                    placeholder="e.g. 4"
                    value={pax}
                    onChange={e => setPax(e.target.value)}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-neutral-50 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-neutral-900 border-b border-neutral-200 pb-2">Order Summary</h3>
                
                {/* Items List for Verification */}
                <div className="space-y-3 max-h-60 overflow-y-auto border-b border-neutral-200 pb-4 custom-scrollbar">
                  {cart.map((item, idx) => (
                    <div key={idx} className="text-sm">
                      <div className="flex justify-between font-medium text-neutral-800">
                        <span>{item.qty}x {item.product.name}</span>
                        <span>{formatCurrency(item.unitPrice * item.qty)}</span>
                      </div>
                      {item.optionsText && (
                        <div className="text-xs text-neutral-500 pl-4 mt-0.5">
                          {item.optionsText}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  
                  {/* Discount */}
                  <div className="flex justify-between text-neutral-600 items-center">
                    <span className="flex items-center gap-1">Discount <Tag className="w-3 h-3" /></span>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white rounded-lg border border-neutral-200 overflow-hidden h-7">
                        <button 
                        onClick={() => setDiscountType('amount')}
                        className={`px-2 text-xs font-medium ${discountType === 'amount' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
                      >
                        {currencySymbol}
                      </button>
                        <button 
                          onClick={() => setDiscountType('percent')}
                          className={`px-2 text-xs font-medium ${discountType === 'percent' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
                        >
                          %
                        </button>
                      </div>
                      <input 
                        className="w-16 text-right bg-transparent border-b border-neutral-300 focus:border-primary-500 outline-none font-medium"
                        value={discountInput}
                        onChange={e => setDiscountInput(e.target.value)}
                      />
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-success-600 text-xs">
                      <span>Saved</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-neutral-600">
                    <span>Tax ({taxRatePct}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-200">
                  <div className="flex justify-between items-end">
                    <span className="text-lg font-bold text-neutral-900">Total</span>
                    <span className="text-3xl font-bold text-primary-600">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pt-4 bg-white">
              <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  checked={orderVerified}
                  onChange={e => setOrderVerified(e.target.checked)}
                />
                <span className="font-medium text-blue-900">I confirm the order details are correct</span>
              </label>
            </div>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-4">
              <button 
                onClick={() => setShowCheckout(false)}
                className="px-6 py-3 text-neutral-600 font-bold hover:bg-neutral-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCheckout}
                disabled={checkingOut || !orderVerified || !tableNumber.trim() || !pax.trim()}
                className="px-8 py-3 bg-primary-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-primary-200 hover:bg-primary-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
              >
                {checkingOut ? 'Processing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages/Toasts */}
      {message && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-neutral-900/90 text-white px-6 py-3 rounded-full shadow-2xl backdrop-blur-md z-50 animate-in slide-in-from-top-4 fade-in duration-300 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success-400" />
          <span className="font-medium">{message}</span>
          <button onClick={() => setMessage(null)} className="ml-2 hover:bg-white/20 rounded-full p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Receipt Print Area */}
      <div className="hidden print:block" ref={receiptRef}>
        {lastDetail && (
          <div id="receipt-print" className="p-4 bg-white text-black text-sm font-mono leading-tight max-w-[80mm]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">{storeName || 'Restaurant'}</h2>
              <p>{storeAddress}</p>
              <p>{storePhone}</p>
              <div className="my-2 border-b border-black"></div>
              <p>Order #{lastDetail.order.order_number || lastDetail.order.order_no || lastDetail.order.id}</p>
              <p>{new Date(lastDetail.order.created_at).toLocaleString()}</p>
            </div>
            
            <div className="mb-4">
              {lastDetail.items.map((item, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between font-bold">
                    <span>{item.product_name}</span>
                    <span>x{item.quantity}</span>
                  </div>
                  {item.options_json && (
                    <div className="text-xs ml-2">
                      {item.options_json.groups?.map((g:any) => g.selected?.map((o:any) => o.name).join(', ')).join(', ')}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <span>{formatCurrency(item.total_price)}</span>
                  </div>
                </div>
              ))}
              <div className="my-2 border-b border-black"></div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(lastDetail.order.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>{formatCurrency(lastDetail.order.discount_amount ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(lastDetail.order.tax_amount ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2">
                <span>Total</span>
                <span>{formatCurrency(lastDetail.order.total_amount)}</span>
              </div>
              <div className="text-center mt-4">
                <p>Thank you!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
