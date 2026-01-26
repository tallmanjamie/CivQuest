// src/admin/components/AtlasAdminSection.jsx
// Atlas Admin Section - integrates into AdminApp
// Provides atlas configuration management for both super_admin and org_admin roles

import React, { useState } from 'react';
import { 
  Map, 
  Settings, 
  Layers, 
  Eye,
  AlertCircle,
  Users
} from 'lucide-react';
import AtlasConfiguration from './AtlasConfiguration';
import AtlasSettingsEditor from './AtlasSettingsEditor';
import MapEditor from './MapEditor';
import ServiceFinder from './ServiceFinder';
import AtlasUserManagement from './AtlasUserManagement';

/**
 * AtlasAdminSection Component
 * 
 * Renders the Atlas admin content based on the active tab.
 * Works with both super_admin and org_admin roles.
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'super_admin' | 'org_admin'
 * @param {string} activeTab - Current active tab ID
 * @param {string} [orgId] - Organization ID (for org_admin)
 * @param {object} [orgData] - Organization data (for org_admin)
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} accentColor - Theme accent color
 * @param {string} [adminEmail] - Current admin's email for audit trail
 */
export default function AtlasAdminSection({
  db,
  role,
  activeTab,
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor,
  adminEmail = null
}) {
  // Service Finder modal state
  const [showServiceFinder, setShowServiceFinder] = useState(false);
  const [serviceFinderCallback, setServiceFinderCallback] = useState(null);

  // Check if Atlas is initialized (live or draft)
  const hasAtlasConfig = !!orgData?.atlasConfig || !!orgData?.atlasConfigDraft;

  // Handle service finder selection
  const handleOpenServiceFinder = (callback) => {
    setServiceFinderCallback(() => callback);
    setShowServiceFinder(true);
  };

  const handleServiceSelect = (serviceUrl) => {
    if (serviceFinderCallback) {
      serviceFinderCallback(serviceUrl);
    }
    setShowServiceFinder(false);
    setServiceFinderCallback(null);
  };

  // Render based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'configuration':
      case 'maps':
        // Main atlas configuration view
        return (
          <AtlasConfiguration
            db={db}
            role={role === 'super_admin' ? 'admin' : 'org_admin'}
            orgId={orgId}
            orgData={orgData}
            addToast={addToast}
            confirm={confirm}
            accentColor={accentColor}
            AtlasSettingsModal={AtlasSettingsEditor}
            MapEditModal={({ data, onClose, onSave }) => (
              <MapEditor
                data={data}
                onClose={onClose}
                onSave={onSave}
                accentColor={accentColor}
                onOpenServiceFinder={(type) => handleOpenServiceFinder((url) => {
                  // Handle service finder callback based on type
                  console.log('Selected service:', url, 'for type:', type);
                })}
              />
            )}
          />
        );

      case 'users':
        // Atlas user management
        // For org_admin: check if Atlas is initialized first
        if (role === 'org_admin' && !hasAtlasConfig) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
              <p className="text-slate-500 mb-4">
                You need to initialize Atlas before you can manage users.
              </p>
              <p className="text-sm text-slate-400">
                Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
              </p>
            </div>
          );
        }

        return (
          <AtlasUserManagement
            db={db}
            role={role === 'super_admin' ? 'admin' : 'org_admin'}
            orgId={orgId}
            orgData={orgData}
            addToast={addToast}
            confirm={confirm}
            accentColor={accentColor}
            adminEmail={adminEmail}
          />
        );

      case 'preview':
        // Atlas preview (link to atlas app) - only for org_admin
        // Super admins use preview links from Configuration tab
        if (!hasAtlasConfig) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
              <p className="text-slate-500 mb-4">
                You need to initialize Atlas before you can preview it.
              </p>
              <p className="text-sm text-slate-400">
                Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
              </p>
            </div>
          );
        }

        // org_admin with Atlas initialized
        const hasDraftConfig = !!orgData?.atlasConfigDraft;
        
        return (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <Eye className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Preview Atlas</h3>
              <p className="text-slate-500 mb-6">
                See how your Atlas configuration looks to end users.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* Preview Live */}
                <a
                  href={`/atlas?org=${orgId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                >
                  <Map className="w-4 h-4" />
                  Preview Live
                </a>
                
                {/* Preview Draft (only if draft exists) */}
                {hasDraftConfig && (
                  <a
                    href={`/atlas?org=${orgId}&preview=draft`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2 text-white rounded-lg font-medium"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Eye className="w-4 h-4" />
                    Preview Draft Changes
                  </a>
                )}
              </div>
              
              {hasDraftConfig && (
                <p className="text-sm text-amber-600 mt-4">
                  You have unpublished changes. Preview Draft to see your changes before publishing.
                </p>
              )}
            </div>

            {/* Preview Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="font-medium text-slate-700 mb-2">About Preview</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• <strong>Preview Live</strong> shows the current published configuration that users see</li>
                <li>• <strong>Preview Draft</strong> shows your unpublished changes (only visible to admins)</li>
                <li>• Changes must be published from the Maps tab to go live</li>
              </ul>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-slate-500">
            <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p>Select a tab to manage Atlas configuration.</p>
          </div>
        );
    }
  };

  return (
    <>
      {renderContent()}

      {/* Service Finder Modal */}
      {showServiceFinder && (
        <ServiceFinder
          isOpen={showServiceFinder}
          onClose={() => setShowServiceFinder(false)}
          onSelect={handleServiceSelect}
        />
      )}
    </>
  );
}

/**
 * Get Atlas navigation items based on role
 * @param {string} role - 'super_admin' | 'org_admin'
 * @returns {Array} Navigation items for atlas section
 */
export function getAtlasNavItems(role) {
  if (role === 'super_admin') {
    return [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'configuration', label: 'Configuration', icon: Settings }
    ];
  }
  
  // org_admin
  return [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'maps', label: 'Maps', icon: Layers },
    { id: 'preview', label: 'Preview', icon: Eye }
  ];
}
