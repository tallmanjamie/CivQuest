// src/atlas/components/FeatureInfoPanel.jsx
// CivQuest Atlas - Feature Info Panel Component
// Responsive panel: RIGHT side on desktop, bottom sheet on mobile
// Supports custom tabbed interface based on customFeatureInfo configuration
//
// FEATURES:
// - Custom tabs based on config when layer matches customFeatureInfo.layerId
// - Each tab displays specific popup elements filtered by name
// - Default Info/Markup tabs when no custom config matches

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  FileText,
  MapPin,
  Target,
  Download,
  Pencil,
  Layers
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import Feature from '@arcgis/core/widgets/Feature';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';

/**
 * FeatureInfoPanel Component
 * Displays feature information in a responsive panel
 * - Desktop: RIGHT side panel (320px width)
 * - Mobile: Bottom sheet (draggable)
 * - Supports custom tabbed interface based on customFeatureInfo config
 */
export default function FeatureInfoPanel({
  feature,
  view,
  config,
  customFeatureInfo,
  sourceLayer,
  onClose,
  onSaveAsMarkup,
  onExportPDF,
  onZoomTo,
  relatedFeatures = [],
  currentRelatedIndex = 0,
  onNavigateRelated,
  isMarkupFeature = false
}) {
  const { config: atlasConfig } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTab, setActiveTab] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(true);
  const [dragStartY, setDragStartY] = useState(null);
  const [panelHeight, setPanelHeight] = useState(300);

  // Refs
  const featureWidgetRef = useRef(null);
  const featureContainerRef = useRef(null);

  // Check if this feature's layer matches the custom feature info config
  const useCustomTabs = useMemo(() => {
    console.log('[FeatureInfoPanel] useCustomTabs check:', {
      customFeatureInfoLayerId: customFeatureInfo?.layerId,
      customFeatureInfoTabsCount: customFeatureInfo?.tabs?.length || 0,
      featureSourceLayerId: feature?.sourceLayerId,
      sourceLayerId: sourceLayer?.id
    });

    if (!customFeatureInfo?.layerId || !customFeatureInfo?.tabs?.length) {
      console.log('[FeatureInfoPanel] useCustomTabs = false (missing layerId or tabs)');
      return false;
    }
    // Check if the source layer ID matches the config layer ID
    const featureLayerId = feature?.sourceLayerId || sourceLayer?.id;
    const matches = featureLayerId === customFeatureInfo.layerId;
    console.log('[FeatureInfoPanel] useCustomTabs =', matches, '(featureLayerId:', featureLayerId, '=== configLayerId:', customFeatureInfo.layerId, ')');
    return matches;
  }, [customFeatureInfo, feature?.sourceLayerId, sourceLayer?.id]);

  // Stable key for popup template content to prevent unnecessary recalculations
  const popupContentKey = useMemo(() => {
    if (!sourceLayer?.popupTemplate?.content) return '';
    const content = sourceLayer.popupTemplate.content;
    if (!Array.isArray(content)) return '';
    // Create a stable key from expression names
    return content
      .filter(element => element.type === 'expression' && element.expressionInfo)
      .map(element => element.expressionInfo?.name || element.expressionInfo?.title || '')
      .filter(Boolean)
      .join('|');
  }, [sourceLayer?.popupTemplate?.content]);

  // Extract Arcade expression elements from popup template to auto-generate tabs
  // Uses popupContentKey for stability - only recalculates when expression names actually change
  const arcadeExpressions = useMemo(() => {
    if (!popupContentKey) return [];
    // Parse the key back to array
    const expressions = popupContentKey.split('|');
    console.log('[FeatureInfoPanel] Extracted Arcade expressions from popup template:', expressions);
    return expressions;
  }, [popupContentKey]);

  // Build tabs based on config or default
  const tabs = useMemo(() => {
    console.log('[FeatureInfoPanel] Building tabs - isMarkupFeature:', isMarkupFeature, 'useCustomTabs:', useCustomTabs, 'arcadeExpressions:', arcadeExpressions.length);

    if (isMarkupFeature) {
      console.log('[FeatureInfoPanel] Using markup feature tabs');
      return [
        { id: 'properties', label: 'Properties', icon: FileText },
        { id: 'style', label: 'Style', icon: Layers },
        { id: 'elevation', label: 'Elevation', icon: Target }
      ];
    }

    // Auto-generate tabs from Arcade expressions in the popup template
    // This is preferred when the popup template has expression elements
    // Only use manual tabs if they comprehensively cover all expressions (same count)
    if (useCustomTabs && arcadeExpressions.length > 0) {
      const manualTabCount = customFeatureInfo?.tabs?.length || 0;

      // If manual tabs don't match the number of Arcade expressions, auto-generate
      // This ensures tabs are created for all expressions in the popup template
      if (manualTabCount !== arcadeExpressions.length) {
        console.log('[FeatureInfoPanel] Auto-generating tabs from Arcade expressions (manual tabs:', manualTabCount, ', expressions:', arcadeExpressions.length, ')');
        const autoTabs = arcadeExpressions.map((expressionName, index) => ({
          id: `custom-${index}`,
          label: expressionName,
          icon: FileText,
          elements: [expressionName], // Filter to show only this expression
          isCustom: true
        }));
        console.log('[FeatureInfoPanel] Auto-generated tabs:', autoTabs.map(t => ({
          id: t.id,
          label: t.label,
          elements: t.elements,
          isCustom: t.isCustom
        })));
        return autoTabs;
      }
    }

    // If we have custom tabs configured that match the expression count, use those
    if (useCustomTabs && customFeatureInfo?.tabs?.length > 0) {
      // Use custom tabs from config
      const customTabs = customFeatureInfo.tabs.map((tab, index) => ({
        id: `custom-${index}`,
        label: tab.name || `Tab ${index + 1}`,
        icon: FileText,
        elements: tab.elements || [],
        isCustom: true
      }));
      console.log('[FeatureInfoPanel] Using manually configured custom tabs:', customTabs.map(t => ({
        id: t.id,
        label: t.label,
        elements: t.elements,
        isCustom: t.isCustom
      })));
      return customTabs;
    }

    // Fallback: Auto-generate tabs from Arcade expressions (when useCustomTabs is false but we have expressions)
    if (arcadeExpressions.length > 0) {
      const autoTabs = arcadeExpressions.map((expressionName, index) => ({
        id: `custom-${index}`,
        label: expressionName,
        icon: FileText,
        elements: [expressionName], // Filter to show only this expression
        isCustom: true
      }));
      console.log('[FeatureInfoPanel] Auto-generated tabs from Arcade expressions:', autoTabs.map(t => ({
        id: t.id,
        label: t.label,
        elements: t.elements,
        isCustom: t.isCustom
      })));
      return autoTabs;
    }

    // Default tabs
    console.log('[FeatureInfoPanel] Using default tabs (Info/Markup)');
    return [
      { id: 'info', label: 'Info', icon: FileText },
      { id: 'markup', label: 'Markup', icon: Pencil, disabled: !onSaveAsMarkup }
    ];
  // arcadeExpressions is now stable thanks to popupContentKey
  }, [isMarkupFeature, useCustomTabs, customFeatureInfo?.tabs, arcadeExpressions, onSaveAsMarkup]);

  // Set initial active tab
  useEffect(() => {
    if (tabs.length > 0 && (!activeTab || !tabs.find(t => t.id === activeTab))) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Feature widget when feature or active tab changes
  useEffect(() => {
    console.log('[FeatureInfoPanel] useEffect for Feature widget - activeTab:', activeTab);
    console.log('[FeatureInfoPanel] useEffect - feature:', !!feature, 'view:', !!view);

    if (!feature || !view) {
      console.log('[FeatureInfoPanel] useEffect - Missing feature or view, skipping widget creation');
      return;
    }

    // Find the current tab config
    const currentTab = tabs.find(t => t.id === activeTab);
    console.log('[FeatureInfoPanel] useEffect - Current tab:', {
      id: currentTab?.id,
      label: currentTab?.label,
      isCustom: currentTab?.isCustom,
      elements: currentTab?.elements
    });

    // Skip widget creation for non-info tabs (markup, properties, etc.)
    if (!currentTab?.isCustom && activeTab !== 'info') {
      console.log('[FeatureInfoPanel] useEffect - Skipping widget creation for non-info tab:', activeTab);
      return;
    }

    // Create widget with a delay to ensure container is mounted
    const createWidget = () => {
      if (!featureContainerRef.current) {
        console.log('[FeatureInfoPanel] createWidget - Container not ready, retrying...');
        return;
      }

      // Clear previous widget
      if (featureWidgetRef.current) {
        console.log('[FeatureInfoPanel] createWidget - Destroying previous widget');
        try {
          featureWidgetRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        featureWidgetRef.current = null;
      }

      // Create a graphic from the feature
      let geometry;
      if (feature.geometry) {
        if (feature.geometry.rings) {
          geometry = new Polygon({
            rings: feature.geometry.rings,
            spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
          });
        } else if (feature.geometry.paths) {
          geometry = new Polyline({
            paths: feature.geometry.paths,
            spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
          });
        } else if (feature.geometry.x !== undefined) {
          geometry = new Point({
            x: feature.geometry.x,
            y: feature.geometry.y,
            spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
          });
        }
      }

      // Create a graphic for the Feature widget
      const graphic = new Graphic({
        geometry,
        attributes: feature.attributes || {},
        layer: sourceLayer
      });

      console.log('[FeatureInfoPanel] createWidget - Created graphic:', {
        hasGeometry: !!geometry,
        geometryType: geometry?.type,
        attributeKeys: Object.keys(feature.attributes || {}),
        sourceLayerId: sourceLayer?.id,
        sourceLayerTitle: sourceLayer?.title,
        hasSourceLayerPopupTemplate: !!sourceLayer?.popupTemplate
      });

      // If we have a custom tab with elements, filter the popup template
      let popupTemplate = null;
      if (currentTab?.isCustom && currentTab.elements?.length > 0 && sourceLayer?.popupTemplate) {
        const originalTemplate = sourceLayer.popupTemplate;
        console.log('[FeatureInfoPanel] createWidget - Original popup template:', {
          title: originalTemplate.title,
          contentType: typeof originalTemplate.content,
          contentIsArray: Array.isArray(originalTemplate.content),
          contentLength: Array.isArray(originalTemplate.content) ? originalTemplate.content.length : 'N/A',
          outFields: originalTemplate.outFields
        });

        // Log each content element in the original template
        if (Array.isArray(originalTemplate.content)) {
          console.log('[FeatureInfoPanel] createWidget - Original template content elements:');
          originalTemplate.content.forEach((element, idx) => {
            console.log(`  [${idx}]:`, {
              type: element.type,
              title: element.title,
              description: element.description,
              text: element.text?.substring?.(0, 100),
              expressionInfo: element.expressionInfo?.name || element.expressionInfo?.title,
              fieldInfos: element.fieldInfos?.length
            });
          });
        } else {
          console.log('[FeatureInfoPanel] createWidget - Original template content (non-array):', {
            type: originalTemplate.content?.type,
            title: originalTemplate.content?.title,
            description: originalTemplate.content?.description
          });
        }

        console.log('[FeatureInfoPanel] createWidget - Filtering with elements:', currentTab.elements);
        const filteredContent = filterPopupContent(originalTemplate.content, currentTab.elements);
        console.log('[FeatureInfoPanel] createWidget - Filtered content result:', {
          filteredIsArray: Array.isArray(filteredContent),
          filteredLength: Array.isArray(filteredContent) ? filteredContent.length : 'N/A',
          filteredItems: Array.isArray(filteredContent) ? filteredContent.map(c => ({
            type: c.type,
            title: c.title,
            description: c.description
          })) : typeof filteredContent
        });

        popupTemplate = {
          title: originalTemplate.title,
          content: filteredContent,
          outFields: originalTemplate.outFields || ['*'],
          fieldInfos: originalTemplate.fieldInfos
        };
      } else {
        console.log('[FeatureInfoPanel] createWidget - NOT filtering popup template:', {
          isCustomTab: currentTab?.isCustom,
          hasElements: currentTab?.elements?.length > 0,
          hasSourceLayerPopupTemplate: !!sourceLayer?.popupTemplate
        });
      }

      // Create new Feature widget
      try {
        const widgetConfig = {
          graphic: graphic,
          view: view,
          container: featureContainerRef.current,
          defaultPopupTemplateEnabled: !popupTemplate
        };

        // Apply custom popup template if we have one
        if (popupTemplate) {
          console.log('[FeatureInfoPanel] createWidget - Applying custom popup template to graphic');
          graphic.popupTemplate = popupTemplate;
        } else {
          console.log('[FeatureInfoPanel] createWidget - Using default popup template (defaultPopupTemplateEnabled: true)');
        }

        console.log('[FeatureInfoPanel] createWidget - Creating Feature widget');
        const widget = new Feature(widgetConfig);
        featureWidgetRef.current = widget;
        console.log('[FeatureInfoPanel] createWidget - Feature widget created successfully');
      } catch (err) {
        console.error('[FeatureInfoPanel] Error creating Feature widget:', err);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready after React render
    const frameId = requestAnimationFrame(() => {
      // Double RAF to ensure we're after the paint
      requestAnimationFrame(createWidget);
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (featureWidgetRef.current) {
        try {
          featureWidgetRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        featureWidgetRef.current = null;
      }
    };
  }, [feature, view, sourceLayer, activeTab, tabs]);

  /**
   * Filter popup content to only include elements matching the given names
   */
  function filterPopupContent(content, elementNames) {
    console.log('[FeatureInfoPanel] filterPopupContent called:', {
      contentType: typeof content,
      contentIsArray: Array.isArray(content),
      contentLength: Array.isArray(content) ? content.length : 'N/A',
      elementNames: elementNames
    });

    if (!content || !elementNames?.length) {
      console.log('[FeatureInfoPanel] filterPopupContent - No content or elementNames, returning original');
      return content;
    }

    // Handle array content (multiple elements)
    if (Array.isArray(content)) {
      const filtered = content.filter(element => {
        // Check if element title/description matches any of the configured element names
        // Also check expressionInfo.name for Arcade expressions
        const elementTitle = element.title || element.description || '';
        const expressionName = element.expressionInfo?.name || element.expressionInfo?.title || '';
        const textContent = element.text || '';

        console.log('[FeatureInfoPanel] filterPopupContent - Checking element:', {
          type: element.type,
          title: elementTitle,
          expressionName: expressionName,
          textPreview: textContent.substring(0, 50)
        });

        const matchesTitle = elementNames.some(name =>
          name && elementTitle.toLowerCase().includes(name.toLowerCase())
        );
        const matchesExpression = elementNames.some(name =>
          name && expressionName.toLowerCase().includes(name.toLowerCase())
        );
        const matchesText = elementNames.some(name =>
          name && textContent.toLowerCase().includes(name.toLowerCase())
        );

        const matches = matchesTitle || matchesExpression || matchesText;
        console.log('[FeatureInfoPanel] filterPopupContent - Element match result:', {
          matchesTitle,
          matchesExpression,
          matchesText,
          finalMatch: matches
        });

        return matches;
      });
      console.log('[FeatureInfoPanel] filterPopupContent - Filtered array from', content.length, 'to', filtered.length, 'elements');
      return filtered;
    }

    // If content is a single object, check if it matches
    if (typeof content === 'object') {
      const elementTitle = content.title || content.description || '';
      const expressionName = content.expressionInfo?.name || content.expressionInfo?.title || '';
      const textContent = content.text || '';

      const matchesTitle = elementNames.some(name =>
        name && elementTitle.toLowerCase().includes(name.toLowerCase())
      );
      const matchesExpression = elementNames.some(name =>
        name && expressionName.toLowerCase().includes(name.toLowerCase())
      );
      const matchesText = elementNames.some(name =>
        name && textContent.toLowerCase().includes(name.toLowerCase())
      );

      const matches = matchesTitle || matchesExpression || matchesText;
      console.log('[FeatureInfoPanel] filterPopupContent - Single object match:', matches);
      return matches ? [content] : [];
    }

    // For string/function content, return as-is
    console.log('[FeatureInfoPanel] filterPopupContent - String/function content, returning as-is');
    return content;
  }

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
            <div className="flex border-b border-slate-200 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`flex-shrink-0 py-2 px-3 text-sm font-medium transition ${
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
                tabs={tabs}
                feature={feature}
                view={view}
                colors={colors}
                featureContainerRef={featureContainerRef}
                onSaveAsMarkup={onSaveAsMarkup}
                isMarkupFeature={isMarkupFeature}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Desktop side panel - DOCKED ON RIGHT SIDE
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl z-40 flex flex-col border-l border-slate-200">
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
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold uppercase tracking-wide transition whitespace-nowrap ${
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
          tabs={tabs}
          feature={feature}
          view={view}
          colors={colors}
          featureContainerRef={featureContainerRef}
          onSaveAsMarkup={onSaveAsMarkup}
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
  tabs,
  feature,
  view,
  colors,
  featureContainerRef,
  onSaveAsMarkup,
  isMarkupFeature
}) {
  // Find current tab
  const currentTab = tabs.find(t => t.id === activeTab);

  // Custom tabs and default 'info' tab render the Feature widget
  if (currentTab?.isCustom || activeTab === 'info') {
    return (
      <div className="p-4">
        <div
          ref={featureContainerRef}
          className="feature-widget-container"
        />
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

  if (isMarkupFeature && activeTab === 'properties') {
    return (
      <div className="p-4">
        <MarkupPropertiesTab feature={feature} colors={colors} />
      </div>
    );
  }

  return null;
}

/**
 * Markup Tab Content
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
