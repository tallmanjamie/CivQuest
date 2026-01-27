// src/admin/components/AtlasUserManagement.jsx
// Atlas User Management - Manage user access to Atlas maps
// Uses the same user store as Notify but tracks Atlas access separately
// 
// LICENSE ENFORCEMENT: Enforces user limits based on organization license type
// - Personal: Max 3 users
// - Professional: Unlimited users

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot,
  query,
  where,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { 
  Users, 
  Search, 
  UserPlus,
  UserMinus,
  Map,
  Layers,
  Check,
  X,
  Loader2,
  Mail,
  Building2,
  Eye,
  EyeOff,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Shield,
  Clock,
  Lock
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';
import { 
  canAddAtlasUser, 
  getProductLicenseLimits, 
  PRODUCTS,
  LICENSE_TYPES 
} from '../../shared/services/licenses';

/**
 * Atlas User Management Component
 * 
 * Manages user access to Atlas for an organization.
 * Users are stored in the same collection as Notify users but with
 * separate atlasAccess field tracking which orgs they can access.
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
  const [showOnlyAtlasUsers, setShowOnlyAtlasUsers] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantOrg, setGrantOrg] = useState(orgId || '');
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
  // LICENSE & ACCESS HELPERS
  // ============================================================

  // Check if user has Atlas access to an org
  const hasAtlasAccess = (user, targetOrgId) => {
    return user.atlasAccess?.[targetOrgId]?.enabled === true;
  };

  // Get user's Atlas access details for an org
  const getAtlasAccessDetails = (user, targetOrgId) => {
    return user.atlasAccess?.[targetOrgId] || null;
  };

  // Count current Atlas users for an organization
  const getAtlasUserCount = (targetOrgId) => {
    return users.filter(user => hasAtlasAccess(user, targetOrgId)).length;
  };

  // Get license limits for an organization
  const getOrgLicenseLimits = (targetOrgId) => {
    const org = organizations.find(o => o.id === targetOrgId);
    if (!org) return null;
    return getProductLicenseLimits(org, PRODUCTS.ATLAS);
  };

  // Check if organization can add more Atlas users
  const canOrgAddUser = (targetOrgId) => {
    const org = organizations.find(o => o.id === targetOrgId);
    if (!org) return { allowed: false, limit: 0, remaining: 0 };
    const currentCount = getAtlasUserCount(targetOrgId);
    return canAddAtlasUser(org, currentCount);
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

  // Grant Atlas access with license check
  const handleGrantAccess = async (userId, userEmail, targetOrgId, mapIds = null) => {
    // Check license limits before granting access
    const licenseCheck = canOrgAddUser(targetOrgId);
    
    if (!licenseCheck.allowed) {
      const limits = getOrgLicenseLimits(targetOrgId);
      addToast?.(
        `Cannot add user: ${limits?.label || 'Personal'} license limit reached (${limits?.maxUsers || 3} users max). Upgrade to Professional for unlimited users.`,
        'error'
      );
      return false;
    }

    setSaving(true);
    try {
      const userRef = doc(db, PATHS.users, userId);
      await updateDoc(userRef, {
        [`atlasAccess.${targetOrgId}`]: {
          enabled: true,
          maps: mapIds, // null = all maps, array = specific maps
          grantedAt: serverTimestamp(),
          grantedBy: 'admin' // Could pass admin email here
        }
      });
      
      addToast?.(`Atlas access granted to ${userEmail}`, 'success');
      return true;
    } catch (error) {
      console.error('[AtlasUserManagement] Grant error:', error);
      addToast?.('Failed to grant access. Please try again.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Revoke Atlas access
  const handleRevokeAccess = async (userId, userEmail, targetOrgId) => {
    confirm?.({
      title: 'Revoke Atlas Access',
      message: `Are you sure you want to revoke Atlas access for ${userEmail}?`,
      confirmLabel: 'Revoke',
      destructive: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          const userRef = doc(db, PATHS.users, userId);
          await updateDoc(userRef, {
            [`atlasAccess.${targetOrgId}`]: {
              enabled: false,
              revokedAt: serverTimestamp()
            }
          });
          
          addToast?.(`Atlas access revoked for ${userEmail}`, 'success');
        } catch (error) {
          console.error('[AtlasUserManagement] Revoke error:', error);
          addToast?.('Failed to revoke access. Please try again.', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  // Grant access to new user
  const handleGrantNewUser = async () => {
    if (!grantEmail.trim() || !grantOrg) {
      addToast?.('Please enter an email and select an organization', 'error');
      return;
    }

    const email = grantEmail.trim().toLowerCase();
    
    // Check license first
    const licenseCheck = canOrgAddUser(grantOrg);
    if (!licenseCheck.allowed) {
      const limits = getOrgLicenseLimits(grantOrg);
      addToast?.(
        `Cannot add user: ${limits?.label || 'Personal'} license limit reached (${limits?.maxUsers || 3} users max). Upgrade to Professional for unlimited users.`,
        'error'
      );
      return;
    }

    // Check if user exists
    let existingUser = users.find(u => u.email?.toLowerCase() === email);

    setSaving(true);
    try {
      if (existingUser) {
        // Update existing user
        await handleGrantAccess(existingUser.id, email, grantOrg);
      } else {
        // Create new user with Atlas access
        const userRef = doc(collection(db, PATHS.users));
        await setDoc(userRef, {
          email,
          createdAt: serverTimestamp(),
          atlasAccess: {
            [grantOrg]: {
              enabled: true,
              maps: null,
              grantedAt: serverTimestamp(),
              grantedBy: 'admin'
            }
          }
        });
        addToast?.(`New user created and Atlas access granted to ${email}`, 'success');
      }

      setShowGrantModal(false);
      setGrantEmail('');
    } catch (error) {
      console.error('[AtlasUserManagement] Grant new user error:', error);
      addToast?.('Failed to grant access. Please try again.', 'error');
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
              ? 'Manage Atlas access across all organizations'
              : 'Manage who can access your Atlas maps'}
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

        {/* Grant Access Button */}
        <button
          onClick={() => setShowGrantModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium text-sm transition"
          style={{ backgroundColor: accentColor }}
        >
          <UserPlus className="w-4 h-4" />
          Grant Access
        </button>
      </div>

      {/* Grant Access Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Grant Atlas Access</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
                  style={{ '--tw-ring-color': accentColor }}
                />
              </div>

              {role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Organization
                  </label>
                  <select
                    value={grantOrg}
                    onChange={(e) => setGrantOrg(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
                    style={{ '--tw-ring-color': accentColor }}
                  >
                    <option value="">Select organization...</option>
                    {organizations.map(org => {
                      const info = getLicenseInfo(org.id);
                      return (
                        <option key={org.id} value={org.id}>
                          {org.name || org.id}
                          {info && info.maxUsers !== Infinity && ` (${info.current}/${info.maxUsers} users)`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* License limit warning */}
              {grantOrg && (() => {
                const info = getLicenseInfo(grantOrg);
                if (info && info.remaining !== null && info.remaining <= 0) {
                  return (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-700">
                        <strong>License limit reached.</strong> This organization's {info.label} license allows {info.maxUsers} users.
                        {info.type === LICENSE_TYPES.PERSONAL && ' Upgrade to Professional for unlimited users.'}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowGrantModal(false); setGrantEmail(''); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantNewUser}
                disabled={saving || !grantEmail.trim() || !grantOrg}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Grant Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Email
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
                    {searchTerm ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const targetOrg = role === 'admin' && filterOrg !== 'all' ? filterOrg : orgId;
                  const hasAccess = targetOrg ? hasAtlasAccess(user, targetOrg) : false;
                  const accessDetails = targetOrg ? getAtlasAccessDetails(user, targetOrg) : null;

                  // Count orgs with Atlas access (for super admin all view)
                  const atlasOrgCount = Object.values(user.atlasAccess || {})
                    .filter(a => a.enabled).length;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-800">{user.email}</span>
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
                        {targetOrg && hasAccess ? (
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
                        {targetOrg && (
                          <div className="flex items-center justify-end gap-1">
                            {hasAccess ? (
                              <button
                                onClick={() => handleRevokeAccess(user.id, user.email, targetOrg)}
                                className="flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs"
                                title="Revoke access"
                              >
                                <UserMinus className="w-3 h-3" />
                                Revoke
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGrantAccess(user.id, user.email, targetOrg)}
                                disabled={saving}
                                className="flex items-center gap-1 px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded text-xs disabled:opacity-50"
                                title="Grant access"
                              >
                                <UserPlus className="w-3 h-3" />
                                Grant
                              </button>
                            )}
                          </div>
                        )}
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
            {getAtlasUserCount(role === 'admin' ? filterOrg : orgId)} users with Atlas access
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
