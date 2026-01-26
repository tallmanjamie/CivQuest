// src/admin/components/AtlasUserManagement.jsx
// Atlas User Management - Manage user access to Atlas maps
// Uses the same user store as Notify but tracks Atlas access separately

import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

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

  // Grant Atlas access
  const handleGrantAccess = async (userId, userEmail, targetOrgId, mapIds = null) => {
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

  // Add new user with Atlas access
  const handleAddUser = async (email, targetOrgId, mapIds = null) => {
    try {
      // Check if user already exists
      const usersRef = collection(db, PATHS.users);
      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
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
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
          >
            <option value="all">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
            style={{ backgroundColor: accentColor }}
          >
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

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
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg transition-colors"
                          style={{ backgroundColor: accentColor }}
                        >
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
          onClose={() => setShowAddModal(false)}
          onSave={handleAddUser}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

// --- User Row for Admin View ---
function UserRowAdmin({ user, organizations, filterOrg, accentColor, onGrantAccess, onRevokeAccess }) {
  const [expanded, setExpanded] = useState(false);
  
  // Get orgs this user has access to
  const userOrgAccess = organizations.filter(org => 
    user.atlasAccess?.[org.id]?.enabled === true
  );

  if (filterOrg !== 'all') {
    // Show single org view
    const hasAccess = user.atlasAccess?.[filterOrg]?.enabled === true;
    const access = user.atlasAccess?.[filterOrg];
    
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
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
              <X className="w-3 h-3" /> No Access
            </span>
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
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg transition-colors"
              style={{ backgroundColor: accentColor }}
            >
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
          <div className="flex flex-wrap gap-1">
            {userOrgAccess.length > 0 ? (
              userOrgAccess.slice(0, 3).map(org => (
                <span key={org.id} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                  {org.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">No Atlas access</span>
            )}
            {userOrgAccess.length > 3 && (
              <span className="text-xs text-slate-500">+{userOrgAccess.length - 3} more</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <button className="text-sm text-slate-500 hover:text-slate-700">
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3} className="px-4 py-3 bg-slate-50">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {organizations.map(org => {
                const hasAccess = user.atlasAccess?.[org.id]?.enabled === true;
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
                        className="p-1 hover:bg-slate-100 rounded"
                        style={{ color: accentColor }}
                        title="Grant access"
                      >
                        <UserPlus className="w-4 h-4" />
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
function AddAtlasUserModal({ organizations, defaultOrg, onClose, onSave, accentColor }) {
  const [email, setEmail] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(defaultOrg || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !selectedOrg) return;
    
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
                required
              >
                <option value="">Select organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !email || !selectedOrg}
              className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Grant Atlas Access
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
