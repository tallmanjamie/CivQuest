// src/atlas/components/MapExportTool.jsx
// CivQuest Atlas - Map Export Tool Component
// Expandable panel for exporting map images/PDFs
//
// STUB - To be implemented
// Planned features:
// - Export current map view as PNG/JPG
// - Export as PDF with title/legend
// - Print functionality
// - Custom extent selection

import React from 'react';
import {
  Download,
  ChevronDown,
  X,
  Image,
  FileText,
  Printer
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

/**
 * MapExportTool Component (STUB)
 * Provides map export functionality
 */
export default function MapExportTool({
  view,
  config,
  isExpanded = false,
  onToggle,
  className = ''
}) {
  const { config: atlasConfig } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Collapsed button
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg 
                   hover:bg-slate-50 transition text-sm font-medium text-slate-700 
                   min-w-[140px] ${className}`}
        title="Export Map"
      >
        <Download className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-left">Export</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  // Expanded panel (stub)
  return (
    <div
      className={`w-64 bg-white rounded-lg shadow-xl border border-slate-200 
                 flex flex-col ${className}`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4" style={{ color: colors.text600 }} />
          <span className="text-sm font-semibold text-slate-700">Export Map</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-white/50 rounded transition"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Content - Stub */}
      <div className="p-4 space-y-3">
        {/* Export as Image */}
        <button
          disabled
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 
                     bg-slate-50 text-slate-400 cursor-not-allowed"
        >
          <Image className="w-5 h-5" />
          <div className="text-left">
            <p className="text-sm font-medium">Export as Image</p>
            <p className="text-xs">PNG or JPG format</p>
          </div>
        </button>

        {/* Export as PDF */}
        <button
          disabled
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 
                     bg-slate-50 text-slate-400 cursor-not-allowed"
        >
          <FileText className="w-5 h-5" />
          <div className="text-left">
            <p className="text-sm font-medium">Export as PDF</p>
            <p className="text-xs">With title and legend</p>
          </div>
        </button>

        {/* Print */}
        <button
          disabled
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 
                     bg-slate-50 text-slate-400 cursor-not-allowed"
        >
          <Printer className="w-5 h-5" />
          <div className="text-left">
            <p className="text-sm font-medium">Print</p>
            <p className="text-xs">Send to printer</p>
          </div>
        </button>

        {/* Coming Soon Notice */}
        <div className="text-center pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            Export features coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
