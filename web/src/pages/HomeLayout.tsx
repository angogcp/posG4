import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/auth';
import LanguageSwitch from '../components/LanguageSwitch';
import { 
  Store, 
  ShoppingCart, 
  Package, 
  FolderOpen, 
  Settings, 
  Users, 
  BarChart3, 
  Sliders, 
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  UtensilsCrossed,
  User
} from 'lucide-react';

export default function HomeLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  const navigationItems = [
    { path: '/pos', label: t('nav.pos'), icon: Store, color: 'text-primary-600' },
    { path: '/waiter', label: 'Waiter', icon: User, color: 'text-success-600' },
    { path: '/kitchen', label: 'Kitchen', icon: UtensilsCrossed, color: 'text-warning-600' },
    { path: '/orders', label: t('nav.orders'), icon: ShoppingCart, color: 'text-success-600' },
    { path: '/products', label: t('nav.products'), icon: Package, color: 'text-accent-600' },
    { path: '/categories', label: t('nav.categories'), icon: FolderOpen, color: 'text-warning-600' },
    ...(user?.role === 'admin' ? [
      { path: '/reports', label: t('nav.reports'), icon: BarChart3, color: 'text-primary-600' },
      { path: '/modifiers', label: t('nav.modifiers'), icon: Sliders, color: 'text-neutral-600' },
      { path: '/users', label: t('nav.users'), icon: Users, color: 'text-danger-600' }
    ] : []),
    { path: '/settings', label: t('nav.settings'), icon: Settings, color: 'text-neutral-600' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 via-white to-neutral-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                    POS G4
                  </h1>
                  <p className="text-xs text-neutral-500 font-medium">Restaurant System</p>
                </div>
              </div>
            </div>

            {/* Desktop Navigation - Hidden on mobile */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = loc.pathname.startsWith(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-link group ${
                      isActive ? 'nav-link-active' : ''
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-primary-600' : item.color} transition-colors duration-200`} />
                    <span className={`font-medium ${isActive ? 'text-primary-800' : 'text-neutral-700'}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Section */}
            <div className="flex items-center space-x-3">
              {/* Search (placeholder for future) - Hidden on mobile */}
              <button className="hidden sm:flex p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all duration-200">
                <Search className="w-5 h-5" />
              </button>
              
              {/* Notifications (placeholder for future) - Hidden on mobile */}
              <button className="hidden sm:flex relative p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all duration-200">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger-500 rounded-full border-2 border-white"></span>
              </button>
              
              {/* Language Switch */}
              <LanguageSwitch />
              
              {/* Mobile menu button */}
              <button 
                className="md:hidden p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all duration-200"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              {/* User Menu */}
              <div className="hidden md:flex items-center space-x-3 pl-3 border-l border-neutral-200">
                <div className="flex items-center space-x-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-neutral-900">{user?.username}</p>
                    <p className="text-xs text-neutral-500 capitalize">{user?.role}</p>
                  </div>
                  <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-white font-semibold text-sm">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="p-2 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-all duration-200 group"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation - Only visible on mobile when menu is open */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-neutral-200/50">
          <div className="px-4 py-3">
            <div className="flex flex-col space-y-2 max-h-[calc(100vh-100px)] overflow-y-auto">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = loc.pathname.startsWith(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-3 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      isActive 
                        ? 'bg-primary-100 text-primary-800 shadow-md' 
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <IconComponent className={`w-5 h-5 ${isActive ? 'text-primary-600' : item.color}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Mobile User Menu */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-200">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {user?.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{user?.username}</p>
                    <p className="text-xs text-neutral-500 capitalize truncate">{user?.role}</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="p-2 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-all duration-200 group flex-shrink-0"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative">
        <div className="absolute inset-0 bg-grid opacity-[0.02] pointer-events-none"></div>
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}