// src/atlas/components/Header.jsx
// CivQuest Atlas - Header Component
// Application header with mode switcher and navigation

import React, { useState } from 'react';
import { 
  Map, 
  Table2, 
  MessageSquare, 
  Menu, 
  LogIn, 
  LogOut,
  ChevronDown,
  User
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

// Mode configuration
const MODES = {
  chat: { id: 'chat', label: 'Chat', icon: MessageSquare },
  map: { id: 'map', label: 'Map', icon: Map },
  table: { id: 'table', label: 'Table', icon: Table2 }
};

/**
 * Header Component
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

        {/* Center: Mode Switcher (Desktop) */}
        <div className="hidden md:flex items-center bg-white/10 rounded-full p-1">
          {Object.values(MODES)
            .filter(m => enabledModes.includes(m.id))
            .map(m => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onModeChange(m.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{m.label}</span>
                </button>
              );
            })
          }
        </div>

        {/* Right: Map Picker, Auth, Menu */}
        <div className="flex items-center gap-2">
          {/* Map Picker (if multiple maps) */}
          {availableMaps.length > 1 && (
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="flex items-center gap-1 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition"
              >
                <span className="max-w-[120px] truncate">{activeMap?.name || 'Select Map'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showMapPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowMapPicker(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                    {availableMaps.map((map, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setActiveMap(index);
                          setShowMapPicker(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 ${
                          index === activeMap?.index ? `text-${themeColor}-700 bg-${themeColor}-50` : 'text-slate-700'
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

          {/* Auth Button (Desktop) */}
          <button
            onClick={isAuthenticated ? signOut : signIn}
            className="hidden md:flex items-center gap-2 text-sm hover:bg-white/10 px-3 py-1.5 rounded-full transition"
          >
            {isAuthenticated ? (
              <>
                <span className="opacity-80 max-w-[100px] truncate">
                  {arcgisUser?.fullName || arcgisUser?.username}
                </span>
                <LogOut className="w-4 h-4" />
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            )}
          </button>

          {/* Right Logo */}
          {config?.ui?.logoRight && (
            <a 
              href={config.ui.rightLink || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:block"
            >
              <img 
                src={config.ui.logoRight} 
                alt="Partner Logo" 
                className="w-7 h-7 md:w-10 md:h-10 object-contain bg-white rounded-full hover:opacity-90 transition-opacity"
              />
            </a>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 hover:bg-white/10 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Mode Switcher (Below Header) */}
      <div className="md:hidden mt-2 flex justify-center">
        <div className="flex items-center bg-white/10 rounded-full p-1">
          {Object.values(MODES)
            .filter(m => enabledModes.includes(m.id))
            .map(m => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onModeChange(m.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-white/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })
          }
        </div>
      </div>
    </header>
  );
}
