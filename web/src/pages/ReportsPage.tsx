import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

interface Totals { orders_count: number; subtotal: number; discount_amount: number; tax_amount: number; total_amount: number; paid_amount: number }
interface DayPoint { day: string; total: number; orders: number }
interface PaymentBreakdown { method: string; total: number; orders: number }
interface TopProduct { product_id: number; product_code: string; product_name: string; quantity: number; amount: number }

export default function ReportsPage() {
  const { t } = useTranslation();
  const { formatCurrency } = useSettings();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byDay, setByDay] = useState<DayPoint[]>([]);
  const [byPayment, setByPayment] = useState<PaymentBreakdown[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  // initialize last 7 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setStartDate(fmt(start));
    setEndDate(fmt(end));
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await axios.get('/api/reports/sales', { params: { start_date: startDate, end_date: endDate } });
      const data = r.data?.data ?? r.data;
      setTotals(data.totals || null);
      setByDay(Array.isArray(data.byDay) ? data.byDay : []);
      setByPayment(Array.isArray(data.byPayment) ? data.byPayment : []);
      setTopProducts(Array.isArray(data.topProducts) ? data.topProducts : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (startDate && endDate) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const maxDay = useMemo(() => Math.max(1, ...byDay.map(p => p.total || 0)), [byDay]);
  const avgOrder = useMemo(() => {
    if (!totals) return 0;
    const orders = Number(totals.orders_count || 0);
    return orders > 0 ? (Number(totals.total_amount || 0) / orders) : 0;
  }, [totals]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-3">{t('reports.title')}</h1>

      <div className="mb-3 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('reports.from')}</label>
          <input type="date" className="border rounded-lg px-3 py-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">{t('reports.to')}</label>
          <input type="date" className="border rounded-lg px-3 py-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60">{loading ? t('common.loading') : t('common.refresh')}</button>
        {error && <div className="text-red-600 ml-3 text-sm">{error}</div>}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi title={t('reports.grossSales')} value={formatCurrency(totals?.total_amount ?? 0)} />
        <Kpi title={t('reports.orders')} value={`${totals?.orders_count ?? 0}`} />
        <Kpi title={t('reports.avgOrder')} value={formatCurrency(avgOrder)} />
        <Kpi title={t('reports.taxCollected')} value={formatCurrency(totals?.tax_amount ?? 0)} />
        <Kpi title={t('reports.discounts')} value={formatCurrency(totals?.discount_amount ?? 0)} />
        <Kpi title={t('reports.subtotal')} value={formatCurrency(totals?.subtotal ?? 0)} />
      </div>

      {/* Daily sales simple bar chart */}
      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">{t('reports.dailySales')}</h2>
        {byDay.length === 0 ? (
          <div className="text-sm text-gray-500">{t('reports.noData')}</div>
        ) : (
          <div className="bg-white border rounded-xl p-3">
            <div className="grid grid-cols-7 gap-2">
              {byDay.map(dp => (
                <div key={dp.day} className="flex flex-col items-center">
                  <div className="h-32 w-6 bg-gray-100 flex items-end rounded">
                    <div className="w-full bg-green-500 rounded-b" style={{ height: `${Math.max(2, (dp.total / maxDay) * 100)}%` }} title={`${formatCurrency(dp.total)} • ${dp.orders} orders`} />
                  </div>
                  <div className="text-[10px] mt-1 text-gray-600">{dp.day.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Payments breakdown */}
      <section className="mb-6">
        <h2 className="text-lg font-medium mb-2">{t('reports.payments')}</h2>
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">{t('reports.method')}</th>
                <th className="p-2 text-right">{t('reports.orders')}</th>
                <th className="p-2 text-right">{t('reports.total')}</th>
              </tr>
            </thead>
            <tbody>
              {byPayment.length === 0 ? (
                <tr><td className="p-3 text-center text-gray-500" colSpan={3}>{t('reports.noData')}</td></tr>
              ) : (
                byPayment.map(p => (
                  <tr key={p.method} className="border-t">
                    <td className="p-2 capitalize">{p.method || 'unknown'}</td>
                    <td className="p-2 text-right">{p.orders}</td>
                    <td className="p-2 text-right">{formatCurrency(p.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top products */}
      <section className="mb-10">
        <h2 className="text-lg font-medium mb-2">{t('reports.topProducts')}</h2>
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">{t('reports.product')}</th>
                <th className="p-2 text-right">{t('reports.qty')}</th>
                <th className="p-2 text-right">{t('reports.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr><td className="p-3 text-center text-gray-500" colSpan={3}>{t('reports.noData')}</td></tr>
              ) : (
                topProducts.map(tp => (
                  <tr key={tp.product_id} className="border-t">
                    <td className="p-2">{tp.product_name}</td>
                    <td className="p-2 text-right">{tp.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(tp.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border rounded-xl p-3">
      <div className="text-xs text-gray-600">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}