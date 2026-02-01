// src/admin/components/customTemplate/index.js
// Export all custom template components and utilities

export { default as CustomTemplateEditor } from './CustomTemplateEditor';
export { default as ThemeCustomizer } from './ThemeCustomizer';
export { default as StatisticsBuilder } from './StatisticsBuilder';
export { default as HTMLTemplateEditor } from './HTMLTemplateEditor';
export { default as TemplatePreview } from './TemplatePreview';
export { default as DisplayFieldEditor } from './DisplayFieldEditor';
export { default as BrandingCustomizer } from './BrandingCustomizer';

// Export constants
export {
  DEFAULT_THEME,
  DEFAULT_CUSTOM_TEMPLATE_HTML,
  DEFAULT_BRANDING,
  STAT_OPERATIONS,
  FORMAT_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  DATE_FORMAT_PRESETS,
  FONT_FAMILY_OPTIONS,
  THEME_PRESETS,
  PLACEHOLDER_SECTIONS,
  DECIMAL_OPTIONS,
  MAX_STATISTICS,
  LOGO_ALIGNMENT_OPTIONS,
  LOGO_SIZE_OPTIONS,
  DASHBOARD_ICONS,
  ICON_CATEGORIES,
  ICON_SIZE_OPTIONS
} from './constants';

// Export validation utilities
export {
  validateStatisticId,
  validateHexColor,
  validateHTMLTemplate,
  validateCustomTemplate,
  getValidPlaceholderNames,
  generateSampleContext
} from './validation';
