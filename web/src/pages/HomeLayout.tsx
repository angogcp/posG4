import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/auth';
import Sidebar from '../components/Sidebar';
import LanguageSwitch from '../components/LanguageSwitch';
import ThemeSwitch from '../components/ThemeSwitch';
import { 
  Search, 
  Bell, 
  Menu
} from 'lucide-react';

export default function HomeLayout() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      setSidebarOpen(JSON.parse(saved));
    }
  }, []);

  const handleSidebarToggle = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem('sidebarOpen', JSON.stringify(open));
  };

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={handleSidebarToggle}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Left: Mobile Toggle & Title/Breadcrumbs */}
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-xl"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* We could add breadcrumbs or page title here if needed */}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Search Bar - Desktop */}
            <div className="hidden md:flex items-center bg-neutral-100 rounded-xl px-3 py-2 w-64 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
              <Search className="w-4 h-4 text-neutral-400 mr-2" />
              <input 
                type="text" 
                placeholder={t('common.search') || "Search..."}
                className="bg-transparent border-none outline-none text-sm w-full placeholder-neutral-400 text-neutral-900"
              />
            </div>

            {/* Action Buttons */}
            <button className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger-500 rounded-full border-2 border-white"></span>
            </button>

            <div className="h-8 w-px bg-neutral-200 mx-1 hidden sm:block"></div>

            <ThemeSwitch />
            <LanguageSwitch />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
