// src/atlas/components/FeatureInfoPanel.jsx
// CivQuest Atlas - Feature Info Panel Component
// Responsive panel: left side on desktop, bottom sheet on mobile
// Tabbed interface for feature attributes and markup tools
//
// Migrated from legacy popup.js functionality

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  FileText,
  MapPin,
  Target,
  Maximize2,
  Download,
  Pencil,
  Layers,
  ChevronDown,
  ChevronUp,
  GripHorizontal
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import Feature from '@arcgis/core/widgets/Feature';

/**
 * FeatureInfoPanel Component
 * Displays feature information in a responsive panel
 * - Desktop: Left side panel (320px width)
 * - Mobile: Bottom sheet (draggable)
 */
export default function FeatureInfoPanel({
  feature,
  view,
  onClose,
  onSaveAsMarkup,
  onExportPDF,
  onZoomTo,
  relatedFeatures = [],
  currentRelatedIndex = 0,
  onNavigateRelated,
  isMarkupFeature = false
}) {
  const { config } = useAtlas();
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTab, setActiveTab] = useState('info');
  const [isMobile, setIsMobile] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(true);
  const [dragStartY, setDragStartY] = useState(null);
  const [panelHeight, setPanelHeight] = useState(300);

  // Refs
  const featureWidgetRef = useRef(null);
  const featureContainerRef = useRef(null);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Feature widget when feature changes
  useEffect(() => {
    if (!feature || !view || !featureContainerRef.current) return;

    // Clear previous widget
    if (featureWidgetRef.current) {
      featureWidgetRef.current.destroy();
      featureWidgetRef.current = null;
    }

    // Create new Feature widget
    try {
      const widget = new Feature({
        graphic: feature,
        view: view,
        container: featureContainerRef.current,
        defaultPopupTemplateEnabled: true
      });
      featureWidgetRef.current = widget;
    } catch (err) {
      console.error('[FeatureInfoPanel] Error creating Feature widget:', err);
    }

    return () => {
      if (featureWidgetRef.current) {
        featureWidgetRef.current.destroy();
        featureWidgetRef.current = null;
      }
    };
  }, [feature, view, activeTab]);

  // Mobile drag handlers
  const handleDragStart = (e) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
  };

  const handleDragMove = (e) => {
    if (dragStartY === null) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY - clientY;
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, panelHeight + delta));
    setPanelHeight(newHeight);
    setDragStartY(clientY);
  };

  const handleDragEnd = () => {
    setDragStartY(null);
    // Snap to expanded or collapsed
    if (panelHeight < 150) {
      setPanelHeight(100);
      setMobileExpanded(false);
    } else {
      setMobileExpanded(true);
    }
  };

  // Get feature title
  const getFeatureTitle = useCallback(() => {
    if (!feature?.attributes) return 'Feature Details';
    
    const attrs = feature.attributes;
    return attrs.title || attrs.TITLE || attrs.name || attrs.NAME || 
           attrs.ADDRESS || attrs.PARCELID || attrs.GPIN || 'Feature Details';
  }, [feature]);

  // Tab definitions
  const tabs = [
    { id: 'info', label: 'Info', icon: FileText },
    { id: 'markup', label: 'Markup', icon: Pencil, disabled: !onSaveAsMarkup }
  ];

  // If it's a markup feature, show markup-specific tabs
  const markupTabs = [
    { id: 'properties', label: 'Properties', icon: FileText },
    { id: 'style', label: 'Style', icon: Layers },
    { id: 'elevation', label: 'Elevation', icon: Target }
  ];

  const currentTabs = isMarkupFeature ? markupTabs : tabs;

  if (!feature) return null;

  // Mobile bottom sheet
  if (isMobile) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-40 flex flex-col"
        style={{ 
          height: mobileExpanded ? panelHeight : 60,
          maxHeight: '80vh',
          transition: dragStartY ? 'none' : 'height 0.3s ease'
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: colors.text600 }} />
            <h3 className="font-semibold text-slate-800 truncate">{getFeatureTitle()}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content (only when expanded) */}
        {mobileExpanded && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              {currentTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`flex-1 py-2 px-3 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'border-b-2 text-slate-800'
                      : tab.disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  style={activeTab === tab.id ? { borderBottomColor: colors.bg500, color: colors.text700 } : {}}
                >
                  <tab.icon className="w-4 h-4 mx-auto mb-0.5" />
                  <span className="text-xs">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <TabContent
                activeTab={activeTab}
                feature={feature}
                view={view}
                colors={colors}
                featureContainerRef={featureContainerRef}
                onSaveAsMarkup={onSaveAsMarkup}
                onExportPDF={onExportPDF}
                onZoomTo={onZoomTo}
                isMarkupFeature={isMarkupFeature}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Desktop side panel
  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl z-40 flex flex-col border-r border-slate-200">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b border-slate-200"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: colors.text600 }} />
          <h3 className="font-semibold text-slate-800 truncate text-sm">{getFeatureTitle()}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/50 rounded-lg transition"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Related Records Navigator */}
      {relatedFeatures.length > 1 && (
        <div className="flex items-center justify-center gap-3 py-2 px-3 bg-slate-50 border-b border-slate-200">
          <button
            onClick={() => onNavigateRelated?.(currentRelatedIndex - 1)}
            disabled={currentRelatedIndex === 0}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-600">
            Record <strong>{currentRelatedIndex + 1}</strong> of <strong>{relatedFeatures.length}</strong>
          </span>
          <button
            onClick={() => onNavigateRelated?.(currentRelatedIndex + 1)}
            disabled={currentRelatedIndex === relatedFeatures.length - 1}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200">
        {onSaveAsMarkup && (
          <ActionButton icon={Bookmark} label="Save" onClick={onSaveAsMarkup} />
        )}
        {onExportPDF && (
          <ActionButton icon={Download} label="PDF" onClick={onExportPDF} />
        )}
        {onZoomTo && (
          <ActionButton icon={Target} label="Zoom" onClick={() => onZoomTo(feature)} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {currentTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold uppercase tracking-wide transition ${
              activeTab === tab.id
                ? 'border-b-2 text-slate-800'
                : tab.disabled
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            style={activeTab === tab.id ? { borderBottomColor: colors.bg500, color: colors.text700 } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <TabContent
          activeTab={activeTab}
          feature={feature}
          view={view}
          colors={colors}
          featureContainerRef={featureContainerRef}
          onSaveAsMarkup={onSaveAsMarkup}
          onExportPDF={onExportPDF}
          onZoomTo={onZoomTo}
          isMarkupFeature={isMarkupFeature}
        />
      </div>
    </div>
  );
}

/**
 * Action Button Component
 */
function ActionButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 
                 hover:bg-slate-100 rounded transition disabled:opacity-50 disabled:cursor-not-allowed
                 group"
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden group-hover:inline">{label}</span>
    </button>
  );
}

/**
 * Tab Content Component
 */
function TabContent({
  activeTab,
  feature,
  view,
  colors,
  featureContainerRef,
  onSaveAsMarkup,
  isMarkupFeature
}) {
  if (activeTab === 'info') {
    return (
      <div className="p-4">
        {/* Feature Widget Container */}
        <div 
          ref={featureContainerRef}
          className="feature-widget-container"
          style={{
            '--esri-feature-background': 'transparent'
          }}
        />
        
        {/* Custom styling for Esri Feature widget */}
        <style>{`
          .feature-widget-container .esri-feature {
            background: transparent !important;
            padding: 0 !important;
          }
          .feature-widget-container .esri-feature__title {
            display: none !important;
          }
          .feature-widget-container .esri-feature__content-element {
            margin: 0 0 12px 0 !important;
          }
          .feature-widget-container .esri-feature__fields {
            font-size: 13px;
          }
          .feature-widget-container .esri-feature__field-header {
            font-weight: 600;
            color: #334155;
          }
          .feature-widget-container .esri-feature__field-data {
            color: #64748b;
          }
        `}</style>
      </div>
    );
  }

  if (activeTab === 'markup') {
    return (
      <div className="p-4">
        <MarkupTabContent 
          feature={feature} 
          onSaveAsMarkup={onSaveAsMarkup}
          colors={colors}
        />
      </div>
    );
  }

  // Markup feature specific tabs
  if (isMarkupFeature) {
    if (activeTab === 'properties') {
      return (
        <div className="p-4">
          <MarkupPropertiesTab feature={feature} colors={colors} />
        </div>
      );
    }
    if (activeTab === 'style') {
      return (
        <div className="p-4">
          <MarkupStyleTab feature={feature} colors={colors} />
        </div>
      );
    }
    if (activeTab === 'elevation') {
      return (
        <div className="p-4">
          <MarkupElevationTab feature={feature} />
        </div>
      );
    }
  }

  return null;
}

/**
 * Markup Tab Content - for saving features as markup
 */
function MarkupTabContent({ feature, onSaveAsMarkup, colors }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (onSaveAsMarkup) {
      onSaveAsMarkup({
        geometry: feature.geometry,
        title: title || 'Saved Location',
        description
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a name for this location"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add notes about this location"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saved}
        className="w-full py-2.5 rounded-lg font-medium text-white transition"
        style={{ backgroundColor: saved ? '#22c55e' : colors.bg600 }}
      >
        {saved ? '✓ Saved!' : 'Save as Markup'}
      </button>
    </div>
  );
}

/**
 * Markup Properties Tab
 */
function MarkupPropertiesTab({ feature, colors }) {
  const attrs = feature?.attributes || {};
  
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
        <p className="text-sm text-slate-800">{attrs.title || 'Untitled'}</p>
      </div>
      {attrs.description && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
          <p className="text-sm text-slate-600">{attrs.description}</p>
        </div>
      )}
      {attrs.metric && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Measurement</label>
          <p className="text-sm text-slate-800 font-mono">{attrs.metric}</p>
        </div>
      )}
      {attrs.createdAt && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Created</label>
          <p className="text-sm text-slate-600">{new Date(attrs.createdAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Markup Style Tab
 */
function MarkupStyleTab({ feature, colors }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 italic">
        Style editing is available in the Markup Tool panel.
      </p>
    </div>
  );
}

/**
 * Markup Elevation Tab
 */
function MarkupElevationTab({ feature }) {
  const [loading, setLoading] = useState(false);
  const [elevationData, setElevationData] = useState(null);

  const loadElevation = async () => {
    setLoading(true);
    // Placeholder for elevation service integration
    setTimeout(() => {
      setElevationData({ min: 0, max: 100, avg: 50 });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {!elevationData ? (
        <button
          onClick={loadElevation}
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium
                     hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? 'Loading...' : '⛰️ Load Elevation Data'}
        </button>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Min Elevation:</span>
            <span className="font-medium">{elevationData.min} ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Max Elevation:</span>
            <span className="font-medium">{elevationData.max} ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Avg Elevation:</span>
            <span className="font-medium">{elevationData.avg} ft</span>
          </div>
        </div>
      )}
    </div>
  );
}
