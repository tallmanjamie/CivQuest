// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from '@shared/components/Toast';

// Module imports
import NotifyApp from '@notify/NotifyApp';
import AtlasApp from '@atlas/AtlasApp';
import AdminApp from '@admin/AdminApp';

// Subdomain detection
function getSubdomain() {
  const hostname = window.location.hostname;
  
  // Local development overrides
  const params = new URLSearchParams(window.location.search);
  const moduleOverride = params.get('module');
  if (moduleOverride) {
    return moduleOverride; // ?module=notify, ?module=atlas, ?module=admin
  }
  
  // Production subdomain detection
  if (hostname.startsWith('notify.')) return 'notify';
  if (hostname.startsWith('atlas.')) return 'atlas';
  if (hostname.startsWith('admin.')) return 'admin';
  
  // Legacy path-based routing (for backward compatibility)
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/atlas')) return 'atlas';
  
  // Default to notify
  return 'notify';
}

// Module selection
function getModule(subdomain) {
  switch (subdomain) {
    case 'atlas':
      return AtlasApp;
    case 'admin':
      return AdminApp;
    case 'notify':
    default:
      return NotifyApp;
  }
}

const subdomain = getSubdomain();
const AppModule = getModule(subdomain);

// Global configuration
window.CIVQUEST_MODULE = subdomain;

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <AppModule />
  </ToastProvider>
);