// src/atlas/components/DisclaimerPopup.jsx
// Configurable disclaimer popup that displays on site load
// Supports HTML content or embedded iframe, with two confirmation modes:
// - confirmation: Checkbox must be checked before continuing
// - dontShowAgain: Optional checkbox to skip future displays (uses cookie)

import React, { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';
import { ensureHttps } from '../../shared/utils/urlSecurity';

/**
 * Cookie utility functions
 */
function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length);
    }
  }
  return null;
}

/**
 * DisclaimerPopup Component
 * @param {Object} props
 * @param {Object} props.config - Full atlas config with disclaimer settings
 * @param {string} props.orgId - Organization ID for cookie naming
 * @param {Function} props.onAccept - Callback when user accepts/closes disclaimer
 */
export default function DisclaimerPopup({ config, orgId, onAccept }) {
  const [isChecked, setIsChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const disclaimer = config?.disclaimer;
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Cookie name for "don't show again" preference
  const cookieName = `atlas_disclaimer_dismissed_${orgId}`;

  // Check if disclaimer was previously dismissed
  useEffect(() => {
    if (disclaimer?.confirmationType === 'dontShowAgain') {
      const dismissed = getCookie(cookieName);
      if (dismissed === 'true') {
        setIsVisible(false);
        onAccept?.();
      }
    }
  }, [disclaimer?.confirmationType, cookieName, onAccept]);

  // Don't render if not enabled or already dismissed
  if (!disclaimer?.enabled || !isVisible) {
    return null;
  }

  // Calculate dimensions
  const width = `${disclaimer.width || 600}${disclaimer.widthUnit || 'px'}`;
  const height = `${disclaimer.height || 400}${disclaimer.heightUnit || 'px'}`;

  // Determine if button should be enabled
  const isConfirmationMode = disclaimer.confirmationType === 'confirmation';
  const isButtonEnabled = isConfirmationMode ? isChecked : true;

  // Handle accept/continue click
  const handleAccept = () => {
    if (!isButtonEnabled) return;

    // For "don't show again" mode, set cookie if checkbox is checked
    if (disclaimer.confirmationType === 'dontShowAgain' && isChecked) {
      setCookie(cookieName, 'true', 365); // 1 year
    }

    setIsVisible(false);
    onAccept?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width,
          height,
          maxWidth: '95vw',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: colors.bg700 }}
        >
          <Shield className="w-6 h-6 text-white" />
          <h2 className="text-lg font-semibold text-white flex-1">
            {disclaimer.title || 'Notice'}
          </h2>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {disclaimer.contentMode === 'embed' && disclaimer.embedUrl ? (
            // Embedded iframe mode - ensure HTTPS to prevent mixed content warnings
            <iframe
              src={ensureHttps(disclaimer.embedUrl)}
              className="w-full h-full border-0"
              title="Disclaimer Content"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : disclaimer.contentMode === 'richText' ? (
            // Rich text content mode (WYSIWYG editor output)
            <div
              className="p-5 prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{
                __html: disclaimer.richTextContent || '<p>No disclaimer content configured.</p>'
              }}
            />
          ) : (
            // HTML content mode
            <div
              className="p-5 prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{
                __html: disclaimer.htmlContent || '<p>No disclaimer content configured.</p>'
              }}
            />
          )}
        </div>

        {/* Footer with checkbox and button */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Checkbox */}
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 focus:ring-2 focus:ring-offset-0"
                style={{
                  accentColor: colors.bg600,
                  '--tw-ring-color': colors.bg500
                }}
              />
              <span className="text-sm text-slate-700">
                {disclaimer.checkboxText || (
                  isConfirmationMode
                    ? 'I agree to the terms and conditions'
                    : "Don't show this again"
                )}
              </span>
            </label>

            {/* Continue Button */}
            <button
              onClick={handleAccept}
              disabled={!isButtonEnabled}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                isButtonEnabled
                  ? 'text-white shadow-sm hover:shadow-md active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              style={isButtonEnabled ? { backgroundColor: colors.bg600 } : {}}
            >
              {disclaimer.buttonText || 'Continue'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
