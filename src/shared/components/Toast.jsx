// src/shared/components/Toast.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, AlertOctagon } from 'lucide-react';

const ToastContext = createContext();

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    info: (msg, duration) => addToast(msg, 'info', duration),
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    remove: removeToast
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertOctagon className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />
  };

  const styles = {
    info: 'bg-white border-slate-200 text-slate-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800'
  };

  const iconColors = {
    info: 'text-[#004E7C]',
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600'
  };

  return (
    <div 
      className={`
        pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border
        animate-in slide-in-from-right-full fade-in duration-300
        ${styles[toast.type]}
      `}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 ${iconColors[toast.type]}`}>
          {icons[toast.type]}
        </span>
        <p className="flex-1 text-sm font-medium pt-0.5">{toast.message}</p>
        <button 
          onClick={() => onRemove(toast.id)}
          className="text-current opacity-50 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ToastProvider;
