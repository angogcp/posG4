import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../core/auth';
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
  ChevronLeft,
  ChevronRight,
  User,
  UtensilsCrossed,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen, mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const loc = useLocation();

  const navigationItems = [
    { path: '/pos', label: t('nav.pos'), icon: Store, color: 'text-primary-500' },
    { path: '/kitchen', label: 'Kitchen', icon: UtensilsCrossed, color: 'text-warning-500' },
    { path: '/orders', label: t('nav.orders'), icon: ShoppingCart, color: 'text-success-500' },
    { path: '/products', label: t('nav.products'), icon: Package, color: 'text-accent-500' },
    { path: '/categories', label: t('nav.categories'), icon: FolderOpen, color: 'text-warning-500' },
    ...(user?.role === 'admin' ? [
      { path: '/reports', label: t('nav.reports'), icon: BarChart3, color: 'text-primary-500' },
      { path: '/modifiers', label: t('nav.modifiers'), icon: Sliders, color: 'text-neutral-500' },
      { path: '/users', label: t('nav.users'), icon: Users, color: 'text-danger-500' }
    ] : []),
    { path: '/settings', label: t('nav.settings'), icon: Settings, color: 'text-neutral-500' }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white border-r border-neutral-200
          flex flex-col transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
          ${isOpen ? 'w-64' : 'w-20 lg:w-20'}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100">
          <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${!isOpen && 'justify-center w-full'}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Store className="w-6 h-6 text-white" />
            </div>
            {isOpen && (
              <div className="flex flex-col min-w-0 fade-in">
                <h1 className="text-lg font-bold text-neutral-900 truncate">POS G4</h1>
                <p className="text-xs text-neutral-500 truncate">Restaurant</p>
              </div>
            )}
          </div>
          {isOpen && (
             <button 
               onClick={() => setMobileOpen(false)} 
               className="lg:hidden p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg"
             >
               <X className="w-5 h-5" />
             </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = loc.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700 shadow-sm' 
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                  ${!isOpen && 'justify-center px-2'}
                `}
                title={!isOpen ? item.label : ''}
              >
                <IconComponent 
                  className={`
                    w-5 h-5 transition-colors duration-200 flex-shrink-0
                    ${isActive ? 'text-primary-600' : item.color}
                    ${!isOpen && 'w-6 h-6'}
                  `} 
                />
                {isOpen && (
                  <span className="font-medium truncate fade-in">{item.label}</span>
                )}
                
                {/* Hover tooltip for collapsed state */}
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile / Footer */}
        <div className="p-4 border-t border-neutral-100">
          <div className={`flex items-center gap-3 ${!isOpen && 'justify-center'}`}>
            <div className="w-9 h-9 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-neutral-700">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            
            {isOpen && (
              <div className="flex-1 min-w-0 fade-in">
                <p className="text-sm font-medium text-neutral-900 truncate">{user?.username}</p>
                <p className="text-xs text-neutral-500 truncate capitalize">{user?.role}</p>
              </div>
            )}

            {isOpen && (
              <button 
                onClick={() => logout()}
                className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title={t('nav.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Collapse Toggle (Desktop only) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden lg:flex absolute -right-3 top-20 bg-white border border-neutral-200 p-1 rounded-full shadow-md text-neutral-500 hover:text-primary-600 transition-colors z-10"
          >
            {isOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </aside>
    </>
  );
}
