// src/admin/components/EmailTemplateEditor.jsx
// Modal editor for creating and editing email templates
// Provides live preview, placeholder documentation, template categories,
// feature service connection for live data preview, and visual drag-and-drop builder
//
// Templates support custom HTML with {{placeholders}} for dynamic content

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Save,
  Eye,
  EyeOff,
  Code,
  FileText,
  Info,
  Copy,
  Check,
  Sparkles,
  LayoutTemplate,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Type,
  Image,
  Table2,
  Download,
  Search,
  Loader2,
  Link as LinkIcon,
  GripVertical,
  Move,
  Lock,
  Unlock,
  Settings,
  Palette,
  MousePointer2,
  FileCode
} from 'lucide-react';
import ServiceFinder from './ServiceFinder';

// Available placeholder documentation
const PLACEHOLDERS = [
  { key: 'organizationName', desc: 'Name of the organization', example: 'One South Realty' },
  { key: 'organizationId', desc: 'ID of the organization', example: 'one_south_realty' },
  { key: 'notificationName', desc: 'Name of the notification', example: 'Daily Market Report' },
  { key: 'notificationId', desc: 'ID of the notification', example: 'daily_market_report' },
  { key: 'recordCount', desc: 'Number of records found', example: '1686' },
  { key: 'dateRangeStart', desc: 'Start date (MM/DD/YYYY)', example: '01/01/2026' },
  { key: 'dateRangeEnd', desc: 'End date (MM/DD/YYYY)', example: '01/31/2026' },
  { key: 'dateRangeStartTime', desc: 'Start date with time', example: '01/01/2026 00:00' },
  { key: 'dateRangeEndTime', desc: 'End date with time', example: '01/31/2026 23:59' },
  { key: 'dataTable', desc: 'Pre-built HTML table of records (first 10)', example: '<table>...</table>' },
  { key: 'downloadButton', desc: 'Pre-built download button HTML', example: '<a href="#">Download</a>' },
  { key: 'downloadUrl', desc: 'Raw URL to CSV download', example: 'https://storage.googleapis.com/...' },
  { key: 'moreRecordsMessage', desc: 'Message if more records exist', example: 'Showing first 10 of 100 records' },
  { key: 'emailIntro', desc: 'Custom intro text from notification config', example: 'Here is your report...' },
  { key: 'emailZeroStateMessage', desc: 'Message when no records found', example: 'No records match your criteria' }
];

// Template categories
const CATEGORIES = [
  { id: 'general', label: 'General', desc: 'Generic notification template' },
  { id: 'real-estate', label: 'Real Estate', desc: 'Property and market reports' },
  { id: 'public-safety', label: 'Public Safety', desc: 'Incident and safety alerts' },
  { id: 'permits', label: 'Permits & Planning', desc: 'Permit and development notifications' },
  { id: 'utilities', label: 'Utilities', desc: 'Service and utility updates' },
  { id: 'statistics', label: 'Statistics', desc: 'Data summaries and analytics' }
];

// Visual builder element types
const ELEMENT_TYPES = {
  header: {
    name: 'Header',
    icon: Type,
    defaultSize: { width: 100, height: 12 },
    minSize: { width: 50, height: 8 },
    defaultContent: {
      text: '{{organizationName}}',
      subtitle: '{{notificationName}}',
      backgroundColor: '#004E7C',
      color: '#ffffff',
      fontSize: 24,
      align: 'center'
    }
  },
  text: {
    name: 'Text Block',
    icon: FileText,
    defaultSize: { width: 100, height: 8 },
    minSize: { width: 20, height: 5 },
    defaultContent: {
      text: '{{emailIntro}}',
      fontSize: 14,
      color: '#444444',
      align: 'left',
      backgroundColor: '#ffffff'
    }
  },
  stats: {
    name: 'Statistics',
    icon: Info,
    defaultSize: { width: 100, height: 15 },
    minSize: { width: 50, height: 10 },
    defaultContent: {
      items: [
        { label: 'Total Records', value: '{{recordCount}}' },
        { label: 'Period', value: '{{dateRangeStart}} - {{dateRangeEnd}}' }
      ],
      backgroundColor: '#f5f7fa',
      labelColor: '#666666',
      valueColor: '#004E7C'
    }
  },
  dataTable: {
    name: 'Data Table',
    icon: Table2,
    defaultSize: { width: 100, height: 30 },
    minSize: { width: 50, height: 15 },
    defaultContent: {
      placeholder: '{{dataTable}}',
      showHeader: true,
      maxRows: 10,
      headerColor: '#f2f2f2',
      borderColor: '#dddddd'
    }
  },
  downloadButton: {
    name: 'Download Button',
    icon: Download,
    defaultSize: { width: 40, height: 8 },
    minSize: { width: 20, height: 6 },
    defaultContent: {
      text: 'Download Full CSV Report',
      placeholder: '{{downloadButton}}',
      backgroundColor: '#004E7C',
      color: '#ffffff',
      align: 'center'
    }
  },
  image: {
    name: 'Logo/Image',
    icon: Image,
    defaultSize: { width: 20, height: 10 },
    minSize: { width: 10, height: 5 },
    defaultContent: {
      src: '',
      alt: 'Organization Logo',
      align: 'center'
    }
  },
  divider: {
    name: 'Divider',
    icon: GripVertical,
    defaultSize: { width: 100, height: 2 },
    minSize: { width: 20, height: 1 },
    defaultContent: {
      color: '#e0e0e0',
      thickness: 1,
      style: 'solid'
    }
  },
  footer: {
    name: 'Footer',
    icon: FileText,
    defaultSize: { width: 100, height: 8 },
    minSize: { width: 50, height: 5 },
    defaultContent: {
      text: 'You are receiving this because you subscribed at CivQuest Notify.',
      fontSize: 12,
      color: '#888888',
      backgroundColor: '#f5f5f5',
      align: 'center'
    }
  },
  moreRecords: {
    name: 'More Records Message',
    icon: Info,
    defaultSize: { width: 100, height: 5 },
    minSize: { width: 30, height: 4 },
    defaultContent: {
      placeholder: '{{moreRecordsMessage}}',
      fontSize: 13,
      color: '#666666',
      fontStyle: 'italic'
    }
  }
};

// Starter templates
const STARTER_TEMPLATES = {
  basic: {
    name: 'Basic',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #004E7C; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">{{organizationName}}</h1>
    <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 16px;">{{notificationName}}</h2>
  </div>

  <div style="padding: 20px;">
    <p style="color: #666; margin: 0 0 15px 0;">
      <strong>Period:</strong> {{dateRangeStart}} to {{dateRangeEnd}}<br>
      <strong>Records:</strong> {{recordCount}}
    </p>

    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 15px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #888;">
    You are receiving this because you subscribed at CivQuest Notify.
  </div>
</div>`
  },
  statistics: {
    name: 'Statistics Report',
    html: `<div style="font-family: Georgia, serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
  <!-- Header -->
  <div style="background-color: #1a1a2e; color: white; padding: 25px; text-align: center;">
    <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">{{notificationName}}</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">{{organizationName}} | {{dateRangeEnd}}</p>
  </div>

  <!-- Statistics Grid -->
  <div style="padding: 20px; background-color: #f8f9fa;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; padding: 10px; text-align: center; vertical-align: top;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Total Records</p>
            <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: bold; color: #004E7C;">{{recordCount}}</p>
          </div>
        </td>
        <td style="width: 50%; padding: 10px; text-align: center; vertical-align: top;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Reporting Period</p>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">{{dateRangeStart}} - {{dateRangeEnd}}</p>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Content Section -->
  <div style="padding: 25px;">
    <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #333; border-bottom: 2px solid #004E7C; padding-bottom: 10px;">Summary</h2>

    {{emailIntro}}

    {{downloadButton}}

    <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: #666;">Recent Records</h3>
    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <!-- Footer -->
  <div style="padding: 20px; background-color: #1a1a2e; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.6);">
      Delivered by CivQuest Notify | {{organizationName}}
    </p>
  </div>
</div>`
  },
  marketReport: {
    name: 'Market Report',
    html: `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #004E7C 0%, #002d4a 100%); color: white; padding: 20px;">
    <table style="width: 100%;">
      <tr>
        <td style="vertical-align: middle;">
          <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Daily Market Report</p>
          <h1 style="margin: 5px 0 0 0; font-size: 24px;">{{organizationName}}</h1>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">{{dateRangeEnd}}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Key Metrics -->
  <div style="padding: 20px; background-color: #f5f7fa;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-radius: 8px 0 0 8px;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">New Listings</p>
          <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #004E7C;">{{recordCount}}</p>
        </td>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-left: 1px solid #eee; border-right: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">Period</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #333;">{{dateRangeStart}}</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold; color: #333;">{{dateRangeEnd}}</p>
        </td>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">Status</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #27ae60;">Active</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Content -->
  <div style="padding: 25px;">
    {{emailIntro}}

    <div style="margin: 20px 0;">
      {{downloadButton}}
    </div>

    <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">
      Latest Entries
    </h3>

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <!-- Footer -->
  <div style="padding: 15px 25px; background-color: #f5f7fa; border-top: 1px solid #e0e0e0;">
    <table style="width: 100%;">
      <tr>
        <td style="font-size: 11px; color: #888;">
          {{organizationName}} | Powered by CivQuest Notify
        </td>
        <td style="text-align: right; font-size: 11px; color: #888;">
          Report ID: {{notificationId}}
        </td>
      </tr>
    </table>
  </div>
</div>`
  },
  minimal: {
    name: 'Minimal',
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="padding: 30px 20px; border-bottom: 3px solid #004E7C;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 600;">{{notificationName}}</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">{{organizationName}} &bull; {{dateRangeStart}} - {{dateRangeEnd}}</p>
  </div>

  <div style="padding: 30px 20px;">
    <p style="margin: 0 0 20px 0; font-size: 32px; font-weight: 700; color: #004E7C;">{{recordCount}} <span style="font-size: 16px; font-weight: 400; color: #666;">records</span></p>

    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 20px; background: #f9f9f9; font-size: 12px; color: #888; text-align: center;">
    CivQuest Notify
  </div>
</div>`
  }
};

// Default visual builder template
const createDefaultVisualTemplate = () => ({
  elements: [
    {
      id: 'header-1',
      type: 'header',
      x: 0,
      y: 0,
      width: 100,
      height: 12,
      locked: false,
      content: {
        text: '{{organizationName}}',
        subtitle: '{{notificationName}}',
        backgroundColor: '#004E7C',
        color: '#ffffff',
        fontSize: 24,
        align: 'center'
      }
    },
    {
      id: 'stats-1',
      type: 'stats',
      x: 0,
      y: 12,
      width: 100,
      height: 15,
      locked: false,
      content: {
        items: [
          { label: 'Total Records', value: '{{recordCount}}' },
          { label: 'Period', value: '{{dateRangeStart}} - {{dateRangeEnd}}' }
        ],
        backgroundColor: '#f5f7fa',
        labelColor: '#666666',
        valueColor: '#004E7C'
      }
    },
    {
      id: 'text-1',
      type: 'text',
      x: 0,
      y: 27,
      width: 100,
      height: 8,
      locked: false,
      content: {
        text: '{{emailIntro}}',
        fontSize: 14,
        color: '#444444',
        align: 'left',
        backgroundColor: '#ffffff'
      }
    },
    {
      id: 'download-1',
      type: 'downloadButton',
      x: 30,
      y: 35,
      width: 40,
      height: 8,
      locked: false,
      content: {
        text: 'Download Full CSV Report',
        placeholder: '{{downloadButton}}',
        backgroundColor: '#004E7C',
        color: '#ffffff',
        align: 'center'
      }
    },
    {
      id: 'dataTable-1',
      type: 'dataTable',
      x: 0,
      y: 45,
      width: 100,
      height: 35,
      locked: false,
      content: {
        placeholder: '{{dataTable}}',
        showHeader: true,
        maxRows: 10,
        headerColor: '#f2f2f2',
        borderColor: '#dddddd'
      }
    },
    {
      id: 'more-1',
      type: 'moreRecords',
      x: 0,
      y: 80,
      width: 100,
      height: 5,
      locked: false,
      content: {
        placeholder: '{{moreRecordsMessage}}',
        fontSize: 13,
        color: '#666666',
        fontStyle: 'italic'
      }
    },
    {
      id: 'footer-1',
      type: 'footer',
      x: 0,
      y: 87,
      width: 100,
      height: 8,
      locked: false,
      content: {
        text: 'You are receiving this because you subscribed at CivQuest Notify.',
        fontSize: 12,
        color: '#888888',
        backgroundColor: '#f5f5f5',
        align: 'center'
      }
    }
  ]
});

/**
 * EmailTemplateEditor Component
 *
 * Modal for editing email template HTML with live preview
 *
 * Props:
 * @param {object} template - The template object to edit
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated template when saved
 * @param {string} accentColor - Theme accent color
 */
export default function EmailTemplateEditor({
  template,
  onClose,
  onSave,
  accentColor = '#004E7C'
}) {
  const [formData, setFormData] = useState({
    ...template,
    html: template.html || STARTER_TEMPLATES.basic.html,
    csvExportEnabled: template.csvExportEnabled !== false, // Default to true for backwards compatibility
    visualElements: template.visualElements || null
  });

  // Editor mode: 'html' or 'visual'
  const [editorMode, setEditorMode] = useState(template.visualElements ? 'visual' : 'html');
  const [showPreview, setShowPreview] = useState(true);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);
  const [errors, setErrors] = useState({});

  // Feature service connection state
  const [showServiceFinder, setShowServiceFinder] = useState(false);
  const [serviceEndpoint, setServiceEndpoint] = useState(template.previewServiceEndpoint || '');
  const [serviceUsername, setServiceUsername] = useState('');
  const [servicePassword, setServicePassword] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedDisplayFields, setSelectedDisplayFields] = useState(template.previewDisplayFields || []);
  const [livePreviewData, setLivePreviewData] = useState(null);
  const [isLoadingPreviewData, setIsLoadingPreviewData] = useState(false);

  // Visual builder state
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [showElementPalette, setShowElementPalette] = useState(false);
  const canvasRef = useRef(null);

  // Configuration for the proxy service
  const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://notify.civ.quest';

  // Sample data for preview (fallback when no live data)
  const getSampleData = useCallback(() => {
    const baseSample = {
      organizationName: 'One South Realty',
      organizationId: 'one_south_realty',
      notificationName: 'Daily Market Report',
      notificationId: 'daily_market_report',
      recordCount: livePreviewData?.recordCount?.toString() || '1686',
      dateRangeStart: '01/01/2026',
      dateRangeEnd: '01/31/2026',
      dateRangeStartTime: '01/01/2026 00:00',
      dateRangeEndTime: '01/31/2026 23:59',
      emailIntro: '<p style="margin: 0 0 15px 0; color: #444;">Here is your daily market summary with the latest property listings and statistics for your area.</p>',
      emailZeroStateMessage: 'No new records found for this period.',
      downloadUrl: 'https://storage.googleapis.com/reports/sample.csv',
      moreRecordsMessage: ''
    };

    // If we have live data, use it for the table
    if (livePreviewData?.features && livePreviewData.features.length > 0) {
      const fields = selectedDisplayFields.length > 0 ? selectedDisplayFields : availableFields.slice(0, 5);

      let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
        <thead>
          <tr>
            ${fields.map(f => `<th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">${f}</th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

      livePreviewData.features.slice(0, 10).forEach(feature => {
        tableHtml += '<tr>';
        fields.forEach(f => {
          const value = feature.attributes?.[f] ?? '';
          tableHtml += `<td style="padding: 10px 8px; border-bottom: 1px solid #eee;">${value}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table>';
      baseSample.dataTable = tableHtml;
      baseSample.recordCount = livePreviewData.recordCount?.toString() || livePreviewData.features.length.toString();

      if (livePreviewData.features.length > 10) {
        baseSample.moreRecordsMessage = `<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first 10 of ${livePreviewData.recordCount || livePreviewData.features.length} records. Download the CSV to see all data.</p>`;
      }
    } else {
      // Default sample table
      baseSample.dataTable = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Address</th>
            <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Price</th>
            <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">123 Main Street</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$450,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/15/2026</td></tr>
          <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">456 Oak Avenue</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$325,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/14/2026</td></tr>
          <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">789 Elm Drive</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$550,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/13/2026</td></tr>
        </tbody>
      </table>`;
      baseSample.moreRecordsMessage = '<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first 3 of 1686 records. Download the CSV to see all data.</p>';
    }

    // Download button - only show if CSV export is enabled
    if (formData.csvExportEnabled) {
      baseSample.downloadButton = `<div style="margin: 20px 0;"><a href="#" style="display: inline-block; background-color: ${accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Full CSV Report</a></div>`;
    } else {
      baseSample.downloadButton = '';
      baseSample.downloadUrl = '';
    }

    return baseSample;
  }, [livePreviewData, selectedDisplayFields, availableFields, accentColor, formData.csvExportEnabled]);

  // Process template HTML with sample/live data
  const processedHtml = formData.html?.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const sampleData = getSampleData();
    return sampleData[key] || match;
  }) || '';

  // Handle form changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
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

  // Insert placeholder at cursor position in textarea
  const insertPlaceholder = (key) => {
    const textarea = document.getElementById('html-editor');
    if (!textarea) return;

    const placeholder = `{{${key}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newHtml = formData.html.substring(0, start) + placeholder + formData.html.substring(end);

    handleChange('html', newHtml);

    // Restore cursor position after the inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  // Apply starter template
  const applyStarterTemplate = (templateKey) => {
    const starter = STARTER_TEMPLATES[templateKey];
    if (starter) {
      handleChange('html', starter.html);
    }
  };

  /**
   * Validate endpoint and fetch fields (via proxy)
   */
  const validateAndFetchFields = async (endpoint = serviceEndpoint) => {
    if (!endpoint) {
      setValidationResult({ type: 'error', message: 'Enter an endpoint URL' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const requestBody = {
        serviceUrl: endpoint,
        ...(serviceUsername && servicePassword ? { username: serviceUsername, password: servicePassword } : {})
      };

      const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to fetch metadata');
      }

      const metadata = await res.json();

      if (!metadata.fields || metadata.fields.length === 0) {
        throw new Error('No fields found in this service');
      }

      // Extract field names
      const fields = metadata.fields.map(f => f.name);
      setAvailableFields(fields);

      setValidationResult({
        type: 'success',
        message: `Connected! Found ${fields.length} fields`
      });

      // Store endpoint for the template
      setFormData(prev => ({ ...prev, previewServiceEndpoint: endpoint }));

    } catch (err) {
      console.error('Validation error:', err);
      setValidationResult({ type: 'error', message: err.message || 'Connection failed' });
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Load live preview data from the feature service
   */
  const loadPreviewData = async () => {
    if (!serviceEndpoint || availableFields.length === 0) return;

    setIsLoadingPreviewData(true);

    try {
      const fields = selectedDisplayFields.length > 0 ? selectedDisplayFields : availableFields.slice(0, 5);

      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: fields.join(','),
        returnGeometry: 'false',
        resultRecordCount: '10',
        f: 'json'
      });

      const requestBody = {
        serviceUrl: `${serviceEndpoint}/query?${queryParams.toString()}`,
        ...(serviceUsername && servicePassword ? { username: serviceUsername, password: servicePassword } : {})
      };

      const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) throw new Error('Failed to fetch data');

      const data = await res.json();

      // Also get total count
      const countParams = new URLSearchParams({
        where: '1=1',
        returnCountOnly: 'true',
        f: 'json'
      });

      const countRes = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: `${serviceEndpoint}/query?${countParams.toString()}`,
          ...(serviceUsername && servicePassword ? { username: serviceUsername, password: servicePassword } : {})
        })
      });

      const countData = await countRes.json();

      setLivePreviewData({
        features: data.features || [],
        recordCount: countData.count || data.features?.length || 0
      });

      // Update display fields in form data
      setFormData(prev => ({ ...prev, previewDisplayFields: fields }));

    } catch (err) {
      console.error('Failed to load preview data:', err);
    } finally {
      setIsLoadingPreviewData(false);
    }
  };

  /**
   * Handle selecting a service from ServiceFinder
   */
  const handleServiceSelected = (serviceData) => {
    setServiceEndpoint(serviceData.url);
    setShowServiceFinder(false);

    // Auto-validate with the new endpoint
    setTimeout(() => {
      validateAndFetchFields(serviceData.url);
    }, 100);
  };

  // Toggle display field for preview
  const toggleDisplayField = (field) => {
    setSelectedDisplayFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  // ============ Visual Builder Functions ============

  // Convert visual elements to HTML
  const visualToHtml = useCallback((elements) => {
    if (!elements || elements.length === 0) return STARTER_TEMPLATES.basic.html;

    // Sort elements by Y position
    const sortedElements = [...elements].sort((a, b) => a.y - b.y);

    let html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">`;

    sortedElements.forEach(element => {
      const content = element.content || {};

      switch (element.type) {
        case 'header':
          html += `
  <div style="background-color: ${content.backgroundColor || '#004E7C'}; color: ${content.color || '#ffffff'}; padding: 20px; text-align: ${content.align || 'center'};">
    <h1 style="margin: 0; font-size: ${content.fontSize || 24}px;">${content.text || '{{organizationName}}'}</h1>
    ${content.subtitle ? `<h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: ${Math.round((content.fontSize || 24) * 0.67)}px;">${content.subtitle}</h2>` : ''}
  </div>`;
          break;

        case 'text':
          html += `
  <div style="padding: 15px 20px; background-color: ${content.backgroundColor || '#ffffff'};">
    <p style="margin: 0; color: ${content.color || '#444444'}; font-size: ${content.fontSize || 14}px; text-align: ${content.align || 'left'};">
      ${content.text || ''}
    </p>
  </div>`;
          break;

        case 'stats':
          if (content.items && content.items.length > 0) {
            const itemWidth = Math.floor(100 / content.items.length);
            html += `
  <div style="padding: 20px; background-color: ${content.backgroundColor || '#f5f7fa'};">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        ${content.items.map((item, i) => `
        <td style="width: ${itemWidth}%; padding: 15px; text-align: center; background: white;${i === 0 ? ' border-radius: 8px 0 0 8px;' : ''}${i === content.items.length - 1 ? ' border-radius: 0 8px 8px 0;' : ''} border-left: ${i > 0 ? '1px solid #eee' : 'none'};">
          <p style="margin: 0; color: ${content.labelColor || '#666666'}; font-size: 11px; text-transform: uppercase;">${item.label}</p>
          <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: ${content.valueColor || '#004E7C'};">${item.value}</p>
        </td>`).join('')}
      </tr>
    </table>
  </div>`;
          }
          break;

        case 'dataTable':
          html += `
  <div style="padding: 15px 20px;">
    ${content.placeholder || '{{dataTable}}'}
  </div>`;
          break;

        case 'downloadButton':
          html += `
  <div style="padding: 15px 20px; text-align: ${content.align || 'center'};">
    ${content.placeholder || '{{downloadButton}}'}
  </div>`;
          break;

        case 'image':
          if (content.src) {
            html += `
  <div style="padding: 15px 20px; text-align: ${content.align || 'center'};">
    <img src="${content.src}" alt="${content.alt || ''}" style="max-width: 100%; height: auto;" />
  </div>`;
          }
          break;

        case 'divider':
          html += `
  <div style="padding: 10px 20px;">
    <hr style="border: none; border-top: ${content.thickness || 1}px ${content.style || 'solid'} ${content.color || '#e0e0e0'}; margin: 0;" />
  </div>`;
          break;

        case 'footer':
          html += `
  <div style="padding: 15px 20px; background-color: ${content.backgroundColor || '#f5f5f5'}; text-align: ${content.align || 'center'};">
    <p style="margin: 0; color: ${content.color || '#888888'}; font-size: ${content.fontSize || 12}px;">
      ${content.text || ''}
    </p>
  </div>`;
          break;

        case 'moreRecords':
          html += `
  <div style="padding: 10px 20px;">
    <p style="margin: 0; color: ${content.color || '#666666'}; font-size: ${content.fontSize || 13}px; font-style: ${content.fontStyle || 'italic'};">
      ${content.placeholder || '{{moreRecordsMessage}}'}
    </p>
  </div>`;
          break;
      }
    });

    html += `
</div>`;

    return html;
  }, []);

  // Update element in visual builder
  const updateVisualElement = (elementId, updates) => {
    setFormData(prev => {
      const elements = prev.visualElements?.elements || [];
      const newElements = elements.map(el =>
        el.id === elementId ? { ...el, ...updates } : el
      );
      const newVisualElements = { elements: newElements };
      // Also update HTML
      const newHtml = visualToHtml(newElements);
      return { ...prev, visualElements: newVisualElements, html: newHtml };
    });
  };

  // Add element in visual builder
  const addVisualElement = (type) => {
    const typeConfig = ELEMENT_TYPES[type];
    const elements = formData.visualElements?.elements || [];

    // Find the bottom-most element to place new one below it
    const maxY = elements.length > 0
      ? Math.max(...elements.map(e => e.y + e.height))
      : 0;

    const newElement = {
      id: `${type}-${Date.now()}`,
      type,
      x: 0,
      y: Math.min(maxY, 90),
      width: typeConfig.defaultSize.width,
      height: typeConfig.defaultSize.height,
      locked: false,
      content: { ...typeConfig.defaultContent }
    };

    const newElements = [...elements, newElement];
    const newVisualElements = { elements: newElements };
    const newHtml = visualToHtml(newElements);

    setFormData(prev => ({
      ...prev,
      visualElements: newVisualElements,
      html: newHtml
    }));
    setSelectedElementId(newElement.id);
    setShowElementPalette(false);
  };

  // Delete element in visual builder
  const deleteVisualElement = (elementId) => {
    const elements = formData.visualElements?.elements || [];
    const newElements = elements.filter(e => e.id !== elementId);
    const newVisualElements = { elements: newElements };
    const newHtml = visualToHtml(newElements);

    setFormData(prev => ({
      ...prev,
      visualElements: newVisualElements,
      html: newHtml
    }));

    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
  };

  // Move element up/down in visual builder
  const moveVisualElement = (elementId, direction) => {
    const elements = formData.visualElements?.elements || [];
    const index = elements.findIndex(e => e.id === elementId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= elements.length) return;

    const newElements = [...elements];
    // Swap Y positions
    const tempY = newElements[index].y;
    newElements[index].y = newElements[newIndex].y;
    newElements[newIndex].y = tempY;

    // Sort by Y
    newElements.sort((a, b) => a.y - b.y);

    const newVisualElements = { elements: newElements };
    const newHtml = visualToHtml(newElements);

    setFormData(prev => ({
      ...prev,
      visualElements: newVisualElements,
      html: newHtml
    }));
  };

  // Initialize visual builder when switching modes
  const switchToVisualMode = () => {
    if (!formData.visualElements) {
      setFormData(prev => ({
        ...prev,
        visualElements: createDefaultVisualTemplate()
      }));
    }
    setEditorMode('visual');
  };

  // Switch to HTML mode
  const switchToHtmlMode = () => {
    // Sync HTML from visual elements if they exist
    if (formData.visualElements?.elements) {
      const html = visualToHtml(formData.visualElements.elements);
      setFormData(prev => ({ ...prev, html }));
    }
    setEditorMode('html');
  };

  // Get selected visual element
  const selectedVisualElement = formData.visualElements?.elements?.find(e => e.id === selectedElementId);

  // Validate form
  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (!formData.html?.trim()) {
      newErrors.html = 'Template HTML is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;

    // If in visual mode, make sure HTML is synced
    let finalData = { ...formData };
    if (editorMode === 'visual' && formData.visualElements?.elements) {
      finalData.html = visualToHtml(formData.visualElements.elements);
    }

    onSave(finalData);
  };

  // Render visual element in canvas
  const renderVisualElement = (element) => {
    const typeConfig = ELEMENT_TYPES[element.type];
    const Icon = typeConfig?.icon || FileText;
    const isSelected = selectedElementId === element.id;
    const content = element.content || {};

    return (
      <div
        key={element.id}
        className={`
          absolute border-2 transition-all cursor-pointer overflow-hidden
          ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 z-10' : 'border-transparent hover:border-slate-300'}
          ${element.locked ? 'opacity-60' : ''}
        `}
        style={{
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: `${element.width}%`,
          height: `${element.height}%`,
          minHeight: '20px'
        }}
        onClick={(e) => { e.stopPropagation(); setSelectedElementId(element.id); }}
      >
        {/* Element preview */}
        {element.type === 'header' && (
          <div
            className="w-full h-full flex flex-col items-center justify-center px-2"
            style={{ backgroundColor: content.backgroundColor, color: content.color }}
          >
            <span className="font-bold text-sm truncate">{content.text}</span>
            {content.subtitle && <span className="text-xs opacity-80 truncate">{content.subtitle}</span>}
          </div>
        )}

        {element.type === 'text' && (
          <div
            className="w-full h-full flex items-center px-2"
            style={{ backgroundColor: content.backgroundColor, color: content.color }}
          >
            <span className="text-xs truncate">{content.text}</span>
          </div>
        )}

        {element.type === 'stats' && (
          <div
            className="w-full h-full flex items-center justify-center gap-2 px-2"
            style={{ backgroundColor: content.backgroundColor }}
          >
            {content.items?.map((item, i) => (
              <div key={i} className="text-center flex-1">
                <div className="text-[8px]" style={{ color: content.labelColor }}>{item.label}</div>
                <div className="text-xs font-bold" style={{ color: content.valueColor }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {element.type === 'dataTable' && (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 border border-slate-200">
            <div className="text-center">
              <Table2 className="w-6 h-6 text-slate-400 mx-auto" />
              <span className="text-[10px] text-slate-500">Data Table</span>
            </div>
          </div>
        )}

        {element.type === 'downloadButton' && (
          <div
            className="w-full h-full flex items-center justify-center rounded"
            style={{ backgroundColor: content.backgroundColor, color: content.color }}
          >
            <Download className="w-3 h-3 mr-1" />
            <span className="text-xs truncate">{content.text}</span>
          </div>
        )}

        {element.type === 'image' && (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 border border-slate-200">
            <Image className="w-6 h-6 text-slate-400" />
          </div>
        )}

        {element.type === 'divider' && (
          <div className="w-full h-full flex items-center px-2">
            <hr className="w-full" style={{ borderColor: content.color }} />
          </div>
        )}

        {element.type === 'footer' && (
          <div
            className="w-full h-full flex items-center justify-center px-2"
            style={{ backgroundColor: content.backgroundColor, color: content.color }}
          >
            <span className="text-[10px] truncate">{content.text}</span>
          </div>
        )}

        {element.type === 'moreRecords' && (
          <div className="w-full h-full flex items-center px-2">
            <span className="text-[10px] italic" style={{ color: content.color }}>More records message</span>
          </div>
        )}

        {/* Lock indicator */}
        {element.locked && (
          <div className="absolute top-1 right-1">
            <Lock className="w-3 h-3 text-slate-400" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Service Finder Modal */}
      {showServiceFinder && (
        <ServiceFinder
          onClose={() => setShowServiceFinder(false)}
          onServiceSelected={handleServiceSelected}
        />
      )}

      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="w-5 h-5" style={{ color: accentColor }} />
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {template.isNew ? 'New Email Template' : 'Edit Email Template'}
              </h3>
              <p className="text-sm text-slate-500">Design custom email layouts with placeholders</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Editor Mode Toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden mr-2">
              <button
                onClick={switchToHtmlMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  editorMode === 'html'
                    ? 'bg-slate-100 text-slate-700'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <FileCode className="w-4 h-4" />
                HTML
              </button>
              <button
                onClick={switchToVisualMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  editorMode === 'visual'
                    ? 'bg-slate-100 text-slate-700'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <MousePointer2 className="w-4 h-4" />
                Visual
              </button>
            </div>

            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showPreview
                  ? 'bg-slate-100 border-slate-300 text-slate-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Editor */}
          <div className={`flex flex-col ${showPreview ? 'w-1/2' : 'w-full'} border-r border-slate-200`}>
            {/* Basic Info */}
            <div className="p-4 border-b border-slate-200 space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Template Name *
                  </label>
                  <input
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Daily Market Report"
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category || 'general'}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <input
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Custom email template for daily market reports"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              {/* CSV Export Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-sm font-medium text-slate-700">CSV Export</span>
                    <p className="text-xs text-slate-500">Include download button and CSV attachment in emails</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.csvExportEnabled}
                    onChange={(e) => handleChange('csvExportEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-700">Template is active and available for use</span>
              </label>
            </div>

            {/* Feature Service Connection */}
            <div className="border-b border-slate-200 shrink-0">
              <button
                onClick={() => setShowPlaceholders(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" style={{ color: accentColor }} />
                  Connect Feature Service (Live Preview)
                </span>
                {showPlaceholders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {showPlaceholders && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    Connect to an ArcGIS feature service to preview your template with real data.
                  </p>

                  <div className="flex gap-2">
                    <input
                      value={serviceEndpoint}
                      onChange={(e) => setServiceEndpoint(e.target.value)}
                      placeholder="https://services.arcgis.com/.../FeatureServer/0"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                    <button
                      onClick={() => setShowServiceFinder(true)}
                      className="px-3 py-2 text-white rounded-lg text-xs flex items-center gap-1.5"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Search className="w-3.5 h-3.5" />
                      Find
                    </button>
                  </div>

                  {/* Auth (optional) */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={serviceUsername}
                      onChange={(e) => setServiceUsername(e.target.value)}
                      placeholder="Username (optional)"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="password"
                      value={servicePassword}
                      onChange={(e) => setServicePassword(e.target.value)}
                      placeholder="Password (optional)"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <button
                    onClick={() => validateAndFetchFields()}
                    disabled={isValidating || !serviceEndpoint}
                    className="w-full py-2 px-3 border rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    {isValidating && <Loader2 className="w-3 h-3 animate-spin" />}
                    {isValidating ? 'Connecting...' : 'Connect & Load Fields'}
                  </button>

                  {/* Validation result */}
                  {validationResult && (
                    <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                      validationResult.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {validationResult.type === 'success' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      {validationResult.message}
                    </div>
                  )}

                  {/* Display field selection */}
                  {availableFields.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-600">Select fields to preview:</label>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
                        {availableFields.map(field => (
                          <button
                            key={field}
                            onClick={() => toggleDisplayField(field)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              selectedDisplayFields.includes(field)
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-white border border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {field}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={loadPreviewData}
                        disabled={isLoadingPreviewData}
                        className="w-full py-2 px-3 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2"
                        style={{ backgroundColor: accentColor }}
                      >
                        {isLoadingPreviewData && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isLoadingPreviewData ? 'Loading...' : 'Load Live Preview Data'}
                      </button>

                      {livePreviewData && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
                          <Check className="w-3.5 h-3.5" />
                          Loaded {livePreviewData.features?.length || 0} records (of {livePreviewData.recordCount} total)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* HTML Editor Mode */}
            {editorMode === 'html' && (
              <>
                {/* Starter Templates */}
                <div className="p-4 border-b border-slate-200 shrink-0">
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Start from Template
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(STARTER_TEMPLATES).map(([key, starter]) => (
                      <button
                        key={key}
                        onClick={() => applyStarterTemplate(key)}
                        className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      >
                        <Sparkles className="w-3 h-3 inline mr-1.5" style={{ color: accentColor }} />
                        {starter.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Placeholder Reference */}
                <div className="border-b border-slate-200 shrink-0">
                  <div className="px-4 py-2 text-xs text-slate-500 flex items-center gap-2">
                    <Code className="w-3 h-3" />
                    Click placeholders below to insert at cursor
                  </div>
                  <div className="px-4 pb-3 max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-1">
                      {PLACEHOLDERS
                        .filter(p => formData.csvExportEnabled || (p.key !== 'downloadButton' && p.key !== 'downloadUrl'))
                        .map(p => (
                        <button
                          key={p.key}
                          onClick={() => insertPlaceholder(p.key)}
                          className="flex items-center justify-between px-2 py-1.5 text-xs text-left bg-slate-50 hover:bg-slate-100 rounded transition-colors group"
                          title={`${p.desc}\nExample: ${p.example}`}
                        >
                          <span className="font-mono text-slate-700">{`{{${p.key}}}`}</span>
                          <Plus className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* HTML Editor */}
                <div className="flex-1 flex flex-col min-h-0 p-4">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    HTML Template *
                  </label>
                  <textarea
                    id="html-editor"
                    value={formData.html || ''}
                    onChange={(e) => handleChange('html', e.target.value)}
                    placeholder="<div>Your email HTML here...</div>"
                    className={`flex-1 w-full px-3 py-2 border rounded-lg text-xs font-mono resize-none ${
                      errors.html ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                    style={{ minHeight: '200px' }}
                  />
                  {errors.html && (
                    <p className="text-xs text-red-500 mt-1">{errors.html}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    Use inline CSS styles for email compatibility. Tables are recommended for complex layouts.
                  </p>
                </div>
              </>
            )}

            {/* Visual Editor Mode */}
            {editorMode === 'visual' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Element List & Properties */}
                <div className="w-64 border-r border-slate-200 flex flex-col overflow-hidden">
                  {/* Elements */}
                  <div className="p-3 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600">Elements</span>
                      <button
                        onClick={() => setShowElementPalette(!showElementPalette)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        <Plus className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>

                    {showElementPalette && (
                      <div className="mb-2 p-2 bg-slate-50 rounded-lg grid grid-cols-2 gap-1">
                        {Object.entries(ELEMENT_TYPES).map(([type, config]) => (
                          <button
                            key={type}
                            onClick={() => addVisualElement(type)}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-slate-700 bg-white rounded hover:bg-slate-100 border border-slate-200"
                          >
                            <config.icon className="w-3 h-3" />
                            {config.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(formData.visualElements?.elements || [])
                        .sort((a, b) => a.y - b.y)
                        .map((element, idx) => {
                          const typeConfig = ELEMENT_TYPES[element.type];
                          const Icon = typeConfig?.icon || FileText;
                          const isSelected = selectedElementId === element.id;

                          return (
                            <div
                              key={element.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                                isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-100'
                              }`}
                              onClick={() => setSelectedElementId(element.id)}
                            >
                              <Icon className="w-3 h-3 text-slate-500" />
                              <span className="flex-1 text-xs text-slate-700 truncate">
                                {typeConfig?.name}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); moveVisualElement(element.id, 'up'); }}
                                className="p-0.5 hover:bg-slate-200 rounded"
                                disabled={idx === 0}
                              >
                                <ChevronDown className="w-3 h-3 text-slate-400 rotate-180" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); moveVisualElement(element.id, 'down'); }}
                                className="p-0.5 hover:bg-slate-200 rounded"
                                disabled={idx === (formData.visualElements?.elements?.length || 0) - 1}
                              >
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Element Properties */}
                  {selectedVisualElement && (
                    <div className="flex-1 p-3 overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-600">Properties</span>
                        <button
                          onClick={() => deleteVisualElement(selectedElementId)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {/* Common properties based on element type */}
                        {(selectedVisualElement.type === 'header' || selectedVisualElement.type === 'text' || selectedVisualElement.type === 'footer') && (
                          <>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">Text</label>
                              <input
                                value={selectedVisualElement.content?.text || ''}
                                onChange={(e) => updateVisualElement(selectedElementId, {
                                  content: { ...selectedVisualElement.content, text: e.target.value }
                                })}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                              />
                            </div>

                            {selectedVisualElement.type === 'header' && (
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">Subtitle</label>
                                <input
                                  value={selectedVisualElement.content?.subtitle || ''}
                                  onChange={(e) => updateVisualElement(selectedElementId, {
                                    content: { ...selectedVisualElement.content, subtitle: e.target.value }
                                  })}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">Background</label>
                                <input
                                  type="color"
                                  value={selectedVisualElement.content?.backgroundColor || '#ffffff'}
                                  onChange={(e) => updateVisualElement(selectedElementId, {
                                    content: { ...selectedVisualElement.content, backgroundColor: e.target.value }
                                  })}
                                  className="w-full h-7 rounded border border-slate-200 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">Text Color</label>
                                <input
                                  type="color"
                                  value={selectedVisualElement.content?.color || '#333333'}
                                  onChange={(e) => updateVisualElement(selectedElementId, {
                                    content: { ...selectedVisualElement.content, color: e.target.value }
                                  })}
                                  className="w-full h-7 rounded border border-slate-200 cursor-pointer"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">Align</label>
                              <select
                                value={selectedVisualElement.content?.align || 'left'}
                                onChange={(e) => updateVisualElement(selectedElementId, {
                                  content: { ...selectedVisualElement.content, align: e.target.value }
                                })}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                          </>
                        )}

                        {selectedVisualElement.type === 'downloadButton' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">Button Text</label>
                              <input
                                value={selectedVisualElement.content?.text || ''}
                                onChange={(e) => updateVisualElement(selectedElementId, {
                                  content: { ...selectedVisualElement.content, text: e.target.value }
                                })}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">Background</label>
                                <input
                                  type="color"
                                  value={selectedVisualElement.content?.backgroundColor || '#004E7C'}
                                  onChange={(e) => updateVisualElement(selectedElementId, {
                                    content: { ...selectedVisualElement.content, backgroundColor: e.target.value }
                                  })}
                                  className="w-full h-7 rounded border border-slate-200 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">Text Color</label>
                                <input
                                  type="color"
                                  value={selectedVisualElement.content?.color || '#ffffff'}
                                  onChange={(e) => updateVisualElement(selectedElementId, {
                                    content: { ...selectedVisualElement.content, color: e.target.value }
                                  })}
                                  className="w-full h-7 rounded border border-slate-200 cursor-pointer"
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {selectedVisualElement.type === 'stats' && (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-medium text-slate-500">Stat Items</label>
                            {(selectedVisualElement.content?.items || []).map((item, i) => (
                              <div key={i} className="flex gap-1">
                                <input
                                  value={item.label}
                                  onChange={(e) => {
                                    const items = [...(selectedVisualElement.content?.items || [])];
                                    items[i] = { ...items[i], label: e.target.value };
                                    updateVisualElement(selectedElementId, {
                                      content: { ...selectedVisualElement.content, items }
                                    });
                                  }}
                                  placeholder="Label"
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-[10px]"
                                />
                                <input
                                  value={item.value}
                                  onChange={(e) => {
                                    const items = [...(selectedVisualElement.content?.items || [])];
                                    items[i] = { ...items[i], value: e.target.value };
                                    updateVisualElement(selectedElementId, {
                                      content: { ...selectedVisualElement.content, items }
                                    });
                                  }}
                                  placeholder="Value"
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-[10px]"
                                />
                                <button
                                  onClick={() => {
                                    const items = (selectedVisualElement.content?.items || []).filter((_, idx) => idx !== i);
                                    updateVisualElement(selectedElementId, {
                                      content: { ...selectedVisualElement.content, items }
                                    });
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const items = [...(selectedVisualElement.content?.items || []), { label: 'Label', value: '{{value}}' }];
                                updateVisualElement(selectedElementId, {
                                  content: { ...selectedVisualElement.content, items }
                                });
                              }}
                              className="w-full py-1 text-[10px] border border-dashed border-slate-300 rounded hover:bg-slate-50"
                            >
                              + Add Stat
                            </button>
                          </div>
                        )}

                        {selectedVisualElement.type === 'divider' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">Color</label>
                              <input
                                type="color"
                                value={selectedVisualElement.content?.color || '#e0e0e0'}
                                onChange={(e) => updateVisualElement(selectedElementId, {
                                  content: { ...selectedVisualElement.content, color: e.target.value }
                                })}
                                className="w-full h-7 rounded border border-slate-200 cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-slate-500 mb-1">Style</label>
                              <select
                                value={selectedVisualElement.content?.style || 'solid'}
                                onChange={(e) => updateVisualElement(selectedElementId, {
                                  content: { ...selectedVisualElement.content, style: e.target.value }
                                })}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                              >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual Canvas */}
                <div
                  ref={canvasRef}
                  className="flex-1 bg-slate-100 p-4 overflow-auto"
                  onClick={() => setSelectedElementId(null)}
                >
                  <div
                    className="relative mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
                    style={{ width: '100%', maxWidth: '600px', minHeight: '600px' }}
                  >
                    {(formData.visualElements?.elements || []).map(element => renderVisualElement(element))}

                    {(!formData.visualElements?.elements || formData.visualElements.elements.length === 0) && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                          <Plus className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Click + to add elements</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          {showPreview && (
            <div className="w-1/2 flex flex-col bg-slate-100">
              <div className="p-3 border-b border-slate-200 bg-white shrink-0">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </h4>
                <p className="text-xs text-slate-400">
                  {livePreviewData ? 'Using live data from feature service' : 'Rendered with sample data'}
                </p>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="max-w-xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                  <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <p className="text-xs text-slate-400">
              Template ID: <code className="font-mono">{formData.id}</code>
            </p>
            {!formData.csvExportEnabled && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                CSV export disabled
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
