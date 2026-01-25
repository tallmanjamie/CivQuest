// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import NotifyApp from './notify/NotifyApp';
// Admin components to be loaded dynamically
// import SuperAdminApp from './admin/SuperAdminApp';
// import OrgAdminApp from './admin/OrgAdminApp';
// Atlas components (Phase 3)
// import AtlasApp from './atlas/AtlasApp';

// Define Global Configuration for ArcGIS Proxy
window.ARCGIS_PROXY_URL = 'https://notify.civ.quest';

// Get subdomain and path for routing
const getRouteInfo = () => {
  const hostname = window.location.hostname;
  const path = window.location.pathname;
  
  // Parse subdomain
  const parts = hostname.split('.');
  let subdomain = null;
  
  // Check for subdomain patterns:
  // - notify.civ.quest -> subdomain = 'notify'
  // - atlas.civ.quest -> subdomain = 'atlas'
  // - admin.civ.quest -> subdomain = 'admin'
  // - localhost -> check path
  // - civ.quest (root) -> no subdomain
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    // Local development: use path-based routing
    subdomain = null;
  } else if (parts.length > 2) {
    subdomain = parts[0];
  }
  
  return { subdomain, path };
};

// Route component selection
const getAppComponent = () => {
  const { subdomain, path } = getRouteInfo();
  
  // Path-based routing (development and admin routes)
  if (path.startsWith('/admin')) {
    // Super admin portal - lazy load when implemented
    // return SuperAdminApp;
    console.warn('Super Admin not yet migrated - showing Notify');
    return NotifyApp;
  }
  
  if (path.startsWith('/org-admin')) {
    // Organization admin portal - lazy load when implemented
    // return OrgAdminApp;
    console.warn('Org Admin not yet migrated - showing Notify');
    return NotifyApp;
  }
  
  // Test routes for development
  if (path.startsWith('/test-editor') || path.startsWith('/test-spatial')) {
    console.warn('Test routes not yet migrated - showing Notify');
    return NotifyApp;
  }
  
  // Subdomain-based routing (production)
  switch (subdomain) {
    case 'notify':
      return NotifyApp;
    case 'atlas':
      // return AtlasApp;
      console.warn('Atlas not yet implemented - showing Notify');
      return NotifyApp;
    case 'admin':
      // return SuperAdminApp;
      console.warn('Admin subdomain not yet migrated - showing Notify');
      return NotifyApp;
    default:
      // Default to Notify for now
      return NotifyApp;
  }
};

// Get the app to render
const AppComponent = getAppComponent();

// Render without StrictMode to avoid double-mounting issues with ArcGIS JS API
// The map gets destroyed mid-init on the first mount, then fails on the second mount
ReactDOM.createRoot(document.getElementById('root')).render(
  <AppComponent />
);
