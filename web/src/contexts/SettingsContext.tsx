import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../core/auth';

interface SettingsContextValue {
  settings: Record<string, string>;
  currency: string;
  currencySymbol: string;
  formatCurrency: (amount: number) => string;
  reloadSettings: () => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const reloadSettings = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const r = await axios.get('/api/settings');
      setSettings(r.data || {});
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const currency = settings['store.currency'] || 'USD';
  
  // Basic mapping for common currencies to locales that display the symbol nicely
  const localeMap: Record<string, string> = {
    'MYR': 'en-MY',
    'USD': 'en-US',
    'EUR': 'de-DE',
    'GBP': 'en-GB',
    'JPY': 'ja-JP',
    'CNY': 'zh-CN',
    'SGD': 'en-SG',
    'AUD': 'en-AU',
  };
  const locale = localeMap[currency] || 'en-US';

  const currencySymbol = React.useMemo(() => {
    try {
      const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).formatToParts(0);
      return parts.find(p => p.type === 'currency')?.value || currency;
    } catch {
      return currency;
    }
  }, [locale, currency]);

  const formatCurrency = useCallback((amount: number) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
      }).format(amount);
    } catch (e) {
      // Fallback
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [locale, currency]);

  return (
    <SettingsContext.Provider value={{ settings, currency, currencySymbol, formatCurrency, reloadSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
