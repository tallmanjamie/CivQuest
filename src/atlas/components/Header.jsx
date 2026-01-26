// src/atlas/components/Header.jsx
// CivQuest Atlas - Header Component
// Application header with branding and user menu (mode switcher moved to SearchToolbar)

import React, { useState } from 'react';
import { 
  Menu, 
  LogIn, 
  LogOut,
  ChevronDown,
  User,
  Settings
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

/**
 * Header Component
 * Displays branding, map selector, and user menu
 */
export default function Header({ 
  config, 
  mode, 
  onModeChange, 
  enabledModes, 
  onMenuToggle,
  showMobileMenu 
}) {
  const { 
    arcgisUser, 
    isAuthenticated, 
    signIn, 
    signOut,
    activeMap,
    availableMaps,
    setActiveMap
  } = useAtlas();

  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const themeColor = config?.ui?.themeColor || 'sky';
  const headerClass = config?.ui?.headerClass || `bg-${themeColor}-700`;

  return (
    <header className={`${headerClass} text-white p-2 shadow-lg z-30 sticky top-0 flex-shrink-0`}>
      <div className="w-full flex justify-between items-center">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-2 overflow-hidden">
          {config?.ui?.logoLeft && (
            <img 
              src={config.ui.logoLeft} 
              alt="Logo" 
              className="w-7 h-7 md:w-10 md:h-10 object-contain bg-white rounded-full p-0.5 flex-shrink-0"
            />
          )}
          <div className="truncate">
            <h1 className="text-sm md:text-xl font-bold leading-tight truncate">
              {config?.ui?.headerTitle || 'CivQuest Atlas'}
            </h1>
            <span className="text-[10px] md:text-sm opacity-90 block md:inline">
              {config?.ui?.headerSubtitle || ''}
            </span>
          </div>
        </div>

        {/* Right: Map Picker & User Menu (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Map Picker (if multiple maps available) */}
          {availableMaps?.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition"
              >
                <span className="truncate max-w-[150px]">{activeMap?.name || 'Select Map'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showMapPicker ? 'rotate-180' : ''}`} />
              </button>
              
              {showMapPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMapPicker(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 max-h-80 overflow-y-auto">
                    {availableMaps.map((map, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setActiveMap(idx); setShowMapPicker(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 ${
                          activeMap?.name === map.name 
                            ? `bg-${themeColor}-50 text-${themeColor}-700 font-medium`
                            : 'text-slate-700'
                        }`}
                      >
                        {map.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* User Menu */}
          <div className="relative">
            {isAuthenticated && arcgisUser ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition"
                >
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                    {arcgisUser.thumbnailUrl ? (
                      <img src={arcgisUser.thumbnailUrl} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-sm font-medium hidden lg:inline truncate max-w-[100px]">
                    {arcgisUser.fullName || arcgisUser.username}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-800">{arcgisUser.fullName || arcgisUser.username}</p>
                        <p className="text-xs text-slate-500 truncate">{arcgisUser.email}</p>
                      </div>
                      <button
                        onClick={() => { signOut(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                onClick={signIn}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden lg:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 hover:bg-white/20 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
