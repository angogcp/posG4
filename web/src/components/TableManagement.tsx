import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Users, 
  Save, 
  X,
  Search
} from 'lucide-react';

interface Table {
  id: number;
  name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  is_active: boolean;
}

export default function TableManagement() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Table>>({});
  const [isAdding, setIsAdding] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [status, setStatus] = useState<'available' | 'occupied' | 'reserved'>('available');

  useEffect(() => {
    fetchTables();
  }, []);

  async function fetchTables() {
    setLoading(true);
    try {
      const r = await axios.get('/api/tables');
      setTables(r.data.data || []);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/tables/${editingId}`, {
          name,
          capacity,
          status
        });
      } else {
        await axios.post('/api/tables', {
          name,
          capacity,
          status
        });
      }
      resetForm();
      fetchTables();
    } catch (err) {
      alert('Failed to save table. Name might be duplicate.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      await axios.delete(`/api/tables/${id}`);
      fetchTables();
    } catch (err) {
      alert('Failed to delete table');
    }
  }

  function startEdit(t: Table) {
    setEditingId(t.id);
    setName(t.name);
    setCapacity(t.capacity);
    setStatus(t.status);
    setIsAdding(true);
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setCapacity(4);
    setStatus('available');
    setIsAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Table Management</h2>
          <p className="text-sm text-neutral-500">Manage dining tables and seating capacity</p>
        </div>
        <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
          <MapPin className="w-5 h-5 text-purple-600" />
        </div>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-neutral-900 flex items-center gap-2">
              {editingId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Edit Table' : 'Add New Table'}
            </h3>
            <button onClick={resetForm} className="text-neutral-400 hover:text-neutral-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Table Name/No.</label>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. T1, A5, VIP1"
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Capacity (Pax)</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="number"
                  min="1"
                  required
                  value={capacity}
                  onChange={e => setCapacity(parseInt(e.target.value) || 1)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Initial Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-md shadow-purple-200"
              >
                {editingId ? 'Update Table' : 'Create Table'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-md shadow-purple-200"
        >
          <Plus className="w-4 h-4" />
          Add Table
        </button>
      )}

      {/* Table List */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map(table => (
          <div
            key={table.id}
            className="group relative bg-white border border-neutral-200 rounded-xl p-4 hover:shadow-lg hover:border-purple-200 hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <span className="font-bold text-purple-700 text-lg">{table.name}</span>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                table.status === 'available' ? 'bg-success-100 text-success-700' :
                table.status === 'occupied' ? 'bg-danger-100 text-danger-700' :
                'bg-warning-100 text-warning-700'
              }`}>
                {table.status}
              </div>
            </div>

            <div className="space-y-1 mb-4">
              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Capacity: <span className="font-medium text-neutral-900">{table.capacity}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEdit(table)}
                className="flex-1 p-1.5 text-neutral-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-xs font-medium flex items-center justify-center gap-1"
              >
                <Edit className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => handleDelete(table.id)}
                className="p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {tables.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-neutral-400 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-200">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No tables found. Click "Add Table" to create one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
