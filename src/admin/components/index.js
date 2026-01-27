// src/admin/components/index.js
// Component exports for Admin module
//
// UPDATED: Added export template components for map export configuration
// - ExportTemplateEditor: Visual drag-and-drop template designer
// - ExportTemplateConfiguration: Organization-level template management
// - MapExportSettings: Map-level template selection (standalone, optional use)

// Atlas Configuration Components
export { default as AtlasConfiguration } from './AtlasConfiguration';
export { default as AtlasSettingsEditor } from './AtlasSettingsEditor';
export { default as MapEditor } from './MapEditor';
export { default as AtlasUserManagement } from './AtlasUserManagement';
export { default as AtlasAdminSection, getAtlasNavItems } from './AtlasAdminSection';

// Export Template Components (NEW)
export { default as ExportTemplateEditor } from './ExportTemplateEditor';
export { default as ExportTemplateConfiguration } from './ExportTemplateConfiguration';
export { default as MapExportSettings, MapExportSettingsCompact } from './MapExportSettings';

// Notify Configuration Components
export { default as NotificationEditModal } from './NotificationEditor';
export { default as NotificationWizard } from './NotificationWizard';
export { default as Configuration } from './NotifyConfiguration';

// User Management
export { default as UserManagementPanel } from './UserManagement';

// Archive
export { default as Archive } from './Archive';

// Service Discovery
export { default as ServiceFinder } from './ServiceFinder';
export { default as SpatialFilter } from './SpatialFilter';

// License Management
export { default as LicenseManagement } from './LicenseManagement';
