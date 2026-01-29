// src/atlas/components/EagleViewModal.jsx
// Modal component for displaying EagleView imagery embedded within Atlas
// Opens as a centered popup window on top of the map

import React, { useEffect, useRef } from 'react';
import { X, Eye, Maximize2, Minimize2 } from 'lucide-react';

/**
 * EagleViewModal Component
 *
 * Displays the EagleView viewer in an embedded iframe modal centered on the map.
 * Supports configurable width/height in pixels or percentage.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {string} props.url - The EagleView URL to load in the iframe
 * @param {string} props.title - Feature title to display in header
 * @param {string} props.themeColor - Theme color for the header
 * @param {Object} props.windowConfig - Window size configuration
 * @param {number} props.windowConfig.width - Window width value
 * @param {string} props.windowConfig.widthUnit - Width unit ('px' or '%')
 * @param {number} props.windowConfig.height - Window height value
 * @param {string} props.windowConfig.heightUnit - Height unit ('px' or '%')
 */
export default function EagleViewModal({
  isOpen,
  onClose,
  url,
  title = 'EagleView',
  themeColor = '#0ea5e9',
  windowConfig = {}
}) {
  const iframeRef = useRef(null);
  const [isMaximized, setIsMaximized] = React.useState(false);

  // Default window configuration
  const {
    width = 80,
    widthUnit = '%',
    height = 80,
    heightUnit = '%'
  } = windowConfig;

  // Calculate dimensions
  const getWidth = () => {
    if (isMaximized) return '100vw';
    return widthUnit === '%' ? `${width}vw` : `${width}px`;
  };

  const getHeight = () => {
    if (isMaximized) return '100vh';
    return heightUnit === '%' ? `${height}vh` : `${height}px`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          isMaximized ? 'rounded-none' : ''
        }`}
        style={{
          width: getWidth(),
          height: getHeight(),
          maxWidth: isMaximized ? '100vw' : '95vw',
          maxHeight: isMaximized ? '100vh' : '95vh',
          minWidth: '400px',
          minHeight: '300px'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base font-semibold text-white truncate max-w-md">
                {title}
              </h2>
              <p className="text-xs text-white/70">EagleView Aerial Imagery</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Maximize/Minimize Button */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="w-5 h-5 text-white" />
              ) : (
                <Maximize2 className="w-5 h-5 text-white" />
              )}
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Iframe Content */}
        <div className="flex-1 relative bg-slate-100">
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            title="EagleView Viewer"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
}
