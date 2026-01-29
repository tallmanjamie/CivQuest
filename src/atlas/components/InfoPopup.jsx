// src/atlas/components/InfoPopup.jsx
// Info popup dropdown that displays organization information with logo and links
// Opens when user clicks the info button in the header
// Positioned directly below the info button as a compact dropdown

import React from 'react';
import { X } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

/**
 * InfoPopup Component - Compact dropdown positioned below info button
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the popup is visible
 * @param {Function} props.onClose - Callback to close the popup
 * @param {Object} props.config - Full atlas config with info settings
 */
export default function InfoPopup({ isOpen, onClose, config }) {
  if (!isOpen) return null;

  const infoConfig = config?.ui?.info;
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  return (
    <>
      {/* Backdrop to close when clicking outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown popup positioned below the button */}
      <div
        className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ backgroundColor: colors.bg700 }}
        >
          <h2 className="text-sm font-semibold text-white">
            {infoConfig?.headerText || 'Welcome!'}
          </h2>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-white/20 rounded transition"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-3 flex flex-col items-center gap-3">
          {/* Title/Text at top */}
          {infoConfig?.text && (
            <h3 className="text-sm font-bold text-slate-800 text-center">
              {infoConfig.text}
            </h3>
          )}

          {/* Logo in the middle */}
          {infoConfig?.logo && (
            <div className="flex justify-center">
              <img
                src={infoConfig.logo}
                alt="Organization Logo"
                className="max-w-[120px] max-h-[80px] object-contain"
              />
            </div>
          )}

          {/* Buttons at the bottom */}
          {infoConfig?.buttons?.length > 0 && (
            <div className="w-full flex flex-col gap-1.5">
              {infoConfig.buttons.map((button, index) => (
                <a
                  key={index}
                  href={button.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-3 py-1.5 text-white text-center text-sm font-medium rounded transition-all hover:opacity-90"
                  style={{ backgroundColor: colors.bg700 }}
                >
                  {button.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
