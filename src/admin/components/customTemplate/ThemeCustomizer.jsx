// src/admin/components/customTemplate/ThemeCustomizer.jsx
// Component for customizing email template theme colors and typography

import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Check
} from 'lucide-react';
import {
  DEFAULT_THEME,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  HEADER_FONT_SIZE_OPTIONS,
  SUBHEADER_FONT_SIZE_OPTIONS,
  BORDER_RADIUS_OPTIONS,
  THEME_PRESETS
} from './constants';
import { validateHexColor } from './validation';

/**
 * ColorInput - A color picker with hex input
 */
function ColorInput({ value, onChange, label, description }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
    setError(null);
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e) => {
    let val = e.target.value;
    // Ensure it starts with #
    if (val && !val.startsWith('#')) {
      val = '#' + val;
    }
    setInputValue(val);

    // Validate and update if valid
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setError(null);
      onChange(val);
    } else if (val.length > 1) {
      setError('Invalid hex color');
    }
  };

  const handleColorPickerChange = (e) => {
    const newColor = e.target.value;
    setInputValue(newColor);
    setError(null);
    onChange(newColor);
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-2">
        {/* Color Swatch Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded border-2 border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
            style={{ backgroundColor: value || '#ffffff' }}
            title="Click to open color picker"
          />
          {isOpen && (
            <div
              ref={popoverRef}
              className="absolute z-50 top-full left-0 mt-1 p-3 bg-white rounded-lg shadow-lg border border-slate-200"
            >
              <input
                type="color"
                value={value || '#000000'}
                onChange={handleColorPickerChange}
                className="w-32 h-32 cursor-pointer border-0"
              />
            </div>
          )}
        </div>

        {/* Hex Input */}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="#000000"
            className={`w-full px-2 py-2 border rounded text-xs font-mono ${
              error ? 'border-red-300 bg-red-50' : 'border-slate-200'
            }`}
            maxLength={7}
          />
          {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
        </div>
      </div>
      {description && (
        <p className="text-[10px] text-slate-400">{description}</p>
      )}
    </div>
  );
}

/**
 * ThemeCustomizer Component
 *
 * Allows users to customize theme colors and typography settings
 *
 * Props:
 * @param {object} theme - Current theme configuration
 * @param {function} onChange - Called with updated theme
 * @param {function} onReset - Called to reset theme to defaults
 */
export default function ThemeCustomizer({ theme = {}, onChange, onReset }) {
  const [colorsExpanded, setColorsExpanded] = useState(true);
  const [typographyExpanded, setTypographyExpanded] = useState(true);
  const [layoutExpanded, setLayoutExpanded] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // Merge with defaults
  const currentTheme = { ...DEFAULT_THEME, ...theme };

  const updateTheme = (updates) => {
    onChange({ ...currentTheme, ...updates });
  };

  const applyPreset = (preset) => {
    onChange({ ...currentTheme, ...preset.theme });
    setShowPresets(false);
  };

  const handleReset = () => {
    if (window.confirm('Reset all theme settings to defaults?')) {
      onReset?.() || onChange(DEFAULT_THEME);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Theme
        </h4>
        <div className="flex items-center gap-2">
          {/* Presets Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
            >
              <Palette className="w-3 h-3" />
              Presets
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                {THEME_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2"
                  >
                    <div className="flex gap-0.5">
                      <div
                        className="w-3 h-3 rounded-full border border-slate-200"
                        style={{ backgroundColor: preset.theme.primaryColor }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-slate-200"
                        style={{ backgroundColor: preset.theme.secondaryColor }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-slate-200"
                        style={{ backgroundColor: preset.theme.accentColor }}
                      />
                    </div>
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            title="Reset to defaults"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Colors Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setColorsExpanded(!colorsExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <span>Colors</span>
          {colorsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {colorsExpanded && (
          <div className="p-3 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <ColorInput
                label="Primary"
                value={currentTheme.primaryColor}
                onChange={(color) => updateTheme({ primaryColor: color })}
                description="Header, buttons"
              />
              <ColorInput
                label="Secondary"
                value={currentTheme.secondaryColor}
                onChange={(color) => updateTheme({ secondaryColor: color })}
                description="Table headers"
              />
              <ColorInput
                label="Accent"
                value={currentTheme.accentColor}
                onChange={(color) => updateTheme({ accentColor: color })}
                description="Links, highlights"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ColorInput
                label="Text"
                value={currentTheme.textColor}
                onChange={(color) => updateTheme({ textColor: color })}
                description="Primary text"
              />
              <ColorInput
                label="Muted Text"
                value={currentTheme.mutedTextColor}
                onChange={(color) => updateTheme({ mutedTextColor: color })}
                description="Secondary text"
              />
              <ColorInput
                label="Border"
                value={currentTheme.borderColor}
                onChange={(color) => updateTheme({ borderColor: color })}
                description="Dividers"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ColorInput
                label="Background"
                value={currentTheme.backgroundColor}
                onChange={(color) => updateTheme({ backgroundColor: color })}
                description="Email body"
              />
            </div>
          </div>
        )}
      </div>

      {/* Typography Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setTypographyExpanded(!typographyExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <span>Typography</span>
          {typographyExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {typographyExpanded && (
          <div className="p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Font Family</label>
              <select
                value={currentTheme.fontFamily}
                onChange={(e) => updateTheme({ fontFamily: e.target.value })}
                className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
              >
                {FONT_FAMILY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Base Size</label>
                <select
                  value={currentTheme.fontSize}
                  onChange={(e) => updateTheme({ fontSize: e.target.value })}
                  className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
                >
                  {FONT_SIZE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Header Size</label>
                <select
                  value={currentTheme.headerFontSize}
                  onChange={(e) => updateTheme({ headerFontSize: e.target.value })}
                  className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
                >
                  {HEADER_FONT_SIZE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subheader Size</label>
                <select
                  value={currentTheme.subHeaderFontSize}
                  onChange={(e) => updateTheme({ subHeaderFontSize: e.target.value })}
                  className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
                >
                  {SUBHEADER_FONT_SIZE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Layout Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setLayoutExpanded(!layoutExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <span>Layout</span>
          {layoutExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {layoutExpanded && (
          <div className="p-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Border Radius</label>
              <select
                value={currentTheme.borderRadius}
                onChange={(e) => updateTheme({ borderRadius: e.target.value })}
                className="w-full px-2 py-2 border border-slate-200 rounded text-xs"
              >
                {BORDER_RADIUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Preview Swatch */}
      <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
        <p className="text-xs font-medium text-slate-500 mb-2">Preview</p>
        <div
          className="p-3 rounded"
          style={{
            backgroundColor: currentTheme.backgroundColor,
            fontFamily: currentTheme.fontFamily,
            fontSize: currentTheme.fontSize,
            borderRadius: currentTheme.borderRadius,
            border: `1px solid ${currentTheme.borderColor}`
          }}
        >
          <div
            className="p-2 mb-2 rounded"
            style={{
              backgroundColor: currentTheme.primaryColor,
              color: 'white',
              fontSize: currentTheme.headerFontSize
            }}
          >
            Header
          </div>
          <p style={{ color: currentTheme.textColor, marginBottom: '4px' }}>
            Primary text example
          </p>
          <p style={{ color: currentTheme.mutedTextColor, fontSize: '12px' }}>
            Muted text example
          </p>
          <a href="#" style={{ color: currentTheme.accentColor, fontSize: '12px' }}>
            Link example
          </a>
        </div>
      </div>
    </div>
  );
}
