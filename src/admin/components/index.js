// src/admin/components/index.js
// Export all admin components

// Notification Management
export { default as NotificationEditModal } from './NotificationEditor';
export { default as NotifyConfiguration } from './NotifyConfiguration';
export { default as ConfigurationPanel } from './NotifyConfiguration'; // Alias for backward compatibility
export { default as NotificationWizard } from './NotificationWizard';

// Atlas Management
export { default as AtlasConfiguration } from './AtlasConfiguration';
export { default as AtlasSettingsEditor } from './AtlasSettingsEditor';
export { default as MapEditor } from './MapEditor';
export { default as AtlasAdminSection, getAtlasNavItems } from './AtlasAdminSection';
export { default as AtlasUserManagement } from './AtlasUserManagement';

// User Management
export { default as UserManagementPanel } from './UserManagement';

// Archive/Logs
export { default as Archive } from './Archive';

// ArcGIS Tools
export { default as ServiceFinder } from './ServiceFinder';
export { default as SpatialFilter } from './SpatialFilter';
