import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

// Configure axios for development and mobile builds
const isCapacitor = typeof window !== 'undefined' && /^(capacitor|ionic):\/\//.test(window.location.href);
const apiBase = (import.meta as any).env?.VITE_API_BASE || (isCapacitor ? 'http://10.0.2.2:4001' : '');
axios.defaults.baseURL = apiBase;
axios.defaults.withCredentials = true;

interface User { id: number; username: string; role: string }

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/auth/me').then(r => setUser(r.data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    try {
      const r = await axios.post('/api/auth/login', { username, password });
      setUser(r.data.user);
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    await axios.post('/api/auth/logout');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}