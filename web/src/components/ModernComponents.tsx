import React, { ReactNode } from 'react';

// Modern Button Component
interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button'
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
    secondary: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 focus:ring-neutral-500',
    danger: 'bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-500',
    success: 'bg-success-600 hover:bg-success-700 text-white focus:ring-success-500',
    outline: 'bg-transparent border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer';
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

// Modern Card Component
interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

// Modern Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, size = 'md' }) => {
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 bg-white border-b border-neutral-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
              <button 
                onClick={onClose}
                className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {children}
        </div>
      </div>
    </div>
  );
};

// Modern Table Component
interface TableProps {
  children: ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${className}`}>
        {children}
      </table>
    </div>
  );
};

interface TableHeadProps {
  children: ReactNode;
}

export const TableHead: React.FC<TableHeadProps> = ({ children }) => {
  return (
    <thead className="bg-gradient-to-r from-neutral-50 to-neutral-100">
      {children}
    </thead>
  );
};

interface TableBodyProps {
  children: ReactNode;
}

export const TableBody: React.FC<TableBodyProps> = ({ children }) => {
  return (
    <tbody>
      {children}
    </tbody>
  );
};

interface TableRowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => {
  return (
    <tr 
      className={`${className} ${onClick ? 'cursor-pointer hover:bg-neutral-50 transition-colors' : ''}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface TableCellProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '', align = 'left' }) => {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };
  
  return (
    <td className={`py-3 px-4 ${alignClasses[align]} ${className}`}>
      {children}
    </td>
  );
};

// Modern Input Component
interface InputProps {
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false
}) => {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`input ${className}`}
    />
  );
};

// Modern Textarea Component
interface TextareaProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

export const Textarea: React.FC<TextareaProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  rows = 3
}) => {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={`input min-h-[100px] ${className}`}
    />
  );
};

// Modern Select Component
interface SelectProps {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  children,
  className = '',
  disabled = false
}) => {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`input ${className}`}
    >
      {children}
    </select>
  );
};