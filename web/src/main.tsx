import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { AuthProvider } from './core/auth'
import { SettingsProvider } from './contexts/SettingsContext'
import './i18n'

import axios from 'axios';

// Ensure fetch calls go to the correct API base when running in Capacitor/Android or Local Dev
const isCapacitor = typeof window !== 'undefined' && /^(capacitor|ionic):\/\//.test(window.location.href);
const isDev = (import.meta as any).env.DEV;
const apiBase = (import.meta as any).env?.VITE_API_BASE || 
                (isCapacitor ? 'http://10.0.2.2:4001' : (isDev ? 'http://localhost:4001' : ''));

// Configure Axios global defaults
if (apiBase) {
  axios.defaults.baseURL = apiBase;
}
axios.defaults.withCredentials = true;

if (apiBase) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = input as string;
    if (typeof input === 'string' || input instanceof URL) {
      url = input.toString();
      if (url.startsWith('/api') && !url.startsWith('http')) {
        url = apiBase.replace(/\/$/, '') + url;
      }
    }
    const finalInit: RequestInit = { credentials: 'include', ...(init || {}) };
    return originalFetch(url as any, finalInit);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)