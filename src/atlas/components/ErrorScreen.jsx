// src/atlas/components/ErrorScreen.jsx
// Error screen component

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorScreen({ 
  title = 'Error', 
  message = 'An error occurred', 
  action = null 
}) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">{title}</h1>
        <p className="text-slate-600 mb-6">{message}</p>
        
        {action || (
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
