// src/shared/components/ConfirmDialog.jsx
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export default function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  destructive = false, 
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center gap-3">
          <div className={`p-3 rounded-full ${destructive ? 'bg-red-100 text-red-600' : 'bg-[#004E7C]/10 text-[#004E7C]'}`}>
            {destructive ? <AlertTriangle className="w-8 h-8" /> : <Info className="w-8 h-8" />}
          </div>
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <p className="text-slate-600">{message}</p>
        </div>
        <div className="flex gap-3 mt-8">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-bold transition-colors ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#004E7C] hover:bg-[#003B5C]'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
