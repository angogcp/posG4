import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

interface Modifier {
  id: number;
  name: string;
  description?: string | null;
  selection_type: 'single' | 'multiple';
  min_choices?: number | null;
  max_choices?: number | null;
  sort_order: number;
  is_active: number;
}

interface ModifierOption {
  id: number;
  modifier_id: number;
  name: string;
  price_delta: number;
  sort_order: number;
  is_active: number;
}

interface AssignmentRow {
  id: number;
  modifier_id: number;
  entity_type: 'category' | 'product';
  entity_id: number;
}

interface Category { id: number; name: string; is_active: number }
interface Product { id: number; name: string; code?: string; is_active: number }

export default function ModifiersPage() {
  const [list, setList] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(true);
  // Search/sort/pagination state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'sort_order' | 'name' | 'id'>('sort_order');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const deepAssignType = useMemo(() => {
    const t = params.get('assignType');
    return t === 'product' ? 'product' : t === 'category' ? 'category' : null;
  }, [params]);
  const deepAssignId = params.get('assignId') || '';
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Modifier | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; selection_type: 'single'|'multiple'; min_choices: string; max_choices: string; sort_order: string; is_active: boolean }>({
    name: '', description: '', selection_type: 'single', min_choices: '0', max_choices: '', sort_order: '0', is_active: true,
  });
  // New: staged options for create/edit modal
  const [formOptions, setFormOptions] = useState<Array<{ name: string; price_delta: string; sort_order: string; is_active: boolean }>>([]);
  const [formOptDraft, setFormOptDraft] = useState<{ name: string; price_delta: string; sort_order: string; is_active: boolean }>({ name: '', price_delta: '0', sort_order: '0', is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manage modal (Options & Assignments)
  const [manageOpen, setManageOpen] = useState(false);
  const [current, setCurrent] = useState<Modifier | null>(null);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [optEditingId, setOptEditingId] = useState<number | null>(null);
  const [optDraft, setOptDraft] = useState<{ name: string; price_delta: string; sort_order: string; is_active: boolean }>({ name: '', price_delta: '0', sort_order: '0', is_active: true });
  const [newOpt, setNewOpt] = useState<{ name: string; price_delta: string; sort_order: string; is_active: boolean }>({ name: '', price_delta: '0', sort_order: '0', is_active: true });

  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [assignType, setAssignType] = useState<'category' | 'product'>('category');
  const [assignId, setAssignId] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const load = useMemo(() => {
    return async () => {
      setLoading(true);
      try {
        const r = await axios.get('/api/modifiers', { params: {
          q: search || undefined,
          sort: sortBy,
          order,
          page,
          pageSize,
          include_inactive: includeInactive ? '1' : undefined
        }});
        let rows: Modifier[] = r.data.data || r.data;
        setList(rows);
        const pg = r.data.pagination;
        if (pg) {
          setTotal(pg.total || rows.length);
          setPages(pg.pages || 1);
        } else {
          setTotal(rows.length);
          setPages(1);
        }
      } finally {
        setLoading(false);
      }
    };
  }, [includeInactive, search, sortBy, order, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', selection_type: 'single', min_choices: '0', max_choices: '', sort_order: '0', is_active: true });
    setFormOptions([]);
    setFormOptDraft({ name: '', price_delta: '0', sort_order: '0', is_active: true });
    setError(null);
    setShowEdit(true);
  }

  function openEdit(m: Modifier) {
    setEditing(m);
    setForm({
      name: m.name || '',
      description: m.description || '',
      selection_type: m.selection_type,
      min_choices: String(m.min_choices ?? 0),
      max_choices: m.max_choices == null ? '' : String(m.max_choices),
      sort_order: String(m.sort_order ?? 0),
      is_active: !!m.is_active,
    });
    setFormOptions([]); // allow adding new options during edit (optional)
    setFormOptDraft({ name: '', price_delta: '0', sort_order: '0', is_active: true });
    setError(null);
    setShowEdit(true);
  }

  // Add helpers to manage staged options in the modal
  function addFormOption() {
    const name = formOptDraft.name.trim();
    if (!name) { alert('Option name is required'); return; }
    setFormOptions(prev => [...prev, { ...formOptDraft }]);
    setFormOptDraft({ name: '', price_delta: '0', sort_order: '0', is_active: true });
  }
  function removeFormOption(idx: number) {
    setFormOptions(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        selection_type: form.selection_type,
        min_choices: Number(form.min_choices) || 0,
        max_choices: form.max_choices === '' ? null : Number(form.max_choices),
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (!payload.name) { setError('Name is required'); setSaving(false); return; }
      let modifierId: number | null = null;
      if (editing) {
        const r = await axios.put(`/api/modifiers/${editing.id}`, payload);
        const updated: Modifier = r.data.data || r.data;
        modifierId = updated.id;
        setList(prev => prev.map(x => x.id === updated.id ? updated : x));
      } else {
        const r = await axios.post('/api/modifiers', payload);
        const created: Modifier = r.data.data || r.data;
        modifierId = created.id;
        setList(prev => [created, ...prev]);
      }
      // If there are staged options, create them now
      if (modifierId && formOptions.length > 0) {
        await Promise.all(formOptions.map(opt => axios.post(`/api/modifiers/${modifierId}/options`, {
          name: opt.name.trim(),
          price_delta: Number(opt.price_delta) || 0,
          sort_order: Number(opt.sort_order) || 0,
          is_active: opt.is_active,
        })));
        // Refresh the modifier list to show updated options count
        await load();
      }
      setShowEdit(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: Modifier) {
    const newVal = !m.is_active;
    const r = await axios.put(`/api/modifiers/${m.id}`, { is_active: newVal });
    const updated: Modifier = r.data.data || r.data;
    setList(prev => prev.map(x => x.id === updated.id ? updated : x));
  }

  async function openManage(m: Modifier) {
    setCurrent(m);
    setManageOpen(true);
    setOptEditingId(null);
    setOptDraft({ name: '', price_delta: '0', sort_order: '0', is_active: true });
    setNewOpt({ name: '', price_delta: '0', sort_order: '0', is_active: true });
    setAssignType((deepAssignType || 'category') as 'category' | 'product');
    setAssignId(deepAssignId || '');
    setAssignError(null);
    // Load options & assignments
    const [optRes, asnRes, catsRes, prodsRes] = await Promise.all([
      axios.get(`/api/modifiers/${m.id}/options`),
      axios.get(`/api/modifiers/${m.id}/assignments`),
      axios.get('/api/categories'),
      axios.get('/api/products', { params: { include_inactive: '1' } }),
    ]);
    setOptions(optRes.data.data || optRes.data);
    setAssignments(asnRes.data.data || asnRes.data);
    setCats((catsRes.data.data || catsRes.data).filter((c: Category) => includeInactive ? true : c.is_active));
    setProds((prodsRes.data.data || prodsRes.data).filter((p: Product) => includeInactive ? true : p.is_active));
  }

  function startEditOption(o: ModifierOption) {
    setOptEditingId(o.id);
    setOptDraft({ name: o.name, price_delta: String(o.price_delta ?? 0), sort_order: String(o.sort_order ?? 0), is_active: !!o.is_active });
  }

  async function saveOption(o: ModifierOption) {
    try {
      const payload = {
        name: optDraft.name.trim(),
        price_delta: Number(optDraft.price_delta) || 0,
        sort_order: Number(optDraft.sort_order) || 0,
        is_active: optDraft.is_active,
      };
      const r = await axios.put(`/api/modifiers/options/${o.id}`, payload);
      const updated: ModifierOption = r.data.data || r.data;
      setOptions(prev => prev.map(x => x.id === updated.id ? updated : x));
      setOptEditingId(null);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to save option');
    }
  }

  async function addOption() {
    if (!current) return;
    try {
      const payload = {
        name: newOpt.name.trim(),
        price_delta: Number(newOpt.price_delta) || 0,
        sort_order: Number(newOpt.sort_order) || 0,
        is_active: newOpt.is_active,
      };
      if (!payload.name) { alert('Option name is required'); return; }
      const r = await axios.post(`/api/modifiers/${current.id}/options`, payload);
      const created: ModifierOption = r.data.data || r.data;
      setOptions(prev => [...prev, created]);
      setNewOpt({ name: '', price_delta: '0', sort_order: '0', is_active: true });
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to add option');
    }
  }

  async function deleteOption(o: ModifierOption) {
    if (!confirm('Disable this option?')) return;
    await axios.delete(`/api/modifiers/options/${o.id}`);
    setOptions(prev => prev.map(x => x.id === o.id ? { ...x, is_active: 0 } : x));
  }

  async function addAssignment() {
    if (!current) return;
    setAssignError(null);
    if (!assignId) { setAssignError('Please choose an item'); return; }
    try {
      const r = await axios.post(`/api/modifiers/${current.id}/assign`, { entity_type: assignType, entity_id: Number(assignId) });
      const created: AssignmentRow = r.data.data || r.data;
      setAssignments(prev => [...prev, created]);
      setAssignId('');
    } catch (e: any) {
      setAssignError(e?.response?.data?.error || 'Failed to assign');
    }
  }

  async function removeAssignment(a: AssignmentRow) {
    if (!current) return;
    await axios.delete(`/api/modifiers/${current.id}/assign`, { data: { entity_type: a.entity_type, entity_id: a.entity_id } });
    setAssignments(prev => prev.filter(x => x.id !== a.id));
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">Modifiers</div>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={includeInactive} onChange={e=>{ setIncludeInactive(e.target.checked); setPage(1); }} /> Include inactive</label>
          <input className="border rounded px-2 py-1 text-sm" placeholder="Search name..." value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }} />
          <select className="border rounded px-2 py-1 text-sm" value={sortBy} onChange={e=>{ setSortBy(e.target.value as any); setPage(1); }}>
            <option value="sort_order">Sort</option>
            <option value="name">Name</option>
            <option value="id">ID</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={order} onChange={e=>{ setOrder(e.target.value as any); }}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded" onClick={openCreate}>New Modifier</button>
        </div>
      </div>

      { (deepAssignType && deepAssignId) && (
        <div className="mb-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
          Deep-link target: {deepAssignType} #{deepAssignId}. Open any modifier's Manage to quickly assign to this target.
        </div>
      )}

      <div className="mb-3 text-sm text-gray-600">Assign modifiers to categories or products. Products inherit from their category, and product-specific assignments override or add to category-level. Use Options to configure price deltas.</div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Min</th>
                <th className="text-left p-2">Max</th>
                <th className="text-left p-2">Sort</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="p-2 font-medium">{m.name}</td>
                  <td className="p-2">{m.selection_type}</td>
                  <td className="p-2">{m.min_choices ?? 0}</td>
                  <td className="p-2">{m.max_choices == null ? '-' : m.max_choices}</td>
                  <td className="p-2">{m.sort_order ?? 0}</td>
                  <td className="p-2">{m.is_active ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Disabled</span>}</td>
                  <td className="p-2 text-right space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={() => openEdit(m)}>Edit</button>
                    <button className="px-2 py-1 border rounded" onClick={() => openManage(m)}>Manage</button>
                    <button className="px-2 py-1 border rounded" onClick={() => toggleActive(m)}>{m.is_active ? 'Disable' : 'Enable'}</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={7}>No modifiers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-lg shadow w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b text-lg font-semibold">{editing ? 'Edit Modifier' : 'New Modifier'}</div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input className="border rounded w-full px-3 py-2" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Type</label>
                <select className="border rounded w-full px-3 py-2" value={form.selection_type} onChange={e=>setForm({...form, selection_type: e.target.value as 'single'|'multiple'})}>
                  <option value="single">Single choice</option>
                  <option value="multiple">Multiple choice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Min choices</label>
                <input type="number" className="border rounded w-full px-3 py-2" value={form.min_choices} onChange={e=>setForm({...form, min_choices: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Max choices (blank = no limit)</label>
                <input type="number" className="border rounded w-full px-3 py-2" value={form.max_choices} onChange={e=>setForm({...form, max_choices: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Description</label>
                <input className="border rounded w-full px-3 py-2" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Sort order</label>
                <input type="number" className="border rounded w-full px-3 py-2" value={form.sort_order} onChange={e=>setForm({...form, sort_order: e.target.value})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form, is_active: e.target.checked})} />
                <span className="text-sm">Active</span>
              </div>

              {/* New: Options section inside create/edit modal */}
              <div className="md:col-span-2">
                <div className="font-medium mb-2">Options (optional)</div>
                <div className="border rounded overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Δ Price</th>
                        <th className="text-left p-2">Sort</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-right p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formOptions.map((fo, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 font-medium">{fo.name}</td>
                          <td className="p-2">{fo.price_delta}</td>
                          <td className="p-2">{fo.sort_order}</td>
                          <td className="p-2">{fo.is_active ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Disabled</span>}</td>
                          <td className="p-2 text-right">
                            <button className="px-2 py-1 border rounded" onClick={() => removeFormOption(idx)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                      {formOptions.length === 0 && (
                        <tr><td className="p-3 text-center text-gray-500" colSpan={5}>No options added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <div className="text-xs text-gray-600">Name</div>
                    <input className="border rounded px-2 py-1" value={formOptDraft.name} onChange={e=>setFormOptDraft({...formOptDraft, name: e.target.value})} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Δ Price</div>
                    <input type="number" className="border rounded px-2 py-1 w-28" value={formOptDraft.price_delta} onChange={e=>setFormOptDraft({...formOptDraft, price_delta: e.target.value})} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Sort</div>
                    <input type="number" className="border rounded px-2 py-1 w-20" value={formOptDraft.sort_order} onChange={e=>setFormOptDraft({...formOptDraft, sort_order: e.target.value})} />
                  </div>
                  <label className="text-xs flex items-center gap-1 mb-1"><input type="checkbox" checked={formOptDraft.is_active} onChange={e=>setFormOptDraft({...formOptDraft, is_active: e.target.checked})} /> Active</label>
                  <button className="px-3 py-2 border rounded" type="button" onClick={addFormOption}>Add Option</button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button className="px-3 py-2" onClick={()=>setShowEdit(false)}>Cancel</button>
              <button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {manageOpen && current && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setManageOpen(false)}>
          <div className="bg-white rounded-lg shadow w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="text-lg font-semibold">Manage: {current.name}</div>
              <button className="px-3 py-1" onClick={()=>setManageOpen(false)}>Close</button>
            </div>
            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="font-medium mb-2">Options</div>
                <div className="border rounded overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Δ Price</th>
                        <th className="text-left p-2">Sort</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-right p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {options.map(o => (
                        <tr key={o.id} className="border-t">
                          {optEditingId === o.id ? (
                            <>
                              <td className="p-2"><input className="border rounded px-2 py-1 w-full" value={optDraft.name} onChange={e=>setOptDraft({...optDraft, name: e.target.value})} /></td>
                              <td className="p-2"><input type="number" className="border rounded px-2 py-1 w-28" value={optDraft.price_delta} onChange={e=>setOptDraft({...optDraft, price_delta: e.target.value})} /></td>
                              <td className="p-2"><input type="number" className="border rounded px-2 py-1 w-20" value={optDraft.sort_order} onChange={e=>setOptDraft({...optDraft, sort_order: e.target.value})} /></td>
                              <td className="p-2"><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={optDraft.is_active} onChange={e=>setOptDraft({...optDraft, is_active: e.target.checked})} /> Active</label></td>
                              <td className="p-2 text-right space-x-2">
                                <button className="px-2 py-1 border rounded" onClick={()=>setOptEditingId(null)}>Cancel</button>
                                <button className="px-2 py-1 border rounded" onClick={()=>saveOption(o)}>Save</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 font-medium">{o.name}</td>
                              <td className="p-2">{o.price_delta}</td>
                              <td className="p-2">{o.sort_order}</td>
                              <td className="p-2">{o.is_active ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Disabled</span>}</td>
                              <td className="p-2 text-right space-x-2">
                                <button className="px-2 py-1 border rounded" onClick={()=>startEditOption(o)}>Edit</button>
                                <button className="px-2 py-1 border rounded" onClick={()=>deleteOption(o)}>Disable</button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {options.length === 0 && (
                        <tr><td className="p-3 text-center text-gray-500" colSpan={5}>No options</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div>
                    <div className="text-xs text-gray-600">Name</div>
                    <input className="border rounded px-2 py-1" value={newOpt.name} onChange={e=>setNewOpt({...newOpt, name: e.target.value})} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Δ Price</div>
                    <input type="number" className="border rounded px-2 py-1 w-28" value={newOpt.price_delta} onChange={e=>setNewOpt({...newOpt, price_delta: e.target.value})} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Sort</div>
                    <input type="number" className="border rounded px-2 py-1 w-20" value={newOpt.sort_order} onChange={e=>setNewOpt({...newOpt, sort_order: e.target.value})} />
                  </div>
                  <label className="text-xs flex items-center gap-1 mb-1"><input type="checkbox" checked={newOpt.is_active} onChange={e=>setNewOpt({...newOpt, is_active: e.target.checked})} /> Active</label>
                  <button className="px-3 py-2 border rounded" onClick={addOption}>Add Option</button>
                </div>
              </div>

              <div>
                <div className="font-medium mb-2">Assignments</div>
                <div className="border rounded overflow-auto mb-2">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Target</th>
                        <th className="text-right p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map(a => (
                        <tr key={a.id} className="border-t">
                          <td className="p-2">{a.entity_type}</td>
                          <td className="p-2">{a.entity_type === 'category' ? (cats.find(c=>c.id===a.entity_id)?.name || a.entity_id) : (prods.find(p=>p.id===a.entity_id)?.name || a.entity_id)}</td>
                          <td className="p-2 text-right">
                            <button className="px-2 py-1 border rounded" onClick={()=>removeAssignment(a)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                      {assignments.length === 0 && (
                        <tr><td className="p-3 text-center text-gray-500" colSpan={3}>No assignments</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <div className="text-xs text-gray-600">Type</div>
                    <select className="border rounded px-2 py-1" value={assignType} onChange={e=>{ setAssignType(e.target.value as 'category'|'product'); setAssignId(''); }}>
                      <option value="category">Category</option>
                      <option value="product">Product</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Target</div>
                    {assignType === 'category' ? (
                      <select className="border rounded px-2 py-1 min-w-[200px]" value={assignId} onChange={e=>setAssignId(e.target.value)}>
                        <option value="">Choose category…</option>
                        {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <select className="border rounded px-2 py-1 min-w-[240px]" value={assignId} onChange={e=>setAssignId(e.target.value)}>
                        <option value="">Choose product…</option>
                        {prods.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
                      </select>
                    )}
                  </div>
                  <button className="px-3 py-2 border rounded" onClick={addAssignment}>Add</button>
                  {assignError && <div className="text-xs text-red-600">{assignError}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}