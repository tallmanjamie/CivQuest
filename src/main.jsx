// src/main.jsx
// CivQuest Unified Platform - Entry Point with Routing
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import NotifyApp from './notify/NotifyApp';
import AdminApp from './admin/AdminApp';
import AtlasApp from './atlas/AtlasApp';

// Define Global Configuration for ArcGIS Proxy
window.ARCGIS_PROXY_URL = 'https://api.civ.quest';

// Get subdomain and path for routing
const getRouteInfo = () => {
  const hostname = window.location.hostname;
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  
  // Parse subdomain
  const parts = hostname.split('.');
  let subdomain = null;
  
  // Check for subdomain patterns:
  // - notify.civ.quest -> subdomain = 'notify'
  // - atlas.civ.quest -> subdomain = 'atlas'
  // - admin.civ.quest -> subdomain = 'admin'
  // - chesapeake.atlas.civ.quest -> subdomain = 'atlas' (org subdomain)
  // - localhost -> check path or query param
  // - civ.quest (root) -> no subdomain
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    // Local development: use path-based or query param routing
    const moduleOverride = params.get('module');
    if (moduleOverride) {
      subdomain = moduleOverride;
    }
    // If ?org= is present, assume Atlas
    else if (params.get('org')) {
      subdomain = 'atlas';
    }
  } else if (parts.length >= 3) {
    // Check if it's an org subdomain (e.g., chesapeake.atlas.civ.quest)
    if (parts[1] === 'atlas') {
      subdomain = 'atlas';
    } else {
      subdomain = parts[0];
    }
  }
  
  return { subdomain, path, params };
};

// Route component selection
const getAppComponent = () => {
  const { subdomain, path, params } = getRouteInfo();

  // OAuth callback fallback: when on localhost at root path with ?code= param,
  // check sessionStorage to route to the correct app that initiated the OAuth flow.
  // This handles cases where the ArcGIS redirect URI doesn't include the app path.
  if (
    (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1') &&
    path === '/' &&
    params.has('code') &&
    params.has('state')
  ) {
    try {
      const oauthApp = sessionStorage.getItem('civquest_oauth_app');
      if (oauthApp === 'admin') {
        return () => <AdminApp loginMode="org_admin" />;
      }
    } catch (e) {
      // sessionStorage not available, continue with normal routing
    }
  }

  // Path-based routing (development and production)
  // Super admin portal - separate access point with email/password login
  if (path.startsWith('/super-admin')) {
    return () => <AdminApp loginMode="super_admin" />;
  }

  // Standard admin portal - org admin with ESRI login only
  if (path.startsWith('/admin')) {
    return () => <AdminApp loginMode="org_admin" />;
  }

  // Legacy route - redirect org-admin to unified admin
  if (path.startsWith('/org-admin')) {
    return () => <AdminApp loginMode="org_admin" />;
  }
  
  // Atlas routes
  if (path.startsWith('/atlas')) {
    return AtlasApp;
  }
  
  // Check if path is an org ID (not a known route) - e.g., /chesapeake
  const knownRoutes = ['admin', 'super-admin', 'notify', 'atlas', 'org-admin', 'test-editor', 'test-spatial'];
  const pathSegment = path.split('/')[1];
  if (pathSegment && !knownRoutes.includes(pathSegment.toLowerCase())) {
    // Treat as Atlas with org ID in path
    return AtlasApp;
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
      return AtlasApp;
    case 'admin':
      // Org admin portal with ESRI login only
      return () => <AdminApp loginMode="org_admin" />;
    default:
      // Check if subdomain is an org ID
      if (subdomain && !['www', 'notify', 'atlas', 'admin'].includes(subdomain)) {
        return AtlasApp;
      }
      // Default to Notify
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