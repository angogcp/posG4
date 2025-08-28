import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Category { id: number; name: string; sort_order: number; is_active: number; options_json?: any }

interface Printer {
  id: number;
  name: string;
  type: string;
  location: string;
  connection_type: string;
  is_active: boolean;
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Printer management state
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printerSettings, setPrinterSettings] = useState<{
    enabled: boolean;
    printer_ids: number[];
  }>({ enabled: false, printer_ids: [] });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', sort_order: '0', is_active: true });
  const [saving, setSaving] = useState(false);

  // Modifiers builder state: GUI vs Advanced JSON
  const [advancedJson, setAdvancedJson] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  type OptItem = { name: string; price_delta?: number };
  type OptGroup = { name: string; required?: boolean; max_select?: number; options: OptItem[] };
  const [optGroups, setOptGroups] = useState<OptGroup[]>([]);

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
  
  // Load printers on component mount
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const response = await axios.get('/api/printers');
        const allPrinters = response.data.data || response.data || [];
        const activePrinters = Array.isArray(allPrinters) ? allPrinters.filter((p: Printer) => p.is_active) : [];
        setPrinters(activePrinters);
      } catch (error) {
        console.error('Failed to load printers:', error);
      }
    };
    loadPrinters();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', sort_order: '0', is_active: true });
    setAdvancedJson(false);
    setOptionsText('');
    setOptGroups([]);
    setPrinterSettings({ enabled: false, printer_ids: [] });
    setModalOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, sort_order: String(c.sort_order ?? 0), is_active: !!c.is_active });
    try { setOptionsText(c.options_json ? JSON.stringify(c.options_json, null, 2) : ''); } catch { setOptionsText(''); }
    try {
      const arr = Array.isArray((c as any).options_json) ? (c as any).options_json : [];
      const normalized: OptGroup[] = (arr || []).map((g: any) => ({
        name: String(g?.name || ''),
        required: !!g?.required,
        max_select: Number.isFinite(Number(g?.max_select)) ? Number(g.max_select) : 1,
        options: Array.isArray(g?.options) ? g.options.map((o: any) => ({ name: String(o?.name || ''), price_delta: Number(o?.price_delta || 0) })) : [],
      }));
      setOptGroups(normalized);
    } catch { setOptGroups([]); }
    
    // Load printer settings from options_json
    try {
      const optionsJson = c.options_json;
      if (optionsJson && typeof optionsJson === 'object' && optionsJson.printer_settings) {
        const printerSettings = optionsJson.printer_settings;
        setPrinterSettings({
          enabled: !!printerSettings.enabled,
          printer_ids: Array.isArray(printerSettings.printer_ids) ? printerSettings.printer_ids : []
        });
      } else {
        setPrinterSettings({ enabled: false, printer_ids: [] });
      }
    } catch {
      setPrinterSettings({ enabled: false, printer_ids: [] });
    }
    
    setAdvancedJson(false);
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }
  function onChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm(prev => ({ ...prev, [key]: value })); }

  const isValid = useMemo(() => {
    const nameOk = form.name.trim().length > 0;
    const sortNum = Number(form.sort_order);
    const sortOk = Number.isFinite(sortNum);
    if (advancedJson) {
      if (optionsText.trim()) {
        try { JSON.parse(optionsText); } catch { return false; }
      }
    }
    return nameOk && sortOk;
  }, [form.name, form.sort_order, advancedJson, optionsText]);

  async function save() {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        sort_order: Number(form.sort_order),
        is_active: form.is_active ? 1 : 0,
      };
      if (advancedJson) {
        const text = optionsText.trim();
        if (text) {
          try { payload.options_json = JSON.parse(text); }
          catch { alert('Options JSON 无效，请检查格式'); return; }
        }
      } else {
        const normalized: OptGroup[] = optGroups
          .map(g => ({
            name: String(g.name || '').trim(),
            required: !!g.required,
            max_select: Number.isFinite(Number(g.max_select)) && Number(g.max_select) > 0 ? Number(g.max_select) : 1,
            options: Array.isArray(g.options) ? g.options.map(o => ({ name: String(o.name || '').trim(), price_delta: Number(o.price_delta || 0) })) : [],
          }))
          .filter(g => g.name && g.options && g.options.filter(o => o.name).length > 0)
          .map(g => ({ ...g, options: g.options.filter(o => o.name) }));
        if (normalized.length > 0) {
          payload.options_json = normalized;
        }
      }
      
      // Save printer settings
      if (printerSettings.enabled && printerSettings.printer_ids.length > 0) {
        if (Array.isArray(payload.options_json)) {
          // Convert array to object to include printer_settings
          payload.options_json = {
            modifiers: payload.options_json,
            printer_settings: {
              enabled: printerSettings.enabled,
              printer_ids: printerSettings.printer_ids
            }
          };
        } else if (payload.options_json && typeof payload.options_json === 'object') {
          // Add printer_settings to existing object
          payload.options_json.printer_settings = {
            enabled: printerSettings.enabled,
            printer_ids: printerSettings.printer_ids
          };
        } else {
          // Create new object with printer_settings
          payload.options_json = {
            printer_settings: {
              enabled: printerSettings.enabled,
              printer_ids: printerSettings.printer_ids
            }
          };
        }
      }

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
          <div className="bg-white rounded shadow max-w-md w-full p-4">
            <h2 className="text-lg font-semibold mb-3">{editing ? t('categories.editCategory') : t('categories.createCategory')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm text-gray-600">{t('categories.name')}</label>
                <input value={form.name} onChange={e => onChange('name', e.target.value)} className="border px-2 py-1 rounded w-full" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-600">{t('categories.sortOrder')}</label>
                <input value={form.sort_order} onChange={e => onChange('sort_order', e.target.value)} className="border px-2 py-1 rounded w-full" type="number" />
              </div>
              <label className="col-span-2 inline-flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={e => onChange('is_active', e.target.checked)} />
                <span>{t('common.active')}</span>
              </label>

              {/* Modifiers builder */}
              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-600">{t('categories.modifiersForCategory')}</label>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={advancedJson} onChange={e => setAdvancedJson(e.target.checked)} />
                      <span>{t('products.advancedJson')}</span>
                    </label>
                    {advancedJson && (
                      <button className="underline" onClick={()=>setOptionsText(`[
  {
    "name": "Size",
    "required": true,
    "max_select": 1,
    "options": [
      { "name": "Small",  "price_delta": 0 },
      { "name": "Medium", "price_delta": 0.5 },
      { "name": "Large",  "price_delta": 1 }
    ]
  },
  {
    "name": "Add-ons",
    "required": false,
    "max_select": 3,
    "options": [
      { "name": "Cheese", "price_delta": 0.5 },
      { "name": "Bacon",  "price_delta": 1 }
    ]
  }
]`)}>{t('products.insertExample')}</button>
                    )}
                    {editing && editing.id && (
                      <Link className="underline" to={`/modifiers?assignType=category&assignId=${editing.id}`}>{t('categories.manageModifiers')}</Link>
                    )}
                  </div>
                </div>
                {!advancedJson && (
                  <div className="mt-2 space-y-3">
                    {optGroups.length === 0 && (
                      <div className="text-xs text-gray-500">{t('products.modifiersNote')}</div>
                    )}
                    {optGroups.map((g, gi) => (
                      <div key={gi} className="border rounded p-2">
                        <div className="flex items-center gap-2">
                          <input className="border px-2 py-1 rounded flex-1" placeholder={t('products.groupNamePlaceholder')} value={g.name} onChange={e=>{
                            const v = e.target.value; setOptGroups(prev => prev.map((gg, i)=> i===gi? { ...gg, name: v }: gg));
                          }} />
                          <label className="text-xs inline-flex items-center gap-1">
                            <input type="checkbox" checked={!!g.required} onChange={e=>{
                              const v = e.target.checked; setOptGroups(prev => prev.map((gg,i)=> i===gi? { ...gg, required: v }: gg));
                            }} />
                            <span>{t('products.required')}</span>
                          </label>
                          <div className="text-xs inline-flex items-center gap-1">
                            <span>{t('products.maxSelect')}</span>
                            <input type="number" min={1} step={1} className="border rounded px-1 py-0.5 w-16" value={g.max_select ?? 1} onChange={e=>{
                              const v = Math.max(1, Number(e.target.value||1)); setOptGroups(prev => prev.map((gg,i)=> i===gi? { ...gg, max_select: v }: gg));
                            }} />
                          </div>
                          <button className="ml-auto text-xs text-red-700" onClick={()=> setOptGroups(prev => prev.filter((_, i)=> i!==gi))}>{t('products.removeGroup')}</button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {(g.options || []).map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input className="border px-2 py-1 rounded flex-1" placeholder={t('products.optionNamePlaceholder')} value={o.name} onChange={e=>{
                                const v = e.target.value; setOptGroups(prev => prev.map((gg,i)=> i===gi? { ...gg, options: gg.options.map((oo,j)=> j===oi? { ...oo, name: v }: oo) }: gg));
                              }} />
                              <div className="text-xs inline-flex items-center gap-1">
                                <span>+ $</span>
                                <input type="number" step={0.01} className="border rounded px-1 py-0.5 w-24" value={Number(o.price_delta || 0)} onChange={e=>{
                                  const v = Number(e.target.value || 0); setOptGroups(prev => prev.map((gg,i)=> i===gi? { ...gg, options: gg.options.map((oo,j)=> j===oi? { ...oo, price_delta: v }: oo) }: gg));
                                }} />
                              </div>
                              <button className="text-xs text-red-700" onClick={()=> setOptGroups(prev => prev.map((gg,i)=> i===gi? { ...gg, options: gg.options.filter((_,j)=> j!==oi) }: gg))}>{t('common.remove')}</button>
                            </div>
                          ))}
                          <button className="text-xs underline" onClick={()=> setOptGroups(prev => prev.map((gg,i)=> i===gi? { ...gg, options: [...(gg.options||[]), { name: '', price_delta: 0 }] }: gg))}>{t('products.addOption')}</button>
                        </div>
                      </div>
                    ))}
                    <button className="text-xs underline" onClick={()=> setOptGroups(prev => [...prev, { name: '', required: false, max_select: 1, options: [] }])}>{t('products.addGroup')}</button>
                  </div>
                )}
                {advancedJson && (
                  <textarea value={optionsText} onChange={e=>setOptionsText(e.target.value)} className="border rounded w-full font-mono text-xs p-2 mt-2" rows={8} placeholder={t('products.jsonPlaceholder')}></textarea>
                )}
                {!advancedJson && (
                  <div className="text-xs text-gray-500 mt-1">{t('categories.modifiersHelp')}</div>
                )}
              </div>
              
              {/* Printer Settings */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-600">{t('settings.printerSettings.title')}</label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={printerSettings.enabled} 
                      onChange={e => setPrinterSettings(prev => ({ ...prev, enabled: e.target.checked, printer_ids: e.target.checked ? prev.printer_ids : [] }))}
                    />
                    <span>{t('settings.printerSettings.enableCustomPrinting')}</span>
                  </label>
                </div>
                
                {printerSettings.enabled && (
                  <div className="border rounded p-3 bg-gray-50">
                    <div className="text-sm text-gray-600 mb-2">{t('settings.printerSettings.selectPrinters')}</div>
                    {printers.length === 0 ? (
                      <div className="text-xs text-gray-500">{t('settings.printerSettings.noPrintersAvailable')}</div>
                    ) : (
                      <div className="space-y-2">
                        {printers.map((printer: Printer) => (
                          <label key={printer.id} className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={printerSettings.printer_ids.includes(printer.id)}
                              onChange={e => {
                                const isChecked = e.target.checked;
                                setPrinterSettings(prev => ({
                                  ...prev,
                                  printer_ids: isChecked 
                                    ? [...prev.printer_ids, printer.id]
                                    : prev.printer_ids.filter(id => id !== printer.id)
                                }));
                              }}
                            />
                            <span>{printer.name}</span>
                            <span className="text-xs text-gray-500">({t(`settings.printerSettings.locations.${printer.location}`)} - {printer.type})</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {t('settings.printerSettings.customPrintingNote')}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {!isValid && <span>{t('categories.validationError')}</span>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1" onClick={closeModal}>{t('common.cancel')}</button>
              <button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded disabled:opacity-50" disabled={saving || !isValid} onClick={save}>{saving ? t('common.saving') : t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}