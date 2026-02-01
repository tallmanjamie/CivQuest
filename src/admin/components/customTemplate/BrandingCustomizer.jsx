// src/admin/components/customTemplate/BrandingCustomizer.jsx
// Component for customizing email template logo

import React, { useState, useEffect } from 'react';
import {
  Image,
  Link as LinkIcon,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  DEFAULT_BRANDING,
  LOGO_ALIGNMENT_OPTIONS,
  LOGO_SIZE_OPTIONS
} from './constants';

/**
 * BrandingCustomizer Component (now just Logo configuration)
 *
 * Allows users to add a custom logo to their email template
 *
 * Props:
 * @param {object} branding - Current branding configuration
 * @param {function} onChange - Called with updated branding
 * @param {object} theme - Current theme (unused, kept for compatibility)
 */
export default function BrandingCustomizer({ branding = {}, onChange, theme = {} }) {
  const [logoExpanded, setLogoExpanded] = useState(true);
  const [logoError, setLogoError] = useState(null);
  const [logoValid, setLogoValid] = useState(false);

  // Merge with defaults
  const currentBranding = { ...DEFAULT_BRANDING, ...branding };

  const updateBranding = (updates) => {
    onChange({ ...currentBranding, ...updates });
  };

  // Validate logo URL
  useEffect(() => {
    if (!currentBranding.logoUrl) {
      setLogoError(null);
      setLogoValid(false);
      return;
    }

    // Basic URL validation
    try {
      const url = new URL(currentBranding.logoUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        setLogoError('URL must use http or https');
        setLogoValid(false);
        return;
      }
      setLogoError(null);
      setLogoValid(true);
    } catch {
      setLogoError('Invalid URL format');
      setLogoValid(false);
    }
  }, [currentBranding.logoUrl]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <Image className="w-4 h-4" />
          Logo
        </h4>
      </div>

      {/* Logo Configuration */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setLogoExpanded(!logoExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <span className="flex items-center gap-2">
            Custom Logo
            {logoValid && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">
                Configured
              </span>
            )}
          </span>
          {logoExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {logoExpanded && (
          <div className="p-3 space-y-3">
            {/* Logo URL Input */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Logo URL
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    value={currentBranding.logoUrl}
                    onChange={(e) => updateBranding({ logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className={`w-full pl-8 pr-3 py-2 border rounded text-xs ${
                      logoError ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                </div>
                {logoValid && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
              </div>
              {logoError && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {logoError}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Enter a URL to your logo image (PNG, JPG, or GIF recommended)
              </p>
            </div>

            {/* Logo Settings */}
            {currentBranding.logoUrl && logoValid && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Width</label>
                    <select
                      value={currentBranding.logoWidth}
                      onChange={(e) => updateBranding({ logoWidth: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
                    >
                      {LOGO_SIZE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Alignment</label>
                    <select
                      value={currentBranding.logoAlignment}
                      onChange={(e) => updateBranding({ logoAlignment: e.target.value })}
                      className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
                    >
                      {LOGO_ALIGNMENT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Logo Preview */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Preview</label>
                  <div
                    className="bg-slate-100 rounded border border-slate-200 p-4"
                    style={{
                      textAlign: currentBranding.logoAlignment
                    }}
                  >
                    <img
                      src={currentBranding.logoUrl}
                      alt="Logo preview"
                      style={{
                        maxWidth: `${currentBranding.logoWidth}px`,
                        height: 'auto',
                        display: 'inline-block'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        setLogoError('Failed to load image');
                        setLogoValid(false);
                      }}
                    />
                  </div>
                </div>

                {/* Usage hint */}
                <div className="p-2 bg-blue-50 border border-blue-100 rounded text-[10px] text-blue-700">
                  <strong>Usage:</strong> Add <code className="bg-blue-100 px-1 rounded">{'{{logoHtml}}'}</code> to your template to display the logo with these settings.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
