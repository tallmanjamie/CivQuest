// src/atlas/components/LoadingScreen.jsx
// Loading screen component

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-sky-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">{message}</p>
      </div>
    </div>
  );
}
