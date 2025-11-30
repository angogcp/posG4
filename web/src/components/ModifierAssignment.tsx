import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Plus, Trash2, Info, Check, X, AlertCircle } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface ModifierOption {
  id: number;
  name: string;
  price_delta: number;
}

interface Modifier {
  id: number;
  name: string;
  selection_type: 'single' | 'multiple';
  min_choices: number;
  max_choices: number | null;
  options: ModifierOption[];
  source?: 'product' | 'category';
}

interface Props {
  entityType: 'product' | 'category';
  entityId: number;
}

export default function ModifierAssignment({ entityType, entityId }: Props) {
  const { formatCurrency } = useSettings();
  const [assigned, setAssigned] = useState<Modifier[]>([]);
  const [available, setAvailable] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedModId, setSelectedModId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Fetch assigned modifiers
  const loadAssigned = async () => {
    setLoading(true);
    try {
      // e.g. /api/products/1/modifiers or /api/categories/1/modifiers
      const r = await axios.get(`/api/${entityType === 'category' ? 'categories' : 'products'}/${entityId}/modifiers`);
      setAssigned(r.data.data || r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all available modifiers for the dropdown
  const loadAvailable = async () => {
    try {
      const r = await axios.get('/api/modifiers?include_inactive=1'); // Get all to show
      const all: Modifier[] = r.data.data || r.data;
      // Filter out ones that are already assigned directly
      // Note: For products, we might want to filter out ones that are already inherited too?
      // Or just show them but maybe disabled? For simplicity, just load all.
      setAvailable(all);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (entityId) {
      loadAssigned();
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (adding) {
      loadAvailable();
    }
  }, [adding]);

  const handleAdd = async () => {
    if (!selectedModId) return;
    setError(null);
    try {
      await axios.post(`/api/modifiers/${selectedModId}/assign`, {
        entity_type: entityType,
        entity_id: entityId
      });
      setAdding(false);
      setSelectedModId('');
      loadAssigned();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to assign modifier');
    }
  };

  const handleRemove = async (modId: number) => {
    if (!confirm('Remove this modifier assignment?')) return;
    try {
      await axios.delete(`/api/modifiers/${modId}/assign`, {
        data: { entity_type: entityType, entity_id: entityId }
      });
      loadAssigned();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to remove assignment');
    }
  };

  // Filter available list: remove ones that are already directly assigned
  const filteredAvailable = useMemo(() => {
    const currentIds = new Set(assigned.filter(m => m.source !== 'category').map(m => m.id));
    // If product, also check inherited? Actually, if inherited, we CAN override or double assign?
    // Usually, if inherited, we don't want to assign again unless we want to override options (not supported yet).
    // Let's just hide if it's present in `assigned` at all for now to avoid confusion.
    const allAssignedIds = new Set(assigned.map(m => m.id));
    return available.filter(m => !allAssignedIds.has(m.id));
  }, [available, assigned]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700">Assigned Modifiers</h3>
        <button 
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Assign Modifier
        </button>
      </div>

      {adding && (
        <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 mb-3">
          <div className="text-xs font-medium mb-2 text-neutral-600">Select a modifier group to assign:</div>
          <div className="flex gap-2">
            <select 
              className="flex-1 border rounded px-2 py-1 text-sm"
              value={selectedModId}
              onChange={e => setSelectedModId(e.target.value)}
            >
              <option value="">-- Select Modifier --</option>
              {filteredAvailable.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.selection_type})</option>
              ))}
            </select>
            <button 
              type="button"
              disabled={!selectedModId}
              onClick={handleAdd}
              className="bg-primary-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
            >
              Add
            </button>
            <button 
              type="button"
              onClick={() => setAdding(false)}
              className="border bg-white px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
          {error && <div className="text-red-600 text-xs mt-2">{error}</div>}
          <div className="mt-2 text-xs text-neutral-500">
            Don't see what you need? <a href="/modifiers" target="_blank" className="text-blue-600 underline">Manage Modifiers</a>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="text-sm text-neutral-500">Loading assignments...</div>
        ) : assigned.length === 0 ? (
          <div className="text-sm text-neutral-400 italic p-4 text-center bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
            No modifiers assigned.
          </div>
        ) : (
          assigned.map(m => (
            <div key={m.id} className="bg-white border border-neutral-200 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium text-neutral-900 flex items-center gap-2">
                    {m.name}
                    {m.source === 'category' && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Inherited from Category
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {m.selection_type === 'single' ? 'Single Choice' : 'Multiple Choice'} • 
                    Min: {m.min_choices} • Max: {m.max_choices || 'Unlim.'}
                  </div>
                </div>
                {m.source !== 'category' && (
                  <button 
                    onClick={() => handleRemove(m.id)}
                    className="text-neutral-400 hover:text-red-600 p-1"
                    title="Remove assignment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Options Preview */}
              <div className="flex flex-wrap gap-2">
                {m.options.map(o => (
                  <span key={o.id} className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-50 text-xs text-neutral-600 border border-neutral-100">
                    {o.name}
                    {o.price_delta > 0 && <span className="ml-1 text-neutral-400">+{formatCurrency(o.price_delta)}</span>}
                  </span>
                ))}
                {m.options.length === 0 && <span className="text-xs text-neutral-400 italic">No options defined</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
