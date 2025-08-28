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
  Tag
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Order { id: number; order_no?: string; order_number?: string; total_amount: number; created_at: string; subtotal?: number; discount_amount?: number; tax_amount?: number; paid_amount?: number; payment_method?: string }
interface OrderItem { id: number; product_name: string; quantity: number; unit_price: number; total_price: number }

export default function OrdersPage() {
  const { t } = useTranslation();
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
  const [thermalPrintEnabled, setThermalPrintEnabled] = useState(() => {
    return localStorage.getItem('thermalPrintEnabled') === 'true';
  });
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function fetchOrders(opts?: { page?: number; pageSize?: number }) {
    const nextPage = opts?.page ?? page;
    const nextPageSize = opts?.pageSize ?? pageSize;
    setLoadingList(true);
    try {
      const params: any = { page: nextPage, pageSize: nextPageSize };
      if (query.trim()) params.q = query.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
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
      return matchesQuery && after && before;
    });
  }, [orders, query, startDate, endDate]);

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
          <div className="flex flex-col lg:flex-row gap-4">
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
                  className="input pl-10"
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
                className="input"
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
                className="input"
              />
            </div>

            {/* Clear Button */}
            <div className="lg:w-auto">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Options
              </label>
              <button
                onClick={() => { 
                  setQuery(''); 
                  setStartDate(''); 
                  setEndDate(''); 
                  setPage(1); 
                  setPageSize(20); 
                  setTotal(0); 
                  fetchOrders({ page: 1, pageSize: 20 }); 
                }}
                className="btn btn-ghost"
              >
                <RotateCcw className="w-4 h-4" />
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
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredOrders.map(order => {
                const orderDate = new Date(order.created_at);
                const paymentIcon = order.payment_method === 'card' ? CreditCard : Banknote;
                const PaymentIcon = paymentIcon;
                
                return (
                  <div 
                    key={order.id} 
                    onClick={() => openDetail(order.id)}
                    className="group relative bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-lg hover:border-primary-200 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-primary-600" />
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
                      <Eye className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors" />
                    </div>

                    {/* Order Details */}
                    <div className="space-y-2">
                      {/* Total Amount */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600 flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          <span className="hidden xs:inline">Total</span>
                        </span>
                        <span className="text-base font-bold text-neutral-900">
                          ${order.total_amount.toFixed(2)}
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
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-6">
              <div className="flex items-center justify-between">
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

                <div className="flex items-center gap-3">
                  {/* Printer Controls */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl">
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={thermalPrintEnabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setThermalPrintEnabled(enabled);
                          localStorage.setItem('thermalPrintEnabled', enabled.toString());
                          if (enabled) {
                            checkPrinterStatus();
                          }
                        }}
                        className="rounded"
                      />
                      <Printer className="w-4 h-4" />
                      Thermal
                    </label>
                    {thermalPrintEnabled && (
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          printerStatus === 'connected' ? 'bg-success-500' :
                          printerStatus === 'checking' ? 'bg-warning-500' : 'bg-danger-500'
                        }`}></div>
                        <button
                          onClick={checkPrinterStatus}
                          disabled={printerStatus === 'checking'}
                          className="p-1 hover:bg-neutral-200 rounded transition-colors"
                          title="Check printer status"
                        >
                          <RefreshCw className={`w-3 h-3 ${printerStatus === 'checking' ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handlePrint}
                    className="btn btn-primary"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                  
                  <button 
                    onClick={closeDetail}
                    className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
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
                          ${(detail.order.subtotal ?? 0).toFixed(2)}
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
                            -${(detail.order.discount_amount ?? 0).toFixed(2)}
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
                            +${(detail.order.tax_amount ?? 0).toFixed(2)}
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
                          ${detail.order.total_amount.toFixed(2)}
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
                          ${(detail.order.paid_amount ?? 0).toFixed(2)}
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
                              ${Math.abs(change).toFixed(2)}
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
                                  ${item.unit_price.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-neutral-900">
                                  ${item.total_price.toFixed(2)}
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
                              <span style={{ width: 60, textAlign: 'right' }}>${it.unit_price.toFixed(2)}</span>
                              <span style={{ width: 70, textAlign: 'right' }}>${it.total_price.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
                      <div style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t('pos.subtotal')}</span>
                          <span>${(detail.order.subtotal ?? 0).toFixed(2)}</span>
                        </div>
                        {(detail.order.discount_amount ?? 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('pos.discount')}</span>
                            <span>-${(detail.order.discount_amount ?? 0).toFixed(2)}</span>
                          </div>
                        )}
                        {(detail.order.tax_amount ?? 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('pos.tax')}</span>
                            <span>+${(detail.order.tax_amount ?? 0).toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 4 }}>
                          <span>{t('pos.total')}</span>
                          <span>${(detail.order.total_amount ?? 0).toFixed(2)}</span>
                        </div>
                        {typeof detail.order.paid_amount === 'number' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Paid</span>
                              <span>${(detail.order.paid_amount ?? 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              {((detail.order.paid_amount ?? 0) - (detail.order.total_amount ?? 0)) >= 0 ? (
                                <>
                                  <span>Change</span>
                                  <span>${(((detail.order.paid_amount ?? 0) - (detail.order.total_amount ?? 0))).toFixed(2)}</span>
                                </>
                              ) : (
                                <>
                                  <span>Due</span>
                                  <span>${(Math.abs(((detail.order.paid_amount ?? 0) - (detail.order.total_amount ?? 0)))).toFixed(2)}</span>
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
      </div>
    </div>
  );
}