import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  DollarSign,
  Image,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Printer,
  Code,
  MoreHorizontal,
  RotateCcw,
  List
} from 'lucide-react';
import ModifierAssignment from '../components/ModifierAssignment';

interface Category { id: number; name: string }
interface Product {
  id: number;
  code: string;
  name: string;
  category_id: number | null;
  price: number;
  image_url?: string | null;
  is_active: number;
  options_json?: any;
}

interface Printer {
  id: number;
  name: string;
  type: string;
  location: string;
  connection_type: string;
  ip_address?: string;
  port?: number;
  is_active: number;
}

interface PageMeta { total: number; page: number; pageSize: number; pages: number }

export default function ProductsPage() {
  const { t } = useTranslation();
  const { formatCurrency } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, pageSize: 20, pages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ code: '', name: '', category_id: '', price: '', image_url: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'modifiers'>('basic');

  useEffect(() => {
    axios.get('/api/categories').then(r => setCategories(r.data.data || r.data));
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useMemo(() => {
    return async () => {
      setLoading(true);
      try {
        // Prefer server-side search when any of q/category/includeInactive is used, or always to keep pagination consistent
        const params: any = {
          q: debouncedQ || undefined,
          category_id: categoryFilter || undefined,
          include_inactive: includeInactive ? '1' : undefined,
          page,
          pageSize,
        };

        const r = await axios.get('/api/products/search', { params });
        const rows: Product[] = r.data.data || r.data;
        const pagination: PageMeta | undefined = r.data.pagination;
        setProducts(rows);
        if (pagination) {
          setMeta(pagination);
        } else {
          // Fallback when backend returns array only
          setMeta({ total: rows.length, page, pageSize, pages: 1 });
        }
      } finally {
        setLoading(false);
      }
    };
  }, [debouncedQ, categoryFilter, includeInactive, page, pageSize]);

  useEffect(() => { setPage(1); }, [debouncedQ, categoryFilter, includeInactive]);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', category_id: '', price: '', image_url: '', is_active: true });
    setActiveTab('basic');
    setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    const formData = { 
      code: p.code, 
      name: p.name, 
      category_id: p.category_id ? String(p.category_id) : '', 
      price: String(p.price), 
      image_url: p.image_url || '', 
      is_active: !!p.is_active 
    };
    setForm(formData);
    setActiveTab('basic');
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
  }
  function onChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: any = {
        code: form.code.trim(),
        name: form.name.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        price: Number(form.price),
        image_url: form.image_url.trim() || null,
        is_active: form.is_active ? 1 : 0,
      };
      
      if (!editing) {
        await axios.post('/api/products', payload);
      } else {
        await axios.put(`/api/products/${editing.id}`, payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function disable(p: Product) {
    if (!confirm(`Disable product ${p.name}?`)) return;
    await axios.delete(`/api/products/${p.id}`);
    await load();
  }
  async function toggleActive(p: Product) {
    await axios.put(`/api/products/${p.id}`, { is_active: p.is_active ? 0 : 1 });
    await load();
  }

  // Form validation
  const isValid = useMemo(() => {
    const codeOk = form.code.trim().length > 0;
    const nameOk = form.name.trim().length > 0;
    const priceNum = Number(form.price);
    const priceOk = !Number.isNaN(priceNum) && priceNum >= 0;
    return codeOk && nameOk && priceOk;
  }, [form.code, form.name, form.price]);

  // Pagination helpers
  const canPrev = page > 1;
  const canNext = page < meta.pages;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{t('products.title')}</h1>
              <p className="text-sm text-neutral-500">
                {loading ? t('common.loading') : `${meta.total} ${t('common.items', { count: meta.total })}`}
              </p>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            {t('products.newProduct')}
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
                  value={q} 
                  onChange={e => setQ(e.target.value)} 
                  className="input pl-10" 
                  placeholder={t('products.searchPlaceholder')}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="lg:w-48">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Tag className="w-4 h-4 inline mr-2" />
                {t('products.category')}
              </label>
              <select 
                value={categoryFilter} 
                onChange={e => setCategoryFilter(e.target.value)} 
                className="input"
              >
                <option value="">{t('common.all')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Filter Options */}
            <div className="lg:w-auto">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Options
              </label>
              <div className="flex flex-col space-y-2">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={includeInactive} 
                    onChange={e => setIncludeInactive(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-neutral-700">{t('products.includeInactive')}</span>
                </label>
                <button 
                  className="btn btn-ghost btn-sm self-start" 
                  onClick={() => { setQ(''); setCategoryFilter(''); setIncludeInactive(false); }}
                >
                  <RotateCcw className="w-3 h-3" />
                  {t('common.clear')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="card overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Products List</h3>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-neutral-600">
                  <span>{t('common.rowsPerPage')}</span>
                  <select 
                    className="input py-1 px-2 text-sm" 
                    value={pageSize} 
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  >
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    <Code className="w-4 h-4 inline mr-2" />
                    <span className="hidden sm:inline">{t('products.code')}</span>
                    <span className="sm:hidden">Code</span>
                  </th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    <Package className="w-4 h-4 inline mr-2" />
                    <span className="hidden sm:inline">{t('products.name')}</span>
                    <span className="sm:hidden">Name</span>
                  </th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell">
                    <Tag className="w-4 h-4 inline mr-2" />
                    <span className="hidden lg:inline">{t('products.category')}</span>
                    <span className="lg:hidden">Cat</span>
                  </th>
                  <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    <span className="hidden sm:inline">{t('products.price')}</span>
                    <span className="sm:hidden">Price</span>
                  </th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    <span className="hidden sm:inline">Status</span>
                    <span className="sm:hidden">Stat</span>
                  </th>
                  <th className="text-center px-4 sm:px-6 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                    <span className="hidden sm:inline">{t('common.actions')}</span>
                    <span className="sm:hidden">Act</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {loading && (
                  <tr>
                    <td className="px-4 sm:px-6 py-12 text-center text-neutral-500" colSpan={6}>
                      <div className="flex flex-col items-center space-y-3">
                        <div className="spinner w-8 h-8" />
                        <span>{t('common.loading')}</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && products.map(p => (
                  <tr key={p.id} className={`hover:bg-neutral-50 transition-colors duration-200 ${
                    p.is_active ? '' : 'opacity-60'
                  }`}>
                    <td className="px-4 sm:px-6 py-4">
                      <span className="font-mono text-xs sm:text-sm bg-neutral-100 px-2 py-1 rounded">{p.code}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-lg flex items-center justify-center">
                          {p.image_url ? (
                            <Image className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-500" />
                          ) : (
                            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 text-sm sm:text-base">{p.name}</div>
                          {p.options_json && (
                            <div className="text-xs text-neutral-500 flex items-center mt-1">
                              <Settings className="w-3 h-3 mr-1" />
                              <span className="hidden sm:inline">Has modifiers</span>
                              <span className="sm:hidden">Mods</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                      {p.category_id ? (
                        <span className="badge badge-primary text-xs">
                          {categories.find(c => c.id === p.category_id)?.name || '-'}
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <span className="text-base sm:text-lg font-bold text-neutral-900">{formatCurrency(p.price)}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      {p.is_active ? (
                        <span className="badge badge-success text-xs">
                          <Eye className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">{t('common.active')}</span>
                          <span className="sm:hidden">Active</span>
                        </span>
                      ) : (
                        <span className="badge badge-neutral text-xs">
                          <EyeOff className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">{t('common.inactive')}</span>
                          <span className="sm:hidden">Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                        <button 
                          className="btn btn-ghost btn-sm p-1 sm:p-2" 
                          onClick={() => openEdit(p)}
                          title={t('common.edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {p.is_active ? (
                          <button 
                            className="btn btn-ghost btn-sm p-1 sm:p-2 text-warning-600 hover:text-warning-700 hover:bg-warning-50" 
                            onClick={() => disable(p)}
                            title={t('common.disable')}
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            className="btn btn-ghost btn-sm p-1 sm:p-2 text-success-600 hover:text-success-700 hover:bg-success-50" 
                            onClick={() => toggleActive(p)}
                            title={t('common.enable')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && products.length === 0 && (
                  <tr>
                    <td className="px-6 py-12 text-center text-neutral-500" colSpan={6}>
                      <div className="flex flex-col items-center space-y-3">
                        <Package className="w-16 h-16 text-neutral-300" />
                        <div>
                          <h3 className="text-lg font-semibold text-neutral-600 mb-1">{t('products.noProducts')}</h3>
                          <p className="text-neutral-500">Create your first product to get started</p>
                        </div>
                        <button className="btn btn-primary" onClick={openCreate}>
                          <Plus className="w-4 h-4" />
                          {t('products.newProduct')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && products.length > 0 && (
            <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-600">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, meta.total)} of {meta.total} products
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    disabled={!canPrev} 
                    className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={() => canPrev && setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('common.prev')}
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-neutral-600">
                    {meta.page} / {meta.pages}
                  </span>
                  <button 
                    disabled={!canNext} 
                    className="btn btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={() => canNext && setPage(p => p + 1)}
                  >
                    {t('common.next')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Product Modal */}
        {modalOpen && (
          <div className="modal-backdrop flex items-center justify-center p-4" onClick={closeModal}>
            <div 
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in" 
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 px-6 py-4 border-b border-neutral-200 bg-white rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900">
                        {editing ? t('products.editProduct') : t('products.newProduct')}
                      </h2>
                      <p className="text-sm text-neutral-500">
                        {editing ? `Product ID: ${editing.id}` : 'Create a new product'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={closeModal}
                    className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex flex-col h-[calc(90vh-140px)]">
                {/* Tabs */}
                <div className="flex items-center px-6 border-b border-neutral-200 bg-neutral-50/50">
                  <button
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'basic'
                        ? 'border-primary-600 text-primary-700'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                    }`}
                    onClick={() => setActiveTab('basic')}
                  >
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4" />
                      <span>Basic Information</span>
                    </div>
                  </button>
                  <button
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'modifiers'
                        ? 'border-primary-600 text-primary-700'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                    }`}
                    onClick={() => setActiveTab('modifiers')}
                  >
                    <div className="flex items-center space-x-2">
                      <List className="w-4 h-4" />
                      <span>{t('products.modifiers')}</span>
                    </div>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === 'basic' ? (
                    <div className="space-y-6">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-neutral-900 flex items-center">
                          <Package className="w-5 h-5 mr-2 text-primary-600" />
                          Basic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-2">
                              <Code className="w-4 h-4 inline mr-2" />
                              {t('products.code')}
                            </label>
                            <input 
                              value={form.code} 
                              onChange={e => onChange('code', e.target.value)} 
                              className="input" 
                              placeholder="Enter product code"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-2">
                              <Package className="w-4 h-4 inline mr-2" />
                              {t('products.name')}
                            </label>
                            <input 
                              value={form.name} 
                              onChange={e => onChange('name', e.target.value)} 
                              className="input" 
                              placeholder="Enter product name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-2">
                              <Tag className="w-4 h-4 inline mr-2" />
                              {t('products.category')}
                            </label>
                            <select 
                              value={form.category_id} 
                              onChange={e => onChange('category_id', e.target.value)} 
                              className="input"
                            >
                              <option value="">Select category</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-2">
                              <DollarSign className="w-4 h-4 inline mr-2" />
                              {t('products.price')}
                            </label>
                            <input 
                              value={form.price} 
                              onChange={e => onChange('price', e.target.value)} 
                              className="input" 
                              type="number" 
                              step="0.01" 
                              min="0"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-neutral-700 mb-2">
                              <Image className="w-4 h-4 inline mr-2" />
                              Image URL (optional)
                            </label>
                            <input 
                              value={form.image_url} 
                              onChange={e => onChange('image_url', e.target.value)} 
                              className="input" 
                              placeholder="https://example.com/image.jpg"
                            />
                          </div>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center space-x-3 p-4 bg-neutral-50 rounded-2xl">
                          <label className="inline-flex items-center space-x-3 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={form.is_active} 
                              onChange={e => onChange('is_active', e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <div className="flex items-center space-x-2">
                              {form.is_active ? (
                                <Eye className="w-4 h-4 text-success-600" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-neutral-500" />
                              )}
                              <span className="font-medium text-neutral-700">{t('common.active')}</span>
                            </div>
                          </label>
                          <span className="text-sm text-neutral-500">
                            {form.is_active ? 'Product will be visible in POS' : 'Product will be hidden from POS'}
                          </span>
                        </div>
                      </div>

                      {/* Validation Message */}
                      {!isValid && (
                        <div className="flex items-center space-x-2 p-4 bg-danger-50 border border-danger-200 rounded-xl">
                          <X className="w-5 h-5 text-danger-600" />
                          <span className="text-sm text-danger-800 font-medium">{t('products.validationMessage')}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {editing && editing.id ? (
                        <ModifierAssignment entityType="product" entityId={editing.id} />
                      ) : (
                        <div className="text-center py-12 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
                          <Save className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                          <h3 className="text-lg font-medium text-neutral-900">Save Product First</h3>
                          <p className="text-neutral-500 max-w-xs mx-auto mt-1">
                            Please save the basic information before assigning modifiers to this product.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 px-6 py-4 border-t border-neutral-200 bg-white rounded-b-3xl">
                <div className="flex justify-end space-x-3">
                  <button 
                    className="btn btn-secondary px-6" 
                    onClick={closeModal}
                  >
                    <X className="w-4 h-4" />
                    {t('common.cancel')}
                  </button>
                  <button 
                    className={`btn btn-lg px-8 ${
                      saving || !isValid 
                        ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed' 
                        : 'btn-primary'
                    }`}
                    disabled={saving || !isValid} 
                    onClick={save}
                  >
                    {saving ? (
                      <>
                        <div className="spinner w-5 h-5" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>{t('common.save')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}