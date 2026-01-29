// src/atlas/components/DisclaimerPopup.jsx
// Configurable disclaimer popup for Atlas sites
// Shows on first visit, supports confirmation or "don't show again" modes
// Uses theme colors from configuration

import React, { useState, useEffect } from 'react';
import { X, Shield } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

/**
 * Cookie utilities
 */
function setCookie(name, value, days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i].trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length);
    }
  }
  return null;
}

/**
 * DisclaimerPopup Component
 *
 * @param {Object} props
 * @param {Object} props.config - Disclaimer configuration from Atlas config
 * @param {string} props.orgId - Organization ID (used for cookie naming)
 * @param {string} props.themeColor - Theme color from UI config
 * @param {Function} props.onAccept - Callback when user accepts/closes disclaimer
 */
export default function DisclaimerPopup({ config, orgId, themeColor = 'sky', onAccept }) {
  const [isChecked, setIsChecked] = useState(false);
  const [visible, setVisible] = useState(false);

  // Get theme colors
  const colors = getThemeColors(themeColor);

  // Cookie name for this organization
  const cookieName = `atlas_disclaimer_${orgId || 'default'}`;

  // Check if disclaimer should be shown
  useEffect(() => {
    if (!config?.enabled) {
      onAccept?.();
      return;
    }

    // Check if user has already dismissed with "don't show again"
    const dismissed = getCookie(cookieName);
    if (dismissed === 'dismissed') {
      onAccept?.();
      return;
    }

    // Show the disclaimer
    setVisible(true);
  }, [config, orgId, cookieName, onAccept]);

  // Handle close/accept
  const handleAccept = () => {
    if (config.confirmationType === 'confirmation' && !isChecked) {
      // Can't close without checking the box in confirmation mode
      return;
    }

    // If "don't show again" mode and checkbox is checked, set cookie
    if (config.confirmationType === 'dontShowAgain' && isChecked) {
      setCookie(cookieName, 'dismissed', 365);
    }

    setVisible(false);
    onAccept?.();
  };

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Calculate size styles
  const getSize = (value, unit) => {
    if (!value) return 'auto';
    return `${value}${unit || 'px'}`;
  };

  const width = getSize(config.width, config.widthUnit);
  const height = getSize(config.height, config.heightUnit);

  // Determine button disabled state
  const isButtonDisabled = config.confirmationType === 'confirmation' && !isChecked;

  // Default texts
  const checkboxText = config.checkboxText ||
    (config.confirmationType === 'confirmation'
      ? 'I agree to the terms and conditions'
      : "Don't show this again");
  const buttonText = config.buttonText || 'Continue';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: config.widthUnit === '%' ? width : undefined,
          maxWidth: config.widthUnit === 'px' ? width : '95vw',
          height: config.heightUnit === '%' ? height : undefined,
          maxHeight: config.heightUnit === 'px' ? height : '90vh',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3 text-white flex-shrink-0"
          style={{ backgroundColor: colors.bg700 }}
        >
          <Shield className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Important Notice</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {config.contentMode === 'embed' && config.embedUrl ? (
            <iframe
              src={config.embedUrl}
              title="Disclaimer"
              className="w-full h-full border-0"
              style={{ minHeight: '200px' }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div
              className="p-5 prose prose-slate max-w-none"
              style={{
                '--tw-prose-headings': colors.text700,
                '--tw-prose-links': colors.text600,
              }}
              dangerouslySetInnerHTML={{
                __html: config.htmlContent || '<p>No disclaimer content configured.</p>'
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0">
          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 focus:ring-2 focus:ring-offset-0"
              style={{
                accentColor: colors.bg600,
              }}
            />
            <span className="text-sm text-slate-700 leading-tight">
              {checkboxText}
            </span>
          </label>

          {/* Button */}
          <button
            onClick={handleAccept}
            disabled={isButtonDisabled}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all ${
              isButtonDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:opacity-90 active:scale-[0.98]'
            }`}
            style={{
              backgroundColor: isButtonDisabled ? colors.bg400 : colors.bg600
            }}
          >
            {buttonText}
          </button>

          {/* Helper text for confirmation mode */}
          {config.confirmationType === 'confirmation' && !isChecked && (
            <p className="text-xs text-slate-500 text-center mt-2">
              Please check the box above to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
