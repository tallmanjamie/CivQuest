// src/shared/components/LoadingSpinner.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ 
  message = null, 
  fullScreen = false,
  size = 'md' 
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className={`animate-spin text-[#004E7C] ${sizeClasses[size]}`} />
      {message && (
        <p className="text-slate-600 text-sm">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="h-screen flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
