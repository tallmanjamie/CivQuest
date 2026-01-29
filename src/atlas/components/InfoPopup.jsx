// src/atlas/components/InfoPopup.jsx
// Info popup modal that displays organization information with logo and links
// Opens when user clicks the info button in the header

import React from 'react';
import { X } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

/**
 * InfoPopup Component
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

  // Get organization title for header
  const title = config?.ui?.headerTitle || 'Information';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: colors.bg700 }}
        >
          <h2 className="text-lg font-semibold text-white">
            Welcome to the
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 flex flex-col items-center gap-6">
          {/* Title/Text at top */}
          {infoConfig?.text && (
            <h3 className="text-xl font-bold text-slate-800 text-center">
              {infoConfig.text}
            </h3>
          )}

          {/* Logo in the middle */}
          {infoConfig?.logo && (
            <div className="flex justify-center">
              <img
                src={infoConfig.logo}
                alt="Organization Logo"
                className="max-w-[200px] max-h-[200px] object-contain"
              />
            </div>
          )}

          {/* Buttons at the bottom */}
          {infoConfig?.buttons?.length > 0 && (
            <div className="w-full flex flex-col gap-3 mt-2">
              {infoConfig.buttons.map((button, index) => (
                <a
                  key={index}
                  href={button.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-6 py-3 text-white text-center font-medium rounded-lg transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
                  style={{ backgroundColor: colors.bg700 }}
                >
                  {button.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
