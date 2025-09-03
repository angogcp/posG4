import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface Order {
  id: number;
  order_number: string;
  status: string;
  created_at?: string;
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
      // Fetch orders that are relevant to kitchen (open or preparing)
      const res = await axios.get('/api/orders', { params: { status: 'open,preparing', pageSize: 50 } });
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
    return (
      <div key={it.id} className="flex items-center justify-between py-1 border-b border-gray-200">
        <div className="mr-3">
          <div className="font-medium">{it.quantity} × {it.product_name}</div>
          {it.options_json && Array.isArray(it.options_json) && it.options_json.length > 0 && (
            <div className="text-xs text-gray-600">Options: {it.options_json.map((o: any) => o?.name || o).join(', ')}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-gray-100">{it.status || 'pending'}</span>
          <button onClick={() => setItemStatus(it.order_id, it.id, 'preparing')} className="text-xs px-2 py-1 rounded bg-yellow-200 hover:bg-yellow-300">Prep</button>
          <button onClick={() => setItemStatus(it.order_id, it.id, 'done')} className="text-xs px-2 py-1 rounded bg-green-200 hover:bg-green-300">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Kitchen Display</h1>
        <div className="text-sm text-gray-500">
          {loading ? 'Refreshing…' : lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : ''}
        </div>
      </div>
      {error && <div className="mb-3 text-red-600">{error}</div>}

      {notCompletedOrders.length === 0 && (
        <div className="text-gray-500">No active orders.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notCompletedOrders.map(o => {
          const items = itemsByOrder[o.id] || [];
          const activeItems = items.filter(it => it.status !== 'done');
          return (
            <div key={o.id} className="border rounded shadow-sm p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{o.order_number || `Order #${o.id}`}</div>
                <span className="text-xs px-2 py-1 rounded bg-blue-100">{o.status}</span>
              </div>
              {activeItems.length === 0 ? (
                <div className="text-sm text-gray-500">All items completed.</div>
              ) : (
                <div>{activeItems.map(renderItem)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}