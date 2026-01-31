/**
 * ElevationSection Component
 *
 * Displays elevation information for markup features:
 * - Points: Z value with feet/meters toggle
 * - Lines: Elevation stats (low, high, median) + interactive profile graph
 * - Polygons: Elevation stats + 3D grid visualization
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Mountain, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  getPointElevation,
  getLineElevation,
  getPolygonElevation,
  convertElevation,
  formatElevation
} from '../utils/elevationService';
import { getThemeColors } from '../utils/themeColors';
import Point from '@arcgis/core/geometry/Point';
import Graphic from '@arcgis/core/Graphic';

// Elevation unit options
const ELEVATION_UNITS = [
  { id: 'feet', label: 'Feet', suffix: 'ft' },
  { id: 'meters', label: 'Meters', suffix: 'm' }
];

/**
 * ElevationSection Component
 */
export default function ElevationSection({
  markup,
  markupType,
  elevationServiceUrl,
  themeColor,
  view,
  refreshKey = 0
}) {
  const colors = getThemeColors(themeColor || 'sky');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elevationData, setElevationData] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(ELEVATION_UNITS[0]); // Default to feet
  const [hoverPoint, setHoverPoint] = useState(null);
  const hoverGraphicRef = useRef(null);
  const graphContainerRef = useRef(null);

  // Fetch elevation data when markup changes
  useEffect(() => {
    if (!markup?.geometry) {
      setElevationData(null);
      return;
    }

    const fetchElevation = async () => {
      setLoading(true);
      setError(null);
      console.log('[ElevationSection] Fetching elevation for', markupType, 'using service:', elevationServiceUrl);
      console.log('[ElevationSection] Markup geometry:', {
        type: markup.geometry?.type,
        x: markup.geometry?.x,
        y: markup.geometry?.y,
        longitude: markup.geometry?.longitude,
        latitude: markup.geometry?.latitude,
        paths: markup.geometry?.paths?.length,
        rings: markup.geometry?.rings?.length,
        spatialReference: markup.geometry?.spatialReference
      });

      try {
        if (markupType === 'point' || markupType === 'text') {
          const elevation = await getPointElevation(markup.geometry, elevationServiceUrl);
          console.log('[ElevationSection] Point elevation result:', elevation);
          setElevationData({ type: 'point', elevation });
        } else if (markupType === 'polyline') {
          const data = await getLineElevation(markup.geometry, elevationServiceUrl, 50);
          setElevationData({ type: 'line', ...data });
        } else if (markupType === 'polygon') {
          const data = await getPolygonElevation(markup.geometry, elevationServiceUrl, 15);
          setElevationData({ type: 'polygon', ...data });
        }
      } catch (err) {
        console.error('[ElevationSection] Error fetching elevation:', err);
        setError('Unable to fetch elevation data');
      } finally {
        setLoading(false);
      }
    };

    fetchElevation();
  }, [markup, markupType, elevationServiceUrl, refreshKey]);

  // Clean up hover graphic on unmount
  useEffect(() => {
    return () => {
      if (hoverGraphicRef.current && view?.graphics) {
        view.graphics.remove(hoverGraphicRef.current);
      }
    };
  }, [view]);

  // Handle hover on profile graph - show point on map
  const handleProfileHover = useCallback((point) => {
    setHoverPoint(point);

    if (!view?.graphics) return;

    // Remove previous hover graphic
    if (hoverGraphicRef.current) {
      view.graphics.remove(hoverGraphicRef.current);
    }

    if (point) {
      // Create a new hover graphic
      const graphic = new Graphic({
        geometry: new Point({
          x: point.x,
          y: point.y,
          spatialReference: markup?.geometry?.spatialReference
        }),
        symbol: {
          type: 'simple-marker',
          color: colors.bg500,
          size: 12,
          outline: { color: 'white', width: 2 }
        }
      });
      view.graphics.add(graphic);
      hoverGraphicRef.current = graphic;
    }
  }, [view, markup, colors.bg500]);

  const handleProfileLeave = useCallback(() => {
    setHoverPoint(null);
    if (hoverGraphicRef.current && view?.graphics) {
      view.graphics.remove(hoverGraphicRef.current);
      hoverGraphicRef.current = null;
    }
  }, [view]);

  // Handle unit change
  const handleUnitChange = useCallback((unitId) => {
    const unit = ELEVATION_UNITS.find(u => u.id === unitId);
    if (unit) {
      setSelectedUnit(unit);
    }
  }, []);

  // Convert and format elevation value
  const formatValue = useCallback((valueInMeters) => {
    if (valueInMeters === null || valueInMeters === undefined) return '--';
    const converted = convertElevation(valueInMeters, selectedUnit.id);
    return formatElevation(converted, selectedUnit.id);
  }, [selectedUnit]);

  if (!markup?.geometry) return null;

  return (
    <div className="px-4 py-3 border-b border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">Elevation</span>
        </div>

        {/* Unit Toggle */}
        <div className="flex gap-1">
          {ELEVATION_UNITS.map(unit => (
            <button
              key={unit.id}
              onClick={() => handleUnitChange(unit.id)}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded transition ${
                selectedUnit.id === unit.id
                  ? 'text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              style={selectedUnit.id === unit.id ? { backgroundColor: colors.bg500 } : {}}
            >
              {unit.suffix}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Loading elevation...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center gap-2 py-2 text-amber-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Point Elevation */}
      {!loading && !error && elevationData?.type === 'point' && (
        <PointElevationDisplay
          elevation={elevationData.elevation}
          formatValue={formatValue}
          colors={colors}
        />
      )}

      {/* Line Elevation */}
      {!loading && !error && elevationData?.type === 'line' && (
        <LineElevationDisplay
          data={elevationData}
          formatValue={formatValue}
          selectedUnit={selectedUnit}
          colors={colors}
          onHover={handleProfileHover}
          onLeave={handleProfileLeave}
          hoverPoint={hoverPoint}
        />
      )}

      {/* Polygon Elevation */}
      {!loading && !error && elevationData?.type === 'polygon' && (
        <PolygonElevationDisplay
          data={elevationData}
          formatValue={formatValue}
          selectedUnit={selectedUnit}
          colors={colors}
        />
      )}
    </div>
  );
}

/**
 * Point Elevation Display
 */
function PointElevationDisplay({ elevation, formatValue, colors }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-center">
        <div className="text-2xl font-bold text-slate-800">
          {formatValue(elevation)}
        </div>
        <div className="text-xs text-slate-500 mt-1">Z Value</div>
      </div>
    </div>
  );
}

/**
 * Line Elevation Display
 */
function LineElevationDisplay({ data, formatValue, selectedUnit, colors, onHover, onLeave, hoverPoint }) {
  const { points, stats, totalDistance } = data;
  const containerRef = useRef(null);

  // Calculate graph dimensions
  const graphHeight = 100;
  const graphPadding = { top: 10, bottom: 25, left: 45, right: 10 };

  // Get min/max for scaling
  const elevations = points.map(p => p.elevation).filter(e => e !== null);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  // Convert distance based on selected unit
  const distanceInUnits = selectedUnit.id === 'feet'
    ? totalDistance * 3.28084
    : totalDistance;
  const distanceUnit = selectedUnit.id === 'feet' ? 'ft' : 'm';

  // Handle mouse move on graph
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || points.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const graphWidth = rect.width - graphPadding.left - graphPadding.right;
    const x = e.clientX - rect.left - graphPadding.left;

    if (x < 0 || x > graphWidth) {
      onLeave?.();
      return;
    }

    // Find the closest point
    const ratio = x / graphWidth;
    const idx = Math.round(ratio * (points.length - 1));
    const point = points[Math.max(0, Math.min(idx, points.length - 1))];
    onHover?.(point);
  }, [points, onHover, onLeave]);

  // Generate SVG path for the elevation profile
  const pathD = useMemo(() => {
    if (points.length < 2) return '';

    const width = 300; // Will be scaled by viewBox
    const height = graphHeight - graphPadding.top - graphPadding.bottom;

    return points.map((point, i) => {
      const x = (point.distance / totalDistance) * width;
      const y = height - ((point.elevation - minElev) / elevRange) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [points, totalDistance, minElev, elevRange]);

  // Generate area fill path
  const areaD = useMemo(() => {
    if (points.length < 2) return '';

    const width = 300;
    const height = graphHeight - graphPadding.top - graphPadding.bottom;

    const linePath = points.map((point, i) => {
      const x = (point.distance / totalDistance) * width;
      const y = height - ((point.elevation - minElev) / elevRange) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return `${linePath} L ${300} ${height} L 0 ${height} Z`;
  }, [points, totalDistance, minElev, elevRange]);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox
          icon={<TrendingDown className="w-3 h-3" />}
          label="Low"
          value={formatValue(stats.min)}
          colors={colors}
        />
        <StatBox
          icon={<Minus className="w-3 h-3" />}
          label="Median"
          value={formatValue(stats.median)}
          colors={colors}
        />
        <StatBox
          icon={<TrendingUp className="w-3 h-3" />}
          label="High"
          value={formatValue(stats.max)}
          colors={colors}
        />
      </div>

      {/* Profile Graph */}
      <div
        ref={containerRef}
        className="relative bg-slate-50 rounded-lg p-2 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={onLeave}
      >
        <svg
          viewBox={`0 0 300 ${graphHeight}`}
          className="w-full"
          style={{ height: graphHeight }}
          preserveAspectRatio="none"
        >
          {/* Y-axis labels */}
          <text x={graphPadding.left - 5} y={graphPadding.top + 5} className="text-[8px]" fill="#64748b" textAnchor="end">
            {formatValue(maxElev)}
          </text>
          <text x={graphPadding.left - 5} y={graphHeight - graphPadding.bottom} className="text-[8px]" fill="#64748b" textAnchor="end">
            {formatValue(minElev)}
          </text>

          {/* Graph area */}
          <g transform={`translate(${graphPadding.left}, ${graphPadding.top})`}>
            {/* Area fill */}
            <path
              d={areaD}
              fill={`${colors.bg500}20`}
              stroke="none"
            />

            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.bg500}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover point indicator */}
            {hoverPoint && (
              <>
                <line
                  x1={(hoverPoint.distance / totalDistance) * 300}
                  y1={0}
                  x2={(hoverPoint.distance / totalDistance) * 300}
                  y2={graphHeight - graphPadding.top - graphPadding.bottom}
                  stroke={colors.bg500}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <circle
                  cx={(hoverPoint.distance / totalDistance) * 300}
                  cy={(graphHeight - graphPadding.top - graphPadding.bottom) - ((hoverPoint.elevation - minElev) / elevRange) * (graphHeight - graphPadding.top - graphPadding.bottom)}
                  r="4"
                  fill={colors.bg500}
                  stroke="white"
                  strokeWidth="2"
                />
              </>
            )}
          </g>

          {/* X-axis labels */}
          <text x={graphPadding.left} y={graphHeight - 5} className="text-[8px]" fill="#64748b">
            0
          </text>
          <text x={300 - graphPadding.right} y={graphHeight - 5} className="text-[8px]" fill="#64748b" textAnchor="end">
            {distanceInUnits.toLocaleString(undefined, { maximumFractionDigits: 0 })} {distanceUnit}
          </text>
        </svg>

        {/* Hover tooltip */}
        {hoverPoint && (
          <div
            className="absolute bg-white border border-slate-200 rounded px-2 py-1 text-xs shadow-sm pointer-events-none"
            style={{
              left: `${(hoverPoint.distance / totalDistance) * 100}%`,
              top: '5px',
              transform: 'translateX(-50%)'
            }}
          >
            {formatValue(hoverPoint.elevation)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Polygon Elevation Display (2D heatmap visualization)
 */
function PolygonElevationDisplay({ data, formatValue, selectedUnit, colors }) {
  const { grid, stats, gridSize, extent } = data;

  // Calculate min/max for color scaling
  const elevations = grid.map(p => p.elevation).filter(e => e !== null);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  // SVG dimensions and padding
  const svgWidth = 280;
  const svgHeight = 120;
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Calculate extent dimensions
  const extentWidth = extent.xmax - extent.xmin || 1;
  const extentHeight = extent.ymax - extent.ymin || 1;

  // Calculate aspect ratio and fit the grid into the graph area
  const extentAspect = extentWidth / extentHeight;
  const graphAspect = graphWidth / graphHeight;

  let scale, offsetX, offsetY;
  if (extentAspect > graphAspect) {
    // Wider than tall - fit to width
    scale = graphWidth / extentWidth;
    offsetX = padding.left;
    offsetY = padding.top + (graphHeight - extentHeight * scale) / 2;
  } else {
    // Taller than wide - fit to height
    scale = graphHeight / extentHeight;
    offsetX = padding.left + (graphWidth - extentWidth * scale) / 2;
    offsetY = padding.top;
  }

  // Transform coordinates to SVG space
  const toSvg = (x, y) => ({
    x: offsetX + (x - extent.xmin) * scale,
    y: offsetY + (extent.ymax - y) * scale // Flip Y axis
  });

  // Calculate cell size based on grid density
  const cellSize = Math.max(
    (extentWidth / gridSize) * scale * 0.9,
    (extentHeight / gridSize) * scale * 0.9,
    4 // Minimum cell size
  );

  // Get color based on elevation (blue-green-yellow-orange gradient)
  const getColor = (elevation) => {
    const normalized = (elevation - minElev) / elevRange;
    if (normalized < 0.33) {
      // Blue to green
      const t = normalized / 0.33;
      return `rgb(${Math.round(59 + t * 30)}, ${Math.round(130 + t * 100)}, ${Math.round(246 - t * 180)})`;
    } else if (normalized < 0.66) {
      // Green to yellow
      const t = (normalized - 0.33) / 0.33;
      return `rgb(${Math.round(89 + t * 160)}, ${Math.round(230 - t * 30)}, ${Math.round(66 - t * 40)})`;
    } else {
      // Yellow to orange
      const t = (normalized - 0.66) / 0.34;
      return `rgb(${Math.round(249)}, ${Math.round(200 - t * 100)}, ${Math.round(26)})`;
    }
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox
          icon={<TrendingDown className="w-3 h-3" />}
          label="Low"
          value={formatValue(stats.min)}
          colors={colors}
        />
        <StatBox
          icon={<Minus className="w-3 h-3" />}
          label="Median"
          value={formatValue(stats.median)}
          colors={colors}
        />
        <StatBox
          icon={<TrendingUp className="w-3 h-3" />}
          label="High"
          value={formatValue(stats.max)}
          colors={colors}
        />
      </div>

      {/* 2D Heatmap Visualization */}
      <div className="relative bg-slate-50 rounded-lg p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Render grid cells as colored squares */}
          {grid.map((point) => {
            const pos = toSvg(point.x, point.y);
            const color = getColor(point.elevation);

            return (
              <rect
                key={`cell-${point.row}-${point.col}`}
                x={pos.x - cellSize / 2}
                y={pos.y - cellSize / 2}
                width={cellSize}
                height={cellSize}
                fill={color}
                rx="1"
              />
            );
          })}

          {/* Legend gradient bar */}
          <defs>
            <linearGradient id="elevGradientHeatmap" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="33%" stopColor="#22c55e" />
              <stop offset="66%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          {/* Legend */}
          <rect x="40" y={svgHeight - 18} width={svgWidth - 80} height="6" fill="url(#elevGradientHeatmap)" rx="1" />
          <text x="40" y={svgHeight - 4} className="text-[7px]" fill="#64748b">
            {formatValue(minElev)}
          </text>
          <text x={svgWidth - 40} y={svgHeight - 4} className="text-[7px]" fill="#64748b" textAnchor="end">
            {formatValue(maxElev)}
          </text>
        </svg>
      </div>
    </div>
  );
}

/**
 * Stat Box Component
 */
function StatBox({ icon, label, value, colors }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
        {icon}
        <span className="text-[9px] uppercase font-medium">{label}</span>
      </div>
      <div className="text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}
