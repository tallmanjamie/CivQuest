// src/admin/components/customTemplate/constants.js
// Constants and default values for the custom email template designer

/**
 * Default theme configuration
 */
export const DEFAULT_THEME = {
  primaryColor: '#004E7C',
  secondaryColor: '#f2f2f2',
  accentColor: '#0077B6',
  textColor: '#333333',
  mutedTextColor: '#666666',
  backgroundColor: '#ffffff',
  borderColor: '#dddddd',
  fontFamily: 'Arial, sans-serif',
  fontSize: '14px',
  headerFontSize: '24px',
  subHeaderFontSize: '16px',
  borderRadius: '4px'
};

/**
 * Default custom template starter HTML
 */
export const DEFAULT_CUSTOM_TEMPLATE_HTML = `<div style="font-family: {{fontFamily}}; color: {{textColor}}; max-width: 600px; margin: 0 auto;">
  <!-- Logo (if configured in Branding section) -->
  {{logoHtml}}

  <!-- Header -->
  <div style="background-color: {{primaryColor}}; padding: 20px; color: white; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">{{organizationName}}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">{{notificationName}}</p>
  </div>

  <!-- Body -->
  <div style="padding: 25px; border: 1px solid {{borderColor}}; border-top: none; background-color: {{backgroundColor}};">

    <!-- Date Range -->
    <p style="color: {{mutedTextColor}}; font-size: 13px; margin-bottom: 20px;">
      <strong>Reporting Period:</strong> {{dateRangeStart}} - {{dateRangeEnd}}
    </p>

    <!-- Statistics (if configured) -->
    {{statisticsHtml}}

    <!-- Summary -->
    <p style="font-size: 16px; margin: 20px 0;">
      We found <strong>{{recordCount}}</strong> new records matching your subscription.
    </p>

    <!-- Download Button -->
    {{downloadButton}}

    <!-- Data Table -->
    {{dataTable}}

    {{moreRecordsMessage}}

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid {{borderColor}}; font-size: 12px; color: {{mutedTextColor}};">
      <p>You are receiving this because you subscribed to notifications.</p>
      <p><a href="#" style="color: {{accentColor}};">Manage Preferences</a></p>
    </div>
  </div>
</div>`;

/**
 * Filter operators for statistics filtering
 */
export const STAT_FILTER_OPERATORS = [
  { value: '=', label: 'equals' },
  { value: '<>', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'greater or equal' },
  { value: '<=', label: 'less or equal' },
  { value: 'LIKE', label: 'contains' }
];

/**
 * Available statistical operations
 */
export const STAT_OPERATIONS = [
  { value: 'sum', label: 'Sum', description: 'Total of all values', requiresNumeric: true },
  { value: 'mean', label: 'Mean (Average)', description: 'Arithmetic average', requiresNumeric: true },
  { value: 'min', label: 'Minimum', description: 'Smallest value', requiresNumeric: true },
  { value: 'max', label: 'Maximum', description: 'Largest value', requiresNumeric: true },
  { value: 'median', label: 'Median', description: 'Middle value', requiresNumeric: true },
  { value: 'count', label: 'Count', description: 'Number of non-empty values', requiresNumeric: false },
  { value: 'distinct', label: 'Distinct Count', description: 'Number of unique values', requiresNumeric: false },
  { value: 'first', label: 'First', description: 'First value in results', requiresNumeric: false },
  { value: 'last', label: 'Last', description: 'Last value in results', requiresNumeric: false }
];

/**
 * Format type options for statistics and display fields
 */
export const FORMAT_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', description: 'Automatically determine formatting' },
  { value: 'text', label: 'Text', description: 'Display as plain text' },
  { value: 'number', label: 'Number', description: 'Numeric with optional decimals' },
  { value: 'currency', label: 'Currency', description: 'Monetary value (e.g., $1,234.56)' },
  { value: 'percent', label: 'Percentage', description: 'Percentage (0.15 → 15%)' },
  { value: 'date', label: 'Date', description: 'Date/time formatting' }
];

/**
 * Currency options
 */
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'CA$' },
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { value: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', symbol: '¥' },
  { value: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
  { value: 'MXN', label: 'MXN - Mexican Peso', symbol: 'MX$' },
  { value: 'BRL', label: 'BRL - Brazilian Real', symbol: 'R$' }
];

/**
 * Date format presets
 */
export const DATE_FORMAT_PRESETS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '01/15/2025' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '15/01/2025' },
  { value: 'MMMM D, YYYY', label: 'Full Date', example: 'January 15, 2025' },
  { value: 'MMM D, YYYY', label: 'Abbreviated', example: 'Jan 15, 2025' },
  { value: 'MMMM YYYY', label: 'Month Year', example: 'January 2025' },
  { value: 'MMM YYYY', label: 'Short Month Year', example: 'Jan 2025' },
  { value: 'YYYY-MM-DD', label: 'ISO Format', example: '2025-01-15' },
  { value: 'dddd, MMMM D', label: 'Day and Date', example: 'Wednesday, January 15' }
];

/**
 * Font family options
 */
export const FONT_FAMILY_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' }
];

/**
 * Font size options
 */
export const FONT_SIZE_OPTIONS = [
  { value: '12px', label: '12px' },
  { value: '13px', label: '13px' },
  { value: '14px', label: '14px' },
  { value: '15px', label: '15px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' }
];

/**
 * Header font size options
 */
export const HEADER_FONT_SIZE_OPTIONS = [
  { value: '20px', label: '20px' },
  { value: '22px', label: '22px' },
  { value: '24px', label: '24px' },
  { value: '26px', label: '26px' },
  { value: '28px', label: '28px' },
  { value: '30px', label: '30px' }
];

/**
 * Subheader font size options
 */
export const SUBHEADER_FONT_SIZE_OPTIONS = [
  { value: '14px', label: '14px' },
  { value: '15px', label: '15px' },
  { value: '16px', label: '16px' },
  { value: '17px', label: '17px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' }
];

/**
 * Border radius options
 */
export const BORDER_RADIUS_OPTIONS = [
  { value: '0px', label: '0px (Square)' },
  { value: '2px', label: '2px' },
  { value: '4px', label: '4px' },
  { value: '6px', label: '6px' },
  { value: '8px', label: '8px' },
  { value: '12px', label: '12px' }
];

/**
 * Theme presets for quick selection
 */
export const THEME_PRESETS = [
  {
    name: 'Default Blue',
    theme: {
      primaryColor: '#004E7C',
      secondaryColor: '#f2f2f2',
      accentColor: '#0077B6',
      textColor: '#333333',
      mutedTextColor: '#666666',
      backgroundColor: '#ffffff',
      borderColor: '#dddddd'
    }
  },
  {
    name: 'Forest Green',
    theme: {
      primaryColor: '#2D5A3D',
      secondaryColor: '#E8F5E9',
      accentColor: '#4CAF50',
      textColor: '#1B5E20',
      mutedTextColor: '#558B2F',
      backgroundColor: '#ffffff',
      borderColor: '#C8E6C9'
    }
  },
  {
    name: 'Sunset Orange',
    theme: {
      primaryColor: '#E65100',
      secondaryColor: '#FFF3E0',
      accentColor: '#FF9800',
      textColor: '#BF360C',
      mutedTextColor: '#E65100',
      backgroundColor: '#ffffff',
      borderColor: '#FFCC80'
    }
  },
  {
    name: 'Royal Purple',
    theme: {
      primaryColor: '#4A148C',
      secondaryColor: '#F3E5F5',
      accentColor: '#9C27B0',
      textColor: '#4A148C',
      mutedTextColor: '#7B1FA2',
      backgroundColor: '#ffffff',
      borderColor: '#CE93D8'
    }
  },
  {
    name: 'Slate Gray',
    theme: {
      primaryColor: '#37474F',
      secondaryColor: '#ECEFF1',
      accentColor: '#607D8B',
      textColor: '#263238',
      mutedTextColor: '#546E7A',
      backgroundColor: '#ffffff',
      borderColor: '#B0BEC5'
    }
  }
];

/**
 * Placeholder sections for the reference panel
 */
export const PLACEHOLDER_SECTIONS = [
  {
    title: 'Branding',
    placeholders: [
      { name: 'logoHtml', description: 'Custom logo image HTML (if configured)', example: '<img src="..." />' },
      { name: 'logoUrl', description: 'Raw logo URL for custom usage', example: 'https://example.com/logo.png' }
    ]
  },
  {
    title: 'Organization & Notification',
    placeholders: [
      { name: 'organizationName', description: 'Organization display name', example: 'City of Springfield' },
      { name: 'organizationId', description: 'Organization ID', example: 'springfield_mo' },
      { name: 'notificationName', description: 'Notification display name', example: 'New Building Permits' },
      { name: 'notificationId', description: 'Notification ID', example: 'building_permits' }
    ]
  },
  {
    title: 'Record Data',
    placeholders: [
      { name: 'recordCount', description: 'Number of records found', example: '42' },
      { name: 'dataTable', description: 'Pre-built HTML table of first 10 records', example: '<table>...</table>' },
      { name: 'moreRecordsMessage', description: '"Showing X of Y" message if >10 records', example: 'Showing 10 of 42 records' }
    ]
  },
  {
    title: 'Date Range',
    placeholders: [
      { name: 'dateRangeStart', description: 'Start date (MM/DD/YYYY)', example: '01/15/2025' },
      { name: 'dateRangeEnd', description: 'End date (MM/DD/YYYY)', example: '01/31/2025' },
      { name: 'dateRangeStartTime', description: 'Start with time (MM/DD/YYYY HH:mm)', example: '01/15/2025 08:00' },
      { name: 'dateRangeEndTime', description: 'End with time (MM/DD/YYYY HH:mm)', example: '01/31/2025 17:00' }
    ]
  },
  {
    title: 'Downloads',
    placeholders: [
      { name: 'downloadButton', description: 'Pre-styled download button HTML', example: '<a>Download CSV</a>' },
      { name: 'downloadUrl', description: 'Raw CSV download URL', example: 'https://storage.../file.csv' }
    ]
  },
  {
    title: 'Statistics',
    dynamic: true,
    placeholders: [
      { name: 'statisticsHtml', description: 'Pre-built statistics cards display', example: '<div>...</div>' }
    ]
  },
  {
    title: 'Theme Colors',
    placeholders: [
      { name: 'primaryColor', description: 'Primary theme color', example: '#004E7C' },
      { name: 'secondaryColor', description: 'Secondary theme color', example: '#f2f2f2' },
      { name: 'accentColor', description: 'Accent color', example: '#0077B6' },
      { name: 'textColor', description: 'Text color', example: '#333333' },
      { name: 'mutedTextColor', description: 'Muted text color', example: '#666666' },
      { name: 'backgroundColor', description: 'Background color', example: '#ffffff' },
      { name: 'borderColor', description: 'Border color', example: '#dddddd' },
      { name: 'fontFamily', description: 'Font family', example: 'Arial, sans-serif' }
    ]
  },
  {
    title: 'Custom Text',
    placeholders: [
      { name: 'emailIntro', description: 'Custom intro text from basic settings', example: 'Here is your report...' },
      { name: 'emailZeroStateMessage', description: 'Message shown when 0 records found', example: 'No records found' }
    ]
  }
];

/**
 * Decimal places options
 */
export const DECIMAL_OPTIONS = [
  { value: 0, label: '0 (e.g., 1,234)' },
  { value: 1, label: '1 (e.g., 1,234.5)' },
  { value: 2, label: '2 (e.g., 1,234.56)' },
  { value: 3, label: '3 (e.g., 1,234.567)' },
  { value: 4, label: '4 (e.g., 1,234.5678)' }
];

/**
 * Reserved statistic IDs that cannot be used
 */
export const RESERVED_STAT_IDS = [
  'recordCount',
  'organizationName',
  'notificationName',
  'dateRangeStart',
  'dateRangeEnd',
  'dataTable',
  'downloadButton',
  'downloadUrl',
  'moreRecordsMessage',
  'emailIntro',
  'emailZeroStateMessage',
  'statisticsHtml'
];

/**
 * Maximum number of statistics per notification
 */
export const MAX_STATISTICS = 10;

/**
 * Default branding configuration
 */
export const DEFAULT_BRANDING = {
  logoUrl: '',
  logoWidth: '150',
  logoHeight: 'auto',
  logoAlignment: 'left'
};

/**
 * Logo alignment options
 */
export const LOGO_ALIGNMENT_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' }
];

/**
 * Logo size presets
 */
export const LOGO_SIZE_OPTIONS = [
  { value: '100', label: 'Small (100px)' },
  { value: '150', label: 'Medium (150px)' },
  { value: '200', label: 'Large (200px)' },
  { value: '250', label: 'Extra Large (250px)' }
];

/**
 * Dashboard icons for email templates
 * These are email-safe inline SVG icons that can be inserted into templates
 */
export const DASHBOARD_ICONS = [
  {
    id: 'building',
    name: 'Building',
    category: 'general',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`
  },
  {
    id: 'chart-bar',
    name: 'Bar Chart',
    category: 'analytics',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`
  },
  {
    id: 'chart-line',
    name: 'Line Chart',
    category: 'analytics',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`
  },
  {
    id: 'chart-pie',
    name: 'Pie Chart',
    category: 'analytics',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`
  },
  {
    id: 'map-pin',
    name: 'Location',
    category: 'location',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
  },
  {
    id: 'map',
    name: 'Map',
    category: 'location',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`
  },
  {
    id: 'calendar',
    name: 'Calendar',
    category: 'time',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
  },
  {
    id: 'clock',
    name: 'Clock',
    category: 'time',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
  },
  {
    id: 'dollar',
    name: 'Dollar',
    category: 'finance',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`
  },
  {
    id: 'trending-up',
    name: 'Trending Up',
    category: 'finance',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`
  },
  {
    id: 'trending-down',
    name: 'Trending Down',
    category: 'finance',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`
  },
  {
    id: 'users',
    name: 'Users',
    category: 'general',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
  },
  {
    id: 'file-text',
    name: 'Document',
    category: 'general',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`
  },
  {
    id: 'alert-circle',
    name: 'Alert',
    category: 'status',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  },
  {
    id: 'check-circle',
    name: 'Success',
    category: 'status',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
  },
  {
    id: 'bell',
    name: 'Notification',
    category: 'status',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`
  },
  {
    id: 'home',
    name: 'Home',
    category: 'general',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  },
  {
    id: 'shield',
    name: 'Security',
    category: 'general',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
  },
  {
    id: 'zap',
    name: 'Energy',
    category: 'utilities',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
  },
  {
    id: 'droplet',
    name: 'Water',
    category: 'utilities',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`
  }
];

/**
 * Icon categories for filtering
 */
export const ICON_CATEGORIES = [
  { value: 'all', label: 'All Icons' },
  { value: 'general', label: 'General' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'location', label: 'Location' },
  { value: 'time', label: 'Time' },
  { value: 'finance', label: 'Finance' },
  { value: 'status', label: 'Status' },
  { value: 'utilities', label: 'Utilities' }
];

/**
 * Icon size options for email templates
 */
export const ICON_SIZE_OPTIONS = [
  { value: '16', label: '16px (Small)' },
  { value: '20', label: '20px' },
  { value: '24', label: '24px (Default)' },
  { value: '32', label: '32px' },
  { value: '40', label: '40px (Large)' },
  { value: '48', label: '48px (XL)' }
];
