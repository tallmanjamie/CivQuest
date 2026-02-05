import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bookmark,
  FileText,
  MapPin,
  Target,
  Download,
  Layers,
  GripVertical,
  Loader2,
  Eye,
  Maximize2,
  Minimize2,
  Radar,
  ZoomIn
} from 'lucide-react';

import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';
import { useIntegrations } from '../hooks/useIntegrations';
import NearbySearchTool from './NearbySearchTool';

/**
 * FeatureInfoPanel Component
 * Displays feature information in a responsive, resizable panel.
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
  onNearbySearch,
  relatedFeatures = [],
  currentRelatedIndex = 0,
  onNavigateRelated,
  isMarkupFeature = false,
  onWidthChange,
  isExportingPDF = false,
  exportPDFProgress = ''
}) {
  const { config: atlasConfig, orgId, activeMap, isPictometryEnabled, openEagleView, isNearmapEnabled, openNearmap } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Layout State
  const [activeTab, setActiveTab] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showNearbyTool, setShowNearbyTool] = useState(false);
  
  // Title State (Resolved from Feature Widget)
  const [dynamicTitle, setDynamicTitle] = useState(null);
  
  // Resizing State
  const [desktopWidth, setDesktopWidth] = useState(400); 
  const [isResizing, setIsResizing] = useState(false);
  
  // Refs
  const featureWidgetRef = useRef(null);
  const featureContainerRef = useRef(null);
  const titleWatcherRef = useRef(null); // Ref to hold the title watcher handle
  const resizeRef = useRef({ startX: 0, startW: 0 });
  // Track previous context to determine when to destroy vs update widget
  const prevContextRef = useRef({ feature: null, view: null, sourceLayer: null });

  // Notify parent of width changes for positioning navigation controls
  // When maximized, report a very large width to push controls out of view
  useEffect(() => {
    if (isMaximized) {
      onWidthChange?.(9999); // Signal maximized state
    } else {
      onWidthChange?.(desktopWidth);
    }
  }, [desktopWidth, isMaximized, onWidthChange]);

  // Reset maximized and minimized state when feature changes
  useEffect(() => {
    setIsMaximized(false);
    setIsMinimized(false);
  }, [feature]);

  const useCustomTabs = useMemo(() => {
    if (!customFeatureInfo?.layerId || !customFeatureInfo?.tabs?.length) return false;
    const featureLayerId = feature?.sourceLayerId || sourceLayer?.id;
    return featureLayerId === customFeatureInfo.layerId;
  }, [customFeatureInfo, feature, sourceLayer]);

  const arcadeExpressions = useMemo(() => {
    const template = sourceLayer?.popupTemplate || feature?.popupTemplate;
    if (!template?.content || !Array.isArray(template.content)) return [];
    return template.content
      .filter(el => el.type === 'expression' && el.expressionInfo)
      .map(el => {
        // Get name from expressionInfo properties
        // Note: expressionInfo.expression may contain "expression/name" format reference
        const name = el.expressionInfo?.name || el.expressionInfo?.title || '';
        if (name) return name;
        // Fallback: extract name from expression reference (e.g., "expression/Summary" -> "Summary")
        const exprRef = el.expressionInfo?.expression || '';
        if (exprRef.startsWith('expression/')) {
          return exprRef.substring('expression/'.length);
        }
        return '';
      })
      .filter(Boolean);
  }, [sourceLayer, feature]);

  const tabs = useMemo(() => {
    if (isMarkupFeature) {
      return [
        { id: 'properties', label: 'Properties', icon: FileText },
        { id: 'style', label: 'Style', icon: Layers },
        { id: 'elevation', label: 'Elevation', icon: Target }
      ];
    }
    if (useCustomTabs && customFeatureInfo?.tabs?.length > 0) {
      return customFeatureInfo.tabs.map((tab, idx) => ({
        id: `custom-${idx}`,
        label: tab.name || `Tab ${idx + 1}`,
        icon: FileText,
        elements: tab.elements || [],
        isCustom: true
      }));
    }
    if (arcadeExpressions.length > 0) {
      return arcadeExpressions.map((name, idx) => ({
        id: `custom-${idx}`,
        label: name,
        icon: FileText,
        elements: [name],
        isCustom: true
      }));
    }
    return [
      { id: 'info', label: 'Info', icon: FileText }
    ];
  }, [isMarkupFeature, useCustomTabs, customFeatureInfo, arcadeExpressions]);

  useEffect(() => {
    if (tabs.length > 0 && (!activeTab || !tabs.find(t => t.id === activeTab))) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Reset dynamic title when feature changes
  useEffect(() => {
    setDynamicTitle(null);
  }, [feature]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!feature || !view || !activeTab) return;

    // Determine if core context has changed (requires widget recreation)
    // Note: We distinguish between view/sourceLayer changes (require recreation) and
    // feature-only changes (can update existing widget)
    const prevContext = prevContextRef.current;
    const viewOrLayerChanged =
      prevContext.view !== view ||
      prevContext.sourceLayer !== sourceLayer;
    const featureChanged = prevContext.feature !== feature;

    const loadArcGIS = async () => {
      try {
        // Dynamically load modules
        const [FeatureClass, GraphicClass, reactiveUtils, projection] = await Promise.all([
          import('@arcgis/core/widgets/Feature').then(m => m.default).catch(() => window.esri?.widgets?.Feature),
          import('@arcgis/core/Graphic').then(m => m.default).catch(() => window.esri?.Graphic),
          import('@arcgis/core/core/reactiveUtils').catch(() => window.esri?.core?.reactiveUtils),
          import('@arcgis/core/geometry/projection').then(m => m.default || m).catch(() => null)
        ]);

        if (!FeatureClass || !GraphicClass || !featureContainerRef.current) return;

        const currentTab = tabs.find(t => t.id === activeTab);
        const isInfoTab = currentTab?.isCustom || activeTab === 'info';

        if (!isInfoTab) {
          if (featureWidgetRef.current) featureWidgetRef.current.container = null;
          return;
        }

        // --- Fix for Geometry Autocast Error ---
        // Ensure geometry is a valid object with a 'type' property if it's a plain JSON object
        let geometry = feature.geometry;
        if (geometry && typeof geometry === 'object' && !geometry.declaredClass) {
          // It's likely a plain JSON object. Clone it to avoid mutating props.
          geometry = { ...geometry };

          // Injects type if missing (required for Graphic autocasting)
          if (!geometry.type) {
             if (geometry.rings) geometry.type = 'polygon';
             else if (geometry.paths) geometry.type = 'polyline';
             else if (geometry.x !== undefined) geometry.type = 'point';
             else if (geometry.xmin !== undefined) geometry.type = 'extent';
             else if (geometry.points) geometry.type = 'multipoint';
          }
        }

        // --- Fix for Arcade Spatial Reference Error ---
        // When features come from search (REST API), geometry is typically in WGS84 (4326)
        // but Arcade expressions expect geometry in the view's spatial reference (often Web Mercator)
        // Project the geometry to match the view's spatial reference for Arcade expressions
        const viewSR = view?.spatialReference;
        const geomSR = geometry?.spatialReference;

        if (geometry && viewSR && projection && geomSR) {
          // Check if spatial references differ (compare WKIDs, handling common equivalents)
          const viewWkid = viewSR.wkid || viewSR.latestWkid;
          const geomWkid = geomSR.wkid || geomSR.latestWkid;

          // Web Mercator WKIDs: 102100, 3857, 102113 are equivalent
          const webMercatorWkids = [102100, 3857, 102113];
          const viewIsWebMercator = webMercatorWkids.includes(viewWkid);
          const geomIsWebMercator = webMercatorWkids.includes(geomWkid);

          // Only project if spatial references are actually different
          const needsProjection = viewWkid !== geomWkid &&
                                  !(viewIsWebMercator && geomIsWebMercator);

          if (needsProjection) {
            try {
              // Load the projection engine if not already loaded
              if (!projection.isLoaded?.()) {
                await projection.load?.();
              }

              // Create proper geometry objects for projection
              const [Point, Polygon, Polyline, Extent, Multipoint] = await Promise.all([
                import('@arcgis/core/geometry/Point').then(m => m.default).catch(() => null),
                import('@arcgis/core/geometry/Polygon').then(m => m.default).catch(() => null),
                import('@arcgis/core/geometry/Polyline').then(m => m.default).catch(() => null),
                import('@arcgis/core/geometry/Extent').then(m => m.default).catch(() => null),
                import('@arcgis/core/geometry/Multipoint').then(m => m.default).catch(() => null)
              ]);

              // Create proper ArcGIS geometry object from JSON
              let sourceGeometry = null;
              if (geometry.type === 'point' && Point) {
                sourceGeometry = new Point(geometry);
              } else if (geometry.type === 'polygon' && Polygon) {
                sourceGeometry = new Polygon(geometry);
              } else if (geometry.type === 'polyline' && Polyline) {
                sourceGeometry = new Polyline(geometry);
              } else if (geometry.type === 'extent' && Extent) {
                sourceGeometry = new Extent(geometry);
              } else if (geometry.type === 'multipoint' && Multipoint) {
                sourceGeometry = new Multipoint(geometry);
              }

              if (sourceGeometry) {
                // Project to view's spatial reference
                const projectedGeometry = projection.project(sourceGeometry, viewSR);
                if (projectedGeometry) {
                  geometry = projectedGeometry;
                }
              }
            } catch (projErr) {
              console.warn('[FeatureInfoPanel] Geometry projection failed, using original:', projErr);
              // Continue with original geometry if projection fails
            }
          }
        }

        const graphic = new GraphicClass({
          geometry: geometry,
          attributes: feature.attributes || {},
          layer: sourceLayer
        });

        const originalTemplate = sourceLayer?.popupTemplate || feature.popupTemplate;
        if (currentTab?.isCustom && currentTab.elements?.length > 0 && originalTemplate) {
          try {
            const contentArray = Array.isArray(originalTemplate.content)
              ? originalTemplate.content
              : [originalTemplate.content].filter(Boolean);

            const filteredContent = contentArray.filter(el => {
              if (!el) return false;
              const titleText = el.title || el.description || el.text || '';
              // Also check el.expressionInfo?.expression which may contain "expression/name" format
              const exprName = el.expressionInfo?.name || el.expressionInfo?.title || '';
              const exprRef = el.expressionInfo?.expression || '';

              return currentTab.elements.some(name => {
                const nameLower = name.toLowerCase();
                return titleText.toLowerCase().includes(nameLower) ||
                       exprName.toLowerCase().includes(nameLower) ||
                       exprRef.toLowerCase().includes(nameLower);
              });
            });

            // Only apply filtered template if we actually have content
            // Otherwise fall back to the original template to avoid showing empty popup
            if (filteredContent.length > 0) {
              // Convert expressionInfos to a plain array to ensure proper auto-casting
              // when creating the popup template (handles Collection objects from existing templates)
              const expressionInfosArray = originalTemplate.expressionInfos
                ? (originalTemplate.expressionInfos.toArray?.() || [...originalTemplate.expressionInfos])
                : [];

              graphic.popupTemplate = {
                title: originalTemplate.title,
                content: filteredContent,
                expressionInfos: expressionInfosArray,
                fieldInfos: originalTemplate.fieldInfos,
                // Include outFields if present - some Arcade expressions need specific fields
                outFields: originalTemplate.outFields
              };
            } else {
              console.warn('[FeatureInfoPanel] Content filter returned empty array, using original template');
            }
          } catch (filterErr) {
            console.warn('[FeatureInfoPanel] Error filtering popup template content:', filterErr);
            // Fall back to original template on error
          }
        }

        // Initialize or update widget
        // Note: The 'map' property is required for Arcade expressions that use
        // FeatureSet functions like FeatureSetByName, Filter, FeatureSetByRelationshipName, etc.
        // The 'spatialReference' property is required for Arcade expressions that use
        // geometry functions like Intersects, Buffer, Filter with geometry, etc.
        const spatialReference = view?.spatialReference || view?.map?.spatialReference;

        // Only create new widget if view/sourceLayer changed or widget doesn't exist
        // IMPORTANT: Do NOT destroy widget on feature-only changes - this breaks Arcade FeatureSet evaluation
        // Instead, update the graphic on the existing widget to preserve Arcade evaluation state
        if (!featureWidgetRef.current || viewOrLayerChanged) {
          // Destroy existing widget only if view or sourceLayer changed (not for feature changes)
          if (featureWidgetRef.current && viewOrLayerChanged) {
            featureWidgetRef.current.destroy?.();
            featureWidgetRef.current = null;
          }

          featureWidgetRef.current = new FeatureClass({
            graphic,
            view,
            map: view?.map,
            spatialReference,
            container: featureContainerRef.current
          });

          // Update context tracking
          prevContextRef.current = { feature, view, sourceLayer };
        } else {
          // Update the graphic on existing widget (for feature changes and tab switches)
          // This allows Arcade FeatureSet evaluation to work correctly on subsequent feature clicks
          featureWidgetRef.current.container = featureContainerRef.current;
          featureWidgetRef.current.graphic = graphic;
          // Ensure map and spatialReference are set
          featureWidgetRef.current.map = view?.map;
          featureWidgetRef.current.spatialReference = spatialReference;
          // Track the new feature in context (view and sourceLayer stay the same)
          if (featureChanged) {
            prevContextRef.current = { feature, view, sourceLayer };
          }
        }

        // --- Title Resolution Logic (Updated for reactiveUtils) ---
        // Clean up old watcher if exists
        if (titleWatcherRef.current) {
          titleWatcherRef.current.remove();
          titleWatcherRef.current = null;
        }

        const updateTitle = (newTitle) => {
          if (newTitle && typeof newTitle === 'string') {
             setDynamicTitle(newTitle);
          }
        };

        // Set initial value if available
        if (featureWidgetRef.current.title) {
          updateTitle(featureWidgetRef.current.title);
        }

        // Start watching using reactiveUtils (replaces deprecated .watch)
        if (reactiveUtils) {
          titleWatcherRef.current = reactiveUtils.watch(
            () => featureWidgetRef.current.title,
            updateTitle
          );
        }

      } catch (err) {
        console.warn("ArcGIS modules error:", err);
      }
    };

    const timer = setTimeout(loadArcGIS, 50);

    // Cleanup function - only run full cleanup on unmount
    // The widget destruction logic is now handled inside the effect based on context changes
    return () => {
      clearTimeout(timer);
      if (titleWatcherRef.current) {
        titleWatcherRef.current.remove();
        titleWatcherRef.current = null;
      }
    };
  }, [feature, view, view?.map, sourceLayer, activeTab, tabs, isMobile]);

  // Cleanup effect that only destroys widget when component unmounts
  // Note: Widget destruction on context changes (view/sourceLayer) is handled in the main effect
  // We do NOT include feature in dependencies because we want to UPDATE the widget, not destroy it
  // Destroying on feature change causes Arcade FeatureSet evaluation to fail on subsequent clicks
  useEffect(() => {
    return () => {
      // Destroy widget only on unmount
      if (featureWidgetRef.current) {
        featureWidgetRef.current.destroy?.();
        featureWidgetRef.current = null;
      }
      prevContextRef.current = { feature: null, view: null, sourceLayer: null };
    };
  }, []); // Empty deps - only run cleanup on unmount

  const startResizingDesktop = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startW: desktopWidth };
    const onMouseMove = (moveEvent) => {
      const delta = resizeRef.current.startX - moveEvent.clientX;
      setDesktopWidth(Math.min(window.innerWidth * 0.8, Math.max(300, resizeRef.current.startW + delta)));
    };
    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [desktopWidth]);

  // Fallback title logic if Widget hasn't loaded or fails
  const getFeatureTitle = useCallback(() => {
    // Priority 1: Check for 'displayName' (set by SearchResults or passed enrichment)
    if (feature?.attributes?.displayName) return feature.attributes.displayName;

    // Priority 2: Check for popup template title from the source layer
    const template = sourceLayer?.popupTemplate || feature?.popupTemplate;
    if (template?.title) {
      const attrs = feature?.attributes || {};
      // Build a case-insensitive lookup map for attribute field names
      const attrKeys = Object.keys(attrs);
      const attrLookup = {};
      attrKeys.forEach(key => {
        attrLookup[key.toLowerCase()] = key;
      });

      // If title is a string with placeholders like "{FIELD_NAME}", resolve them
      if (typeof template.title === 'string') {
        const resolvedTitle = template.title.replace(/\{([^}]+)\}/g, (match, fieldName) => {
          // First try exact match, then case-insensitive match
          let value = attrs[fieldName];
          if (value === undefined || value === null) {
            const actualKey = attrLookup[fieldName.toLowerCase()];
            if (actualKey) {
              value = attrs[actualKey];
            }
          }
          return value !== undefined && value !== null ? String(value) : '';
        });
        // Only use if we got a meaningful resolved title
        if (resolvedTitle && resolvedTitle.trim() && !resolvedTitle.includes('{')) {
          return resolvedTitle.trim();
        }
      }
    }

    // Priority 3: Fallback to standard attribute fields
    const attrs = feature?.attributes || {};
    return attrs.title || attrs.TITLE || attrs.name || attrs.NAME ||
           attrs.ADDRESS || attrs.address || attrs.PARCELID || 'Feature Details';
  }, [feature, sourceLayer]);

  // Determine final title to display
  const displayTitle = dynamicTitle || getFeatureTitle();

  const renderTabsList = () => (
    <div className="flex border-b border-slate-200 overflow-x-auto bg-white sticky top-0 z-10 no-scrollbar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && setActiveTab(tab.id)}
          disabled={tab.disabled}
          className={`flex-1 py-2 px-2.5 text-xs font-bold uppercase tracking-wider transition whitespace-nowrap border-b-2 ${
            activeTab === tab.id ? 'text-slate-900' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
          }`}
          style={activeTab === tab.id ? { borderBottomColor: colors.bg500, color: colors.text700 } : {}}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // Handle EagleView button click
  const handleOpenEagleView = useCallback(() => {
    if (!feature?.geometry) return;

    openEagleView({
      geometry: feature.geometry,
      title: displayTitle,
      themeColor: colors.bg500
    });
  }, [feature, displayTitle, colors.bg500, openEagleView]);

  // Handle Nearmap button click
  const handleOpenNearmap = useCallback(() => {
    if (!feature?.geometry) return;

    openNearmap({
      geometry: feature.geometry,
      title: displayTitle,
      themeColor: colors.bg500
    });
  }, [feature, displayTitle, colors.bg500, openNearmap]);

  // Handle Nearby button click
  const handleNearbyClick = useCallback(() => {
    setShowNearbyTool(true);
  }, []);

  // Handle Nearby search results
  const handleNearbyResults = useCallback((features, bufferGeometry, searchInfo) => {
    console.log('[FeatureInfoPanel] Nearby search found', features.length, 'features');
    setShowNearbyTool(false);
    if (onNearbySearch) {
      onNearbySearch(features, bufferGeometry, searchInfo);
    }
  }, [onNearbySearch]);

  // Handle saving buffer as markup
  const handleSaveBufferAsMarkup = useCallback((bufferGeometry, bufferName) => {
    if (onSaveAsMarkup) {
      // Create a pseudo-feature with the buffer geometry
      const bufferFeature = {
        geometry: bufferGeometry,
        attributes: {}
      };
      onSaveAsMarkup(bufferFeature, bufferName);
    }
  }, [onSaveAsMarkup]);

  // Get endpoint for nearby search
  const nearbyEndpoint = activeMap?.endpoint || config?.data?.endpoint;

  const ActionButtons = () => (
    <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-200">
      <ActionButton icon={Bookmark} label="Markup" onClick={() => onSaveAsMarkup?.(feature, displayTitle)} />
      <ActionButton
        icon={isExportingPDF ? Loader2 : Download}
        label={isExportingPDF ? (exportPDFProgress || 'Exporting...') : 'Export'}
        onClick={() => !isExportingPDF && onExportPDF?.(feature, displayTitle)}
        disabled={isExportingPDF}
        isLoading={isExportingPDF}
      />
      <ActionButton icon={ZoomIn} label="Zoom" onClick={() => onZoomTo?.(feature)} />
      <ActionButton icon={Radar} label="Nearby" onClick={handleNearbyClick} />
      {isPictometryEnabled && (
        <ActionButton
          icon={Eye}
          label="EagleView"
          onClick={handleOpenEagleView}
        />
      )}
      {isNearmapEnabled && (
        <ActionButton
          icon={MapPin}
          label="Nearmap"
          onClick={handleOpenNearmap}
        />
      )}
    </div>
  );

  if (!feature) return null;

  // Get search bar position from config
  const searchBarPosition = atlasConfig?.ui?.searchBarPosition || 'top';
  const searchBarHeight = searchBarPosition === 'bottom' ? 60 : 0; // Approximate height of search toolbar

  if (isMobile) {
    // Mobile minimized view: Only header at bottom of map
    if (isMinimized) {
      return (
        <div
          className="fixed inset-x-0 bg-white z-40 flex flex-col shadow-2xl rounded-t-2xl"
          style={{ bottom: searchBarHeight }}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm border border-slate-100">
                <MapPin className="w-3 h-3" style={{ color: colors.bg500 }} />
              </div>
              <h3 className="font-semibold text-slate-800 truncate text-base">{displayTitle}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"
                title="Restore"
              >
                <ChevronUp className="w-5 h-5 text-slate-500" />
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
          </div>
        </div>
      );
    }

    // Mobile view: 1/2 height by default, full height when maximized
    // When search bar is at bottom, position popup above it to avoid covering it
    const mobileStyle = isMaximized
      ? { top: '64px', bottom: searchBarHeight } // Full height from header, accounting for bottom search bar
      : { height: '50vh', maxHeight: 'calc(100vh - 180px)', bottom: searchBarHeight }; // 1/2 of viewport, positioned above search bar

    return (
      <div
        className={`fixed inset-x-0 bg-white z-40 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 ${
          isMaximized ? '' : 'rounded-t-2xl'
        }`}
        style={mobileStyle}
      >
        {/* Mobile: No resize handle - users can only maximize or close */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm border border-slate-100">
              <MapPin className="w-3 h-3" style={{ color: colors.bg500 }} />
            </div>
            <h3 className="font-semibold text-slate-800 truncate text-base">{displayTitle}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"
              title="Minimize"
            >
              <ChevronDown className="w-5 h-5 text-slate-500" />
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"
              title={isMaximized ? 'Restore size' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="w-5 h-5 text-slate-500" />
              ) : (
                <Maximize2 className="w-5 h-5 text-slate-500" />
              )}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition active:scale-90"><X className="w-5 h-5 text-slate-500" /></button>
          </div>
        </div>
        <ActionButtons />

        {/* Nearby Search Tool */}
        {showNearbyTool && (
          <div className="p-3 border-b border-slate-200">
            <NearbySearchTool
              geometry={feature?.geometry}
              endpoint={nearbyEndpoint}
              customFeatureInfo={customFeatureInfo}
              onResults={handleNearbyResults}
              onSaveBufferAsMarkup={handleSaveBufferAsMarkup}
              onClose={() => setShowNearbyTool(false)}
              themeColor={themeColor}
              sourceName={displayTitle}
              sourceType="feature-info"
            />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {renderTabsList()}
          <div className="flex-1 overflow-y-auto p-5 pb-20">
            <div ref={featureContainerRef} className="feature-widget-container" />
          </div>
        </div>
      </div>
    );
  }

  // Desktop minimized view: Only header in top right corner
  if (isMinimized) {
    return (
      <div
        className="absolute right-4 top-4 bg-white shadow-lg z-40 flex items-center rounded-lg border border-slate-200"
        style={{ maxWidth: '300px' }}
      >
        <div className="flex items-center gap-2 px-3 py-2 min-w-0">
          <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: colors.bg500 }} />
          <h3 className="font-semibold text-slate-800 truncate text-sm">{displayTitle}</h3>
        </div>
        <div className="flex items-center gap-1 pr-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition"
            title="Restore"
          >
            <ChevronUp className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>
    );
  }

  // Desktop view: resizable sidebar by default, full map area when maximized
  const desktopStyle = isMaximized
    ? { left: 0, right: 0, width: 'auto' } // Full width of map container
    : { width: desktopWidth };

  return (
    <div
      className={`absolute right-0 top-0 bottom-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-40 flex flex-col border-l border-slate-200 ${
        isMaximized ? 'transition-all duration-300' : ''
      }`}
      style={desktopStyle}
    >
      {/* Resize handle - only show when not maximized */}
      {!isMaximized && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors z-50 flex items-center justify-center group"
          style={{ '--hover-bg': `${colors.bg500}4D` }}
          onMouseDown={startResizingDesktop}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.bg500}4D`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div className="hidden group-hover:block"><GripVertical className="w-3 h-3" style={{ color: colors.text600 }} /></div>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: colors.bg500 }} />
          <h3 className="font-semibold text-slate-800 truncate text-sm">{displayTitle}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white rounded-lg transition"
            title="Minimize"
          >
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-white rounded-lg transition"
            title={isMaximized ? 'Restore size' : 'Maximize'}
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4 text-slate-500" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-500" />
            )}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white rounded-lg transition"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      <ActionButtons />

      {/* Nearby Search Tool */}
      {showNearbyTool && (
        <div className="p-3 border-b border-slate-200">
          <NearbySearchTool
            geometry={feature?.geometry}
            endpoint={nearbyEndpoint}
            customFeatureInfo={customFeatureInfo}
            onResults={handleNearbyResults}
            onSaveBufferAsMarkup={handleSaveBufferAsMarkup}
            onClose={() => setShowNearbyTool(false)}
            themeColor={themeColor}
            sourceName={displayTitle}
            sourceType="feature-info"
          />
        </div>
      )}

      {renderTabsList()}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6">
          <div ref={featureContainerRef} className="feature-widget-container" />
        </div>
      </div>

      <style>{`
        .feature-widget-container .esri-feature { background: transparent !important; padding: 0 !important; }
        .feature-widget-container .esri-feature__title { display: none !important; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled = false, isLoading = false, themeColor = null }) {
  // If themeColor is provided, use it for a highlighted button style
  const isHighlighted = !!themeColor;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${
        disabled
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
          : isHighlighted
            ? 'text-white hover:opacity-90 active:scale-95'
            : 'text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm active:scale-95 border-slate-200'
      }`}
      style={isHighlighted && !disabled ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
    >
      <Icon className={`w-4 h-4 ${disabled ? 'text-slate-300' : isHighlighted ? 'text-white' : 'text-slate-400'} ${isLoading ? 'animate-spin' : ''}`} />
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 transition-all duration-200 truncate">{label}</span>
    </button>
  );
}