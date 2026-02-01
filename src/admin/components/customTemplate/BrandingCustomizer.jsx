// src/admin/components/customTemplate/BrandingCustomizer.jsx
// Component for customizing email template branding (logo and icons)

import React, { useState, useEffect } from 'react';
import {
  Image,
  Link as LinkIcon,
  AlertCircle,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  Grid,
  X
} from 'lucide-react';
import {
  DEFAULT_BRANDING,
  LOGO_ALIGNMENT_OPTIONS,
  LOGO_SIZE_OPTIONS,
  DASHBOARD_ICONS,
  ICON_CATEGORIES,
  ICON_SIZE_OPTIONS
} from './constants';

/**
 * IconPicker - Modal for selecting and customizing icons
 */
function IconPicker({ onSelect, onClose, theme = {} }) {
  const [category, setCategory] = useState('all');
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [iconSize, setIconSize] = useState('24');
  const [iconColor, setIconColor] = useState(theme.primaryColor || '#004E7C');
  const [copied, setCopied] = useState(false);

  const filteredIcons = category === 'all'
    ? DASHBOARD_ICONS
    : DASHBOARD_ICONS.filter(icon => icon.category === category);

  const generateIconHtml = (icon) => {
    if (!icon) return '';
    // Replace currentColor with the selected color and adjust size
    let svg = icon.svg
      .replace(/width="24"/g, `width="${iconSize}"`)
      .replace(/height="24"/g, `height="${iconSize}"`)
      .replace(/stroke="currentColor"/g, `stroke="${iconColor}"`);
    return svg;
  };

  const handleCopy = () => {
    if (!selectedIcon) return;
    const html = generateIconHtml(selectedIcon);
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!selectedIcon) return;
    const html = generateIconHtml(selectedIcon);
    onSelect(html);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Grid className="w-5 h-5 text-[#004E7C]" />
            Insert Icon
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          {/* Icon Grid */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Category Filter */}
            <div className="p-3 border-b bg-slate-50">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
              >
                {ICON_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Icons */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-6 gap-2">
                {filteredIcons.map(icon => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      selectedIcon?.id === icon.id
                        ? 'border-[#004E7C] bg-[#004E7C]/5'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    title={icon.name}
                  >
                    <span
                      dangerouslySetInnerHTML={{
                        __html: icon.svg.replace('stroke="currentColor"', `stroke="${iconColor}"`)
                      }}
                    />
                    <span className="text-[10px] text-slate-500 truncate w-full text-center">
                      {icon.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Customization Panel */}
          <div className="w-56 border-l bg-slate-50 p-4 flex flex-col gap-4 shrink-0">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Size</label>
              <select
                value={iconSize}
                onChange={(e) => setIconSize(e.target.value)}
                className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
              >
                {ICON_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={iconColor}
                  onChange={(e) => setIconColor(e.target.value)}
                  className="flex-1 px-2 py-2 border border-slate-200 rounded text-xs font-mono"
                  maxLength={7}
                />
              </div>
              <div className="flex gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => setIconColor(theme.primaryColor || '#004E7C')}
                  className="px-2 py-1 text-[10px] bg-slate-200 hover:bg-slate-300 rounded"
                >
                  Primary
                </button>
                <button
                  type="button"
                  onClick={() => setIconColor(theme.accentColor || '#0077B6')}
                  className="px-2 py-1 text-[10px] bg-slate-200 hover:bg-slate-300 rounded"
                >
                  Accent
                </button>
              </div>
            </div>

            {/* Preview */}
            {selectedIcon && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-2">Preview</label>
                <div className="bg-white rounded border border-slate-200 p-4 flex items-center justify-center min-h-[80px]">
                  <span
                    dangerouslySetInnerHTML={{ __html: generateIconHtml(selectedIcon) }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!selectedIcon}
            className="px-3 py-2 text-xs border border-slate-200 rounded hover:bg-white flex items-center gap-1.5 disabled:opacity-50"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy HTML'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={!selectedIcon}
              className="px-4 py-2 bg-[#004E7C] text-white rounded text-sm font-medium disabled:opacity-50"
            >
              Insert Icon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * BrandingCustomizer Component
 *
 * Allows users to add a custom logo and access dashboard icons
 *
 * Props:
 * @param {object} branding - Current branding configuration
 * @param {function} onChange - Called with updated branding
 * @param {object} theme - Current theme for icon color defaults
 * @param {function} onInsertIcon - Called when user wants to insert an icon into the template
 */
export default function BrandingCustomizer({ branding = {}, onChange, theme = {}, onInsertIcon }) {
  const [logoExpanded, setLogoExpanded] = useState(true);
  const [iconsExpanded, setIconsExpanded] = useState(true);
  const [showIconPicker, setShowIconPicker] = useState(false);
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

  const handleIconSelect = (iconHtml) => {
    onInsertIcon?.(iconHtml);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <Image className="w-4 h-4" />
          Branding
        </h4>
      </div>

      {/* Logo Section */}
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

      {/* Icons Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIconsExpanded(!iconsExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <span>Dashboard Icons</span>
          {iconsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {iconsExpanded && (
          <div className="p-3 space-y-3">
            <p className="text-xs text-slate-500">
              Add visual icons to your email template to highlight statistics or sections.
            </p>

            {/* Quick icon preview grid */}
            <div className="grid grid-cols-10 gap-1">
              {DASHBOARD_ICONS.slice(0, 10).map(icon => (
                <div
                  key={icon.id}
                  className="p-2 bg-slate-50 rounded flex items-center justify-center"
                  title={icon.name}
                >
                  <span
                    dangerouslySetInnerHTML={{
                      __html: icon.svg
                        .replace(/width="24"/g, 'width="16"')
                        .replace(/height="24"/g, 'height="16"')
                        .replace('stroke="currentColor"', `stroke="${theme.primaryColor || '#004E7C'}"`)
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Open Icon Picker Button */}
            <button
              type="button"
              onClick={() => setShowIconPicker(true)}
              className="w-full px-3 py-2 bg-[#004E7C] text-white rounded text-xs font-medium hover:bg-[#003d61] flex items-center justify-center gap-2"
            >
              <Grid className="w-4 h-4" />
              Browse All Icons ({DASHBOARD_ICONS.length})
            </button>

            <p className="text-[10px] text-slate-400">
              Select an icon, customize its size and color, then copy the HTML code to paste into your template.
            </p>
          </div>
        )}
      </div>

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <IconPicker
          onSelect={handleIconSelect}
          onClose={() => setShowIconPicker(false)}
          theme={theme}
        />
      )}
    </div>
  );
}
