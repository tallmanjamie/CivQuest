// src/atlas/components/PreviewBanner.jsx
// Banner shown when Atlas is in draft preview mode
// Indicates to admin that they're viewing unpublished changes

import React from 'react';
import { Eye, X, ArrowLeft } from 'lucide-react';

/**
 * PreviewBanner Component
 * Displays a fixed banner at the top of the screen when viewing draft preview
 * 
 * @param {function} onClose - Optional callback to close preview (navigate away)
 * @param {string} orgId - Organization ID being previewed
 */
export default function PreviewBanner({ onClose, orgId }) {
  const handleBackToAdmin = () => {
    // Navigate back to admin panel
    if (onClose) {
      onClose();
    } else {
      // Default: navigate to admin with atlas section
      window.location.href = '/admin';
    }
  };

  const handleViewLive = () => {
    // Remove preview=draft param and reload
    const url = new URL(window.location.href);
    url.searchParams.delete('preview');
    window.location.href = url.toString();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* Left: Preview indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-600/30 px-3 py-1 rounded-full">
            <Eye className="w-4 h-4" />
            <span className="font-semibold text-sm">DRAFT PREVIEW</span>
          </div>
          <span className="text-sm">
            You are viewing unpublished changes for <strong>{orgId}</strong>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleViewLive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            View Live
          </button>
          <button
            onClick={handleBackToAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to add padding to body when preview banner is shown
 * Call this in AtlasApp when isPreviewMode is true
 */
export function usePreviewBannerPadding(isPreviewMode) {
  React.useEffect(() => {
    if (isPreviewMode) {
      // Add padding to body to account for fixed banner
      document.body.style.paddingTop = '48px';
      return () => {
        document.body.style.paddingTop = '';
      };
    }
  }, [isPreviewMode]);
}
