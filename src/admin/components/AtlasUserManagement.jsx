// src/admin/components/AtlasUserManagement.jsx
// Atlas User Management - View and suspend users who have Atlas access
//
// Users now self-register from the organization's sign-in page.
// Admins can only view users and suspend/unsuspend them.
// Users cannot be invited, granted access, or deleted by admins.

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import {
  Users,
  Search,
  Ban,
  UserCheck,
  Map,
  Check,
  X,
  Loader2,
  Mail,
  Building2,
  Filter,
  AlertCircle,
  Shield,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';
import {
  getProductLicenseLimits,
  PRODUCTS,
  LICENSE_TYPES
} from '../../shared/services/licenses';

/**
 * Atlas User Management Component
 *
 * Manages user access to Atlas for an organization.
 * Users self-register - admins can only view and suspend users.
 *
 * Props:
 * - db: Firestore instance
 * - role: 'admin' (super) or 'org_admin'
 * - orgId: Organization ID (required for org_admin)
 * - orgData: Organization data
 * - accentColor: UI accent color
 * - addToast: Toast notification function
 * - confirm: Confirmation dialog function
 */
export default function AtlasUserManagement({
  db,
  role,
  orgId,
  orgData,
  accentColor,
  addToast,
  confirm
}) {
  // State
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState(role === 'admin' ? 'all' : orgId);
  const [showOnlyAtlasUsers, setShowOnlyAtlasUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load users
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, PATHS.users),
      (snapshot) => {
        const userData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(userData);
        setLoading(false);
      },
      (error) => {
        console.error("[AtlasUserManagement] Error loading users:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  // Load organizations for super admin
  useEffect(() => {
    if (role !== 'admin') {
      if (orgData) {
        setOrganizations([{ id: orgId, ...orgData }]);
      }
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, PATHS.organizations),
      (snapshot) => {
        const orgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrganizations(orgs);
      },
      (error) => {
        console.error("[AtlasUserManagement] Error loading orgs:", error);
      }
    );

    return () => unsubscribe();
  }, [db, role, orgId, orgData]);

  // ============================================================
  // USER HELPERS
  // ============================================================

  // Check if user has Atlas access to an org
  const hasAtlasAccess = (user, targetOrgId) => {
    return user.atlasAccess?.[targetOrgId]?.enabled === true;
  };

  // Count current Atlas users for an organization
  const getAtlasUserCount = (targetOrgId) => {
    return users.filter(user => hasAtlasAccess(user, targetOrgId) && !user.suspended).length;
  };

  // Get license limits for an organization
  const getOrgLicenseLimits = (targetOrgId) => {
    const org = organizations.find(o => o.id === targetOrgId);
    if (!org) return null;
    return getProductLicenseLimits(org, PRODUCTS.ATLAS);
  };

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const matchesSearch = !searchTerm ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());

      // Org filter (for admin view)
      const targetOrg = role === 'admin' ? filterOrg : orgId;

      // Atlas access filter
      if (showOnlyAtlasUsers) {
        if (targetOrg === 'all') {
          // Has Atlas access to any org
          const hasAnyAccess = Object.values(user.atlasAccess || {}).some(access => access.enabled);
          return matchesSearch && hasAnyAccess;
        } else {
          // Has Atlas access to specific org
          return matchesSearch && hasAtlasAccess(user, targetOrg);
        }
      }

      return matchesSearch;
    });
  }, [users, searchTerm, filterOrg, showOnlyAtlasUsers, role, orgId]);

  // Suspend user
  const handleSuspendUser = async (userId, userEmail) => {
    confirm?.({
      title: 'Suspend User',
      message: `Are you sure you want to suspend ${userEmail}? They will not be able to access Atlas until unsuspended.`,
      confirmLabel: 'Suspend',
      destructive: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          const userRef = doc(db, PATHS.users, userId);
          await updateDoc(userRef, {
            suspended: true,
            suspendedAt: serverTimestamp(),
            suspendReason: 'Suspended by admin'
          });

          addToast?.(`User ${userEmail} has been suspended`, 'success');
        } catch (error) {
          console.error('[AtlasUserManagement] Suspend error:', error);
          addToast?.('Failed to suspend user. Please try again.', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  // Unsuspend user
  const handleUnsuspendUser = async (userId, userEmail) => {
    setSaving(true);
    try {
      const userRef = doc(db, PATHS.users, userId);
      await updateDoc(userRef, {
        suspended: false,
        suspendedAt: null,
        suspendReason: null,
        unsuspendedAt: serverTimestamp()
      });

      addToast?.(`User ${userEmail} has been unsuspended`, 'success');
    } catch (error) {
      console.error('[AtlasUserManagement] Unsuspend error:', error);
      addToast?.('Failed to unsuspend user. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Get license info for display
  const getLicenseInfo = (targetOrgId) => {
    const limits = getOrgLicenseLimits(targetOrgId);
    if (!limits) return null;

    const currentCount = getAtlasUserCount(targetOrgId);
    return {
      ...limits,
      current: currentCount,
      remaining: limits.maxUsers === Infinity ? null : Math.max(0, limits.maxUsers - currentCount)
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  // Get license info for org admin view
  const orgLicenseInfo = role === 'org_admin' && orgId ? getLicenseInfo(orgId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6" style={{ color: accentColor }} />
            Atlas Users
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {role === 'admin'
              ? 'View and manage Atlas users across all organizations'
              : 'View and manage users who have access to your Atlas maps'}
          </p>
        </div>

        {/* License Badge for Org Admin */}
        {orgLicenseInfo && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            orgLicenseInfo.type === LICENSE_TYPES.PROFESSIONAL
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">{orgLicenseInfo.label}</span>
            {orgLicenseInfo.maxUsers !== Infinity && (
              <span className="text-xs">
                ({orgLicenseInfo.current}/{orgLicenseInfo.maxUsers} users)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium">Users self-register for Atlas</p>
          <p className="mt-1">
            Users create their own accounts on the organization's sign-in page.
            You can suspend users to temporarily revoke their access.
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by email..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-opacity-50"
            style={{ '--tw-ring-color': accentColor }}
          />
        </div>

        {/* Org Filter (super admin only) */}
        {role === 'admin' && (
          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-opacity-50"
            style={{ '--tw-ring-color': accentColor }}
          >
            <option value="all">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name || org.id}
              </option>
            ))}
          </select>
        )}

        {/* Atlas Users Filter */}
        <button
          onClick={() => setShowOnlyAtlasUsers(!showOnlyAtlasUsers)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition ${
            showOnlyAtlasUsers
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          {showOnlyAtlasUsers ? 'Atlas Users Only' : 'All Users'}
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  User
                </th>
                {role === 'admin' && filterOrg === 'all' && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Atlas Access
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    {searchTerm ? 'No users match your search' : 'No Atlas users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const targetOrg = role === 'admin' && filterOrg !== 'all' ? filterOrg : orgId;
                  const hasAccess = targetOrg ? hasAtlasAccess(user, targetOrg) : false;
                  const isSuspended = user.suspended === true;

                  // Get display name - prefer firstName/lastName, then email
                  const displayName = (user.firstName || user.lastName)
                    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
                    : null;

                  // Count orgs with Atlas access (for super admin all view)
                  const atlasOrgCount = Object.values(user.atlasAccess || {})
                    .filter(a => a.enabled).length;

                  return (
                    <tr key={user.id} className={`hover:bg-slate-50 ${isSuspended ? 'bg-red-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <div>
                            {displayName && (
                              <span className={`text-sm font-medium block ${isSuspended ? 'text-slate-500' : 'text-slate-800'}`}>
                                {displayName}
                              </span>
                            )}
                            <span className={`text-sm ${displayName ? 'text-slate-500' : (isSuspended ? 'text-slate-500' : 'text-slate-800')}`}>
                              {user.email}
                            </span>
                            {user.arcgisProfile?.username && (
                              <span className="text-xs text-slate-400 block">
                                ArcGIS: {user.arcgisProfile.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {role === 'admin' && filterOrg === 'all' && (
                        <td className="px-4 py-3">
                          {atlasOrgCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                              <Map className="w-3 h-3" />
                              {atlasOrgCount} org{atlasOrgCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">No access</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                            <Ban className="w-3 h-3" />
                            Suspended
                          </span>
                        ) : targetOrg && hasAccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        ) : targetOrg ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs">
                            <X className="w-3 h-3" />
                            No Access
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isSuspended ? (
                            <button
                              onClick={() => handleUnsuspendUser(user.id, user.email)}
                              disabled={saving}
                              className="flex items-center gap-1 px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded text-xs disabled:opacity-50"
                              title="Unsuspend user"
                            >
                              <UserCheck className="w-3 h-3" />
                              Unsuspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspendUser(user.id, user.email)}
                              disabled={saving}
                              className="flex items-center gap-1 px-2 py-1 text-amber-600 hover:bg-amber-50 rounded text-xs disabled:opacity-50"
                              title="Suspend user"
                            >
                              <Ban className="w-3 h-3" />
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      {(role === 'org_admin' || filterOrg !== 'all') && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {getAtlasUserCount(role === 'admin' ? filterOrg : orgId)} active users with Atlas access
          </span>
          {(() => {
            const info = getLicenseInfo(role === 'admin' ? filterOrg : orgId);
            if (info && info.maxUsers !== Infinity) {
              return (
                <span className={info.remaining === 0 ? 'text-amber-600' : ''}>
                  {info.remaining} of {info.maxUsers} slots remaining ({info.label})
                </span>
              );
            }
            return <span className="text-emerald-600">Unlimited users (Professional)</span>;
          })()}
        </div>
      )}
    </div>
  );
}
