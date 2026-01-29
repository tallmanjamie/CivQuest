// src/atlas/components/Header.jsx
// CivQuest Atlas - Header Component
// Application header with branding and user menu
//
// CHANGES:
// - Removed map picker dropdown (moved to MapView top-left controls)
// - Header now only contains branding and user menu
// - Uses themeColors utility for proper dynamic theming
// - Added account settings option in user menu

import React, { useState } from 'react';
import {
  Menu,
  LogIn,
  LogOut,
  ChevronDown,
  User,
  Settings,
  Info
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';
import InfoPopup from './InfoPopup';

/**
 * Header Component
 * Displays branding and user menu
 * Map picker has been moved to MapView component (top-left corner of map)
 */
export default function Header({
  config,
  mode,
  onModeChange,
  enabledModes,
  onMenuToggle,
  showMobileMenu,
  onOpenSettings
}) {
  const {
    user,
    userData,
    signOut,
    activeMap
  } = useAtlas();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  // Get theme colors from utility - this properly handles dynamic colors
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Get full display name from user data - prefer firstName/lastName, then arcgisProfile.fullName, then email
  const getDisplayName = () => {
    if (userData?.firstName || userData?.lastName) {
      return [userData.firstName, userData.lastName].filter(Boolean).join(' ');
    }
    return userData?.arcgisProfile?.fullName || user?.email || 'User';
  };
  const displayName = getDisplayName();

  // Get first name only for the dropdown button
  const getFirstName = () => {
    if (userData?.firstName) {
      return userData.firstName;
    }
    if (userData?.arcgisProfile?.fullName) {
      return userData.arcgisProfile.fullName.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };
  const firstName = getFirstName();
  const displayEmail = user?.email || '';

  return (
    <header
      className="text-white p-2 shadow-lg z-30 sticky top-0 flex-shrink-0"
      style={{ backgroundColor: colors.bg700 }}
    >
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
            {config?.ui?.headerSubtitle && (
              <span className="text-[10px] md:text-sm opacity-90 block md:inline">
                {config.ui.headerSubtitle}
              </span>
            )}
          </div>
        </div>

        {/* Right: Links, Info Button, and User Menu (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Header Links */}
          {config?.ui?.links?.enabled && config?.ui?.links?.items?.length > 0 && (
            <div className={
              config.ui.links.layout === 'stacked'
                ? "flex flex-col items-end gap-0.5"
                : "flex items-center gap-4"
            }>
              {config.ui.links.items.slice(0, 4).map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    config.ui.links.layout === 'stacked'
                      ? "text-xs text-white/90 hover:text-white hover:underline transition whitespace-nowrap leading-tight"
                      : "text-sm text-white/90 hover:text-white hover:underline transition whitespace-nowrap"
                  }
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {/* Info Button with Dropdown */}
          {config?.ui?.info?.enabled && (
            <div className="relative">
              <button
                onClick={() => setShowInfoPopup(!showInfoPopup)}
                className="p-1.5 bg-white rounded-full shadow-sm hover:shadow-md hover:scale-105 transition-all"
                title="Information"
              >
                <Info className="w-5 h-5" style={{ color: colors.bg700 }} />
              </button>
              <InfoPopup
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                config={config}
              />
            </div>
          )}

          {/* User Menu */}
          <div className="relative">
            {user ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition"
                >
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium hidden lg:inline truncate max-w-[180px]">
                    {firstName}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{displayEmail}</p>
                      </div>
                      <button
                        onClick={() => { onOpenSettings?.(); setShowUserMenu(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => { signOut(); setShowUserMenu(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <span className="text-sm text-white/70">Not signed in</span>
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
