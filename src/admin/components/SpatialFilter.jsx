// src/admin/components/SpatialFilter.jsx
// Stub component - Full implementation coming later

import React from 'react';
import { X, Map, AlertCircle } from 'lucide-react';

export default function SpatialFilter({ 
  isOpen, 
  onClose, 
  currentFilter, 
  onSave, 
  serviceUrl 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Map className="w-5 h-5" />
            Spatial Filter
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
            The Spatial Filter tool is being developed and will allow you to define geographic boundaries for your notification data.
          </p>
          
          {currentFilter && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              <strong>Current Filter:</strong> {currentFilter.type || 'None'}
            </div>
          )}
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
