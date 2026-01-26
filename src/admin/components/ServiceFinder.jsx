// src/admin/components/ServiceFinder.jsx
// Stub component - Full implementation coming later

import React from 'react';
import { X, Search, AlertCircle } from 'lucide-react';

export default function ServiceFinder({ isOpen, onClose, onSelect }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-5 h-5" />
            Service Finder
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-amber-50 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h4 className="text-lg font-semibold text-slate-700 mb-2">
            Coming Soon
          </h4>
          <p className="text-slate-500 max-w-md">
            The Service Finder tool is being developed and will allow you to browse and discover ArcGIS services for your notifications.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
