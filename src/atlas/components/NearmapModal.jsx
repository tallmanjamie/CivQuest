// src/atlas/components/NearmapModal.jsx
// Modal component for displaying Nearmap imagery embedded within Atlas
// Opens as a centered popup window on top of the map
// Supports configurable width/height in pixels or percentage of screen

import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { ensureHttps } from '../../shared/utils/urlSecurity';

/**
 * NearmapModal Component
 *
 * Displays the Nearmap viewer in an embedded iframe modal centered on the map.
 * Supports configurable width/height in pixels or percentage of screen.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {string} props.url - The Nearmap URL to load in the iframe
 * @param {string} props.title - Feature title to display in header
 * @param {string} props.themeColor - Theme color for the header
 * @param {Object} props.windowConfig - Window size configuration
 * @param {number} props.windowConfig.width - Window width value
 * @param {string} props.windowConfig.widthUnit - Width unit ('px' or '%')
 * @param {number} props.windowConfig.height - Window height value
 * @param {string} props.windowConfig.heightUnit - Height unit ('px' or '%')
 */
export default function NearmapModal({
  isOpen,
  onClose,
  url,
  title = 'Nearmap',
  themeColor = '#0ea5e9',
  windowConfig = {}
}) {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fixedDimensions, setFixedDimensions] = useState(null);

  // Default window configuration
  const {
    width = 80,
    widthUnit = '%',
    height = 80,
    heightUnit = '%'
  } = windowConfig;

  // Calculate and fix dimensions when modal opens (not responsive to browser resize)
  useEffect(() => {
    if (isOpen && !fixedDimensions) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate pixel dimensions based on config
      const calculatedWidth = widthUnit === '%'
        ? Math.round((width / 100) * viewportWidth) + 20
        : width + 20;
      const calculatedHeight = heightUnit === '%'
        ? Math.round((height / 100) * viewportHeight) + 40
        : height + 40;

      // Apply constraints
      const maxWidth = Math.round(viewportWidth * 0.92);
      const maxHeight = Math.round(viewportHeight * 0.92);
      const minWidth = 400;
      const minHeight = 300;

      setFixedDimensions({
        width: Math.max(minWidth, Math.min(calculatedWidth, maxWidth)),
        height: Math.max(minHeight, Math.min(calculatedHeight, maxHeight))
      });
    }
  }, [isOpen, fixedDimensions, width, widthUnit, height, heightUnit]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(true);
      setFixedDimensions(null);
    }
  }, [isOpen]);

  // Handle iframe load completion
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !fixedDimensions) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - fixed pixel dimensions calculated on open */}
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          width: `${fixedDimensions.width}px`,
          height: `${fixedDimensions.height}px`
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base font-semibold text-white truncate max-w-md">
                {title}
              </h2>
              <p className="text-xs text-white/70">Nearmap Aerial Imagery</p>
            </div>
          </div>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Iframe Content */}
        <div className="flex-1 relative bg-slate-100">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
                <p className="text-sm text-slate-600">Loading Nearmap...</p>
              </div>
            </div>
          )}
          {/* Ensure HTTPS to prevent mixed content warnings */}
          <iframe
            ref={iframeRef}
            src={ensureHttps(url)}
            className="w-full h-full border-0"
            title="Nearmap Viewer"
            allow="fullscreen"
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
}
