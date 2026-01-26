// src/admin/components/LicenseManagement.jsx
// License Management Component for Super Admins
// Allows viewing and editing organization license types for Notify and Atlas separately

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Shield, 
  Building2, 
  Search, 
  Loader2, 
  Check,
  Users,
  Map,
  Globe,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Bell
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';
import { 
  PRODUCTS,
  LICENSE_TYPES, 
  LICENSE_CONFIG, 
  DEFAULT_LICENSE,
  getLicenseOptions,
  getProductLicenseType
} from '../../shared/services/licenses';

/**
 * LicenseManagement Component
 * 
 * Super admin only component for managing organization licenses.
 * Displays all organizations with their current license types for both 
 * Notify and Atlas, and allows separate changes for each product.
 * 
 * @param {object} db - Firestore database instance
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} adminEmail - Current admin's email for audit trail
 * @param {string} accentColor - Theme accent color
 */
export default function LicenseManagement({
  db,
  addToast,
  confirm,
  adminEmail,
  accentColor = '#004E7C'
}) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(null); // { orgId, product } being updated
  const [expandedOrg, setExpandedOrg] = useState(null);

  // Fetch all organizations
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, PATHS.organizations),
      (snapshot) => {
        const orgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort by name
        orgs.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        setOrganizations(orgs);
        setLoading(false);
      },
      (error) => {
        console.error('[LicenseManagement] Error fetching organizations:', error);
        addToast('Failed to load organizations', 'error');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, addToast]);

  // Filter organizations by search term
  const filteredOrgs = organizations.filter(org =>
    (org.name || org.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle license change for a specific product
  const handleLicenseChange = async (orgId, orgName, product, newLicenseType) => {
    const org = organizations.find(o => o.id === orgId);
    const currentType = getProductLicenseType(org, product);
    
    if (currentType === newLicenseType) return;

    const newConfig = LICENSE_CONFIG[newLicenseType];
    const isDowngrade = newLicenseType === LICENSE_TYPES.PROFESSIONAL && currentType === LICENSE_TYPES.ORGANIZATION;
    const productLabel = product === PRODUCTS.NOTIFY ? 'Notify' : 'Atlas';

    let warningMessage = '';
    if (isDowngrade) {
      warningMessage = `
        <strong>Warning:</strong> Downgrading ${productLabel} to Team license will:
        <ul class="list-disc ml-4 mt-2">
          <li>Limit ${productLabel} users to 5</li>
          <li>Prevent public ${product === PRODUCTS.NOTIFY ? 'notifications' : 'maps'}</li>
        </ul>
        <p class="mt-2">Existing public items will need to be changed to private.</p>
      `;
    }

    confirm({
      title: `Change ${productLabel} License for ${orgName}`,
      message: `
        Change ${productLabel} license from <strong>${LICENSE_CONFIG[currentType].label}</strong> to <strong>${newConfig.label}</strong>?
        ${warningMessage ? `<div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">${warningMessage}</div>` : ''}
      `,
      confirmLabel: 'Change License',
      destructive: isDowngrade,
      onConfirm: async () => {
        setUpdating({ orgId, product });
        try {
          const orgRef = doc(db, PATHS.organization(orgId));
          await updateDoc(orgRef, {
            [`license.${product}.type`]: newLicenseType,
            [`license.${product}.updatedAt`]: serverTimestamp(),
            [`license.${product}.updatedBy`]: adminEmail
          });
          addToast(`${productLabel} license updated to ${newConfig.label} for ${orgName}`, 'success');
        } catch (error) {
          console.error('[LicenseManagement] Error updating license:', error);
          addToast('Failed to update license: ' + error.message, 'error');
        } finally {
          setUpdating(null);
        }
      }
    });
  };

  // Get license badge color
  const getLicenseBadgeClass = (licenseType) => {
    const type = licenseType || DEFAULT_LICENSE;
    switch (type) {
      case LICENSE_TYPES.ORGANIZATION:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case LICENSE_TYPES.PROFESSIONAL:
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  // Count items for an org
  const countOrgItems = (org) => {
    const notificationCount = org.notifications?.length || 0;
    const mapCount = org.atlasConfig?.data?.maps?.length || org.atlasConfigDraft?.data?.maps?.length || 0;
    return { notificationCount, mapCount };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6" style={{ color: accentColor }} />
            License Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Configure license types for Notify and Atlas separately
          </p>
        </div>
        
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search organizations..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-opacity-50"
            style={{ '--tw-ring-color': accentColor }}
          />
        </div>
      </div>

      {/* License Types Legend */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">License Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getLicenseOptions().map(option => (
            <div 
              key={option.value}
              className={`p-3 rounded-lg border ${
                option.value === LICENSE_TYPES.ORGANIZATION 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  option.value === LICENSE_TYPES.ORGANIZATION 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2">{option.description}</p>
              <div className="space-y-1 text-xs">
                {option.value === LICENSE_TYPES.PROFESSIONAL ? (
                  <>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="w-3 h-3" /> Max 3 users per product
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Lock className="w-3 h-3" /> No public notifications/maps
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="w-3 h-3" /> Unlimited users
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Globe className="w-3 h-3" /> Public access allowed
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Organizations List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">
            Organizations ({filteredOrgs.length})
          </h3>
        </div>
        
        {filteredOrgs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'No organizations match your search' : 'No organizations found'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrgs.map(org => {
              const notifyLicenseType = getProductLicenseType(org, PRODUCTS.NOTIFY);
              const atlasLicenseType = getProductLicenseType(org, PRODUCTS.ATLAS);
              const { notificationCount, mapCount } = countOrgItems(org);
              const isExpanded = expandedOrg === org.id;
              
              return (
                <div key={org.id} className="hover:bg-slate-50 transition-colors">
                  {/* Main Row */}
                  <div className="p-4 flex items-center gap-4">
                    {/* Expand Toggle */}
                    <button
                      onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Org Icon */}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${accentColor}15` }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: accentColor }} />
                    </div>
                    
                    {/* Org Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-800 truncate">
                        {org.name || org.id}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        {org.id}
                        {notificationCount > 0 && ` • ${notificationCount} notification${notificationCount !== 1 ? 's' : ''}`}
                        {mapCount > 0 && ` • ${mapCount} map${mapCount !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    
                    {/* License Badges */}
                    <div className="flex items-center gap-2">
                      {/* Notify License */}
                      <div className="flex items-center gap-1">
                        <Bell className="w-3 h-3 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getLicenseBadgeClass(notifyLicenseType)}`}>
                          {LICENSE_CONFIG[notifyLicenseType].label}
                        </span>
                      </div>
                      
                      {/* Atlas License */}
                      <div className="flex items-center gap-1">
                        <Map className="w-3 h-3 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getLicenseBadgeClass(atlasLicenseType)}`}>
                          {LICENSE_CONFIG[atlasLicenseType].label}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 ml-14">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        {/* Notify License */}
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                              <Bell className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <h5 className="font-medium text-slate-800 text-sm">Notify License</h5>
                              <p className="text-xs text-slate-500">
                                {LICENSE_CONFIG[notifyLicenseType].limits[PRODUCTS.NOTIFY].maxUsers === Infinity 
                                  ? 'Unlimited users' 
                                  : `Max ${LICENSE_CONFIG[notifyLicenseType].limits[PRODUCTS.NOTIFY].maxUsers} users`}
                                {LICENSE_CONFIG[notifyLicenseType].limits[PRODUCTS.NOTIFY].allowPublic 
                                  ? ' • Public allowed' 
                                  : ' • Private only'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="relative">
                            <select
                              value={notifyLicenseType}
                              onChange={(e) => handleLicenseChange(org.id, org.name || org.id, PRODUCTS.NOTIFY, e.target.value)}
                              disabled={updating?.orgId === org.id && updating?.product === PRODUCTS.NOTIFY}
                              className="appearance-none bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-opacity-50 disabled:opacity-50"
                              style={{ '--tw-ring-color': accentColor }}
                            >
                              {getLicenseOptions().map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {updating?.orgId === org.id && updating?.product === PRODUCTS.NOTIFY ? (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </div>
                        
                        {/* Atlas License */}
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <Map className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <h5 className="font-medium text-slate-800 text-sm">Atlas License</h5>
                              <p className="text-xs text-slate-500">
                                {LICENSE_CONFIG[atlasLicenseType].limits[PRODUCTS.ATLAS].maxUsers === Infinity 
                                  ? 'Unlimited users' 
                                  : `Max ${LICENSE_CONFIG[atlasLicenseType].limits[PRODUCTS.ATLAS].maxUsers} users`}
                                {LICENSE_CONFIG[atlasLicenseType].limits[PRODUCTS.ATLAS].allowPublic 
                                  ? ' • Public allowed' 
                                  : ' • Private only'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="relative">
                            <select
                              value={atlasLicenseType}
                              onChange={(e) => handleLicenseChange(org.id, org.name || org.id, PRODUCTS.ATLAS, e.target.value)}
                              disabled={updating?.orgId === org.id && updating?.product === PRODUCTS.ATLAS}
                              className="appearance-none bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-opacity-50 disabled:opacity-50"
                              style={{ '--tw-ring-color': accentColor }}
                            >
                              {getLicenseOptions().map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {updating?.orgId === org.id && updating?.product === PRODUCTS.ATLAS ? (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                        </div>
                        
                        {/* Last Updated Info */}
                        <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs text-slate-500">
                          {org.license?.notify?.updatedAt && (
                            <div className="flex items-center gap-1">
                              <Bell className="w-3 h-3" />
                              <span>
                                Notify updated: {org.license.notify.updatedAt.toDate?.().toLocaleDateString() || 'Unknown'}
                                {org.license.notify.updatedBy && ` by ${org.license.notify.updatedBy}`}
                              </span>
                            </div>
                          )}
                          {org.license?.atlas?.updatedAt && (
                            <div className="flex items-center gap-1">
                              <Map className="w-3 h-3" />
                              <span>
                                Atlas updated: {org.license.atlas.updatedAt.toDate?.().toLocaleDateString() || 'Unknown'}
                                {org.license.atlas.updatedBy && ` by ${org.license.atlas.updatedBy}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
