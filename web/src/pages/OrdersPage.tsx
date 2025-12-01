import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { 
  Search, 
  Filter, 
  Printer, 
  RefreshCw,
  ShoppingBag,
  Calendar,
  DollarSign,
  Clock,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CreditCard,
  Banknote,
  Package,
  FileText,
  RotateCcw,
  Tag,
  Users,
  MapPin,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Order { 
  id: number; 
  order_no?: string; 
  order_number?: string; 
  total_amount: number; 
  created_at: string; 
  subtotal?: number; 
  discount_amount?: number; 
  tax_amount?: number; 
  paid_amount?: number; 
  payment_method?: string;
  table_number?: string;
  pax?: number;
}
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

interface OrderItem { id: number; product_name: string; quantity: number; unit_price: number; total_price: number }

export default function OrdersPage() {
  const { t } = useTranslation();
  const { formatCurrency, currency } = useSettings();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [storeName, setStoreName] = useState<string>('');
  const [storeAddress, setStoreAddress] = useState<string>('');
  const [storePhone, setStorePhone] = useState<string>('');
  const [printerStatus, setPrinterStatus] = useState<'connected' | 'disconnected' | 'checking'>('disconnected');
  const [printing, setPrinting] = useState(false);
  const [thermalPrintEnabled, setThermalPrintEnabled] = useState(() => {
    return localStorage.getItem('thermalPrintEnabled') === 'true';
  });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('unpaid');
  const [showFilters, setShowFilters] = useState(false);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleProcessPayment() {
    if (!selectedId || !paymentAmount || processingPayment) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount');
      return;
    }

    setProcessingPayment(true);
    try {
      await axios.post(`/api/orders/${selectedId}/pay`, {
        paid_amount: amount,
        payment_method: paymentMethod
      });
      
      // Refresh order details
      const r = await axios.get(`/api/orders/${selectedId}`);
      setDetail(r.data.data);
      setPaymentModalOpen(false);
      setPaymentAmount('');
      
      // Also refresh the list
      fetchOrders();
    } catch (e: any) {
      console.error(e);
      alert('Payment failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setProcessingPayment(false);
    }
  }

  async function fetchOrders(opts?: { page?: number; pageSize?: number }) {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    setLoadingList(true);
    try {
      const params: any = { page: nextPage, pageSize: nextPageSize };
      if (query.trim()) params.q = query.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (statusFilter !== 'all') params.payment_status = statusFilter;

      const r = await axios.get('/api/orders', { params });
      const data = r.data?.data ?? r.data;
      setOrders(Array.isArray(data) ? data : []);
      const t = r.data?.total ?? 0;
      setTotal(typeof t === 'number' ? t : 0);
      setPage(r.data?.page ?? nextPage);
      setPageSize(r.data?.pageSize ?? nextPageSize);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    fetchOrders({ page: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Preload business settings for receipt header/footer
    (async () => {
      try {
        const r = await axios.get('/api/settings');
        const arr = (r.data?.data ?? r.data) as Array<{ key: string; value: string }>;
        if (Array.isArray(arr)) {
          const map = arr.reduce<Record<string, string>>((m, it: any) => {
            if (it && it.key != null) m[String(it.key)] = String(it.value ?? '');
            return m;
          }, {});
          setStoreName(map['store.name'] || map['name'] || '');
          setStoreAddress(map['store.address'] || map['address'] || '');
          setStorePhone(map['store.phone'] || map['phone'] || '');
        }
      } catch (_e) {
        // ignore
      }
    })();
    
    // Check printer status on load
    if (thermalPrintEnabled) {
      checkPrinterStatus();
    }
  }, [thermalPrintEnabled]);

  const filteredOrders = useMemo(() => {
    // server-side already filters; keep client filter for resiliency
    const q = query.trim().toLowerCase();
    return orders.filter(o => {
      const num = (o.order_number || o.order_no || '').toString().toLowerCase();
      const matchesQuery = !q || num.includes(q);
      const d = new Date(o.created_at);
      const after = !startDate || d >= new Date(startDate + 'T00:00:00');
      const before = !endDate || d <= new Date(endDate + 'T23:59:59');
      
      let matchesStatus = true;
      const isPaid = (o.paid_amount || 0) >= o.total_amount;
      if (statusFilter === 'paid') matchesStatus = isPaid;
      if (statusFilter === 'unpaid') matchesStatus = !isPaid;

      return matchesQuery && after && before && matchesStatus;
    });
  }, [orders, query, startDate, endDate, statusFilter]);

  async function applyFilters() {
    await fetchOrders({ page: 1, pageSize });
  }

  async function changePage(next: number) {
    if (next < 1 || next > totalPages) return;
    await fetchOrders({ page: next, pageSize });
  }

  async function openDetail(id: number) {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const r = await axios.get(`/api/orders/${id}`);
      setDetail(r.data.data);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setLoadingDetail(false);
  }

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

  const printThermalReceipt = async (orderData: any) => {
    setPrinting(true);
    try {
      if (!thermalPrintEnabled || printerStatus !== 'connected') {
        window.print();
        return;
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
            order_number: orderData.order.order_number || orderData.order.id,
            created_at: orderData.order.created_at,
            subtotal: orderData.order.subtotal || 0,
            discount_amount: orderData.order.discount_amount || 0,
            tax_amount: orderData.order.tax_amount || 0,
            total_amount: orderData.order.total_amount || 0,
            paid_amount: orderData.order.paid_amount || 0,
            payment_method: orderData.order.payment_method || 'cash'
          },
          items: orderData.items.map((item: any) => ({
            name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            options: item.options || []
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

        const response = await fetch('/api/print/receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(receiptData)
        });

        if (!response.ok) {
          throw new Error('Thermal print failed');
        }
      } catch (error) {
        console.error('Thermal printing failed, falling back to browser print:', error);
        window.print();
      }
    } finally {
      setPrinting(false);
    }
  };

  function handlePrint() {
     if (detail) {
       printThermalReceipt(detail);
     } else {
       window.print();
     }
   }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center shadow-lg">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{t('orders.title')}</h1>
              <p className="text-sm text-neutral-500">
                {loadingList ? t('common.loading') : t('common.showing', { count: filteredOrders.length, total: total || orders.length })}
              </p>
            </div>
          </div>
          <button 
            onClick={applyFilters}
            disabled={loadingList}
            className={`btn ${loadingList ? 'btn-secondary' : 'btn-primary'} disabled:opacity-60`}
          >
            {loadingList ? (
              <>
                <div className="spinner w-4 h-4" />
                <span>{t('common.refreshing')}</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>{t('common.apply')}</span>
              </>
            )}
          </button>
        </div>

        {/* Search and Filters */}
        <div className="card p-6">
          <div 
            className="flex items-center justify-between lg:hidden mb-4 cursor-pointer" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center gap-2 text-neutral-700">
              <Filter className="w-4 h-4" />
              <span className="font-semibold text-sm">Filters & Search</span>
            </div>
            <ChevronRight className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
          </div>

          <div className={`flex flex-col lg:flex-row gap-4 ${showFilters ? 'flex' : 'hidden lg:flex'}`}>
            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Search className="w-4 h-4 inline mr-2" />
                {t('common.search')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('orders.searchPlaceholder')}
                  className="input pl-10 w-full"
                />
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="lg:w-48">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                {t('orders.from')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input w-full"
              />
            </div>
            
            <div className="lg:w-48">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                {t('orders.to')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="input w-full"
              />
            </div>

            <div className="lg:w-48">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                {t('orders.status')}
              </label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="input w-full"
              >
                <option value="all">All Orders</option>
                <option value="paid">Paid Only</option>
                <option value="unpaid">Unpaid Only</option>
              </select>
            </div>

            {/* Clear Button */}
            <div className="lg:w-auto">
              <label className="block text-sm font-semibold text-neutral-700 mb-2 lg:invisible">
                Options
              </label>
              <button
                onClick={() => { 
                  setQuery(''); 
                  setStartDate(''); 
                  setEndDate(''); 
                  setStatusFilter('all');
                  setPage(1); 
                  setPageSize(20); 
                  setTotal(0); 
                  fetchOrders({ page: 1, pageSize: 20 }); 
                }}
                className="btn btn-ghost w-full lg:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-2 lg:mr-0" />
                {t('common.clear')}
              </button>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="card p-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-600 mb-2">{t('orders.noOrders')}</h3>
              <p className="text-neutral-500 text-sm">No orders found for the selected criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredOrders.map(order => {
                const orderDate = new Date(order.created_at);
                const paymentIcon = order.payment_method === 'card' ? CreditCard : Banknote;
                const PaymentIcon = paymentIcon;
                const isPaid = (order.paid_amount || 0) >= order.total_amount;
                
                return (
                  <div 
                    key={order.id} 
                    onClick={() => openDetail(order.id)}
                    className={`group relative bg-white border rounded-2xl p-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer ${
                      isPaid ? 'border-neutral-200 hover:border-primary-200' : 'border-amber-200 hover:border-amber-400 shadow-sm'
                    }`}
                  >
                    {/* Status Badge */}
                    <div className={`absolute top-4 right-4 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      isPaid ? 'bg-success-100 text-success-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isPaid ? 'PAID' : 'UNPAID'}
                    </div>

                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isPaid ? 'bg-gradient-to-br from-primary-100 to-primary-200' : 'bg-gradient-to-br from-amber-100 to-amber-200'
                        }`}>
                          <Receipt className={`w-4 h-4 ${isPaid ? 'text-primary-600' : 'text-amber-600'}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors text-sm">
                            #{order.order_number || order.order_no || order.id}
                          </h3>
                          <p className="text-xs text-neutral-500">
                            {orderDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="space-y-2">
                      {/* Table Info */}
                      {(order.table_number || order.pax) && (
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-dashed border-neutral-200">
                          <span className="text-xs text-neutral-600 flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            <span className="hidden xs:inline">Table</span>
                          </span>
                          <span className="text-sm font-bold text-neutral-800">
                            {order.table_number || '-'}
                            {order.pax ? (
                              <span className="ml-1 text-xs font-normal text-neutral-500">
                                ({order.pax} <Users className="w-3 h-3 inline -mt-0.5" />)
                              </span>
                            ) : ''}
                          </span>
                        </div>
                      )}

                      {/* Total Amount */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600 flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          <span className="hidden xs:inline">Total</span>
                        </span>
                        <span className="text-base font-bold text-neutral-900">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>

                      {/* Payment Method */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600 flex items-center">
                          <PaymentIcon className="w-3 h-3 mr-1" />
                          <span className="hidden xs:inline">Payment</span>
                        </span>
                        <span className="text-xs font-medium text-neutral-700 capitalize">
                          {order.payment_method || 'Cash'}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          <span className="hidden xs:inline">Time</span>
                        </span>
                        <span className="text-xs text-neutral-700">
                          {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Hover Effect Overlay */}
                    <div className="absolute inset-0 bg-primary-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modern Pagination */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Page Info */}
            <div className="flex items-center space-x-2 text-sm text-neutral-600">
              <span>Showing</span>
              <span className="font-semibold text-neutral-900">{Math.min((page - 1) * pageSize + 1, total)}</span>
              <span>to</span>
              <span className="font-semibold text-neutral-900">{Math.min(page * pageSize, total)}</span>
              <span>of</span>
              <span className="font-semibold text-neutral-900">{total}</span>
              <span>orders</span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-2">
              {/* First Page */}
              <button 
                onClick={() => changePage(1)}
                disabled={page <= 1}
                className="p-2 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-600"
                title="First page"
              >
                <ChevronLeft className="w-4 h-4" />
                <ChevronLeft className="w-4 h-4 -ml-2" />
              </button>
              
              {/* Previous Page */}
              <button 
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                className="p-2 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-600"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => changePage(pageNum)}
                      className={`w-8 h-8 text-sm font-medium rounded-xl transition-all ${
                        page === pageNum
                          ? 'bg-primary-600 text-white shadow-lg'
                          : 'text-neutral-600 hover:text-primary-600 hover:bg-primary-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Next Page */}
              <button 
                onClick={() => changePage(page + 1)}
                disabled={page >= totalPages}
                className="p-2 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-600"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {/* Last Page */}
              <button 
                onClick={() => changePage(totalPages)}
                disabled={page >= totalPages}
                className="p-2 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-600"
                title="Last page"
              >
                <ChevronRight className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 -ml-2" />
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center space-x-2 text-sm">
              <label className="text-neutral-600">Show:</label>
              <select 
                value={pageSize} 
                onChange={e => { 
                  const v = parseInt(e.target.value, 10) || 20; 
                  setPageSize(v); 
                  fetchOrders({ page: 1, pageSize: v }); 
                }}
                className="input text-sm py-1 px-2 w-20"
              >
                {[10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-neutral-600">per page</span>
            </div>
          </div>
        </div>

      {/* Modern Order Detail Modal */}
      {selectedId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-4 lg:p-6 z-10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center justify-between w-full lg:w-auto space-x-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Receipt className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900">
                        Order #{detail?.order?.order_number || detail?.order?.order_no || selectedId}
                      </h2>
                      <p className="text-sm text-neutral-500">
                        {detail?.order && new Date(detail.order.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Mobile Close Button */}
                  <button 
                    onClick={closeDetail}
                    className="lg:hidden p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                  {/* Printer Controls - Hide text on mobile to save space */}
                  <div className="flex items-center gap-2 px-2 py-1.5 lg:px-4 lg:py-2 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const enabled = !thermalPrintEnabled;
                          setThermalPrintEnabled(enabled);
                          localStorage.setItem('thermalPrintEnabled', enabled.toString());
                          if (enabled) {
                            checkPrinterStatus();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          thermalPrintEnabled ? 'bg-primary-600' : 'bg-neutral-200'
                        }`}
                        role="switch"
                        aria-checked={thermalPrintEnabled}
                      >
                        <span
                          className={`${
                            thermalPrintEnabled ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                        <span className="text-sm font-medium text-neutral-700 flex items-center gap-2 hidden sm:flex">
                        <Printer className="w-4 h-4" />
                        Thermal
                      </span>
                    </div>

                    {thermalPrintEnabled && (
                      <div className="flex items-center gap-2 pl-2 lg:pl-3 border-l border-neutral-200">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                          printerStatus === 'connected' ? 'bg-success-50 text-success-700' :
                          printerStatus === 'checking' ? 'bg-warning-50 text-warning-700' : 
                          'bg-danger-50 text-danger-700'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            printerStatus === 'connected' ? 'bg-success-500' :
                            printerStatus === 'checking' ? 'bg-warning-500' : 'bg-danger-500'
                          }`}></div>
                          <span className="capitalize hidden sm:inline">{printerStatus}</span>
                        </div>
                        <button
                          onClick={checkPrinterStatus}
                          disabled={printerStatus === 'checking'}
                          className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Check printer status"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${printerStatus === 'checking' ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>

                  {(detail?.order.paid_amount || 0) < (detail?.order.total_amount || 0) && (
                    <>
                      <button 
                        onClick={() => {
                          navigate('/pos', { state: { orderId: detail?.order.id } });
                        }}
                        className="btn bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-200 px-3 lg:px-4"
                      >
                        <Plus className="w-4 h-4 mr-1 lg:mr-2" />
                        <span className="hidden sm:inline">Add Items</span>
                        <span className="sm:hidden">Add</span>
                      </button>

                      <button 
                        onClick={() => {
                          setPaymentAmount((detail?.order.total_amount || 0).toString());
                          setPaymentModalOpen(true);
                        }}
                        className="btn bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-200 px-3 lg:px-4"
                      >
                        <DollarSign className="w-4 h-4 mr-1 lg:mr-2" />
                        Pay
                      </button>
                    </>
                  )}

                  <button 
                    onClick={handlePrint}
                    disabled={printing}
                    className="btn btn-primary disabled:opacity-70 px-3 lg:px-4"
                  >
                    {printing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline ml-2">Printing...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4 mr-1 lg:mr-2" />
                        <span className="hidden sm:inline">Receipt</span>
                        <span className="sm:hidden">Print</span>
                      </>
                    )}
                  </button>
                  
                  <button 
                    onClick={closeDetail}
                    className="hidden lg:block p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingDetail && (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner w-8 h-8" />
                  <span className="ml-3 text-neutral-600">{t('common.loading')}</span>
                </div>
              )}
              
              {detail && (
                <div className="space-y-6">
                  {/* Order Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Table Info */}
                    {(detail.order.table_number || detail.order.pax) && (
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-purple-200 rounded-lg flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-purple-700" />
                            </div>
                            <span className="text-sm font-medium text-purple-800">Table</span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-800">
                              {detail.order.table_number || '-'}
                            </div>
                            {detail.order.pax ? (
                              <div className="text-xs text-purple-600 font-medium flex items-center justify-end gap-1">
                                {detail.order.pax} <Users className="w-3 h-3" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Subtotal */}
                    <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-neutral-200 rounded-lg flex items-center justify-center">
                            <Package className="w-4 h-4 text-neutral-600" />
                          </div>
                          <span className="text-sm font-medium text-neutral-700">Subtotal</span>
                        </div>
                        <span className="text-lg font-bold text-neutral-900">
                            {formatCurrency(detail.order.subtotal ?? 0)}
                          </span>
                      </div>
                    </div>

                    {/* Discount */}
                    {(detail.order.discount_amount ?? 0) > 0 && (
                      <div className="bg-gradient-to-br from-warning-50 to-warning-100 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-warning-200 rounded-lg flex items-center justify-center">
                              <Tag className="w-4 h-4 text-warning-700" />
                            </div>
                            <span className="text-sm font-medium text-warning-800">Discount</span>
                          </div>
                          <span className="text-lg font-bold text-warning-800">
                            -{formatCurrency(detail.order.discount_amount ?? 0)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tax */}
                    {(detail.order.tax_amount ?? 0) > 0 && (
                      <div className="bg-gradient-to-br from-info-50 to-info-100 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-info-200 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-info-700" />
                            </div>
                            <span className="text-sm font-medium text-info-800">Tax</span>
                          </div>
                          <span className="text-lg font-bold text-info-800">
                            +{formatCurrency(detail.order.tax_amount ?? 0)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary-200 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-primary-700" />
                          </div>
                          <span className="text-sm font-medium text-primary-800">Total</span>
                        </div>
                        <span className="text-xl font-bold text-primary-800">
                          {formatCurrency(detail.order.total_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="bg-gradient-to-br from-success-50 to-success-100 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-success-200 rounded-lg flex items-center justify-center">
                            {detail.order.payment_method === 'card' ? (
                              <CreditCard className="w-4 h-4 text-success-700" />
                            ) : (
                              <Banknote className="w-4 h-4 text-success-700" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-success-800">Paid</span>
                        </div>
                        <span className="text-lg font-bold text-success-800">
                          {formatCurrency(detail.order.paid_amount ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-neutral-200 rounded-lg flex items-center justify-center">
                            {detail.order.payment_method === 'card' ? (
                              <CreditCard className="w-4 h-4 text-neutral-600" />
                            ) : (
                              <Banknote className="w-4 h-4 text-neutral-600" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-neutral-700">Method</span>
                        </div>
                        <span className="text-sm font-semibold text-neutral-800 capitalize">
                          {detail.order.payment_method || 'Cash'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Change/Due Amount */}
                  {typeof detail.order.paid_amount === 'number' && detail.order.paid_amount !== undefined && (
                    (() => {
                      const change = (detail.order.paid_amount! - detail.order.total_amount);
                      return (
                        <div className={`p-4 rounded-xl ${
                          change >= 0 
                            ? 'bg-gradient-to-br from-success-50 to-success-100 border border-success-200'
                            : 'bg-gradient-to-br from-danger-50 to-danger-100 border border-danger-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${
                              change >= 0 ? 'text-success-800' : 'text-danger-800'
                            }`}>
                              {change >= 0 ? 'Change Given:' : 'Amount Due:'}
                            </span>
                            <span className={`text-lg font-bold ${
                              change >= 0 ? 'text-success-800' : 'text-danger-800'
                            }`}>
                              {formatCurrency(Math.abs(change))}
                            </span>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Order Items */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-neutral-900 flex items-center">
                      <Package className="w-5 h-5 mr-2" />
                      Order Items
                    </h3>
                    
                    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-neutral-50 to-neutral-100">
                            <tr>
                              <th className="text-left py-4 px-6 font-semibold text-neutral-700">{t('orders.item')}</th>
                              <th className="text-right py-4 px-6 font-semibold text-neutral-700">{t('orders.qty')}</th>
                              <th className="text-right py-4 px-6 font-semibold text-neutral-700">{t('orders.unit')}</th>
                              <th className="text-right py-4 px-6 font-semibold text-neutral-700">{t('orders.total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.items.map((item, index) => (
                              <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-neutral-25'} hover:bg-neutral-50 transition-colors`}>
                                <td className="py-4 px-6">
                                  <div className="font-medium text-neutral-900">{item.product_name}</div>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-medium">
                                    {item.quantity}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-right font-medium text-neutral-900">
                                  {formatCurrency(item.unit_price)}
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-neutral-900">
                                  {formatCurrency(item.total_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Printable Receipt (hidden on screen, visible on print) */}
                  <div id="receipt-print" ref={receiptRef} style={{ display: 'none' }}>
                    <div style={{ width: '80mm', margin: '0 auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                      <div style={{ textAlign: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>{storeName || t('pos.store')}</div>
                        {storeAddress ? <div style={{ whiteSpace: 'pre-wrap' }}>{storeAddress}</div> : null}
                        {storePhone ? <div>Tel: {storePhone}</div> : null}
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <div>{t('pos.order')}: {detail.order.order_number || selectedId}</div>
                        <div>{t('pos.date')}: {new Date(detail.order.created_at).toLocaleString()}</div>
                      </div>
                      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
                      <div style={{ fontSize: 12 }}>
                        {detail.items.map(it => (
                          <div key={it.id} style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ flex: 1, paddingRight: 6 }}>{it.product_name}</span>
                              <span style={{ width: 40, textAlign: 'right' }}>{it.quantity}x</span>
                              <span style={{ width: 60, textAlign: 'right' }}>{formatCurrency(it.unit_price)}</span>
                              <span style={{ width: 70, textAlign: 'right' }}>{formatCurrency(it.total_price)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
                      <div style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t('pos.subtotal')}</span>
                          <span>{formatCurrency(detail.order.subtotal ?? 0)}</span>
                        </div>
                        {(detail.order.discount_amount ?? 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('pos.discount')}</span>
                            <span>-{formatCurrency(detail.order.discount_amount ?? 0)}</span>
                          </div>
                        )}
                        {(detail.order.tax_amount ?? 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('pos.tax')}</span>
                            <span>+{formatCurrency(detail.order.tax_amount ?? 0)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 4 }}>
                          <span>{t('pos.total')}</span>
                          <span>{formatCurrency(detail.order.total_amount ?? 0)}</span>
                        </div>
                        {typeof detail.order.paid_amount === 'number' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Paid</span>
                              <span>{formatCurrency(detail.order.paid_amount ?? 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              {((detail.order.paid_amount ?? 0) - (detail.order.total_amount ?? 0)) >= 0 ? (
                                <>
                                  <span>Change</span>
                                  <span>{formatCurrency(((detail.order.paid_amount ?? 0) - (detail.order.total_amount ?? 0)))}</span>
                                </>
                              ) : (
                                <>
                                  <span>Due</span>
                                  <span>{formatCurrency(Math.abs(((detail.order.paid_amount ?? 0) - (detail.order.total_amount ?? 0))))}</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                        <div style={{ marginTop: 8 }}>Payment: {(detail.order.payment_method || '-').toString()}</div>
                      </div>
                      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
                      <div style={{ textAlign: 'center', fontSize: 12, marginTop: 6 }}>{t('pos.thankYou')}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <h3 className="font-bold text-lg">Process Payment</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="p-2 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={`
                      flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${paymentMethod === 'cash' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-neutral-200 hover:border-primary-200 text-neutral-600'}
                    `}
                  >
                    <Banknote className="w-6 h-6" />
                    <span className="font-medium">Cash</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('card')}
                    className={`
                      flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                      ${paymentMethod === 'card' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-neutral-200 hover:border-primary-200 text-neutral-600'}
                    `}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="font-medium">Card</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-neutral-400">{currency}</span>
                  <input 
                    type="number" 
                    className="w-full pl-8 pr-4 py-3 text-xl font-bold border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-3">
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 text-neutral-600 font-medium hover:bg-neutral-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleProcessPayment}
                disabled={processingPayment || !paymentAmount}
                className="px-6 py-2 bg-success-600 text-white font-bold rounded-xl shadow-lg shadow-success-200 hover:bg-success-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {processingPayment ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}