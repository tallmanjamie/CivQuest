// src/admin/components/AtlasUserManagement.jsx
// Atlas User Management - Manage user access to Atlas maps
// Uses the same user store as Notify but tracks Atlas access separately
// 
// LICENSE ENFORCEMENT: Enforces user limits based on organization license type
// - Professional: Max 3 users
// - Organization: Unlimited users

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
 * User document structure:
 * {
 *   email: "user@example.com",
 *   subscriptions: { ... },  // Notify subscriptions
 *   atlasAccess: {           // Atlas access by org
 *     "chesapeake": {
 *       enabled: true,
 *       grantedAt: Timestamp,
 *       grantedBy: "admin@example.com",
 *       maps: ["map1", "map2"] // Optional: specific map access (null = all maps)
 *     }
 *   }
 * }
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'admin' | 'org_admin'
 * @param {string} [orgId] - Required for 'org_admin' role
 * @param {object} [orgData] - Organization data (for org_admin)
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color
 * @param {string} [adminEmail] - Current admin's email for audit trail
 */
export default function AtlasUserManagement({ 
  db,
  role = 'admin',
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor = '#004E7C',
  adminEmail = null
}) {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState(orgId || 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOnlyAtlasUsers, setShowOnlyAtlasUsers] = useState(true);

  // Fetch users
  useEffect(() => {
    const usersRef = collection(db, PATHS.users);
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setUsers(usersList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  // Fetch organizations (for admin role)
  useEffect(() => {
    if (role === 'admin') {
      const orgsRef = collection(db, PATHS.organizations);
      const unsubscribe = onSnapshot(orgsRef, (snapshot) => {
        const orgsList = snapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .filter(org => org.atlasConfig); // Only orgs with Atlas
        setOrganizations(orgsList);
      });
      return () => unsubscribe();
    } else if (orgData) {
      setOrganizations([{ id: orgId, ...orgData }]);
    }
  }, [db, role, orgId, orgData]);

  // Get available maps for an org
  const getOrgMaps = (targetOrgId) => {
    const org = organizations.find(o => o.id === targetOrgId);
    return org?.atlasConfig?.data?.maps || [];
  };

  // Check if user has Atlas access for an org
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
  const filteredUsers = users.filter(user => {
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

  // Grant Atlas access with license check
  const handleGrantAccess = async (userId, userEmail, targetOrgId, mapIds = null) => {
    // Check license limits before granting access
    const licenseCheck = canOrgAddUser(targetOrgId);
    
    if (!licenseCheck.allowed) {
      const limits = getOrgLicenseLimits(targetOrgId);
      addToast(
        `Cannot add user: ${limits?.label || 'Professional'} license limit reached (${limits?.maxUsers || 3} users max). Upgrade to Organization license for unlimited users.`,
        'error'
      );
      return;
    }

    try {
      const userRef = doc(db, PATHS.users, userId);
      const accessData = {
        enabled: true,
        grantedAt: serverTimestamp(),
        grantedBy: adminEmail || 'admin',
        maps: mapIds // null means all maps
      };
      
      await updateDoc(userRef, {
        [`atlasAccess.${targetOrgId}`]: accessData
      });
      
      addToast(`Atlas access granted to ${userEmail}`, 'success');
    } catch (err) {
      addToast(`Error granting access: ${err.message}`, 'error');
    }
  };

  // Revoke Atlas access
  const handleRevokeAccess = (userId, userEmail, targetOrgId) => {
    confirm({
      title: 'Revoke Atlas Access',
      message: `Are you sure you want to revoke Atlas access for ${userEmail}?`,
      destructive: true,
      confirmLabel: 'Revoke Access',
      onConfirm: async () => {
        try {
          const userRef = doc(db, PATHS.users, userId);
          await updateDoc(userRef, {
            [`atlasAccess.${targetOrgId}.enabled`]: false,
            [`atlasAccess.${targetOrgId}.revokedAt`]: serverTimestamp(),
            [`atlasAccess.${targetOrgId}.revokedBy`]: adminEmail || 'admin'
          });
          
          addToast(`Atlas access revoked for ${userEmail}`, 'success');
        } catch (err) {
          addToast(`Error revoking access: ${err.message}`, 'error');
        }
      }
    });
  };

  // Add new user with Atlas access (with license check)
  const handleAddUser = async (email, targetOrgId, mapIds = null) => {
    // Check license limits before adding user
    const licenseCheck = canOrgAddUser(targetOrgId);
    
    if (!licenseCheck.allowed) {
      const limits = getOrgLicenseLimits(targetOrgId);
      addToast(
        `Cannot add user: ${limits?.label || 'Professional'} license limit reached (${limits?.maxUsers || 3} users max). Upgrade to Organization license for unlimited users.`,
        'error'
      );
      return;
    }

    try {
      // Check if user already exists
      const usersRef = collection(db, PATHS.users);
      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        // Check if user already has access (don't count them twice)
        if (hasAtlasAccess(existingUser, targetOrgId)) {
          addToast(`${email} already has Atlas access`, 'warning');
          setShowAddModal(false);
          return;
        }
        // Grant access to existing user
        await handleGrantAccess(existingUser.id, email, targetOrgId, mapIds);
      } else {
        // Create new user with Atlas access
        const newUserRef = doc(collection(db, PATHS.users));
        await setDoc(newUserRef, {
          email: email.toLowerCase(),
          createdAt: serverTimestamp(),
          atlasAccess: {
            [targetOrgId]: {
              enabled: true,
              grantedAt: serverTimestamp(),
              grantedBy: adminEmail || 'admin',
              maps: mapIds
            }
          }
        });
        addToast(`User ${email} created with Atlas access`, 'success');
      }
      
      setShowAddModal(false);
    } catch (err) {
      addToast(`Error adding user: ${err.message}`, 'error');
    }
  };

  // Export users to CSV
  const handleExportCSV = () => {
    const targetOrg = role === 'admin' ? filterOrg : orgId;
    const exportUsers = filteredUsers.map(user => {
      const access = targetOrg !== 'all' ? getAtlasAccessDetails(user, targetOrg) : null;
      return {
        email: user.email,
        organization: targetOrg !== 'all' ? targetOrg : 'Multiple',
        hasAccess: targetOrg !== 'all' ? hasAtlasAccess(user, targetOrg) : 'See details',
        grantedAt: access?.grantedAt?.toDate?.()?.toISOString() || '',
        grantedBy: access?.grantedBy || ''
      };
    });
    
    const headers = ['Email', 'Organization', 'Has Access', 'Granted At', 'Granted By'];
    const csvContent = [
      headers.join(','),
      ...exportUsers.map(u => [u.email, u.organization, u.hasAccess, u.grantedAt, u.grantedBy].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atlas-users-${targetOrg}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    addToast('Users exported to CSV', 'success');
  };

  // License info banner component
  const LicenseInfoBanner = ({ targetOrgId }) => {
    const limits = getOrgLicenseLimits(targetOrgId);
    const currentCount = getAtlasUserCount(targetOrgId);
    const canAdd = canOrgAddUser(targetOrgId);
    
    if (!limits) return null;

    const isProfessional = limits.type === LICENSE_TYPES.PROFESSIONAL;
    const isAtLimit = !canAdd.allowed;

    return (
      <div className={`rounded-lg p-3 flex items-start gap-3 ${
        isAtLimit 
          ? 'bg-amber-50 border border-amber-200' 
          : isProfessional 
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-emerald-50 border border-emerald-200'
      }`}>
        <Shield className={`w-5 h-5 shrink-0 mt-0.5 ${
          isAtLimit 
            ? 'text-amber-600' 
            : isProfessional 
              ? 'text-blue-600'
              : 'text-emerald-600'
        }`} />
        <div className={`text-sm ${
          isAtLimit 
            ? 'text-amber-800' 
            : isProfessional 
              ? 'text-blue-800'
              : 'text-emerald-800'
        }`}>
          <p className="font-medium">
            {limits.label} License
            {isProfessional && ` • ${currentCount}/${limits.maxUsers} users`}
            {!isProfessional && ` • ${currentCount} users (unlimited)`}
          </p>
          {isAtLimit && (
            <p className="mt-1 text-xs">
              User limit reached. Contact your administrator to upgrade to Organization license for unlimited users.
            </p>
          )}
          {isProfessional && !isAtLimit && canAdd.remaining !== null && (
            <p className="mt-1 text-xs">
              {canAdd.remaining} user slot{canAdd.remaining !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      </div>
    );
  };

  // Render for admin role (all organizations)
  if (role === 'admin') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Atlas Users</h2>
            <p className="text-slate-500 text-sm">Manage user access to Atlas across all organizations.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
              style={{ backgroundColor: accentColor }}
            >
              <UserPlus className="w-4 h-4" /> Add User
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': accentColor }}
            />
          </div>

          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{ '--tw-ring-color': accentColor }}
          >
            <option value="all">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name || org.id}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyAtlasUsers}
              onChange={(e) => setShowOnlyAtlasUsers(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
              style={{ accentColor }}
            />
            Atlas users only
          </label>
        </div>

        {/* License Info Banner (when org is selected) */}
        {filterOrg !== 'all' && <LicenseInfoBanner targetOrgId={filterOrg} />}

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No users found.</p>
              {showOnlyAtlasUsers && (
                <p className="text-sm mt-1">Try unchecking "Atlas users only" to see all users.</p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Atlas Access</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => (
                  <UserRowAdmin
                    key={user.id}
                    user={user}
                    organizations={organizations}
                    filterOrg={filterOrg}
                    accentColor={accentColor}
                    canOrgAddUser={canOrgAddUser}
                    onGrantAccess={(targetOrgId) => handleGrantAccess(user.id, user.email, targetOrgId)}
                    onRevokeAccess={(targetOrgId) => handleRevokeAccess(user.id, user.email, targetOrgId)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <AddAtlasUserModal
            organizations={organizations}
            canOrgAddUser={canOrgAddUser}
            getOrgLicenseLimits={getOrgLicenseLimits}
            onClose={() => setShowAddModal(false)}
            onSave={handleAddUser}
            accentColor={accentColor}
          />
        )}
      </div>
    );
  }

  // Render for org_admin role (single organization)
  const maps = getOrgMaps(orgId);
  const orgAtlasUsers = users.filter(user => hasAtlasAccess(user, orgId));
  const orgFilteredUsers = filteredUsers;
  const licenseCheck = canOrgAddUser(orgId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Atlas Users</h2>
          <p className="text-slate-500 text-sm">
            Manage user access to Atlas for {orgData?.name}.
            <span className="ml-2 text-slate-400">({orgAtlasUsers.length} users with access)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button 
            onClick={() => {
              if (!licenseCheck.allowed) {
                const limits = getOrgLicenseLimits(orgId);
                addToast(
                  `Cannot add user: ${limits?.label || 'Professional'} license limit reached (${limits?.maxUsers || 3} users max).`,
                  'error'
                );
                return;
              }
              setShowAddModal(true);
            }}
            disabled={!licenseCheck.allowed}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-colors ${
              !licenseCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: accentColor }}
          >
            {!licenseCheck.allowed && <Lock className="w-4 h-4" />}
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* License Info Banner */}
      <LicenseInfoBanner targetOrgId={orgId} />

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
            style={{ '--tw-ring-color': accentColor }}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyAtlasUsers}
            onChange={(e) => setShowOnlyAtlasUsers(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
            style={{ accentColor }}
          />
          Atlas users only
        </label>
      </div>

      {/* Info about Atlas access */}
      {maps.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">About Atlas Access</p>
            <p className="mt-1">
              Users with Atlas access can view all {maps.length} configured map{maps.length !== 1 ? 's' : ''} 
              for your organization. Access is separate from Notify subscriptions.
            </p>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : orgFilteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No users found.</p>
            {showOnlyAtlasUsers && (
              <button
                onClick={() => setShowOnlyAtlasUsers(false)}
                className="text-sm mt-2 hover:underline"
                style={{ color: accentColor }}
              >
                Show all users to grant access
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Granted</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgFilteredUsers.map(user => {
                const access = getAtlasAccessDetails(user, orgId);
                const hasAccess = hasAtlasAccess(user, orgId);
                
                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-800">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {hasAccess ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                          <X className="w-3 h-3" /> No Access
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {access?.grantedAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {access.grantedAt.toDate?.().toLocaleDateString() || 'Unknown'}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasAccess ? (
                        <button
                          onClick={() => handleRevokeAccess(user.id, user.email, orgId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <UserMinus className="w-4 h-4" /> Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGrantAccess(user.id, user.email, orgId)}
                          disabled={!licenseCheck.allowed}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${
                            !licenseCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          style={{ backgroundColor: accentColor }}
                          title={!licenseCheck.allowed ? 'User limit reached' : 'Grant Atlas access'}
                        >
                          {!licenseCheck.allowed && <Lock className="w-3 h-3" />}
                          <UserPlus className="w-4 h-4" /> Grant Access
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddAtlasUserModal
          organizations={[{ id: orgId, name: orgData?.name }]}
          defaultOrg={orgId}
          canOrgAddUser={canOrgAddUser}
          getOrgLicenseLimits={getOrgLicenseLimits}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddUser}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

// --- User Row for Admin View ---
function UserRowAdmin({ user, organizations, filterOrg, accentColor, canOrgAddUser, onGrantAccess, onRevokeAccess }) {
  const [expanded, setExpanded] = useState(false);
  
  // Get orgs this user has access to
  const userOrgAccess = organizations.filter(org => 
    user.atlasAccess?.[org.id]?.enabled === true
  );

  if (filterOrg !== 'all') {
    // Show single org view
    const hasAccess = user.atlasAccess?.[filterOrg]?.enabled === true;
    const access = user.atlasAccess?.[filterOrg];
    const canAdd = canOrgAddUser(filterOrg);
    
    return (
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-800">{user.email}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {hasAccess ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <Check className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="text-xs text-slate-400">No access</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {hasAccess ? (
            <button
              onClick={() => onRevokeAccess(filterOrg)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <UserMinus className="w-4 h-4" /> Revoke
            </button>
          ) : (
            <button
              onClick={() => onGrantAccess(filterOrg)}
              disabled={!canAdd.allowed}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${
                !canAdd.allowed ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ backgroundColor: accentColor }}
              title={!canAdd.allowed ? 'User limit reached' : 'Grant access'}
            >
              {!canAdd.allowed && <Lock className="w-3 h-3" />}
              <UserPlus className="w-4 h-4" /> Grant
            </button>
          )}
        </td>
      </tr>
    );
  }

  // Multi-org view
  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-800">{user.email}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {userOrgAccess.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {userOrgAccess.slice(0, 3).map(org => (
                <span key={org.id} className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                  {org.name || org.id}
                </span>
              ))}
              {userOrgAccess.length > 3 && (
                <span className="text-xs text-slate-500">+{userOrgAccess.length - 3} more</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">No access</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button className="text-slate-400 hover:text-slate-600">
            {expanded ? '▼' : '▶'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan="3" className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {organizations.map(org => {
                const hasAccess = user.atlasAccess?.[org.id]?.enabled === true;
                const canAdd = canOrgAddUser(org.id);
                return (
                  <div key={org.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                    <span className="text-sm text-slate-700 truncate">{org.name}</span>
                    {hasAccess ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRevokeAccess(org.id); }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Revoke access"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); onGrantAccess(org.id); }}
                        disabled={!canAdd.allowed}
                        className={`p-1 hover:bg-slate-100 rounded ${!canAdd.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                        style={{ color: canAdd.allowed ? accentColor : undefined }}
                        title={canAdd.allowed ? 'Grant access' : 'User limit reached'}
                      >
                        {!canAdd.allowed ? <Lock className="w-4 h-4 text-slate-400" /> : <UserPlus className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- Add Atlas User Modal ---
function AddAtlasUserModal({ organizations, defaultOrg, canOrgAddUser, getOrgLicenseLimits, onClose, onSave, accentColor }) {
  const [email, setEmail] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(defaultOrg || '');
  const [saving, setSaving] = useState(false);

  const licenseCheck = selectedOrg ? canOrgAddUser(selectedOrg) : { allowed: true };
  const limits = selectedOrg ? getOrgLicenseLimits(selectedOrg) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !selectedOrg) return;
    
    if (!licenseCheck.allowed) {
      return; // Button should be disabled, but double-check
    }
    
    setSaving(true);
    await onSave(email, selectedOrg);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Add Atlas User</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor }}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              If this user already exists, Atlas access will be granted to their existing account.
            </p>
          </div>

          {organizations.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': accentColor }}
                required
              >
                <option value="">Select organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name || org.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* License limit warning */}
          {selectedOrg && !licenseCheck.allowed && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">User Limit Reached</p>
                <p className="text-xs mt-1">
                  This organization's {limits?.label || 'Professional'} license allows a maximum of {limits?.maxUsers || 3} users.
                  Contact your administrator to upgrade to Organization license.
                </p>
              </div>
            </div>
          )}

          {/* License info */}
          {selectedOrg && licenseCheck.allowed && limits && (
            <div className={`rounded-lg p-3 flex items-start gap-2 ${
              limits.type === LICENSE_TYPES.PROFESSIONAL 
                ? 'bg-blue-50 border border-blue-200' 
                : 'bg-emerald-50 border border-emerald-200'
            }`}>
              <Shield className={`w-4 h-4 shrink-0 mt-0.5 ${
                limits.type === LICENSE_TYPES.PROFESSIONAL ? 'text-blue-600' : 'text-emerald-600'
              }`} />
              <div className={`text-sm ${
                limits.type === LICENSE_TYPES.PROFESSIONAL ? 'text-blue-800' : 'text-emerald-800'
              }`}>
                <p className="font-medium">{limits.label} License</p>
                {licenseCheck.remaining !== null && (
                  <p className="text-xs mt-1">
                    {licenseCheck.remaining} user slot{licenseCheck.remaining !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !email || !selectedOrg || !licenseCheck.allowed}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
