import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';

const LanguageSwitch: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ];

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all duration-200 group"
        title={t('settings.language')}
      >
        <Globe className="w-4 h-4 text-primary-500 group-hover:text-primary-600 transition-colors duration-200" />
        <span className="text-sm font-medium flex items-center space-x-1">
          <span className="text-lg leading-none">{currentLang.flag}</span>
          <span className="hidden sm:block">{currentLang.name}</span>
        </span>
        <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-neutral-200 z-20 animate-slide-down">
            <div className="p-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    i18n.language === lang.code
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg leading-none">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                  {i18n.language === lang.code && (
                    <Check className="w-4 h-4 text-primary-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitch;