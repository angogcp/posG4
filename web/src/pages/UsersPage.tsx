import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Plus, 
  Edit3, 
  User, 
  Shield, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle,
  Filter,
  Search
} from 'lucide-react';

interface UserRow { id: number; username: string; role: 'admin'|'cashier'; is_active: number; created_at?: string }

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<{username: string; role: 'admin'|'cashier'; password: string; is_active: boolean}>({ username: '', role: 'cashier', password: '', is_active: true });
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await axios.get('/api/users');
      setUsers(r.data.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      // Filter by active status
      if (!includeInactive && !u.is_active) return false;
      
      // Filter by search query
      if (query.trim()) {
        const q = query.toLowerCase();
        return u.username.toLowerCase().includes(q);
      }
      
      return true;
    });
  }, [users, includeInactive, query]);

  function openCreate() {
    setEditing(null);
    setForm({ username: '', role: 'cashier', password: '', is_active: true });
    setError(null);
    setShowModal(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ username: u.username, role: u.role, password: '', is_active: !!u.is_active });
    setError(null);
    setShowModal(true);
  }

  async function save() {
    try {
      setError(null);
      if (!form.username.trim()) return setError(t('users.usernameRequired'));
      if (!editing && !form.password) return setError(t('users.passwordRequired'));
      if (editing) {
        const payload: any = { username: form.username.trim(), role: form.role, is_active: form.is_active ? 1 : 0 };
        if (form.password) payload.password = form.password;
        const r = await axios.put(`/api/users/${editing.id}`, payload);
        setUsers(prev => prev.map(x => x.id === editing.id ? r.data.data : x));
      } else {
        const r = await axios.post('/api/users', { username: form.username.trim(), password: form.password, role: form.role, is_active: form.is_active ? 1 : 0 });
        setUsers(prev => [...prev, r.data.data]);
      }
      setShowModal(false);
    } catch (e: any) {
      setError(e?.response?.data?.error || t('common.failedToSave'));
    }
  }

  async function toggleActive(u: UserRow) {
    const r = await axios.put(`/api/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
    setUsers(prev => prev.map(x => x.id === u.id ? r.data.data : x));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{t('users.title')}</h1>
              <p className="text-sm text-neutral-500">
                {loading ? t('common.loading') : t('common.showing', { count: filtered.length, total: users.length })}
              </p>
            </div>
          </div>
          <button 
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4" />
            {t('users.newUser')}
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
                  placeholder={t('users.searchPlaceholder')}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Filter Options */}
            <div className="lg:w-auto">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                {t('common.filters')}
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <input 
                    type="checkbox" 
                    checked={includeInactive}
                    onChange={e=>setIncludeInactive(e.target.checked)}
                    className="rounded"
                  />
                  {t('common.includeInactive')}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Users Grid */}
        <div className="card p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8" />
              <span className="ml-3 text-neutral-600">{t('common.loading')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-600 mb-2">{t('users.noUsers')}</h3>
              <p className="text-neutral-500 text-sm">No users found for the selected criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map(user => (
                <div 
                  key={user.id} 
                  className="group relative bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-lg hover:border-primary-200 hover:-translate-y-1 transition-all duration-300"
                >
                  {/* User Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors text-sm">
                          {user.username}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-success-100 text-success-800' : 'bg-neutral-100 text-neutral-800'}`}>
                            {user.is_active ? (
                              <>
                                <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                <span className="hidden xs:inline">{t('common.active')}</span>
                                <span className="xs:hidden">A</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-2.5 h-2.5 mr-0.5" />
                                <span className="hidden xs:inline">{t('common.disabled')}</span>
                                <span className="xs:hidden">D</span>
                              </>
                            )}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-warning-100 text-warning-800' : 'bg-info-100 text-info-800'}`}>
                            <Shield className="w-2.5 h-2.5 mr-0.5" />
                            {user.role === 'admin' ? (
                              <>
                                <span className="hidden xs:inline">{t('users.admin')}</span>
                                <span className="xs:hidden">Admin</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden xs:inline">{t('users.cashier')}</span>
                                <span className="xs:hidden">Cash</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Actions */}
                  <div className="flex items-center justify-end space-x-1">
                    <button 
                      className="p-1.5 text-neutral-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                      onClick={() => openEdit(user)}
                      title={t('common.edit')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      className={`p-1.5 rounded-lg transition-all ${user.is_active ? 'text-danger-600 hover:text-danger-700 hover:bg-danger-50' : 'text-success-600 hover:text-success-700 hover:bg-success-50'}`}
                      onClick={() => toggleActive(user)}
                      title={user.is_active ? t('common.disable') : t('common.enable')}
                    >
                      {user.is_active ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-primary-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modern User Modal */}
        {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={()=>setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">
                      {editing ? t('users.editUser') : t('users.newUser')}
                    </h2>
                    <p className="text-sm text-neutral-500">
                      {editing ? 'Update user information' : 'Create a new user account'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={()=>setShowModal(false)}
                  className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-5">
                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl">
                    <div className="flex items-center text-danger-800">
                      <XCircle className="w-5 h-5 mr-2" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </div>
                )}

                {/* Username Field */}
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    {t('users.username')}
                  </label>
                  <input 
                    className="input w-full"
                    value={form.username}
                    onChange={e=>setForm({...form, username: e.target.value})}
                    placeholder={t('users.usernamePlaceholder')}
                  />
                </div>

                {/* Role Field */}
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    {t('users.role')}
                  </label>
                  <select 
                    className="input w-full"
                    value={form.role}
                    onChange={e=>setForm({...form, role: e.target.value as 'admin'|'cashier'})}
                  >
                    <option value="cashier">
                      <div className="flex items-center">
                        <span>{t('users.cashier')}</span>
                        <span className="text-xs text-neutral-500 ml-2">Limited access to system functions</span>
                      </div>
                    </option>
                    <option value="admin">
                      <div className="flex items-center">
                        <span>{t('users.admin')}</span>
                        <span className="text-xs text-neutral-500 ml-2">Full access to all system functions</span>
                      </div>
                    </option>
                  </select>
                  <div className="mt-2 text-xs text-neutral-500">
                    {form.role === 'admin' 
                      ? 'Administrators have full access to all system functions'
                      : 'Cashiers have limited access to POS functions only'}
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    {editing ? t('users.resetPassword') : t('users.password')}
                  </label>
                  <input 
                    type="password"
                    className="input w-full"
                    value={form.password}
                    onChange={e=>setForm({...form, password: e.target.value})}
                    placeholder={editing ? t('users.passwordPlaceholderOptional') : t('users.passwordPlaceholder')}
                  />
                  <div className="mt-2 text-xs text-neutral-500">
                    {editing 
                      ? 'Leave blank to keep current password'
                      : 'Password must be at least 6 characters long'}
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${form.is_active ? 'bg-success-500' : 'bg-neutral-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.is_active ? 'left-5' : 'left-0.5'}`}></div>
                    </div>
                    <span className="text-sm font-medium text-neutral-700">{t('common.active')}</span>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.is_active}
                      onChange={e=>setForm({...form, is_active: e.target.checked})}
                      className="sr-only"
                    />
                    <span className="text-sm text-neutral-500">{form.is_active ? t('common.enabled') : t('common.disabled')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-6">
              <div className="flex justify-end gap-3">
                <button 
                  className="btn btn-secondary"
                  onClick={()=>setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={save}
                >
                  {editing ? t('common.update') : t('common.create')}
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