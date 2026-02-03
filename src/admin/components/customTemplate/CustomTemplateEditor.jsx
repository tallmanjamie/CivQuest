// src/admin/components/customTemplate/CustomTemplateEditor.jsx
// Main container component for custom email template editing
// Features Designer mode with drag-and-drop and HTML mode with live preview

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  FileDown,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  Info,
  Code,
  MousePointer2,
  GripVertical,
  Trash2,
  Plus,
  Move,
  Monitor,
  Smartphone,
  RefreshCw,
  Database,
  Loader2,
  LayoutTemplate,
  Type,
  BarChart3,
  Table,
  Download,
  FileText,
  Columns,
  Copy,
  Search,
  X,
  Settings2,
  // Icons available for the icon widget
  Bell,
  Star,
  Heart,
  Bookmark,
  Flag,
  Award,
  Zap,
  Sun,
  Moon,
  Cloud,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Users,
  User,
  Home,
  Building,
  Car,
  Plane,
  Ship,
  TreePine,
  Droplet,
  Flame,
  Wind,
  Thermometer,
  Shield,
  Lock,
  Key,
  Wifi,
  Signal,
  Battery,
  Camera,
  Image,
  Music,
  Video,
  Mic,
  Speaker,
  Headphones,
  Globe,
  Map,
  Compass,
  Navigation,
  Target,
  Crosshair,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  ShoppingCart,
  Package,
  Truck,
  Gift,
  Tag,
  Percent,
  Hash,
  AtSign,
  Link,
  Paperclip,
  Scissors,
  Clipboard,
  FileCheck,
  FolderOpen,
  Archive,
  Inbox,
  Send,
  MessageSquare,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Frown,
  Meh
} from 'lucide-react';
import ThemeCustomizer from './ThemeCustomizer';
import StatisticsBuilder from './StatisticsBuilder';
import BrandingCustomizer from './BrandingCustomizer';
import { DEFAULT_THEME, DEFAULT_CUSTOM_TEMPLATE_HTML, DEFAULT_BRANDING, PLACEHOLDER_SECTIONS } from './constants';
import { validateCustomTemplate, generateSampleContext } from './validation';

// Icon map for the icon widget - allows users to select from these icons
const AVAILABLE_ICONS = {
  Bell, Star, Heart, Bookmark, Flag, Award, Zap, Sun, Moon, Cloud,
  MapPin, Phone, Mail, Calendar, Clock, Users, User, Home, Building,
  Car, Plane, Ship, TreePine, Droplet, Flame, Wind, Thermometer,
  Shield, Lock, Key, Wifi, Signal, Battery, Camera, Image, Music,
  Video, Mic, Speaker, Headphones, Globe, Map, Compass, Navigation,
  Target, Crosshair, Activity, TrendingUp, TrendingDown, DollarSign,
  CreditCard, ShoppingCart, Package, Truck, Gift, Tag, Percent, Hash,
  AtSign, Link, Paperclip, Scissors, Clipboard, FileCheck, FolderOpen,
  Archive, Inbox, Send, MessageSquare, MessageCircle, ThumbsUp,
  ThumbsDown, Smile, Frown, Meh, AlertCircle, Info, Check, Database
};

// Visual Builder Element Types for drag-and-drop
const VISUAL_ELEMENTS = [
  {
    id: 'header',
    name: 'Header',
    icon: 'LayoutTemplate',
    category: 'structure',
    defaultContent: {
      type: 'header',
      title: '{{organizationName}}',
      subtitle: '{{notificationName}}',
      usePrimaryColor: true,
      titleSize: '24',
      subtitleSize: '14',
      alignment: 'left'
    }
  },
  {
    id: 'logo',
    name: 'Logo',
    icon: 'LayoutTemplate',
    category: 'structure',
    defaultContent: {
      type: 'logo',
      placeholder: '{{logoHtml}}',
      size: '150',
      alignment: 'left'
    }
  },
  {
    id: 'text',
    name: 'Text Block',
    icon: 'Type',
    category: 'content',
    defaultContent: {
      type: 'text',
      content: '<p>Add your custom text here...</p>',
      textSize: '14',
      alignment: 'left'
    }
  },
  {
    id: 'intro',
    name: 'Email Intro',
    icon: 'Type',
    category: 'content',
    defaultContent: {
      type: 'text',
      content: '{{emailIntro}}'
    }
  },
  {
    id: 'statistics',
    name: 'Statistics',
    icon: 'BarChart3',
    category: 'content',
    defaultContent: {
      type: 'statistics',
      selectedStatistics: [], // Empty = show all, otherwise array of stat IDs
      valueSize: '24',
      valueAlignment: 'center',
      containerWidth: '100',
      containerAlignment: 'center',
      placeholder: '{{statisticsHtml}}'
    }
  },
  {
    id: 'record-count',
    name: 'Record Count',
    icon: 'BarChart3',
    category: 'content',
    defaultContent: {
      type: 'record-count',
      template: 'We found <strong>{{recordCount}}</strong> new records matching your subscription.'
    }
  },
  {
    id: 'date-range',
    name: 'Date Range',
    icon: 'FileText',
    category: 'content',
    defaultContent: {
      type: 'date-range',
      template: '<strong>Reporting Period:</strong> {{dateRangeStart}} - {{dateRangeEnd}}'
    }
  },
  {
    id: 'datatable',
    name: 'Data Table',
    icon: 'Table',
    category: 'data',
    defaultContent: {
      type: 'datatable',
      placeholder: '{{dataTable}}',
      selectedFields: [], // Empty = use notification's display fields, otherwise array of field names
      recordLimit: 10 // Number of records to show in the table
    }
  },
  {
    id: 'download-button',
    name: 'Download Button',
    icon: 'Download',
    category: 'data',
    defaultContent: {
      type: 'download-button',
      placeholder: '{{downloadButton}}'
    }
  },
  {
    id: 'more-records',
    name: 'More Records',
    icon: 'Info',
    category: 'data',
    defaultContent: {
      type: 'more-records',
      placeholder: '{{moreRecordsMessage}}'
    }
  },
  {
    id: 'divider',
    name: 'Divider',
    icon: 'Columns',
    category: 'structure',
    defaultContent: {
      type: 'divider',
      width: '100',
      alignment: 'center',
      thickness: '1',
      style: 'solid'
    }
  },
  {
    id: 'spacer',
    name: 'Spacer',
    icon: 'Columns',
    category: 'structure',
    defaultContent: {
      type: 'spacer',
      height: '20px'
    }
  },
  {
    id: 'icon',
    name: 'Icon',
    icon: 'Star',
    category: 'structure',
    defaultContent: {
      type: 'icon',
      iconName: 'Star',
      iconSize: '24',
      iconColor: '{{primaryColor}}',
      alignment: 'center'
    }
  },
  {
    id: 'row',
    name: 'Row (Icon + Content)',
    icon: 'Columns',
    category: 'structure',
    defaultContent: {
      type: 'row',
      iconName: 'Star',
      iconSize: '32',
      iconColor: '{{primaryColor}}',
      iconPosition: 'left',
      contentType: 'text',
      content: '<p>Add your content here...</p>',
      selectedStatistics: [],
      statisticsValueSize: '24',
      statisticsValueAlignment: 'left',
      statisticsContainerWidth: '100',
      statisticsContainerAlignment: 'center',
      verticalAlign: 'center',
      gap: '15'
    }
  },
  {
    id: 'footer',
    name: 'Footer',
    icon: 'FileText',
    category: 'structure',
    defaultContent: {
      type: 'footer',
      text: 'You are receiving this because you subscribed to notifications.',
      textSize: '12',
      alignment: 'left'
    }
  },
  {
    id: 'graph',
    name: 'Graph',
    icon: 'BarChart3',
    category: 'content',
    defaultContent: {
      type: 'graph',
      graphType: 'bar', // 'bar', 'line', or 'pie'
      title: 'Chart Title',
      dataField: '', // Field to aggregate
      labelField: '', // Field for labels/categories
      operation: 'count', // 'sum', 'count', 'mean'
      width: '100', // percentage
      height: '250', // pixels
      alignment: 'center',
      showLegend: true,
      showValues: true,
      maxItems: 6 // Max categories to show
    }
  }
];

// Configuration for the proxy service
const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://api.civ.quest';

/**
 * Helper function to generate statistics HTML for a subset of statistics
 * @param {Array} statistics - Array of statistic definitions
 * @param {Object} sampleContext - Sample context with stat values
 * @param {Object} theme - Theme colors
 * @param {Object} options - Optional display options (valueSize, alignment)
 */
function generateSelectedStatisticsHtml(statistics, sampleContext, theme, options = {}) {
  if (!statistics || statistics.length === 0) return '';

  const primaryColor = theme?.primaryColor || '#004E7C';
  const secondaryColor = theme?.secondaryColor || '#f2f2f2';
  const mutedTextColor = theme?.mutedTextColor || '#666666';

  // Options for customizing statistics display
  const valueSize = options.valueSize || '24';
  const valueAlignment = options.valueAlignment || 'center';
  const containerWidth = options.containerWidth || '100';
  const containerAlignment = options.containerAlignment || 'center';
  const labelSize = Math.max(9, Math.round(parseInt(valueSize) * 0.45));

  const cards = statistics.map(stat => {
    const value = sampleContext[`stat_${stat.id}`] || '-';
    const label = stat.label || stat.id;

    return `<td style="width: ${100 / statistics.length}%; padding: 10px; text-align: ${valueAlignment}; vertical-align: top;">
      <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="margin: 0; font-size: ${labelSize}px; color: ${mutedTextColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
        <p style="margin: 8px 0 0 0; font-size: ${valueSize}px; font-weight: bold; color: ${primaryColor};">${value}</p>
      </div>
    </td>`;
  }).join('');

  // Container alignment determines how the table is positioned when not full width
  const tableMargin = containerAlignment === 'left'
    ? 'margin-right: auto;'
    : containerAlignment === 'right'
      ? 'margin-left: auto;'
      : 'margin: 0 auto;';

  const widthValue = containerWidth === '100' ? '100%' : `${containerWidth}%`;

  return `<div style="padding: 0; margin: 0;">
    <table style="width: ${widthValue}; border-collapse: collapse; background-color: ${secondaryColor}; border-radius: 8px; ${tableMargin}">
      <tr>${cards}</tr>
    </table>
  </div>`;
}

/**
 * Helper function to generate graph HTML (SVG-based charts for email)
 * @param {string} graphType - 'bar', 'line', or 'pie'
 * @param {Array} data - Array of {label, value} objects
 * @param {Object} theme - Theme colors
 * @param {Object} options - Graph options (title, width, height, showLegend, showValues)
 */
/**
 * Helper function to wrap text into multiple lines for SVG
 * @param {string} text - The text to wrap
 * @param {number} maxChars - Maximum characters per line
 * @returns {string[]} Array of text lines
 */
function wrapText(text, maxChars = 12) {
  if (!text || text.length <= maxChars) {
    return [text];
  }

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // If we have no lines (single long word), break the word
  if (lines.length === 0) {
    lines.push(text.substring(0, maxChars));
    if (text.length > maxChars) {
      lines.push(text.substring(maxChars));
    }
  }

  return lines;
}

/**
 * Generate wrapped text SVG element with tspan elements
 * @param {string} text - Text to display
 * @param {number} x - X position
 * @param {number} y - Starting Y position
 * @param {number} maxChars - Max characters per line
 * @param {string} fill - Text color
 * @param {number} rotation - Rotation angle (optional)
 * @param {number} lineHeight - Line height in pixels (default 11)
 * @returns {string} SVG text element with tspan children
 */
function generateWrappedText(text, x, y, maxChars, fill, rotation = 0, lineHeight = 11) {
  const lines = wrapText(text, maxChars);
  const transform = rotation !== 0 ? ` transform="rotate(${rotation} ${x} ${y})"` : '';

  const tspans = lines.map((line, i) => {
    const dy = i === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" ${i === 0 ? `y="${y}"` : `dy="${dy}"`}>${line}</tspan>`;
  }).join('');

  return `<text text-anchor="middle" font-size="9" fill="${fill}"${transform}>${tspans}</text>`;
}

function generateGraphHtml(graphType, data, theme, options = {}) {
  console.log('[Graph Debug] generateGraphHtml called:', {
    graphType,
    dataPoints: data?.length || 0,
    data: data,
    theme: {
      primaryColor: theme?.primaryColor,
      accentColor: theme?.accentColor,
      textColor: theme?.textColor
    },
    options
  });

  if (!data || data.length === 0) {
    console.log('[Graph Debug] generateGraphHtml returning "no data" message');
    return '<div style="padding: 20px; text-align: center; color: #666; font-style: italic;">No data available for chart</div>';
  }

  // Check if all values are zero - this indicates a data extraction issue
  const maxValue = Math.max(...data.map(d => d.value));
  if (maxValue === 0) {
    console.warn('[Graph Debug] All graph values are 0 - possible field name mismatch in ArcGIS response:', {
      dataPoints: data.length,
      labels: data.map(d => d.label)
    });
    return '<div style="padding: 20px; text-align: center; color: #92400e; background-color: #fef3c7; border-radius: 4px; font-size: 12px;">Chart data loaded but all values are 0. Check console for field mapping details.</div>';
  }

  const primaryColor = theme?.primaryColor || '#004E7C';
  const secondaryColor = theme?.secondaryColor || '#f2f2f2';
  const accentColor = theme?.accentColor || '#0077B6';
  const textColor = theme?.textColor || '#333333';
  const mutedTextColor = theme?.mutedTextColor || '#666666';

  const width = parseInt(options.width) || 100;
  const height = parseInt(options.height) || 250;
  const title = options.title || '';
  const showLegend = options.showLegend !== false;
  const showValues = options.showValues !== false;
  const alignment = options.alignment || 'center';

  // Generate a color palette based on theme
  const colors = [
    primaryColor,
    accentColor,
    '#4CAF50', // green
    '#FF9800', // orange
    '#9C27B0', // purple
    '#00BCD4', // cyan
    '#E91E63', // pink
    '#795548', // brown
  ];

  const containerMargin = alignment === 'left' ? 'margin-right: auto;'
    : alignment === 'right' ? 'margin-left: auto;'
    : 'margin: 0 auto;';

  const svgWidth = 400;
  const svgHeight = height;
  const padding = { top: 40, right: 20, bottom: 80, left: 50 };

  // maxValue already calculated above for the zero-check
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  let chartSvg = '';

  if (graphType === 'bar') {
    // Bar Chart
    const barWidth = chartWidth / data.length * 0.7;
    const barGap = chartWidth / data.length * 0.3;

    const bars = data.map((d, i) => {
      const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const y = padding.top + chartHeight - barHeight;
      const color = colors[i % colors.length];

      let bar = `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>`;
      if (showValues && d.value > 0) {
        bar += `<text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="${textColor}">${d.value.toLocaleString()}</text>`;
      }
      bar += generateWrappedText(d.label, x + barWidth/2, svgHeight - 35, 12, mutedTextColor, -30);
      return bar;
    }).join('');

    // Y-axis
    const yAxisLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const y = padding.top + chartHeight * (1 - ratio);
      const val = Math.round(maxValue * ratio);
      return `<line x1="${padding.left - 5}" y1="${y}" x2="${svgWidth - padding.right}" y2="${y}" stroke="#eee" stroke-width="1"/>
              <text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="${mutedTextColor}">${val.toLocaleString()}</text>`;
    }).join('');

    chartSvg = `${yAxisLines}${bars}`;

  } else if (graphType === 'line') {
    // Line Chart
    const pointGap = chartWidth / (data.length - 1 || 1);

    const points = data.map((d, i) => {
      const x = padding.left + i * pointGap;
      const y = maxValue > 0 ? padding.top + chartHeight - (d.value / maxValue) * chartHeight : padding.top + chartHeight;
      return { x, y, label: d.label, value: d.value };
    });

    // Draw area under line
    const areaPath = `M${points[0].x},${padding.top + chartHeight} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length-1].x},${padding.top + chartHeight} Z`;

    // Draw line
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    // Draw dots and labels
    const dotsAndLabels = points.map((p, i) => {
      let result = `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${primaryColor}" stroke="white" stroke-width="2"/>`;
      if (showValues) {
        result += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="9" fill="${textColor}">${p.value.toLocaleString()}</text>`;
      }
      result += generateWrappedText(p.label, p.x, svgHeight - 35, 12, mutedTextColor, -30);
      return result;
    }).join('');

    // Y-axis
    const yAxisLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const y = padding.top + chartHeight * (1 - ratio);
      const val = Math.round(maxValue * ratio);
      return `<line x1="${padding.left - 5}" y1="${y}" x2="${svgWidth - padding.right}" y2="${y}" stroke="#eee" stroke-width="1"/>
              <text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="${mutedTextColor}">${val.toLocaleString()}</text>`;
    }).join('');

    chartSvg = `${yAxisLines}
      <path d="${areaPath}" fill="${primaryColor}" fill-opacity="0.1"/>
      <path d="${linePath}" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dotsAndLabels}`;

  } else if (graphType === 'pie') {
    // Pie Chart
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      return '<div style="padding: 20px; text-align: center; color: #666; font-style: italic;">No data for pie chart</div>';
    }

    const centerX = svgWidth / 2;
    const centerY = (svgHeight - (showLegend ? 40 : 0)) / 2 + padding.top / 2;
    const radius = Math.min(centerX - padding.left, centerY - padding.top) - 20;

    let currentAngle = -Math.PI / 2; // Start at top
    const slices = data.map((d, i) => {
      const sliceAngle = (d.value / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
      const color = colors[i % colors.length];

      // Calculate label position
      const labelAngle = startAngle + sliceAngle / 2;
      const labelRadius = radius * 0.7;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);
      const percentage = Math.round((d.value / total) * 100);

      let slice = `<path d="M${centerX},${centerY} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2} Z" fill="${color}" stroke="white" stroke-width="2"/>`;
      if (showValues && percentage >= 5) {
        slice += `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="bold" fill="white">${percentage}%</text>`;
      }
      return slice;
    }).join('');

    // Legend
    let legend = '';
    if (showLegend) {
      const legendY = svgHeight - 30;
      const legendItems = data.map((d, i) => {
        const itemWidth = svgWidth / Math.min(data.length, 4);
        const x = (i % 4) * itemWidth + 10;
        const row = Math.floor(i / 4);
        const y = legendY + row * 15;
        const color = colors[i % colors.length];
        return `<rect x="${x}" y="${y}" width="10" height="10" fill="${color}" rx="2"/>
                <text x="${x + 14}" y="${y + 8}" font-size="9" fill="${mutedTextColor}">${d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label}</text>`;
      }).join('');
      legend = legendItems;
    }

    chartSvg = `${slices}${legend}`;
  }

  // Title
  const titleHtml = title ? `<text x="${svgWidth/2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="${textColor}">${title}</text>` : '';

  const html = `<div style="width: ${width}%; ${containerMargin} padding: 15px;">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; max-width: ${svgWidth}px;">
      <rect width="100%" height="100%" fill="white"/>
      ${titleHtml}
      ${chartSvg}
    </svg>
  </div>`;

  console.log('[Graph Debug] generateGraphHtml complete:', {
    graphType,
    htmlLength: html.length,
    hasTitle: !!title,
    dimensions: { width: `${width}%`, height: svgHeight }
  });

  return html;
}

/**
 * Format a value based on its field type for display in data tables
 * @param {*} value - The raw value to format
 * @param {string} fieldType - The ArcGIS field type (esriFieldTypeString, esriFieldTypeDate, etc.)
 * @param {Object} domain - Optional domain for coded values
 * @returns {string} Formatted value for display
 */
function formatFieldValue(value, fieldType, domain = null) {
  // Handle null/undefined/empty values
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // Handle coded value domains
  if (domain && domain.type === 'codedValue' && domain.codedValues) {
    const codedValue = domain.codedValues.find(cv => cv.code === value);
    if (codedValue) {
      return codedValue.name;
    }
  }

  // Format based on field type
  switch (fieldType) {
    case 'esriFieldTypeDate':
      // ArcGIS dates are stored as milliseconds since epoch
      if (typeof value === 'number') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          // Format as readable date: "Jan 15, 2024"
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        }
      }
      // Try parsing string date
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        }
      }
      return String(value);

    case 'esriFieldTypeDouble':
    case 'esriFieldTypeSingle':
      // Format decimal numbers with 2 decimal places if needed
      if (typeof value === 'number') {
        // Only show decimal places if the number has them
        if (Number.isInteger(value)) {
          return value.toLocaleString();
        }
        return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }
      return String(value);

    case 'esriFieldTypeInteger':
    case 'esriFieldTypeSmallInteger':
    case 'esriFieldTypeOID':
      // Format integers with thousand separators
      if (typeof value === 'number') {
        return Math.round(value).toLocaleString();
      }
      return String(value);

    case 'esriFieldTypeString':
    case 'esriFieldTypeGlobalID':
    default:
      // Return as-is for strings and other types
      return String(value);
  }
}

/**
 * Helper function to aggregate data for graph
 * @param {Array} records - Array of data records
 * @param {string} labelField - Field to use for labels/categories
 * @param {string} dataField - Field to aggregate values from
 * @param {string} operation - 'sum', 'count', or 'mean'
 * @param {number} maxItems - Maximum number of items to show
 */
function aggregateGraphData(records, labelField, dataField, operation, maxItems = 6) {
  console.log('[Graph Debug] aggregateGraphData called:', {
    recordCount: records?.length || 0,
    labelField,
    dataField,
    operation,
    maxItems
  });

  if (!records || records.length === 0 || !labelField) {
    console.log('[Graph Debug] aggregateGraphData early return - missing data:', {
      hasRecords: !!records,
      recordCount: records?.length || 0,
      labelField
    });
    return [];
  }

  // Helper to get field value case-insensitively
  const getFieldValue = (record, fieldName) => {
    if (!record || !fieldName) return null;
    // First try exact match
    if (record[fieldName] !== undefined) return record[fieldName];
    // Then try case-insensitive match
    const lowerFieldName = fieldName.toLowerCase();
    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === lowerFieldName) {
        return record[key];
      }
    }
    return null;
  };

  // Log sample record to help debug field matching
  if (records.length > 0) {
    console.log('[Graph Debug] aggregateGraphData sample record fields:', {
      availableFields: Object.keys(records[0]),
      sampleRecord: records[0],
      labelFieldValue: getFieldValue(records[0], labelField),
      dataFieldValue: dataField ? getFieldValue(records[0], dataField) : 'N/A (using count)'
    });
  }

  // Group by label field
  const groups = {};
  let skippedRecords = 0;
  records.forEach(record => {
    const labelValue = getFieldValue(record, labelField);
    // Normalize label: trim whitespace to ensure proper grouping
    const label = String(labelValue ?? 'Unknown').trim();
    // Skip invalid labels
    if (label === 'Unknown' || label === 'null' || label === 'undefined' || label === '') {
      skippedRecords++;
      return;
    }
    if (!groups[label]) {
      groups[label] = [];
    }
    const rawValue = dataField ? getFieldValue(record, dataField) : 1;
    const value = parseFloat(rawValue);
    if (!isNaN(value)) {
      groups[label].push(value);
    } else if (!dataField) {
      // For count operations without dataField, always count the record
      groups[label].push(1);
    }
  });

  console.log('[Graph Debug] aggregateGraphData grouping complete:', {
    uniqueGroups: Object.keys(groups).length,
    groupLabels: Object.keys(groups),
    skippedRecords
  });

  // Calculate aggregated values
  const result = Object.entries(groups).map(([label, values]) => {
    let value;
    switch (operation) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'mean':
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'count':
      default:
        value = values.length;
        break;
    }
    return { label, value: Math.round(value * 100) / 100 };
  });

  // Sort by value descending and limit
  result.sort((a, b) => b.value - a.value);
  const finalResult = result.slice(0, maxItems);

  console.log('[Graph Debug] aggregateGraphData result:', {
    totalGroups: result.length,
    returnedGroups: finalResult.length,
    data: finalResult
  });

  return finalResult;
}

/**
 * Generate sample data for graph preview when no live data is available
 * @param {string} graphType - 'bar', 'line', or 'pie'
 * @param {number} count - Number of data points
 */
function generateSampleGraphData(graphType, count = 5) {
  const labels = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E', 'Category F'];
  return labels.slice(0, count).map((label, i) => ({
    label,
    value: Math.round(50 + Math.random() * 100)
  }));
}

/**
 * CustomTemplateEditor Component
 *
 * Container for the full custom template editing experience
 * Features Designer mode (drag-and-drop) and HTML mode (raw code)
 *
 * Props:
 * @param {object} customTemplate - Current custom template configuration
 * @param {function} onChange - Called with updated custom template
 * @param {object} notification - Parent notification configuration
 * @param {object} locality - Organization/locality data
 * @param {function} onSendTest - Called to send a test email
 */
export default function CustomTemplateEditor({
  customTemplate = {},
  onChange,
  notification = {},
  locality = {},
  onSendTest
}) {
  // Right panel mode: 'designer' or 'html'
  const [rightPanelMode, setRightPanelMode] = useState('designer');
  const [previewMode, setPreviewMode] = useState('desktop');
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    branding: true,
    theme: false,
    statistics: true,
    placeholders: false
  });

  // Live data state
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(false);
  const [liveDataRecords, setLiveDataRecords] = useState([]);
  const [liveDataFields, setLiveDataFields] = useState([]);
  const [liveDataFieldMetadata, setLiveDataFieldMetadata] = useState({}); // Full field metadata including type info
  const [liveDataError, setLiveDataError] = useState(null);
  const [liveRecordCount, setLiveRecordCount] = useState(null);
  const [useLiveData, setUseLiveData] = useState(false);

  // Server-side statistics state
  const [serverStatistics, setServerStatistics] = useState({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Server-side graph data state (keyed by graph element ID)
  const [serverGraphData, setServerGraphData] = useState({});
  const [isLoadingGraphData, setIsLoadingGraphData] = useState({});

  // Track previous graph configurations to detect actual changes
  const prevGraphConfigsRef = useRef({});

  // Drag and drop state
  const [draggedElement, setDraggedElement] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragCounter = useRef(0);

  // Copied placeholder
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);

  // Element editing state
  const [selectedElementIndex, setSelectedElementIndex] = useState(null);

  // Ensure default values
  const template = {
    html: customTemplate.html || DEFAULT_CUSTOM_TEMPLATE_HTML,
    includeCSV: customTemplate.includeCSV !== false,
    theme: { ...DEFAULT_THEME, ...(customTemplate.theme || {}) },
    branding: { ...DEFAULT_BRANDING, ...(customTemplate.branding || {}) },
    statistics: customTemplate.statistics || [],
    visualElements: customTemplate.visualElements || [],
    ...customTemplate
  };

  // Update handler with defaults
  const handleUpdate = useCallback((updates) => {
    onChange({
      ...template,
      ...updates
    });
  }, [template, onChange]);

  // Theme update handler
  const handleThemeChange = useCallback((theme) => {
    handleUpdate({ theme });
  }, [handleUpdate]);

  // Branding update handler
  const handleBrandingChange = useCallback((branding) => {
    handleUpdate({ branding });
  }, [handleUpdate]);

  // Statistics update handler
  const handleStatisticsChange = useCallback((statistics) => {
    handleUpdate({ statistics });
  }, [handleUpdate]);

  // HTML update handler
  const handleHtmlChange = useCallback((html) => {
    handleUpdate({ html });
  }, [handleUpdate]);

  // CSV toggle handler
  const handleCSVToggle = useCallback((includeCSV) => {
    handleUpdate({ includeCSV });
  }, [handleUpdate]);

  // Update a specific visual element
  const updateElement = useCallback((index, updates) => {
    const newElements = [...(template.visualElements || [])];
    const currentElement = newElements[index];
    newElements[index] = { ...currentElement, ...updates };

    // Debug logging for graph configuration changes
    if (currentElement?.type === 'graph') {
      console.log('[Graph Debug] updateElement called for graph:', {
        elementId: currentElement.id,
        index,
        updates,
        previousConfig: {
          graphType: currentElement.graphType,
          labelField: currentElement.labelField,
          dataField: currentElement.dataField,
          operation: currentElement.operation,
          title: currentElement.title,
          maxItems: currentElement.maxItems,
          width: currentElement.width,
          height: currentElement.height,
          alignment: currentElement.alignment,
          showLegend: currentElement.showLegend,
          showValues: currentElement.showValues
        },
        newConfig: {
          graphType: newElements[index].graphType,
          labelField: newElements[index].labelField,
          dataField: newElements[index].dataField,
          operation: newElements[index].operation,
          title: newElements[index].title,
          maxItems: newElements[index].maxItems,
          width: newElements[index].width,
          height: newElements[index].height,
          alignment: newElements[index].alignment,
          showLegend: newElements[index].showLegend,
          showValues: newElements[index].showValues
        }
      });
    }

    handleUpdate({ visualElements: newElements });
  }, [template.visualElements, handleUpdate]);

  // Section toggle
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch live data from the notification's data source
  const fetchLiveData = useCallback(async () => {
    const endpoint = notification.source?.endpoint;
    console.log('[CustomTemplateEditor] fetchLiveData called', { endpoint, source: notification.source });

    if (!endpoint) {
      console.warn('[CustomTemplateEditor] No endpoint configured, skipping live data fetch');
      setLiveDataError('No data source endpoint configured');
      return;
    }

    setIsLoadingLiveData(true);
    setLiveDataError(null);

    try {
      const username = notification.source?.username;
      const password = notification.source?.password;
      console.log('[CustomTemplateEditor] Fetching metadata from:', `${ARCGIS_PROXY_URL}/arcgis/metadata`);

      // Fetch metadata
      const metadataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: endpoint,
          ...(username && password ? { username, password } : {})
        })
      });

      console.log('[CustomTemplateEditor] Metadata response status:', metadataRes.status, metadataRes.ok);
      if (!metadataRes.ok) {
        const errorText = await metadataRes.text();
        console.error('[CustomTemplateEditor] Metadata fetch failed:', errorText);
        throw new Error('Failed to fetch service metadata');
      }

      const metadata = await metadataRes.json();
      console.log('[CustomTemplateEditor] Metadata received:', {
        fieldsCount: metadata.fields?.length,
        fields: metadata.fields?.map(f => f.name),
        hasError: !!metadata.error,
        error: metadata.error,
        rawMetadata: metadata
      });

      // Check for error in metadata response
      if (metadata.error) {
        throw new Error(metadata.error.message || metadata.error.details || 'Failed to fetch service metadata');
      }

      const fields = (metadata.fields || []).map(f => f.name);
      if (fields.length === 0) {
        console.warn('[CustomTemplateEditor] No fields found in metadata - service may be empty or require authentication');
      }
      console.log('[CustomTemplateEditor] Extracted field names:', fields);
      setLiveDataFields(fields);

      // Store full field metadata for type detection
      const fieldMetadata = {};
      (metadata.fields || []).forEach(f => {
        fieldMetadata[f.name] = {
          type: f.type,
          alias: f.alias || f.name,
          length: f.length,
          domain: f.domain
        };
      });
      console.log('[CustomTemplateEditor] Field metadata:', fieldMetadata);
      setLiveDataFieldMetadata(fieldMetadata);

      // Get total record count
      const baseUrl = endpoint.replace(/\/$/, '');

      const countRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: '1=1',
          returnCountOnly: true,
          f: 'json',
          ...(username && password ? { username, password } : {})
        })
      });

      if (countRes.ok) {
        const countData = await countRes.json();
        console.log('[CustomTemplateEditor] Count response:', countData);

        // Check for error in response
        if (countData.error) {
          console.warn('[CustomTemplateEditor] Count query error:', countData.error);
        } else {
          // Handle different response formats - count or features array length
          const count = countData.count ?? countData.features?.length ?? 0;
          setLiveRecordCount(count);
        }
      }

      // Get sample records (first 10)
      const dataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: '1=1',
          outFields: '*',
          resultRecordCount: 10,
          f: 'json',
          ...(username && password ? { username, password } : {})
        })
      });

      if (!dataRes.ok) throw new Error('Failed to fetch sample data');

      const data = await dataRes.json();
      console.log('[CustomTemplateEditor] Data response:', {
        hasError: !!data.error,
        error: data.error,
        hasFeatures: !!data.features,
        featuresLength: data.features?.length,
        rawKeys: Object.keys(data)
      });

      // Check for error in response
      if (data.error) {
        throw new Error(data.error.message || data.error.details || 'Query returned an error');
      }

      const records = (data.features || []).map(f => f.attributes || {});
      console.log('[CustomTemplateEditor] Sample records fetched:', {
        recordCount: records.length,
        sampleRecord: records[0],
        allRecordKeys: records.length > 0 ? Object.keys(records[0]) : []
      });
      setLiveDataRecords(records);
      setUseLiveData(true);
      console.log('[CustomTemplateEditor] Live data fetch complete - useLiveData set to true');

    } catch (err) {
      console.error('[CustomTemplateEditor] Live data fetch error:', err);
      console.error('[CustomTemplateEditor] Error stack:', err.stack);
      setLiveDataError(err.message);
    } finally {
      setIsLoadingLiveData(false);
      console.log('[CustomTemplateEditor] fetchLiveData finished, isLoadingLiveData set to false');
    }
  }, [notification.source]);

  // Auto-fetch live data if endpoint exists
  useEffect(() => {
    console.log('[CustomTemplateEditor] Auto-fetch useEffect triggered:', {
      hasEndpoint: !!notification.source?.endpoint,
      endpoint: notification.source?.endpoint,
      liveDataRecordsLength: liveDataRecords.length,
      isLoadingLiveData,
      willFetch: notification.source?.endpoint && !liveDataRecords.length && !isLoadingLiveData
    });
    if (notification.source?.endpoint && !liveDataRecords.length && !isLoadingLiveData) {
      console.log('[CustomTemplateEditor] Auto-fetching live data...');
      fetchLiveData();
    }
  }, [notification.source?.endpoint]);

  // Build WHERE clause from a statistic's filter configuration
  const buildStatFilterWhereClause = useCallback((filter) => {
    if (!filter || filter.mode === 'none') return '1=1';
    if (filter.mode === 'advanced') return filter.advancedWhere || '1=1';

    const rules = filter.rules || [];
    if (rules.length === 0) return '1=1';

    const clauses = rules
      .filter(r => r.field && r.value !== undefined && r.value !== '')
      .map(r => {
        const isNumeric = !isNaN(r.value) && String(r.value).trim() !== '';
        const formattedValue = isNumeric ? r.value : `'${String(r.value).replace(/'/g, "''")}'`;
        return `${r.field} ${r.operator} ${formattedValue}`;
      });

    if (clauses.length === 0) return '1=1';
    return clauses.join(` ${filter.logic || 'AND'} `);
  }, []);

  // Map our operation names to ArcGIS statisticType values
  const mapOperationToArcGIS = (operation) => {
    const mapping = {
      'sum': 'sum',
      'mean': 'avg',
      'min': 'min',
      'max': 'max',
      'count': 'count'
    };
    return mapping[operation] || null;
  };

  // Fetch server-side statistics from ArcGIS
  const fetchServerStatistics = useCallback(async () => {
    const endpoint = notification.source?.endpoint;
    if (!endpoint || template.statistics.length === 0) {
      return;
    }

    setIsLoadingStats(true);
    const username = notification.source?.username;
    const password = notification.source?.password;
    const baseUrl = endpoint.replace(/\/$/, '');

    const newStats = {};

    try {
      // Group statistics by their filter (so we can batch requests)
      const statsByFilter = {};
      template.statistics.forEach(stat => {
        const filterKey = JSON.stringify(stat.filter || { mode: 'none' });
        if (!statsByFilter[filterKey]) {
          statsByFilter[filterKey] = [];
        }
        statsByFilter[filterKey].push(stat);
      });

      // Process each filter group
      for (const [filterKey, stats] of Object.entries(statsByFilter)) {
        const filter = JSON.parse(filterKey);
        const whereClause = buildStatFilterWhereClause(filter);

        // Separate stats into server-supported and client-calculated
        const serverSupportedStats = stats.filter(s => mapOperationToArcGIS(s.operation));
        const clientCalculatedStats = stats.filter(s => !mapOperationToArcGIS(s.operation));

        // Fetch server-side statistics if any
        if (serverSupportedStats.length > 0) {
          const outStatistics = serverSupportedStats.map(stat => ({
            statisticType: mapOperationToArcGIS(stat.operation),
            onStatisticField: stat.field,
            outStatisticFieldName: `stat_${stat.id}`
          }));

          try {
            const statsRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceUrl: baseUrl,
                where: whereClause,
                outStatistics: JSON.stringify(outStatistics),
                f: 'json',
                ...(username && password ? { username, password } : {})
              })
            });

            if (statsRes.ok) {
              const statsData = await statsRes.json();
              if (statsData.features && statsData.features.length > 0) {
                const attributes = statsData.features[0].attributes || {};
                serverSupportedStats.forEach(stat => {
                  newStats[stat.id] = attributes[`stat_${stat.id}`];
                });
              }
            }
          } catch (err) {
            console.error('[CustomTemplateEditor] Server statistics fetch error:', err);
          }
        }

        // For client-calculated stats (median, distinct, first, last), fetch all records
        if (clientCalculatedStats.length > 0) {
          try {
            // Get the fields we need
            const fieldsNeeded = [...new Set(clientCalculatedStats.map(s => s.field))];

            // Fetch all records for these specific fields
            const allRecordsRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceUrl: baseUrl,
                where: whereClause,
                outFields: fieldsNeeded.join(','),
                f: 'json',
                ...(username && password ? { username, password } : {})
              })
            });

            if (allRecordsRes.ok) {
              const allRecordsData = await allRecordsRes.json();
              const allRecords = (allRecordsData.features || []).map(f => f.attributes || {});

              // Calculate each client-side statistic
              clientCalculatedStats.forEach(stat => {
                const values = allRecords.map(r => r[stat.field]).filter(v => v !== null && v !== undefined && v !== '');
                if (values.length === 0) {
                  newStats[stat.id] = null;
                  return;
                }

                const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(n => !isNaN(n));

                switch (stat.operation) {
                  case 'median':
                    if (numericValues.length === 0) {
                      newStats[stat.id] = null;
                    } else {
                      const sorted = [...numericValues].sort((a, b) => a - b);
                      const mid = Math.floor(sorted.length / 2);
                      newStats[stat.id] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                    }
                    break;
                  case 'distinct':
                    newStats[stat.id] = new Set(values.map(v => String(v))).size;
                    break;
                  case 'first':
                    newStats[stat.id] = values[0];
                    break;
                  case 'last':
                    newStats[stat.id] = values[values.length - 1];
                    break;
                  default:
                    newStats[stat.id] = null;
                }
              });
            }
          } catch (err) {
            console.error('[CustomTemplateEditor] Client statistics calculation error:', err);
          }
        }
      }

      setServerStatistics(newStats);
    } catch (err) {
      console.error('[CustomTemplateEditor] Statistics fetch error:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [notification.source, template.statistics, buildStatFilterWhereClause]);

  // Fetch server statistics when statistics config or live data changes
  useEffect(() => {
    if (useLiveData && template.statistics.length > 0) {
      fetchServerStatistics();
    }
  }, [useLiveData, template.statistics, fetchServerStatistics]);

  // Helper function to find a field value case-insensitively
  const getFieldValueCaseInsensitive = (attributes, fieldName) => {
    if (!attributes || !fieldName) return null;
    // First try exact match
    if (attributes[fieldName] !== undefined) return attributes[fieldName];
    // Then try case-insensitive match
    const lowerFieldName = fieldName.toLowerCase();
    for (const key of Object.keys(attributes)) {
      if (key.toLowerCase() === lowerFieldName) {
        return attributes[key];
      }
    }
    return null;
  };

  // Fetch server-side aggregated data for a graph element
  const fetchGraphDataForElement = useCallback(async (element) => {
    const endpoint = notification.source?.endpoint;
    if (!endpoint || !element.labelField) {
      console.log('[CustomTemplateEditor] Graph fetch skipped - no endpoint or labelField');
      return;
    }

    const elementId = element.id;
    setIsLoadingGraphData(prev => ({ ...prev, [elementId]: true }));

    try {
      const username = notification.source?.username;
      const password = notification.source?.password;
      const baseUrl = endpoint.replace(/\/$/, '');

      // Map operation to ArcGIS statisticType
      const operation = element.operation || 'count';
      const arcgisOperation = {
        'sum': 'sum',
        'mean': 'avg',
        'count': 'count'
      }[operation] || 'count';

      // For count operation without a data field, count the label field itself
      const dataField = element.dataField || element.labelField;
      const maxItems = parseInt(element.maxItems) || 10;

      const outStatistics = [{
        statisticType: arcgisOperation,
        onStatisticField: dataField,
        outStatisticFieldName: 'aggregated_value'
      }];

      console.log('[CustomTemplateEditor] Fetching graph data with statistics:', {
        labelField: element.labelField,
        dataField,
        operation: arcgisOperation,
        outStatistics
      });

      const graphRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: '1=1',
          outStatistics: JSON.stringify(outStatistics),
          groupByFieldsForStatistics: element.labelField,
          f: 'json',
          ...(username && password ? { username, password } : {})
        })
      });

      if (!graphRes.ok) {
        throw new Error(`HTTP error: ${graphRes.status}`);
      }

      const graphResponse = await graphRes.json();
      console.log('[CustomTemplateEditor] Graph response:', graphResponse);

      // Check for ArcGIS error in response
      if (graphResponse.error) {
        console.warn('[CustomTemplateEditor] ArcGIS error in response:', graphResponse.error);
        throw new Error(graphResponse.error.message || 'ArcGIS query error');
      }

      const features = graphResponse.features || [];

      // If statistics query didn't return data, try fetching all records and aggregating client-side
      if (features.length === 0) {
        console.log('[CustomTemplateEditor] Statistics query returned no features, trying full data fetch');

        // Fetch all records with just the label field
        const allDataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceUrl: baseUrl,
            where: '1=1',
            outFields: element.dataField ? `${element.labelField},${element.dataField}` : element.labelField,
            f: 'json',
            ...(username && password ? { username, password } : {})
          })
        });

        if (allDataRes.ok) {
          const allData = await allDataRes.json();
          if (!allData.error && allData.features && allData.features.length > 0) {
            const records = allData.features.map(f => f.attributes || {});
            console.log('[CustomTemplateEditor] Fetched', records.length, 'records for client-side aggregation');

            // Aggregate client-side
            const graphData = aggregateGraphData(records, element.labelField, element.dataField, operation, maxItems);
            console.log('[CustomTemplateEditor] Client-side aggregated data:', graphData);
            setServerGraphData(prev => ({ ...prev, [elementId]: graphData }));
            return;
          }
        }

        // If all fallbacks fail, set empty data
        setServerGraphData(prev => ({ ...prev, [elementId]: [] }));
        return;
      }

      // Helper to find the aggregated value with multiple fallback patterns
      // ArcGIS servers may return different field names depending on configuration
      const findAggregatedValue = (attributes) => {
        if (!attributes) return 0;

        // First try our specified field name (case-insensitive)
        const directMatch = getFieldValueCaseInsensitive(attributes, 'aggregated_value');
        if (directMatch !== null && directMatch !== undefined) return directMatch;

        // Try common ArcGIS statistic field name patterns
        const patterns = [
          `count_${dataField}`,          // count_fieldname
          `COUNT_${dataField}`,          // COUNT_fieldname
          `sum_${dataField}`,            // sum_fieldname
          `SUM_${dataField}`,            // SUM_fieldname
          `avg_${dataField}`,            // avg_fieldname
          `AVG_${dataField}`,            // AVG_fieldname
          `${arcgisOperation}_${dataField}`, // operation_fieldname
          dataField,                     // Sometimes just returns the field itself
        ];

        for (const pattern of patterns) {
          const val = getFieldValueCaseInsensitive(attributes, pattern);
          if (val !== null && val !== undefined) return val;
        }

        // Last resort: look for any field that contains numbers and isn't the label field
        const labelFieldLower = element.labelField?.toLowerCase() || '';
        for (const [key, val] of Object.entries(attributes)) {
          if (key.toLowerCase() !== labelFieldLower && typeof val === 'number') {
            return val;
          }
        }

        return 0;
      };

      // Debug: Log first feature attributes to help diagnose field naming issues
      if (features.length > 0) {
        console.log('[CustomTemplateEditor] Graph response first feature attributes:', {
          attributes: features[0].attributes,
          attributeKeys: Object.keys(features[0].attributes || {}),
          expectedAggFieldName: 'aggregated_value',
          labelField: element.labelField,
          dataField: dataField
        });
      }

      // Check if the statistics query actually returned aggregated data
      // A proper statistics response should have only 2 fields: labelField and aggregated_value
      // If we have many more fields (e.g., 10+), the server returned raw features instead
      const firstFeatureKeys = features.length > 0 ? Object.keys(features[0].attributes || {}) : [];
      const hasAggregatedValue = features.length > 0 && (
        getFieldValueCaseInsensitive(features[0].attributes, 'aggregated_value') !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `count_${dataField}`) !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `COUNT_${dataField}`) !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `sum_${dataField}`) !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `SUM_${dataField}`) !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `avg_${dataField}`) !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `AVG_${dataField}`) !== null ||
        getFieldValueCaseInsensitive(features[0].attributes, `${arcgisOperation}_${dataField}`) !== null
      );

      // If the response has many fields (> 5) and no aggregated_value field,
      // the statistics query didn't work - fall back to client-side aggregation
      if (firstFeatureKeys.length > 5 && !hasAggregatedValue) {
        console.log('[CustomTemplateEditor] Statistics query returned raw features instead of aggregated data, using client-side aggregation', {
          fieldsCount: firstFeatureKeys.length,
          hasAggregatedValue
        });

        // Use the features we already have for client-side aggregation
        const records = features.map(f => f.attributes || {});
        const graphData = aggregateGraphData(records, element.labelField, element.dataField, operation, maxItems);
        console.log('[CustomTemplateEditor] Client-side aggregated data from stats response:', graphData);
        setServerGraphData(prev => ({ ...prev, [elementId]: graphData }));
        return;
      }

      // Transform to graph data format using case-insensitive field lookup
      // First, collect all data points and aggregate duplicates (same label after trimming)
      const labelGroups = {};
      features.forEach(f => {
        const labelValue = getFieldValueCaseInsensitive(f.attributes, element.labelField);
        // Normalize label: trim whitespace and convert to string
        const rawLabel = String(labelValue ?? 'Unknown').trim();
        // Skip invalid labels
        if (!rawLabel || rawLabel === 'Unknown' || rawLabel === 'null' || rawLabel === 'undefined') {
          return;
        }
        // Use multiple fallback patterns since ArcGIS servers may return different field names
        const aggValue = findAggregatedValue(f.attributes);
        // Ensure we have a valid number, defaulting to 0 for non-numeric values
        const numericValue = typeof aggValue === 'number' && !isNaN(aggValue) ? aggValue : parseFloat(aggValue);
        const value = !isNaN(numericValue) ? Math.round(numericValue * 100) / 100 : 0;

        // Aggregate values for duplicate labels
        if (labelGroups[rawLabel]) {
          labelGroups[rawLabel] += value;
        } else {
          labelGroups[rawLabel] = value;
        }
      });

      // Convert to array format, sort, and limit
      const graphData = Object.entries(labelGroups)
        .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, maxItems);

      // Log detailed info about the graph data including values
      console.log('[CustomTemplateEditor] Graph data fetched for', elementId, ':', {
        dataPoints: graphData.length,
        data: graphData,
        hasNonZeroValues: graphData.some(d => d.value > 0),
        maxValue: Math.max(...graphData.map(d => d.value), 0),
        sumValues: graphData.reduce((sum, d) => sum + d.value, 0)
      });
      setServerGraphData(prev => ({ ...prev, [elementId]: graphData }));

    } catch (err) {
      console.error('[CustomTemplateEditor] Graph data fetch error:', err);

      // Try fallback: fetch all records and aggregate client-side
      try {
        const username = notification.source?.username;
        const password = notification.source?.password;
        const baseUrl = endpoint.replace(/\/$/, '');
        const maxItems = parseInt(element.maxItems) || 10;
        const operation = element.operation || 'count';

        console.log('[CustomTemplateEditor] Trying fallback: fetch all records for client-side aggregation');

        const allDataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceUrl: baseUrl,
            where: '1=1',
            outFields: element.dataField ? `${element.labelField},${element.dataField}` : element.labelField,
            f: 'json',
            ...(username && password ? { username, password } : {})
          })
        });

        if (allDataRes.ok) {
          const allData = await allDataRes.json();
          if (!allData.error && allData.features && allData.features.length > 0) {
            const records = allData.features.map(f => f.attributes || {});
            console.log('[CustomTemplateEditor] Fallback fetched', records.length, 'records');

            const graphData = aggregateGraphData(records, element.labelField, element.dataField, operation, maxItems);
            console.log('[CustomTemplateEditor] Fallback aggregated data:', graphData);
            setServerGraphData(prev => ({ ...prev, [elementId]: graphData }));
            return;
          }
        }
      } catch (fallbackErr) {
        console.error('[CustomTemplateEditor] Fallback also failed:', fallbackErr);
      }

      setServerGraphData(prev => ({ ...prev, [elementId]: null }));
    } finally {
      setIsLoadingGraphData(prev => ({ ...prev, [elementId]: false }));
    }
  }, [notification.source]);

  // Fetch graph data for all graph elements when live data is enabled
  useEffect(() => {
    if (useLiveData && notification.source?.endpoint) {
      const graphElements = (template.visualElements || []).filter(el => el.type === 'graph' && el.labelField);

      graphElements.forEach(element => {
        // Build a config key to compare with previous configuration
        const currentConfig = `${element.labelField}|${element.dataField || ''}|${element.operation || 'count'}|${element.maxItems || 10}`;
        const prevConfig = prevGraphConfigsRef.current[element.id];

        // Only fetch if configuration has actually changed or we don't have data yet
        if (currentConfig !== prevConfig) {
          console.log('[CustomTemplateEditor] Graph config changed for', element.id, ':', prevConfig, '->', currentConfig);
          prevGraphConfigsRef.current[element.id] = currentConfig;
          fetchGraphDataForElement(element);
        }
      });

      // Clean up configs for removed graph elements
      const currentGraphIds = new Set(graphElements.map(el => el.id));
      Object.keys(prevGraphConfigsRef.current).forEach(id => {
        if (!currentGraphIds.has(id)) {
          delete prevGraphConfigsRef.current[id];
        }
      });
    }
  }, [useLiveData, notification.source?.endpoint, template.visualElements, fetchGraphDataForElement]);

  // Helper function to calculate a statistic from records
  const calculateStatistic = useCallback((records, field, operation) => {
    if (!records || records.length === 0) return null;

    const values = records.map(r => r[field]).filter(v => v !== null && v !== undefined && v !== '');

    if (values.length === 0) return null;

    // Convert to numbers for numeric operations
    const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(n => !isNaN(n));

    switch (operation) {
      case 'count':
        return values.length;
      case 'distinct':
        return new Set(values.map(v => String(v))).size;
      case 'sum':
        return numericValues.reduce((a, b) => a + b, 0);
      case 'mean':
        return numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : null;
      case 'min':
        return numericValues.length > 0 ? Math.min(...numericValues) : null;
      case 'max':
        return numericValues.length > 0 ? Math.max(...numericValues) : null;
      case 'median':
        if (numericValues.length === 0) return null;
        const sorted = [...numericValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      case 'first':
        return values[0];
      case 'last':
        return values[values.length - 1];
      default:
        return null;
    }
  }, []);

  // Helper function to format a statistic value
  const formatStatisticValue = useCallback((value, formatOptions = {}) => {
    if (value === null || value === undefined) return '-';

    const { format = 'auto', decimals = 0, prefix = '', suffix = '', currency = 'USD' } = formatOptions;

    if (format === 'currency') {
      try {
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(value);
        return prefix + formatted + suffix;
      } catch {
        return prefix + '$' + Number(value).toLocaleString() + suffix;
      }
    }

    if (format === 'percent') {
      return prefix + (value * 100).toFixed(decimals) + '%' + suffix;
    }

    if (typeof value === 'number') {
      return prefix + value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }) + suffix;
    }

    return prefix + String(value) + suffix;
  }, []);

  // Calculate live statistics using server-side data when available
  const liveStatistics = useMemo(() => {
    if (!useLiveData || !template.statistics.length) {
      return null;
    }

    const stats = {};
    template.statistics.forEach(stat => {
      // Use server-side statistics if available, otherwise fall back to sample calculation
      let rawValue;
      if (serverStatistics.hasOwnProperty(stat.id)) {
        rawValue = serverStatistics[stat.id];
      } else if (liveDataRecords.length > 0) {
        // Fallback to sample data (for preview while loading)
        rawValue = calculateStatistic(liveDataRecords, stat.field, stat.operation);
      } else {
        rawValue = null;
      }

      const formattedValue = formatStatisticValue(rawValue, stat.format);
      stats[`stat_${stat.id}`] = formattedValue;
      stats[`stat_${stat.id}_value`] = rawValue;
      stats[`stat_${stat.id}_label`] = stat.label || stat.id;
    });

    return stats;
  }, [useLiveData, liveDataRecords, template.statistics, serverStatistics, calculateStatistic, formatStatisticValue]);

  // Generate sample context with live data if available
  const sampleContext = useMemo(() => {
    const baseContext = generateSampleContext(notification, template, locality, {
      mockRecordCount: useLiveData && liveRecordCount !== null ? liveRecordCount : 42
    });

    // If we have live data, build a real data table
    if (useLiveData && liveDataRecords.length > 0 && liveDataFields.length > 0) {
      // Find datatable element to get customization options
      const datatableElement = (template.visualElements || []).find(el => el.type === 'datatable');
      const recordLimit = datatableElement?.recordLimit || 10;
      const selectedTableFields = datatableElement?.selectedFields || [];

      // Determine which fields to show
      let displayFields;
      if (selectedTableFields.length > 0) {
        // Use selected fields from the datatable element
        displayFields = selectedTableFields.map(fieldName => {
          // Try to find matching field in notification.source.displayFields for label
          const notifField = (notification.source?.displayFields || []).find(f =>
            (typeof f === 'string' ? f : f.field) === fieldName
          );
          if (notifField && typeof notifField !== 'string') {
            return notifField;
          }
          return { field: fieldName, label: fieldName };
        });
      } else if (notification.source?.displayFields?.length > 0) {
        // Fall back to notification's display fields
        displayFields = notification.source.displayFields;
      } else {
        // Fall back to first 3 fields from live data
        displayFields = liveDataFields.slice(0, 3).map(f => ({ field: f, label: f }));
      }

      const fieldNames = displayFields.map(f => typeof f === 'string' ? f : f.field);
      const fieldLabels = displayFields.map(f => typeof f === 'string' ? f : (f.label || f.field));

      // Helper to format cell value with type detection
      const formatCellValue = (row, fieldName) => {
        const rawValue = row[fieldName];
        const fieldMeta = liveDataFieldMetadata[fieldName];
        if (fieldMeta) {
          return formatFieldValue(rawValue, fieldMeta.type, fieldMeta.domain);
        }
        // Fallback: try to detect type from value
        if (rawValue === null || rawValue === undefined || rawValue === '') {
          return '';
        }
        // Check if it's a date (large number that could be epoch milliseconds)
        if (typeof rawValue === 'number' && rawValue > 946684800000 && rawValue < 4102444800000) {
          // Likely a date between year 2000 and 2100
          const date = new Date(rawValue);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          }
        }
        // Check if it's a regular number
        if (typeof rawValue === 'number') {
          if (Number.isInteger(rawValue)) {
            return rawValue.toLocaleString();
          }
          return rawValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }
        return String(rawValue);
      };

      const tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
        <thead>
          <tr>
            ${fieldLabels.map(label => `<th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">${label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${liveDataRecords.slice(0, recordLimit).map(row => `<tr>${fieldNames.map(f => `<td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${formatCellValue(row, f)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;

      baseContext.dataTable = tableHtml;
      baseContext.recordCount = liveRecordCount !== null ? String(liveRecordCount) : String(liveDataRecords.length);

      if (liveRecordCount > recordLimit) {
        baseContext.moreRecordsMessage = `<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first ${recordLimit} of ${liveRecordCount.toLocaleString()} records. Download the CSV to see all data.</p>`;
      } else {
        baseContext.moreRecordsMessage = '';
      }

      // Override statistics with live calculated values
      if (liveStatistics) {
        Object.assign(baseContext, liveStatistics);

        // Regenerate statisticsHtml with live values
        const theme = template.theme || {};
        const statsHtml = generateSelectedStatisticsHtml(template.statistics, { ...baseContext, ...liveStatistics }, theme);
        baseContext.statisticsHtml = statsHtml;
      }
    }

    // Generate statistics HTML for each element with custom options
    const theme = template.theme || {};
    const contextWithLiveStats = liveStatistics ? { ...baseContext, ...liveStatistics } : baseContext;

    (template.visualElements || []).forEach(el => {
      if (el.type === 'statistics') {
        // Get selected statistics or all
        const selectedIds = el.selectedStatistics || [];
        const statsToShow = selectedIds.length > 0
          ? template.statistics.filter(s => selectedIds.includes(s.id))
          : template.statistics;

        const valueSize = el.valueSize || '24';
        const valueAlignment = el.valueAlignment || 'center';
        const containerWidth = el.containerWidth || '100';
        const containerAlignment = el.containerAlignment || 'center';
        const key = `statisticsHtml_${el.id}_${valueSize}_${valueAlignment}_${containerWidth}_${containerAlignment}`;
        baseContext[key] = generateSelectedStatisticsHtml(statsToShow, contextWithLiveStats, theme, { valueSize, valueAlignment, containerWidth, containerAlignment });
      } else if (el.type === 'row' && el.contentType === 'statistics') {
        // Get selected statistics for row or all
        const selectedIds = el.selectedStatistics || [];
        const statsToShow = selectedIds.length > 0
          ? template.statistics.filter(s => selectedIds.includes(s.id))
          : template.statistics;

        const valueSize = el.statisticsValueSize || '24';
        const valueAlignment = el.statisticsValueAlignment || 'left';
        const containerWidth = el.statisticsContainerWidth || '100';
        const containerAlignment = el.statisticsContainerAlignment || 'center';
        const key = `statisticsHtml_${el.id}_${valueSize}_${valueAlignment}_${containerWidth}_${containerAlignment}`;
        baseContext[key] = generateSelectedStatisticsHtml(statsToShow, contextWithLiveStats, theme, { valueSize, valueAlignment, containerWidth, containerAlignment });
      } else if (el.type === 'graph') {
        // Generate graph HTML using server-side aggregated data if available
        // Prefer serverGraphData (from ArcGIS groupByFieldsForStatistics) over client-side aggregation
        let graphData;
        let dataSource;
        if (useLiveData && serverGraphData[el.id] && serverGraphData[el.id].length > 0) {
          // Use server-side aggregated data (accurate for all records)
          graphData = serverGraphData[el.id];
          dataSource = 'server-side';
        } else if (useLiveData && liveDataRecords.length > 0 && el.labelField) {
          // Fallback to client-side aggregation (limited to sample records)
          graphData = aggregateGraphData(liveDataRecords, el.labelField, el.dataField, el.operation || 'count', el.maxItems || 10);
          dataSource = 'client-side';
        } else {
          // Use sample data for preview when no live data
          graphData = generateSampleGraphData(el.graphType || 'bar', 5);
          dataSource = 'sample';
        }

        console.log('[Graph Debug] Processing graph element in sampleContext:', {
          elementId: el.id,
          dataSource,
          useLiveData,
          hasServerGraphData: !!serverGraphData[el.id],
          serverGraphDataLength: serverGraphData[el.id]?.length || 0,
          liveDataRecordsLength: liveDataRecords.length,
          labelField: el.labelField,
          graphConfig: {
            graphType: el.graphType || 'bar',
            labelField: el.labelField,
            dataField: el.dataField,
            operation: el.operation || 'count',
            title: el.title,
            maxItems: el.maxItems || 10
          },
          graphDataPoints: graphData?.length || 0
        });

        const graphOptions = {
          title: el.title || '',
          width: el.width || '100',
          height: el.height || '250',
          alignment: el.alignment || 'center',
          showLegend: el.showLegend !== false,
          showValues: el.showValues !== false
        };

        baseContext[`graph_${el.id}`] = generateGraphHtml(el.graphType || 'bar', graphData, theme, graphOptions);
      }
    });

    return baseContext;
  }, [notification, template, locality, useLiveData, liveDataRecords, liveDataFields, liveDataFieldMetadata, liveRecordCount, liveStatistics, serverGraphData]);

  // Process template HTML with context
  const processedHtml = useMemo(() => {
    if (!template.html) return '';

    let html = template.html;
    Object.entries(sampleContext).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
    });

    return html;
  }, [template.html, sampleContext]);

  // Visual Elements drag handlers
  const handleDragStart = (e, element, sourceIndex = null) => {
    setDraggedElement({ element, sourceIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(targetIndex);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);

    if (!draggedElement) return;

    const { element, sourceIndex } = draggedElement;
    const newElements = [...(template.visualElements || [])];

    if (sourceIndex !== null) {
      // Moving existing element
      const [movedElement] = newElements.splice(sourceIndex, 1);
      const adjustedIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      newElements.splice(adjustedIndex, 0, movedElement);

      // Debug logging for moving graph elements
      if (movedElement.type === 'graph') {
        console.log('[Graph Debug] Graph element moved:', {
          elementId: movedElement.id,
          fromIndex: sourceIndex,
          toIndex: adjustedIndex,
          currentConfig: movedElement
        });
      }
    } else {
      // Adding new element from palette
      const newElement = {
        id: `${element.id}_${Date.now()}`,
        ...element.defaultContent
      };
      newElements.splice(targetIndex, 0, newElement);

      // Debug logging for adding new graph elements
      if (newElement.type === 'graph') {
        console.log('[Graph Debug] New graph element added via handleDrop:', {
          elementId: newElement.id,
          targetIndex,
          defaultConfig: newElement
        });
      }
    }

    handleUpdate({ visualElements: newElements });
    setDraggedElement(null);
  };

  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);

    if (!draggedElement) return;

    const { element, sourceIndex } = draggedElement;

    if (sourceIndex === null) {
      const newElement = {
        id: `${element.id}_${Date.now()}`,
        ...element.defaultContent
      };

      // Debug logging for adding new graph elements
      if (newElement.type === 'graph') {
        console.log('[Graph Debug] New graph element added via handleDropOnCanvas:', {
          elementId: newElement.id,
          appendedToEnd: true,
          currentElementCount: (template.visualElements || []).length,
          defaultConfig: newElement
        });
      }

      handleUpdate({
        visualElements: [...(template.visualElements || []), newElement]
      });
    }

    setDraggedElement(null);
  };

  const removeElement = (index) => {
    // Clear or adjust selection when removing elements
    if (selectedElementIndex !== null) {
      if (selectedElementIndex === index) {
        setSelectedElementIndex(null);
      } else if (selectedElementIndex > index) {
        setSelectedElementIndex(selectedElementIndex - 1);
      }
    }
    handleUpdate({
      visualElements: (template.visualElements || []).filter((_, i) => i !== index)
    });
  };

  // Convert visual elements to HTML
  const visualElementsToHtml = useCallback(() => {
    const elements = template.visualElements || [];
    if (elements.length === 0) return template.html;

    const theme = template.theme || DEFAULT_THEME;
    let html = `<div style="font-family: {{fontFamily}}; color: {{textColor}}; max-width: 600px; margin: 0 auto;">\n`;

    elements.forEach(el => {
      switch (el.type) {
        case 'header':
          const headerTitleSize = el.titleSize || '24';
          const headerSubtitleSize = el.subtitleSize || '14';
          const headerAlignment = el.alignment || 'left';
          html += `  <!-- Header -->
  <div style="background-color: {{primaryColor}}; padding: 20px; color: white; border-radius: 8px 8px 0 0; text-align: ${headerAlignment};">
    <h1 style="margin: 0; font-size: ${headerTitleSize}px;">${el.title}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: ${headerSubtitleSize}px;">${el.subtitle}</p>
  </div>\n`;
          break;
        case 'logo':
          const logoSize = el.size || '150';
          const logoAlignment = el.alignment || 'left';
          const logoAlignStyle = logoAlignment === 'center' ? 'margin: 0 auto;' : logoAlignment === 'right' ? 'margin-left: auto;' : '';
          html += `  <!-- Logo -->
  <div style="padding: 15px 25px; text-align: ${logoAlignment};">
    <img src="{{logoUrl}}" alt="Logo" style="max-width: ${logoSize}px; height: auto; ${logoAlignStyle}" />
  </div>\n`;
          break;
        case 'text':
          const textSize = el.textSize || '14';
          const textAlignment = el.alignment || 'left';
          html += `  <div style="padding: 15px 25px; font-size: ${textSize}px; text-align: ${textAlignment};">${el.content}</div>\n`;
          break;
        case 'statistics':
          // Use element-specific placeholder with options
          const statsValueSize = el.valueSize || '24';
          const statsValueAlignment = el.valueAlignment || 'center';
          const statsContainerWidth = el.containerWidth || '100';
          const statsContainerAlignment = el.containerAlignment || 'center';
          html += `  <!-- Statistics -->\n  <div style="padding: 15px 25px;">{{statisticsHtml_${el.id}_${statsValueSize}_${statsValueAlignment}_${statsContainerWidth}_${statsContainerAlignment}}}</div>\n`;
          break;
        case 'record-count':
          html += `  <p style="font-size: 16px; padding: 0 25px; margin: 20px 0;">${el.template}</p>\n`;
          break;
        case 'date-range':
          html += `  <p style="color: {{mutedTextColor}}; font-size: 13px; padding: 0 25px; margin-bottom: 20px;">${el.template}</p>\n`;
          break;
        case 'datatable':
          html += `  <!-- Data Table -->\n  <div style="padding: 0 25px;">{{dataTable}}</div>\n`;
          break;
        case 'download-button':
          html += `  <!-- Download Button -->\n  <div style="padding: 15px 25px;">{{downloadButton}}</div>\n`;
          break;
        case 'more-records':
          html += `  <div style="padding: 0 25px;">{{moreRecordsMessage}}</div>\n`;
          break;
        case 'divider':
          const dividerWidth = el.width || '100';
          const dividerAlignment = el.alignment || 'center';
          const dividerThickness = el.thickness || '1';
          const dividerStyle = el.style || 'solid';
          const dividerMargin = dividerAlignment === 'left' ? 'margin-right: auto;' : dividerAlignment === 'right' ? 'margin-left: auto;' : 'margin: 0 auto;';
          html += `  <div style="padding: 20px 25px;">
    <hr style="border: none; border-top: ${dividerThickness}px ${dividerStyle} {{borderColor}}; width: ${dividerWidth}%; ${dividerMargin}" />
  </div>\n`;
          break;
        case 'spacer':
          html += `  <div style="height: ${el.height || '20px'};"></div>\n`;
          break;
        case 'icon':
          const iconAlignment = el.alignment || 'center';
          const iconSize = el.iconSize || '24';
          const iconColor = el.iconColor || '{{primaryColor}}';
          html += `  <!-- Icon: ${el.iconName} -->
  <div style="text-align: ${iconAlignment}; padding: 15px 25px;">
    <span style="display: inline-block; width: ${iconSize}px; height: ${iconSize}px; color: ${iconColor};">{{icon_${el.iconName}_${iconSize}}}</span>
  </div>\n`;
          break;
        case 'row':
          const rowIconSize = el.iconSize || '32';
          const rowIconColor = el.iconColor || '{{primaryColor}}';
          const rowGap = el.gap || '15';
          const vertAlign = el.verticalAlign === 'top' ? 'flex-start' : el.verticalAlign === 'bottom' ? 'flex-end' : 'center';
          const isIconLeft = el.iconPosition !== 'right';

          // Generate content HTML based on contentType
          let rowContent = '';
          if (el.contentType === 'statistics') {
            // Use specific statistics placeholder with options
            const rowStatsValueSize = el.statisticsValueSize || '24';
            const rowStatsValueAlignment = el.statisticsValueAlignment || 'left';
            const rowStatsContainerWidth = el.statisticsContainerWidth || '100';
            const rowStatsContainerAlignment = el.statisticsContainerAlignment || 'center';
            rowContent = `{{statisticsHtml_${el.id}_${rowStatsValueSize}_${rowStatsValueAlignment}_${rowStatsContainerWidth}_${rowStatsContainerAlignment}}}`;
          } else {
            rowContent = el.content || '<p>Content here</p>';
          }

          const iconHtml = `<span style="display: inline-block; width: ${rowIconSize}px; height: ${rowIconSize}px; color: ${rowIconColor}; flex-shrink: 0;">{{icon_${el.iconName}_${rowIconSize}}}</span>`;
          const contentHtml = `<div style="flex: 1; min-width: 0;">${rowContent}</div>`;

          html += `  <!-- Row: Icon + Content -->
  <div style="padding: 15px 25px; display: flex; align-items: ${vertAlign}; gap: ${rowGap}px;">
    ${isIconLeft ? iconHtml + '\n    ' + contentHtml : contentHtml + '\n    ' + iconHtml}
  </div>\n`;
          break;
        case 'footer':
          const footerTextSize = el.textSize || '12';
          const footerAlignment = el.alignment || 'left';
          html += `  <!-- Footer -->
  <div style="margin-top: 30px; padding: 20px 25px; border-top: 1px solid {{borderColor}}; font-size: ${footerTextSize}px; color: {{mutedTextColor}}; text-align: ${footerAlignment};">
    <p>${el.text}</p>
    <p><a href="#" style="color: {{accentColor}};">Manage Preferences</a></p>
  </div>\n`;
          break;
        case 'graph':
          const graphId = el.id;
          html += `  <!-- Graph -->
  <div style="padding: 15px 25px;">{{graph_${graphId}}}</div>\n`;
          break;
      }
    });

    html += '</div>';
    return html;
  }, [template.visualElements, template.theme]);

  // Sync visual elements to HTML when in designer mode
  useEffect(() => {
    if (rightPanelMode === 'designer' && (template.visualElements || []).length > 0) {
      const generatedHtml = visualElementsToHtml();
      if (generatedHtml !== template.html) {
        handleUpdate({ html: generatedHtml });
      }
    }
  }, [template.visualElements, rightPanelMode, visualElementsToHtml, template.html, handleUpdate]);

  // Get icon component for visual element
  const getElementIcon = (iconName) => {
    const icons = { LayoutTemplate, Type, BarChart3, Columns, Table, Download, FileText, Info, Star };
    return icons[iconName] || FileText;
  };

  // Render visual element for the canvas
  const renderVisualElement = (element, index) => {
    const processContent = (content) => {
      if (typeof content !== 'string') return content;
      return content.replace(/\{\{(\w+)\}\}/g, (match, key) => sampleContext[key] || match);
    };

    const isSelected = selectedElementIndex === index;

    return (
      <div
        key={element.id}
        draggable
        onDragStart={(e) => handleDragStart(e, element, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedElementIndex(index);
        }}
        className={`group relative border-2 transition-all cursor-move ${
          isSelected
            ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200'
            : dragOverIndex === index
              ? 'border-blue-400 bg-blue-50'
              : 'border-transparent hover:border-slate-300'
        }`}
      >
        {/* Element Controls */}
        <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedElementIndex(index);
            }}
            className="p-1 bg-blue-500 text-white rounded shadow-sm hover:bg-blue-600"
            title="Edit element"
          >
            <Settings2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeElement(index);
            }}
            className="p-1 bg-red-500 text-white rounded shadow-sm hover:bg-red-600"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <div className="p-1 bg-slate-600 text-white rounded shadow-sm cursor-grab">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>

        {/* Rendered Element */}
        {element.type === 'header' && (
          <div style={{
            backgroundColor: template.theme?.primaryColor || '#004E7C',
            color: 'white',
            padding: '20px',
            textAlign: element.alignment || 'left'
          }}>
            <h1 style={{ margin: 0, fontSize: `${element.titleSize || '24'}px` }}>{processContent(element.title)}</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: `${element.subtitleSize || '14'}px` }}>{processContent(element.subtitle)}</p>
          </div>
        )}

        {element.type === 'logo' && (
          <div style={{ padding: '15px 25px', textAlign: element.alignment || 'left' }}>
            {template.branding?.logoUrl ? (
              <img
                src={template.branding.logoUrl}
                alt="Logo"
                style={{ maxWidth: `${element.size || '150'}px`, height: 'auto' }}
              />
            ) : (
              <span style={{ color: '#999', fontStyle: 'italic' }}>No logo configured</span>
            )}
          </div>
        )}

        {element.type === 'text' && (
          <div
            style={{
              padding: '15px 25px',
              fontSize: `${element.textSize || '14'}px`,
              textAlign: element.alignment || 'left'
            }}
            dangerouslySetInnerHTML={{ __html: processContent(element.content) }}
          />
        )}

        {element.type === 'statistics' && (() => {
          // Get the statistics to display (selected or all)
          const selectedIds = element.selectedStatistics || [];
          const statsToShow = selectedIds.length > 0
            ? template.statistics.filter(s => selectedIds.includes(s.id))
            : template.statistics;

          if (statsToShow.length === 0) {
            return (
              <div style={{ padding: '15px 25px' }}>
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                  {template.statistics.length === 0
                    ? 'No statistics configured. Add statistics in the left panel.'
                    : 'No statistics selected. Click edit to select which statistics to show.'}
                </span>
              </div>
            );
          }

          // Generate statistics HTML for the selected stats with customization options
          const statsOptions = {
            valueSize: element.valueSize || '24',
            valueAlignment: element.valueAlignment || 'center',
            containerWidth: element.containerWidth || '100',
            containerAlignment: element.containerAlignment || 'center'
          };
          const statsHtml = generateSelectedStatisticsHtml(statsToShow, sampleContext, template.theme, statsOptions);
          return (
            <div style={{ padding: '15px 25px' }} dangerouslySetInnerHTML={{ __html: statsHtml }} />
          );
        })()}

        {element.type === 'record-count' && (
          <p style={{ fontSize: '16px', padding: '0 25px', margin: '20px 0' }} dangerouslySetInnerHTML={{ __html: processContent(element.template) }} />
        )}

        {element.type === 'date-range' && (
          <p style={{ color: template.theme?.mutedTextColor || '#666', fontSize: '13px', padding: '0 25px', marginBottom: '20px' }} dangerouslySetInnerHTML={{ __html: processContent(element.template) }} />
        )}

        {element.type === 'datatable' && (
          <div style={{ padding: '0 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'download-button' && template.includeCSV && (
          <div style={{ padding: '15px 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'download-button' && !template.includeCSV && (
          <div style={{ padding: '15px 25px', opacity: 0.5 }}>
            <span className="text-xs text-slate-500 italic">Download button hidden (CSV disabled)</span>
          </div>
        )}

        {element.type === 'more-records' && (
          <div style={{ padding: '0 25px' }} dangerouslySetInnerHTML={{ __html: processContent(element.placeholder) }} />
        )}

        {element.type === 'divider' && (() => {
          const dividerWidth = element.width || '100';
          const dividerAlignment = element.alignment || 'center';
          const dividerThickness = element.thickness || '1';
          const dividerStyle = element.style || 'solid';
          const marginStyle = dividerAlignment === 'left' ? { marginRight: 'auto' }
            : dividerAlignment === 'right' ? { marginLeft: 'auto' }
            : { margin: '0 auto' };

          return (
            <div style={{ padding: '20px 25px' }}>
              <hr style={{
                border: 'none',
                borderTop: `${dividerThickness}px ${dividerStyle} ${template.theme?.borderColor || '#ddd'}`,
                width: `${dividerWidth}%`,
                ...marginStyle
              }} />
            </div>
          );
        })()}

        {element.type === 'spacer' && (
          <div style={{ height: element.height || '20px', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-xs text-slate-400">Spacer ({element.height || '20px'})</span>
          </div>
        )}

        {element.type === 'icon' && (() => {
          const IconComponent = AVAILABLE_ICONS[element.iconName] || Star;
          const iconSize = parseInt(element.iconSize) || 24;
          const iconColor = element.iconColor?.startsWith('{{')
            ? (template.theme?.primaryColor || '#004E7C')
            : (element.iconColor || template.theme?.primaryColor || '#004E7C');
          return (
            <div style={{ textAlign: element.alignment || 'center', padding: '15px 25px' }}>
              <IconComponent style={{ width: iconSize, height: iconSize, color: iconColor }} />
            </div>
          );
        })()}

        {element.type === 'row' && (() => {
          const IconComponent = AVAILABLE_ICONS[element.iconName] || Star;
          const iconSize = parseInt(element.iconSize) || 32;
          const iconColor = element.iconColor?.startsWith('{{')
            ? (template.theme?.primaryColor || '#004E7C')
            : (element.iconColor || template.theme?.primaryColor || '#004E7C');
          const gap = element.gap || '15';
          const verticalAlign = element.verticalAlign || 'center';
          const isIconLeft = element.iconPosition !== 'right';

          // Render the content based on contentType
          const renderContent = () => {
            if (element.contentType === 'statistics') {
              const selectedIds = element.selectedStatistics || [];
              const statsToShow = selectedIds.length > 0
                ? template.statistics.filter(s => selectedIds.includes(s.id))
                : template.statistics;

              if (statsToShow.length === 0) {
                return <span style={{ color: '#999', fontStyle: 'italic' }}>Select statistics to display</span>;
              }

              // Use row-specific statistics options
              const statsOptions = {
                valueSize: element.statisticsValueSize || '24',
                valueAlignment: element.statisticsValueAlignment || 'left',
                containerWidth: element.statisticsContainerWidth || '100',
                containerAlignment: element.statisticsContainerAlignment || 'center'
              };
              const statsHtml = generateSelectedStatisticsHtml(statsToShow, sampleContext, template.theme, statsOptions);
              return <div dangerouslySetInnerHTML={{ __html: statsHtml }} />;
            }
            return <div dangerouslySetInnerHTML={{ __html: processContent(element.content || '<p>Add content...</p>') }} />;
          };

          const iconElement = (
            <div style={{ flexShrink: 0 }}>
              <IconComponent style={{ width: iconSize, height: iconSize, color: iconColor }} />
            </div>
          );

          const contentElement = (
            <div style={{ flex: 1, minWidth: 0 }}>
              {renderContent()}
            </div>
          );

          return (
            <div style={{
              padding: '15px 25px',
              display: 'flex',
              alignItems: verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center',
              gap: `${gap}px`
            }}>
              {isIconLeft ? (
                <>{iconElement}{contentElement}</>
              ) : (
                <>{contentElement}{iconElement}</>
              )}
            </div>
          );
        })()}

        {element.type === 'footer' && (
          <div style={{
            marginTop: '30px',
            padding: '20px 25px',
            borderTop: `1px solid ${template.theme?.borderColor || '#ddd'}`,
            fontSize: `${element.textSize || '12'}px`,
            color: template.theme?.mutedTextColor || '#666',
            textAlign: element.alignment || 'left'
          }}>
            <p>{element.text}</p>
            <p><a href="#" style={{ color: template.theme?.accentColor || '#0077B6' }}>Manage Preferences</a></p>
          </div>
        )}

        {element.type === 'graph' && (() => {
          // Generate graph preview using server-side aggregated data if available
          let graphData;
          const isLoading = isLoadingGraphData[element.id];

          if (useLiveData && serverGraphData[element.id] && serverGraphData[element.id].length > 0) {
            // Use server-side aggregated data (accurate for all records)
            graphData = serverGraphData[element.id];
          } else if (useLiveData && liveDataRecords.length > 0 && element.labelField) {
            // Fallback to client-side aggregation (limited to sample records)
            graphData = aggregateGraphData(liveDataRecords, element.labelField, element.dataField, element.operation || 'count', element.maxItems || 10);
          } else {
            // Use sample data for preview when no live data
            graphData = generateSampleGraphData(element.graphType || 'bar', 5);
          }

          const graphOptions = {
            title: element.title || '',
            width: element.width || '100',
            height: element.height || '250',
            alignment: element.alignment || 'center',
            showLegend: element.showLegend !== false,
            showValues: element.showValues !== false
          };

          const graphHtml = generateGraphHtml(element.graphType || 'bar', graphData, template.theme, graphOptions);

          return (
            <div style={{ padding: '15px 25px' }}>
              {!element.labelField && (
                <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '11px', color: '#92400e' }}>
                  Select a label field to see real data. Showing sample data.
                </div>
              )}
              {isLoading && (
                <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '11px', color: '#1e40af' }}>
                  Loading graph data from server...
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: graphHtml }} />
            </div>
          );
        })()}
      </div>
    );
  };

  // Copy placeholder to clipboard
  const copyPlaceholder = async (key) => {
    const placeholder = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopiedPlaceholder(key);
      setTimeout(() => setCopiedPlaceholder(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Validate template
  const validationResult = validateCustomTemplate(template, notification);

  // Get available fields for statistics
  // Note: Use length check because empty array [] is truthy and wouldn't fall back to liveDataFields
  const availableFields = notification.source?.displayFields?.length > 0
    ? notification.source.displayFields
    : liveDataFields;

  // Debug logging for statistics field selection
  console.log('[CustomTemplateEditor] availableFields resolution:', {
    'notification.source?.displayFields': notification.source?.displayFields,
    'liveDataFields': liveDataFields,
    'resolved availableFields': availableFields,
    'availableFields.length': availableFields?.length || 0,
    'useLiveData': useLiveData,
    'isLoadingLiveData': isLoadingLiveData,
    'liveDataRecords.length': liveDataRecords?.length || 0
  });

  return (
    <div className="flex h-full min-h-0">
      {/* Preview Overlay Modal */}
      {showPreviewOverlay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-[#004E7C]" />
                <div>
                  <h4 className="font-bold text-slate-800">Template Preview</h4>
                  <p className="text-xs text-slate-500">
                    {useLiveData && liveRecordCount !== null
                      ? `Rendered with ${liveRecordCount.toLocaleString()} live records`
                      : 'Rendered with sample data'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 rounded p-0.5">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1.5 rounded transition-colors ${
                      previewMode === 'desktop'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1.5 rounded transition-colors ${
                      previewMode === 'mobile'
                        ? 'bg-white shadow-sm text-slate-700'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowPreviewOverlay(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100">
              <div
                className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
                style={{ maxWidth: previewMode === 'mobile' ? '375px' : '600px' }}
              >
                <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Panel - Configuration */}
      <div className="w-80 flex flex-col min-h-0 border-r border-slate-200 bg-slate-50 shrink-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Configuration</span>
            {!validationResult.isValid && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {validationResult.errors.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPreviewOverlay(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {/* Live Data Connection */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Live Data Preview
              </span>
              {useLiveData && liveRecordCount !== null && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">
                  Connected
                </span>
              )}
            </div>

            {notification.source?.endpoint ? (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 truncate">
                  {notification.source.endpoint}
                </p>
                {isLoadingLiveData ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading live data...
                  </div>
                ) : liveDataError ? (
                  <div className="flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    {liveDataError}
                  </div>
                ) : useLiveData ? (
                  <div className="space-y-2">
                    <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                      {liveRecordCount?.toLocaleString() || liveDataRecords.length} records, {liveDataFields.length} fields
                    </div>
                    {/* Show calculated statistics */}
                    {liveStatistics && template.statistics.length > 0 && (
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-[10px] font-medium text-blue-700 mb-1.5">Calculated Statistics:</p>
                        <div className="space-y-1">
                          {template.statistics.map(stat => (
                            <div key={stat.id} className="flex items-center justify-between text-[10px]">
                              <span className="text-blue-600">{stat.label || stat.id}:</span>
                              <span className="font-medium text-blue-800">{liveStatistics[`stat_${stat.id}`] || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={fetchLiveData}
                  disabled={isLoadingLiveData}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLiveData ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No data source configured in notification settings
              </p>
            )}
          </div>

          {/* CSV Toggle */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.includeCSV}
                onChange={(e) => handleCSVToggle(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-slate-700 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                Include CSV attachment
              </span>
            </label>
          </div>

          {/* Logo Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('branding')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                Logo
                {template.branding?.logoUrl && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">Set</span>
                )}
              </span>
              {expandedSections.branding ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.branding && (
              <div className="p-3 border-t border-slate-100">
                <BrandingCustomizer
                  branding={template.branding}
                  onChange={handleBrandingChange}
                  theme={template.theme}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Theme Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('theme')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                Theme Colors
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: template.theme?.primaryColor }} />
                  <div className="w-3 h-3 rounded-sm border border-slate-200" style={{ backgroundColor: template.theme?.accentColor }} />
                </div>
              </span>
              {expandedSections.theme ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.theme && (
              <div className="p-3 border-t border-slate-100">
                <ThemeCustomizer
                  theme={template.theme}
                  onChange={handleThemeChange}
                  onReset={() => handleThemeChange(DEFAULT_THEME)}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Statistics Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('statistics')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                Statistics
                {template.statistics.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#004E7C] text-white text-[10px] rounded-full">
                    {template.statistics.length}
                  </span>
                )}
              </span>
              {expandedSections.statistics ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.statistics && (
              <div className="p-3 border-t border-slate-100">
                <StatisticsBuilder
                  statistics={template.statistics}
                  availableFields={availableFields}
                  onChange={handleStatisticsChange}
                  compact={true}
                />
              </div>
            )}
          </div>

          {/* Placeholders Reference */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('placeholders')}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Code className="w-3.5 h-3.5" />
                Placeholders
              </span>
              {expandedSections.placeholders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {expandedSections.placeholders && (
              <div className="p-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                {PLACEHOLDER_SECTIONS.slice(0, 4).map(section => (
                  <div key={section.title} className="mb-2">
                    <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">{section.title}</p>
                    <div className="space-y-0.5">
                      {section.placeholders.map(p => (
                        <button
                          key={p.name}
                          onClick={() => copyPlaceholder(p.name)}
                          className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] bg-slate-50 rounded hover:bg-slate-100"
                          title={p.description}
                        >
                          <span className="font-mono text-slate-700">{`{{${p.name}}}`}</span>
                          {copiedPlaceholder === p.name ? (
                            <Check className="w-2.5 h-2.5 text-green-500" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Designer/HTML Editor */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
        {/* Right Panel Header with Mode Toggle */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setRightPanelMode('designer')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  rightPanelMode === 'designer'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                Designer
              </button>
              <button
                onClick={() => setRightPanelMode('html')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  rightPanelMode === 'html'
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                HTML
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rightPanelMode === 'designer' && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Move className="w-3 h-3" />
                Drag elements to reorder
              </span>
            )}
            {useLiveData && liveRecordCount !== null && (
              <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                <Database className="w-3 h-3" />
                Live: {liveRecordCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Designer Mode */}
        {rightPanelMode === 'designer' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Element Palette */}
            <div className="w-40 border-r border-slate-200 p-2 overflow-y-auto bg-white shrink-0">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Elements</h4>

              {/* Structure Elements */}
              <div className="mb-3">
                <h5 className="text-[9px] font-medium text-slate-400 uppercase mb-1">Structure</h5>
                <div className="space-y-1">
                  {VISUAL_ELEMENTS.filter(el => el.category === 'structure').map(el => {
                    const Icon = getElementIcon(el.icon);
                    return (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all"
                      >
                        <Icon className="w-3 h-3 text-slate-500" />
                        {el.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Content Elements */}
              <div className="mb-3">
                <h5 className="text-[9px] font-medium text-slate-400 uppercase mb-1">Content</h5>
                <div className="space-y-1">
                  {VISUAL_ELEMENTS.filter(el => el.category === 'content').map(el => {
                    const Icon = getElementIcon(el.icon);
                    return (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all"
                      >
                        <Icon className="w-3 h-3 text-slate-500" />
                        {el.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Elements */}
              <div>
                <h5 className="text-[9px] font-medium text-slate-400 uppercase mb-1">Data</h5>
                <div className="space-y-1">
                  {VISUAL_ELEMENTS.filter(el => el.category === 'data').map(el => {
                    const Icon = getElementIcon(el.icon);
                    return (
                      <div
                        key={el.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, el)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] cursor-grab hover:border-slate-300 hover:shadow-sm hover:bg-white transition-all ${
                          el.id === 'download-button' && !template.includeCSV ? 'opacity-50' : ''
                        }`}
                      >
                        <Icon className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{el.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Designer Canvas */}
            <div
              className="flex-1 overflow-y-auto p-4"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={handleDropOnCanvas}
              onClick={() => setSelectedElementIndex(null)}
            >
              <div className="max-w-xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden min-h-[400px]">
                {(template.visualElements || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 border-2 border-dashed border-slate-200 m-4 rounded-lg">
                    <LayoutTemplate className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm font-medium">Drag elements here</p>
                    <p className="text-xs mt-1 text-center px-4">Drop structure, content, and data elements to build your email</p>
                  </div>
                ) : (
                  (template.visualElements || []).map((element, index) => renderVisualElement(element, index))
                )}

                {/* Drop zone at the end */}
                {(template.visualElements || []).length > 0 && (
                  <div
                    onDragOver={(e) => handleDragOver(e, (template.visualElements || []).length)}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, (template.visualElements || []).length)}
                    className={`h-16 border-2 border-dashed m-4 rounded-lg flex items-center justify-center text-[10px] text-slate-400 transition-colors ${
                      dragOverIndex === (template.visualElements || []).length ? 'border-blue-400 bg-blue-50 text-blue-500' : 'border-slate-200'
                    }`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Drop here to add at end
                  </div>
                )}
              </div>
            </div>

            {/* Element Editor Panel */}
            {selectedElementIndex !== null && template.visualElements?.[selectedElementIndex] && (
              <div className="w-64 border-l border-slate-200 bg-white p-3 overflow-y-auto shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5" />
                    Edit Element
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedElementIndex(null)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Element-specific editors */}
                {(() => {
                  const element = template.visualElements[selectedElementIndex];
                  const elementType = element.type;

                  return (
                    <div className="space-y-3">
                      {/* Header Editor */}
                      {elementType === 'header' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Title</label>
                            <input
                              type="text"
                              value={element.title || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { title: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Header title"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Subtitle</label>
                            <input
                              type="text"
                              value={element.subtitle || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { subtitle: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Header subtitle"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Title Size</label>
                              <select
                                value={element.titleSize || '24'}
                                onChange={(e) => updateElement(selectedElementIndex, { titleSize: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              >
                                <option value="18">18px</option>
                                <option value="20">20px</option>
                                <option value="22">22px</option>
                                <option value="24">24px</option>
                                <option value="28">28px</option>
                                <option value="32">32px</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Subtitle Size</label>
                              <select
                                value={element.subtitleSize || '14'}
                                onChange={(e) => updateElement(selectedElementIndex, { subtitleSize: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              >
                                <option value="12">12px</option>
                                <option value="14">14px</option>
                                <option value="16">16px</option>
                                <option value="18">18px</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'left') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Text/Intro Editor */}
                      {elementType === 'text' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Content</label>
                            <textarea
                              value={element.content || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { content: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[120px] resize-y"
                              placeholder="Enter text content (HTML supported)"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">Supports HTML and placeholders like {'{{organizationName}}'}</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Text Size</label>
                            <select
                              value={element.textSize || '14'}
                              onChange={(e) => updateElement(selectedElementIndex, { textSize: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="12">12px (Small)</option>
                              <option value="13">13px</option>
                              <option value="14">14px (Default)</option>
                              <option value="15">15px</option>
                              <option value="16">16px (Large)</option>
                              <option value="18">18px (XL)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'left') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Record Count Editor */}
                      {elementType === 'record-count' && (
                        <div>
                          <label className="block text-[10px] font-medium text-slate-600 mb-1">Template</label>
                          <textarea
                            value={element.template || ''}
                            onChange={(e) => updateElement(selectedElementIndex, { template: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-y"
                            placeholder="We found {{recordCount}} records"
                          />
                          <p className="text-[9px] text-slate-400 mt-1">Use {'{{recordCount}}'} for the count</p>
                        </div>
                      )}

                      {/* Date Range Editor */}
                      {elementType === 'date-range' && (
                        <div>
                          <label className="block text-[10px] font-medium text-slate-600 mb-1">Template</label>
                          <textarea
                            value={element.template || ''}
                            onChange={(e) => updateElement(selectedElementIndex, { template: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-y"
                            placeholder="Period: {{dateRangeStart}} - {{dateRangeEnd}}"
                          />
                          <p className="text-[9px] text-slate-400 mt-1">Use {'{{dateRangeStart}}'} and {'{{dateRangeEnd}}'}</p>
                        </div>
                      )}

                      {/* Footer Editor */}
                      {elementType === 'footer' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Footer Text</label>
                            <textarea
                              value={element.text || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { text: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px] resize-y"
                              placeholder="Footer text"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Text Size</label>
                            <select
                              value={element.textSize || '12'}
                              onChange={(e) => updateElement(selectedElementIndex, { textSize: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="10">10px (Small)</option>
                              <option value="11">11px</option>
                              <option value="12">12px (Default)</option>
                              <option value="13">13px</option>
                              <option value="14">14px (Large)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'left') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Spacer Editor */}
                      {elementType === 'spacer' && (
                        <div>
                          <label className="block text-[10px] font-medium text-slate-600 mb-1">Height</label>
                          <select
                            value={element.height || '20px'}
                            onChange={(e) => updateElement(selectedElementIndex, { height: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="10px">Small (10px)</option>
                            <option value="20px">Medium (20px)</option>
                            <option value="30px">Large (30px)</option>
                            <option value="40px">Extra Large (40px)</option>
                            <option value="60px">Huge (60px)</option>
                          </select>
                        </div>
                      )}

                      {/* Statistics Editor */}
                      {elementType === 'statistics' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Select Statistics to Display</label>
                            {template.statistics.length === 0 ? (
                              <p className="text-[9px] text-slate-500 p-2 bg-slate-50 rounded">
                                No statistics configured yet. Add statistics in the left panel under "Statistics" section.
                              </p>
                            ) : (
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {template.statistics.map(stat => {
                                  const isSelected = (element.selectedStatistics || []).includes(stat.id);
                                  return (
                                    <label key={stat.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded hover:bg-slate-100 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const currentSelected = element.selectedStatistics || [];
                                          const newSelected = e.target.checked
                                            ? [...currentSelected, stat.id]
                                            : currentSelected.filter(id => id !== stat.id);
                                          updateElement(selectedElementIndex, { selectedStatistics: newSelected });
                                        }}
                                        className="rounded text-blue-500"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium text-slate-700">{stat.label || stat.id}</span>
                                        <span className="text-[9px] text-slate-400 ml-2">{stat.operation} of {stat.field}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-blue-50 border border-blue-100 rounded">
                            <p className="text-[9px] text-blue-700">
                              {(element.selectedStatistics || []).length === 0
                                ? 'No statistics selected - all statistics will be shown'
                                : `${(element.selectedStatistics || []).length} statistic(s) selected`}
                            </p>
                          </div>
                          {/* Value Size */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Value Size</label>
                            <select
                              value={element.valueSize || '24'}
                              onChange={(e) => updateElement(selectedElementIndex, { valueSize: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="16">Small (16px)</option>
                              <option value="20">Medium (20px)</option>
                              <option value="24">Large (24px)</option>
                              <option value="32">Extra Large (32px)</option>
                              <option value="40">Huge (40px)</option>
                            </select>
                          </div>
                          {/* Value Alignment */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Value Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { valueAlignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.valueAlignment || 'center') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Container Width */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Container Width</label>
                            <select
                              value={element.containerWidth || '100'}
                              onChange={(e) => updateElement(selectedElementIndex, { containerWidth: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="50">50%</option>
                              <option value="60">60%</option>
                              <option value="70">70%</option>
                              <option value="80">80%</option>
                              <option value="90">90%</option>
                              <option value="100">100% (Full Width)</option>
                            </select>
                          </div>
                          {/* Container Alignment */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Container Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { containerAlignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.containerAlignment || 'center') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Icon Editor */}
                      {elementType === 'icon' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Icon</label>
                            <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto p-1 border border-slate-200 rounded bg-slate-50">
                              {Object.keys(AVAILABLE_ICONS).map(iconName => {
                                const IconComp = AVAILABLE_ICONS[iconName];
                                const isSelected = element.iconName === iconName;
                                return (
                                  <button
                                    key={iconName}
                                    type="button"
                                    onClick={() => updateElement(selectedElementIndex, { iconName })}
                                    className={`p-1.5 rounded hover:bg-white transition-colors ${
                                      isSelected ? 'bg-blue-100 ring-1 ring-blue-400' : ''
                                    }`}
                                    title={iconName}
                                  >
                                    <IconComp className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Size</label>
                            <select
                              value={element.iconSize || '24'}
                              onChange={(e) => updateElement(selectedElementIndex, { iconSize: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="16">Small (16px)</option>
                              <option value="24">Medium (24px)</option>
                              <option value="32">Large (32px)</option>
                              <option value="48">Extra Large (48px)</option>
                              <option value="64">Huge (64px)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={element.iconColor?.startsWith('{{') ? (template.theme?.primaryColor || '#004E7C') : (element.iconColor || '#004E7C')}
                                onChange={(e) => updateElement(selectedElementIndex, { iconColor: e.target.value })}
                                className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => updateElement(selectedElementIndex, { iconColor: '{{primaryColor}}' })}
                                className={`flex-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                                  element.iconColor === '{{primaryColor}}'
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Use Theme Color
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'center') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Row Editor */}
                      {elementType === 'row' && (
                        <div className="space-y-3">
                          {/* Icon Selection */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Icon</label>
                            <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto p-1 border border-slate-200 rounded bg-slate-50">
                              {Object.keys(AVAILABLE_ICONS).map(iconName => {
                                const IconComp = AVAILABLE_ICONS[iconName];
                                const isSelected = element.iconName === iconName;
                                return (
                                  <button
                                    key={iconName}
                                    type="button"
                                    onClick={() => updateElement(selectedElementIndex, { iconName })}
                                    className={`p-1.5 rounded hover:bg-white transition-colors ${
                                      isSelected ? 'bg-blue-100 ring-1 ring-blue-400' : ''
                                    }`}
                                    title={iconName}
                                  >
                                    <IconComp className="w-3 h-3 text-slate-600" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Icon Size and Color */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Size</label>
                              <select
                                value={element.iconSize || '32'}
                                onChange={(e) => updateElement(selectedElementIndex, { iconSize: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              >
                                <option value="24">24px</option>
                                <option value="32">32px</option>
                                <option value="40">40px</option>
                                <option value="48">48px</option>
                                <option value="64">64px</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={element.iconColor?.startsWith('{{') ? (template.theme?.primaryColor || '#004E7C') : (element.iconColor || '#004E7C')}
                                  onChange={(e) => updateElement(selectedElementIndex, { iconColor: e.target.value })}
                                  className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { iconColor: '{{primaryColor}}' })}
                                  className={`flex-1 px-1 py-1 text-[9px] rounded border transition-colors ${
                                    element.iconColor === '{{primaryColor}}'
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600'
                                  }`}
                                >
                                  Theme
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Icon Position */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Icon Position</label>
                            <div className="flex gap-1">
                              {['left', 'right'].map(pos => (
                                <button
                                  key={pos}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { iconPosition: pos })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.iconPosition || 'left') === pos
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Content Type */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Content Type</label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => updateElement(selectedElementIndex, { contentType: 'text' })}
                                className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                                  (element.contentType || 'text') === 'text'
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Text/HTML
                              </button>
                              <button
                                type="button"
                                onClick={() => updateElement(selectedElementIndex, { contentType: 'statistics' })}
                                className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                                  element.contentType === 'statistics'
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                Statistics
                              </button>
                            </div>
                          </div>

                          {/* Text Content (when contentType is text) */}
                          {(element.contentType || 'text') === 'text' && (
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Content</label>
                              <textarea
                                value={element.content || ''}
                                onChange={(e) => updateElement(selectedElementIndex, { content: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded min-h-[80px] resize-y"
                                placeholder="Enter text or HTML content..."
                              />
                            </div>
                          )}

                          {/* Statistics Selection (when contentType is statistics) */}
                          {element.contentType === 'statistics' && (
                            <>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Select Statistics</label>
                                {template.statistics.length === 0 ? (
                                  <p className="text-[9px] text-slate-500 p-2 bg-slate-50 rounded">
                                    No statistics configured. Add them in the Statistics section.
                                  </p>
                                ) : (
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {template.statistics.map(stat => {
                                      const isSelected = (element.selectedStatistics || []).includes(stat.id);
                                      return (
                                        <label key={stat.id} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded hover:bg-slate-100 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              const currentSelected = element.selectedStatistics || [];
                                              const newSelected = e.target.checked
                                                ? [...currentSelected, stat.id]
                                                : currentSelected.filter(id => id !== stat.id);
                                              updateElement(selectedElementIndex, { selectedStatistics: newSelected });
                                            }}
                                            className="rounded text-blue-500"
                                          />
                                          <span className="text-[10px] text-slate-700">{stat.label || stat.id}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              {/* Statistics Value Size */}
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Statistics Value Size</label>
                                <select
                                  value={element.statisticsValueSize || '24'}
                                  onChange={(e) => updateElement(selectedElementIndex, { statisticsValueSize: e.target.value })}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                                >
                                  <option value="16">Small (16px)</option>
                                  <option value="20">Medium (20px)</option>
                                  <option value="24">Large (24px)</option>
                                  <option value="32">Extra Large (32px)</option>
                                  <option value="40">Huge (40px)</option>
                                </select>
                              </div>
                              {/* Statistics Value Alignment */}
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Statistics Value Alignment</label>
                                <div className="flex gap-1">
                                  {['left', 'center', 'right'].map(align => (
                                    <button
                                      key={align}
                                      type="button"
                                      onClick={() => updateElement(selectedElementIndex, { statisticsValueAlignment: align })}
                                      className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                        (element.statisticsValueAlignment || 'left') === align
                                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      {align}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Statistics Container Width */}
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Statistics Container Width</label>
                                <select
                                  value={element.statisticsContainerWidth || '100'}
                                  onChange={(e) => updateElement(selectedElementIndex, { statisticsContainerWidth: e.target.value })}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                                >
                                  <option value="50">50%</option>
                                  <option value="60">60%</option>
                                  <option value="70">70%</option>
                                  <option value="80">80%</option>
                                  <option value="90">90%</option>
                                  <option value="100">100% (Full Width)</option>
                                </select>
                              </div>
                              {/* Statistics Container Alignment */}
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">Statistics Container Alignment</label>
                                <div className="flex gap-1">
                                  {['left', 'center', 'right'].map(align => (
                                    <button
                                      key={align}
                                      type="button"
                                      onClick={() => updateElement(selectedElementIndex, { statisticsContainerAlignment: align })}
                                      className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                        (element.statisticsContainerAlignment || 'center') === align
                                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      {align}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {/* Vertical Alignment */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Vertical Align</label>
                            <div className="flex gap-1">
                              {['top', 'center', 'bottom'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { verticalAlign: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.verticalAlign || 'center') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Gap */}
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Gap</label>
                            <select
                              value={element.gap || '15'}
                              onChange={(e) => updateElement(selectedElementIndex, { gap: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="10">Small (10px)</option>
                              <option value="15">Medium (15px)</option>
                              <option value="20">Large (20px)</option>
                              <option value="30">Extra Large (30px)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Logo Editor */}
                      {elementType === 'logo' && (
                        <>
                          <div className="p-2 bg-blue-50 border border-blue-100 rounded text-[9px] text-blue-700 mb-2">
                            Logo URL is configured in the Logo section on the left panel. Here you can adjust size and alignment.
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Logo Size</label>
                            <select
                              value={element.size || '150'}
                              onChange={(e) => updateElement(selectedElementIndex, { size: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="80">80px (Small)</option>
                              <option value="100">100px</option>
                              <option value="120">120px</option>
                              <option value="150">150px (Default)</option>
                              <option value="180">180px</option>
                              <option value="200">200px (Large)</option>
                              <option value="250">250px (XL)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'left') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Divider Editor */}
                      {elementType === 'divider' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Width</label>
                            <select
                              value={element.width || '100'}
                              onChange={(e) => updateElement(selectedElementIndex, { width: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="25">25%</option>
                              <option value="50">50%</option>
                              <option value="75">75%</option>
                              <option value="100">100% (Full)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'center') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Thickness</label>
                              <select
                                value={element.thickness || '1'}
                                onChange={(e) => updateElement(selectedElementIndex, { thickness: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              >
                                <option value="1">1px</option>
                                <option value="2">2px</option>
                                <option value="3">3px</option>
                                <option value="4">4px</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Style</label>
                              <select
                                value={element.style || 'solid'}
                                onChange={(e) => updateElement(selectedElementIndex, { style: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Graph Editor */}
                      {elementType === 'graph' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Chart Title</label>
                            <input
                              type="text"
                              value={element.title || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { title: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              placeholder="Enter chart title"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Graph Type</label>
                            <div className="flex gap-1">
                              {['bar', 'line', 'pie'].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { graphType: type })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.graphType || 'bar') === type
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Label Field (Categories)</label>
                            <select
                              value={element.labelField || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { labelField: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="">Select field...</option>
                              {availableFields.map(f => {
                                const fieldName = typeof f === 'string' ? f : f.field;
                                const fieldLabel = typeof f === 'string' ? f : (f.label || f.field);
                                return (
                                  <option key={fieldName} value={fieldName}>{fieldLabel}</option>
                                );
                              })}
                            </select>
                            <p className="text-[9px] text-slate-400 mt-1">Field to group data by (e.g., Status, Category)</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Data Field (Values)</label>
                            <select
                              value={element.dataField || ''}
                              onChange={(e) => updateElement(selectedElementIndex, { dataField: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="">Select field (optional)...</option>
                              {availableFields.map(f => {
                                const fieldName = typeof f === 'string' ? f : f.field;
                                const fieldLabel = typeof f === 'string' ? f : (f.label || f.field);
                                return (
                                  <option key={fieldName} value={fieldName}>{fieldLabel}</option>
                                );
                              })}
                            </select>
                            <p className="text-[9px] text-slate-400 mt-1">Field to aggregate (leave empty for count)</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Operation</label>
                            <select
                              value={element.operation || 'count'}
                              onChange={(e) => updateElement(selectedElementIndex, { operation: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="count">Count (number of records)</option>
                              <option value="sum">Sum (total value)</option>
                              <option value="mean">Average (mean value)</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Max Categories</label>
                              <input
                                type="number"
                                min="1"
                                value={element.maxItems || '6'}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value, 10);
                                  if (value >= 1) {
                                    updateElement(selectedElementIndex, { maxItems: String(value) });
                                  } else if (e.target.value === '') {
                                    updateElement(selectedElementIndex, { maxItems: '1' });
                                  }
                                }}
                                onBlur={(e) => {
                                  const value = parseInt(e.target.value, 10);
                                  if (!value || value < 1) {
                                    updateElement(selectedElementIndex, { maxItems: '1' });
                                  }
                                }}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-600 mb-1">Height</label>
                              <select
                                value={element.height || '250'}
                                onChange={(e) => updateElement(selectedElementIndex, { height: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                              >
                                <option value="180">Small (180px)</option>
                                <option value="220">Medium (220px)</option>
                                <option value="250">Default (250px)</option>
                                <option value="300">Large (300px)</option>
                                <option value="350">XL (350px)</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Width</label>
                            <select
                              value={element.width || '100'}
                              onChange={(e) => updateElement(selectedElementIndex, { width: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded"
                            >
                              <option value="50">50%</option>
                              <option value="70">70%</option>
                              <option value="85">85%</option>
                              <option value="100">100% (Full)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Alignment</label>
                            <div className="flex gap-1">
                              {['left', 'center', 'right'].map(align => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateElement(selectedElementIndex, { alignment: align })}
                                  className={`flex-1 px-2 py-1.5 text-[10px] rounded border transition-colors capitalize ${
                                    (element.alignment || 'center') === align
                                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-2 text-[10px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={element.showLegend !== false}
                                onChange={(e) => updateElement(selectedElementIndex, { showLegend: e.target.checked })}
                                className="rounded"
                              />
                              Show Legend
                            </label>
                            <label className="flex items-center gap-2 text-[10px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={element.showValues !== false}
                                onChange={(e) => updateElement(selectedElementIndex, { showValues: e.target.checked })}
                                className="rounded"
                              />
                              Show Values
                            </label>
                          </div>
                          <div className="p-2 bg-blue-50 border border-blue-100 rounded">
                            <p className="text-[9px] text-blue-700">
                              Graph colors automatically match your theme colors (primary, accent, etc.)
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Data Table Editor */}
                      {elementType === 'datatable' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Records to Display</label>
                            <select
                              value={element.recordLimit || '10'}
                              onChange={(e) => updateElement(selectedElementIndex, { recordLimit: parseInt(e.target.value) })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="5">5 records</option>
                              <option value="10">10 records</option>
                              <option value="15">15 records</option>
                              <option value="20">20 records</option>
                              <option value="25">25 records</option>
                              <option value="50">50 records</option>
                            </select>
                            <p className="text-[9px] text-slate-400 mt-1">Maximum records shown in the email table</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-1">Visible Fields</label>
                            {availableFields.length === 0 ? (
                              <p className="text-[9px] text-slate-500 p-2 bg-slate-50 rounded">
                                No fields available. Connect to your data source to see available fields.
                              </p>
                            ) : (
                              <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50">
                                {availableFields.map(f => {
                                  const fieldName = typeof f === 'string' ? f : f.field;
                                  const fieldLabel = typeof f === 'string' ? f : (f.label || f.field);
                                  const isSelected = (element.selectedFields || []).includes(fieldName);
                                  return (
                                    <label key={fieldName} className="flex items-center gap-2 p-1.5 bg-white rounded hover:bg-slate-100 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const currentSelected = element.selectedFields || [];
                                          const newSelected = e.target.checked
                                            ? [...currentSelected, fieldName]
                                            : currentSelected.filter(name => name !== fieldName);
                                          updateElement(selectedElementIndex, { selectedFields: newSelected });
                                        }}
                                        className="rounded text-blue-500"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs text-slate-700">{fieldLabel}</span>
                                        {fieldLabel !== fieldName && (
                                          <span className="text-[9px] text-slate-400 ml-1">({fieldName})</span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-blue-50 border border-blue-100 rounded">
                            <p className="text-[9px] text-blue-700">
                              {(element.selectedFields || []).length === 0
                                ? 'No fields selected - all notification display fields will be shown'
                                : `${(element.selectedFields || []).length} field(s) selected for the table`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Non-editable elements info */}
                      {['download-button', 'more-records'].includes(elementType) && (
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-[10px] text-slate-600">
                            {elementType === 'download-button' && 'Download button appears when CSV attachment is enabled.'}
                            {elementType === 'more-records' && 'This message appears automatically when there are more records than displayed.'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* HTML Mode */}
        {rightPanelMode === 'html' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* HTML Editor */}
            <div className="flex-1 flex flex-col p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">HTML Template</label>
                <span className="text-[10px] text-slate-400">Use inline CSS for email compatibility</span>
              </div>
              <textarea
                value={template.html || ''}
                onChange={(e) => handleHtmlChange(e.target.value)}
                placeholder="<div>Your email HTML here...</div>"
                className="flex-1 w-full px-4 py-3 border rounded-lg text-xs font-mono resize-none bg-slate-900 text-green-400 border-slate-700"
                spellCheck={false}
              />
            </div>

            {/* Live Preview */}
            <div className="w-1/2 border-l border-slate-200 bg-slate-100 flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-white">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview
                </span>
                <div className="flex items-center bg-slate-100 rounded p-0.5">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1 rounded transition-colors ${
                      previewMode === 'desktop' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1 rounded transition-colors ${
                      previewMode === 'mobile' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3">
                <div
                  className="mx-auto bg-white shadow rounded-lg overflow-hidden transition-all"
                  style={{ maxWidth: previewMode === 'mobile' ? '375px' : '600px' }}
                >
                  <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
