// src/shared/components/Header.jsx
import React from 'react';
import { LogOut, Shield } from 'lucide-react';

export default function Header({ 
  title = 'CivQuest', 
  subtitle = null,
  user = null, 
  onSignOut = null,
  rightContent = null,
  showLogo = true,
  variant = 'default' // 'default' | 'admin'
}) {
  // Admin variant has darker header
  if (variant === 'admin') {
    return (
      <header className="bg-[#002A4D] text-white px-6 py-4 flex items-center justify-between shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-white" />
          <h1 className="font-bold text-xl tracking-tight">{title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {rightContent}
          
          {user && (
            <div className="flex items-center gap-4 border-l border-[#004E7C] pl-6">
              <span className="text-xs text-slate-300">{user.email}</span>
              {onSignOut && (
                <button onClick={onSignOut} className="text-slate-300 hover:text-white">
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>
    );
  }

  // Default variant
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {showLogo && (
          <img 
            src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg" 
            alt="CivQuest Logo"
            className="h-10 w-auto object-contain rounded-sm"
          />
        )}
        <div>
          <h1 className="font-bold text-xl tracking-tight text-[#004E7C]">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {rightContent}
        
        {user && (
          <>
            <span className="text-sm text-slate-500 hidden sm:inline">{user.email}</span>
            {onSignOut && (
              <button 
                onClick={onSignOut}
                className="text-sm font-medium text-slate-600 hover:text-red-600 flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
