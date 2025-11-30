import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, List, Save } from 'lucide-react';
import ModifierAssignment from '../components/ModifierAssignment';

interface Category { id: number; name: string; sort_order: number; is_active: number; options_json?: any }

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', sort_order: '0', is_active: true });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'modifiers'>('basic');

  const load = useMemo(() => {
    return async () => {
      setLoading(true);
      try {
        const r = await axios.get('/api/categories', { params: { include_inactive: includeInactive ? '1' : undefined } });
        setCategories(r.data.data || r.data);
      } finally {
        setLoading(false);
      }
    };
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);
  
  function openCreate() {
    setEditing(null);
    setForm({ name: '', sort_order: '0', is_active: true });
    setActiveTab('basic');
    setModalOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, sort_order: String(c.sort_order ?? 0), is_active: !!c.is_active });
    setActiveTab('basic');
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }
  function onChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm(prev => ({ ...prev, [key]: value })); }

  const isValid = useMemo(() => {
    const nameOk = form.name.trim().length > 0;
    const sortNum = Number(form.sort_order);
    const sortOk = Number.isFinite(sortNum);
    return nameOk && sortOk;
  }, [form.name, form.sort_order]);

  async function save() {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        sort_order: Number(form.sort_order),
        is_active: form.is_active ? 1 : 0,
      };

      if (!editing) {
        await axios.post('/api/categories', payload);
      } else {
        await axios.put(`/api/categories/${editing.id}`, payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || t('common.failedToSave'));
    } finally {
      setSaving(false);
    }
  }

  async function disable(c: Category) {
    if (!confirm(t('categories.confirmDisable', { name: c.name }))) return;
    await axios.delete(`/api/categories/${c.id}`);
    await load();
  }
  async function toggleActive(c: Category) {
    await axios.put(`/api/categories/${c.id}`, { is_active: c.is_active ? 0 : 1 });
    await load();
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{t('categories.title')}</h1>
        <button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded" onClick={openCreate}>{t('categories.newCategory')}</button>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          <span>{t('common.includeInactive')}</span>
        </label>
        <button className="text-sm text-gray-600 underline" onClick={() => setIncludeInactive(true)}>{t('common.showAll')}</button>
        <div className="text-sm text-gray-600">{loading ? t('common.loading') : t('common.items', { count: categories.length })}</div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">{t('categories.name')}</th>
              <th className="text-right px-3 py-2">{t('categories.sort')}</th>
              <th className="text-left px-3 py-2">{t('common.status')}</th>
              <th className="px-3 py-2">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>{t('common.loading')}</td></tr>}
            {!loading && categories.map(c => (
              <tr key={c.id} className={c.is_active ? '' : 'opacity-60'}>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-right">{(c.sort_order ?? 0)}</td>
                <td className="px-3 py-2">{c.is_active ? t('common.active') : t('common.inactive')}</td>
                <td className="px-3 py-2 text-center space-x-2">
                  <button className="text-primary-700" onClick={() => openEdit(c)}>{t('common.edit')}</button>
                  {c.is_active ? (
                    <button className="text-amber-700" onClick={() => disable(c)}>{t('common.disable')}</button>
                  ) : (
                    <button className="text-green-700" onClick={() => toggleActive(c)}>{t('common.enable')}</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && categories.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>{t('categories.noCategories')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-white">
              <h2 className="text-xl font-semibold text-neutral-900">
                {editing ? t('categories.editCategory') : t('categories.createCategory')}
              </h2>
              <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            
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
                <div className="space-y-6 max-w-lg mx-auto">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">{t('categories.name')}</label>
                        <input value={form.name} onChange={e => onChange('name', e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">{t('categories.sortOrder')}</label>
                        <input value={form.sort_order} onChange={e => onChange('sort_order', e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" type="number" />
                      </div>
                      <label className="col-span-2 inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.is_active} onChange={e => onChange('is_active', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                        <span className="text-sm text-neutral-700">{t('common.active')}</span>
                      </label>
                   </div>
                   
                   <div className="pt-6 border-t border-neutral-200 flex justify-end gap-3">
                      <button 
                        className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 font-medium transition-colors" 
                        onClick={closeModal}
                      >
                        {t('common.cancel')}
                      </button>
                      <button 
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm" 
                        disabled={!isValid || saving} 
                        onClick={save}
                      >
                        {saving ? t('common.saving') : t('common.save')}
                      </button>
                   </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {editing && editing.id ? (
                    <ModifierAssignment entityType="category" entityId={editing.id} />
                  ) : (
                    <div className="text-center py-12 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
                      <Save className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-neutral-900">Save Category First</h3>
                      <p className="text-neutral-500 max-w-xs mx-auto mt-1">
                        Please save the basic information before assigning modifiers to this category.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}