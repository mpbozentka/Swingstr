import React from 'react';

export function Button({ onClick, active, children, className = '', title = '', disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${active
          ? 'bg-purple-600 text-white shadow-lg scale-105'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
        } ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

export function IconButton({ onClick, active, children, title, className = '' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-all flex items-center justify-center ${active
          ? 'bg-purple-600 text-white shadow-lg'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        } ${className}`}
    >
      {children}
    </button>
  );
}

export function MenuButton({ icon: Icon, label, active, onClick, isOpen }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${active || isOpen
          ? 'bg-gray-700 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
        }`}
    >
      <Icon size={18} className={active ? 'text-purple-400' : ''} />
      <span className="text-sm font-medium">{label}</span>
      {isOpen && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-700 rotate-45 translate-y-1" />
      )}
    </button>
  );
}
