// src/admin/components/LicenseManagement.jsx
// License Management for CivQuest Admin
// Super admin only - configure license types per organization per product
//
// LICENSE TIERS:
// - Pilot: Trial license for evaluation (max 3 users, no public access)
// - Production: Full production license for live deployments (unlimited users, public access allowed)

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";
import { 
  Shield, 
  Search, 
  Building2,
  Bell,
  Map,
  Users,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';
import { 
  LICENSE_TYPES, 
  LICENSE_CONFIG,
  PRODUCTS,
  getLicenseOptions,
  getProductLicenseType,
  updateProductLicense
} from '../../shared/services/licenses';

/**
 * LicenseManagement Component
 * 
 * Allows super admins to view and modify license types for organizations.
 * Each product (Notify, Atlas) can have its own license type.
 */
export default function LicenseManagement({ 
  db, 
  accentColor,
  adminEmail,
  addToast
}) {
  // State
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [updating, setUpdating] = useState(null); // { orgId, product }

  // Load organizations
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, PATHS.organizations),
      (snapshot) => {
        const orgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrganizations(orgs);
        setLoading(false);
      },
      (error) => {
        console.error('[LicenseManagement] Error loading orgs:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  // Filter organizations
  const filteredOrgs = useMemo(() => {
    if (!searchTerm) return organizations;
    const term = searchTerm.toLowerCase();
    return organizations.filter(org => 
      org.name?.toLowerCase().includes(term) ||
      org.id?.toLowerCase().includes(term)
    );
  }, [organizations, searchTerm]);

  // Handle license change
  const handleLicenseChange = async (orgId, orgName, product, newLicenseType) => {
    setUpdating({ orgId, product });
    
    try {
      await updateProductLicense(orgId, product, newLicenseType, adminEmail);
      addToast?.(
        `Updated ${product === PRODUCTS.NOTIFY ? 'Notify' : 'Atlas'} license for ${orgName} to ${LICENSE_CONFIG[newLicenseType].label}`,
        'success'
      );
    } catch (error) {
      console.error('[LicenseManagement] Update failed:', error);
      addToast?.('Failed to update license. Please try again.', 'error');
    } finally {
      setUpdating(null);
    }
  };

  // Get badge classes for license type
  const getLicenseBadgeClasses = (licenseType) => {
    switch (licenseType) {
      case LICENSE_TYPES.PRODUCTION:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case LICENSE_TYPES.PILOT:
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
                option.value === LICENSE_TYPES.PRODUCTION
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  option.value === LICENSE_TYPES.PRODUCTION
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-2">{option.description}</p>
              <div className="space-y-1 text-xs">
                {option.value === LICENSE_TYPES.PILOT ? (
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
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    
                    {/* Org Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <h4 className="font-medium text-slate-800 truncate">
                          {org.name || org.id}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {notificationCount} notification{notificationCount !== 1 ? 's' : ''} • {mapCount} map{mapCount !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* License Badges */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Bell className="w-3 h-3 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLicenseBadgeClasses(notifyLicenseType)}`}>
                          {LICENSE_CONFIG[notifyLicenseType]?.label || 'Pilot'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Map className="w-3 h-3 text-slate-400" />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getLicenseBadgeClasses(atlasLicenseType)}`}>
                          {LICENSE_CONFIG[atlasLicenseType]?.label || 'Pilot'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-10 space-y-3">
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

                        {/* License History */}
                        {(org.license?.notify?.updatedAt || org.license?.atlas?.updatedAt) && (
                          <div className="text-xs text-slate-400 px-3">
                            {org.license?.notify?.updatedBy && (
                              <p>Notify last updated by {org.license.notify.updatedBy}</p>
                            )}
                            {org.license?.atlas?.updatedBy && (
                              <p>Atlas last updated by {org.license.atlas.updatedBy}</p>
                            )}
                          </div>
                        )}
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
