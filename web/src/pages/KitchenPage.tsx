import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { 
  Clock, 
  ChefHat, 
  CheckCircle, 
  AlertCircle, 
  Utensils,
  X,
  RotateCcw
} from 'lucide-react';

interface Order {
  id: number;
  order_number: string;
  status: string;
  created_at?: string;
  table_name?: string;
}

interface OrderItem {
  id: number;
  order_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  options_json?: any;
  status?: string; // pending | preparing | done
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<number, OrderItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notCompletedOrders = useMemo(() => orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled'), [orders]);

  async function fetchOrdersAndItems() {
    try {
      setLoading(true);
      setError(null);
      // Fetch orders that are relevant to kitchen (open, preparing, or pending)
      const res = await axios.get('/api/orders', { params: { status: 'open,preparing,pending', pageSize: 50 } });
      const data: Order[] = res.data?.data || [];
      setOrders(data);
      // Load items for each order (only once or when list changes)
      const newItemsByOrder: Record<number, OrderItem[]> = {};
      await Promise.all(
        data.map(async (o) => {
          try {
            const r = await axios.get(`/api/orders/${o.id}`);
            const items: OrderItem[] = r.data?.data?.items || [];
            // Normalize options_json if string
            const normalized = items.map(it => {
              let opts = it.options_json;
              if (typeof opts === 'string' && opts.trim() !== '') {
                try { opts = JSON.parse(opts); } catch { /* ignore */ }
              }
              return { ...it, options_json: opts } as OrderItem;
            });
            newItemsByOrder[o.id] = normalized;
          } catch (e) {
            // per-order item fetch failure shouldn't block others
          }
        })
      );
      setItemsByOrder(newItemsByOrder);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrdersAndItems();
    const t = setInterval(fetchOrdersAndItems, 5000);
    return () => clearInterval(t);
  }, []);

  async function setItemStatus(orderId: number, itemId: number, status: 'pending' | 'preparing' | 'done') {
    try {
      await axios.put(`/api/orders/${orderId}/items/${itemId}/status`, { status });
      // Update local state immediately
      setItemsByOrder(prev => {
        const curr = prev[orderId] || [];
        const updated = curr.map(it => it.id === itemId ? { ...it, status } : it);
        return { ...prev, [orderId]: updated };
      });
      // If all items done, consider updating order status to 'completed'
      const items = itemsByOrder[orderId] || [];
      const allDone = items.length > 0 && items.every(it => (it.id === itemId ? status : (it.status || 'pending')) === 'done');
      if (allDone) {
        try { await axios.put(`/api/orders/${orderId}/status`, { status: 'completed' }); } catch {}
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' } : o));
      }
    } catch (e) {
      // no-op; UI will refresh on next poll
    }
  }

  function renderItem(it: OrderItem) {
    const isDone = it.status === 'done';
    const isPrep = it.status === 'preparing';
    
    return (
      <div key={it.id} className={`flex items-start justify-between py-3 border-b border-neutral-100 last:border-0 ${isDone ? 'opacity-50' : ''}`}>
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-neutral-900">{it.quantity}×</span>
            <span className="font-medium text-neutral-800 text-lg">{it.product_name}</span>
          </div>
          {it.options_json?.groups && Array.isArray(it.options_json.groups) && (
            <div className="mt-1 text-sm text-neutral-500 bg-neutral-50 p-2 rounded-lg">
              {it.options_json.groups.map((g: any, i: number) => (
                <div key={i} className="flex gap-1">
                  <span className="font-medium">{g.name}:</span>
                  <span>{g.selected?.map((s:any) => s.name).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {isDone ? (
            <div className="flex items-center gap-1 text-success-600 bg-success-50 px-3 py-1 rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Done
            </div>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setItemStatus(it.order_id, it.id, 'preparing')}
                className={`p-2 rounded-lg transition-colors ${isPrep ? 'bg-warning-100 text-warning-700' : 'bg-neutral-100 text-neutral-400 hover:bg-warning-50 hover:text-warning-600'}`}
                title="Mark as preparing"
              >
                <Utensils className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setItemStatus(it.order_id, it.id, 'done')}
                className="p-2 rounded-lg bg-neutral-100 text-neutral-400 hover:bg-success-50 hover:text-success-600 transition-colors"
                title="Mark as done"
              >
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-warning-500 rounded-2xl flex items-center justify-center shadow-lg shadow-warning-200">
              <ChefHat className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Kitchen Display</h1>
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Clock className="w-4 h-4" />
                {loading ? 'Refreshing...' : lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Connecting...'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-danger-50 text-danger-700 p-4 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {notCompletedOrders.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <ChefHat className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No active orders in the kitchen.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {notCompletedOrders.map(o => {
            const items = itemsByOrder[o.id] || [];
            const activeItems = items.filter(it => it.status !== 'done');
            const orderDate = o.created_at ? new Date(o.created_at) : new Date();
            const elapsed = Math.floor((new Date().getTime() - orderDate.getTime()) / 60000);
            
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
                {/* Order Header */}
                <div className={`p-4 flex items-center justify-between border-b border-neutral-100 ${elapsed > 20 ? 'bg-danger-50' : elapsed > 10 ? 'bg-warning-50' : 'bg-primary-50'}`}>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-neutral-900">#{o.order_number || o.id}</span>
                      {o.table_name && <span className="text-sm font-medium text-neutral-600">Table {o.table_name}</span>}
                    </div>
                    <div className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ({elapsed}m ago)
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    o.status === 'preparing' ? 'bg-warning-100 text-warning-700' : 'bg-primary-100 text-primary-700'
                  }`}>
                    {o.status}
                  </span>
                </div>
                
                {/* Items */}
                <div className="p-4 flex-1">
                  {activeItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                      <CheckCircle className="w-12 h-12 mb-2 text-success-200" />
                      <p>All items done</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {activeItems.map(renderItem)}
                    </div>
                  )}
                </div>
                
                {/* Footer Actions */}
                {activeItems.length > 0 && (
                  <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                    <button 
                      onClick={() => {
                        // Mark all as done
                        activeItems.forEach(it => setItemStatus(o.id, it.id, 'done'));
                      }}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 px-4 py-2 hover:bg-white rounded-lg transition-colors"
                    >
                      Mark All Done
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}