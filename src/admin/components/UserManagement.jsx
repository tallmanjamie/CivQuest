// src/admin/components/UserManagement.jsx
// User/Subscriber Management for Notify module
// Supports both super admin (all orgs) and org admin (single org) views
//
// LICENSE ENFORCEMENT: Enforces user limits based on organization license type
// - Personal: Max 3 subscribers per organization
// - Professional: Unlimited subscribers
//
// A "subscriber" counts toward an org's limit if they have ANY active subscription
// to any notification in that organization.

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import {
  Users,
  Search,
  Edit2,
  UserPlus,
  Check,
  X,
  Ban,
  UserCheck,
  Mail,
  Bell,
  Building2,
  Lock,
  ChevronDown,
  Save,
  Loader2,
  AlertTriangle,
  Shield,
  AlertCircle
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';
import { 
  canAddNotifyUser, 
  getProductLicenseLimits, 
  PRODUCTS,
  LICENSE_TYPES 
} from '../../shared/services/licenses';

/**
 * UserManagementPanel Component
 * 
 * Manages Notify subscribers for organizations.
 * Supports both super admin view (all orgs) and org admin view (single org).
 * 
 * Props:
 * - db: Firestore instance
 * - role: 'admin' (super) or 'org_admin'
 * - orgId: Organization ID (required for org_admin)
 * - orgData: Organization data (required for org_admin)
 * - accentColor: UI accent color
 * - addToast: Toast notification function
 * - confirm: Confirmation dialog function
 */
export default function UserManagementPanel({ 
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
  const [availableOptions, setAvailableOptions] = useState([]);
  const [optionsMap, setOptionsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
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
        console.error("[UserManagement] Error loading users:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db]);

  // Load organizations and notifications for super admin
  useEffect(() => {
    if (role !== 'admin') {
      if (orgData) {
        setOrganizations([{ id: orgId, ...orgData }]);
        buildOptionsFromOrg(orgId, orgData);
      }
      return;
    }

    const fetchOrgs = async () => {
      try {
        const snapshot = await getDocs(collection(db, PATHS.organizations));
        const orgs = [];
        const options = [];
        const map = {};

        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          orgs.push({ id: docSnap.id, ...data });
          
          // Build notification options
          if (data.notifications && Array.isArray(data.notifications)) {
            data.notifications.forEach(notif => {
              const key = `${docSnap.id}_${notif.id}`;
              const obj = { 
                key, 
                label: notif.name, 
                organization: data.name, 
                access: notif.access || 'public', 
                paused: notif.paused || false, 
                orgId: docSnap.id, 
                notifId: notif.id 
              };
              options.push(obj);
              map[key] = obj;
            });
          }
        });

        setOrganizations(orgs);
        setAvailableOptions(options);
        setOptionsMap(map);
      } catch (e) {
        console.error("Error fetching organizations:", e);
      }
    };

    fetchOrgs();
  }, [db, role, orgId, orgData]);

  // Build options from single org (for org admin)
  const buildOptionsFromOrg = (targetOrgId, data) => {
    const options = [];
    const map = {};

    if (data.notifications && Array.isArray(data.notifications)) {
      data.notifications.forEach(notif => {
        const key = `${targetOrgId}_${notif.id}`;
        const obj = { 
          key, 
          label: notif.name, 
          organization: data.name, 
          access: notif.access || 'public', 
          paused: notif.paused || false, 
          orgId: targetOrgId, 
          notifId: notif.id 
        };
        options.push(obj);
        map[key] = obj;
      });
    }

    setAvailableOptions(options);
    setOptionsMap(map);
  };

  // ============================================================
  // LICENSE ENFORCEMENT HELPERS
  // ============================================================

  /**
   * Check if a user has any active subscription to an organization
   */
  const userHasOrgSubscription = (user, targetOrgId) => {
    if (!user.subscriptions) return false;
    return Object.entries(user.subscriptions).some(([key, value]) => 
      key.startsWith(`${targetOrgId}_`) && value === true
    );
  };

  /**
   * Count unique users with active subscriptions to an organization
   */
  const countOrgSubscribers = (targetOrgId) => {
    return users.filter(user => userHasOrgSubscription(user, targetOrgId)).length;
  };

  /**
   * Get organization data by ID
   */
  const getOrgById = (targetOrgId) => {
    return organizations.find(o => o.id === targetOrgId) || null;
  };

  /**
   * Check if an organization can add more subscribers
   */
  const canOrgAddSubscriber = (targetOrgId) => {
    const org = getOrgById(targetOrgId);
    if (!org) return { allowed: false, reason: 'Organization not found' };
    
    const currentCount = countOrgSubscribers(targetOrgId);
    const result = canAddNotifyUser(org, currentCount);
    
    return {
      allowed: result.allowed,
      limit: result.limit,
      current: currentCount,
      remaining: result.remaining,
      licenseType: result.licenseType,
      reason: result.allowed
        ? null
        : `${result.licenseType === LICENSE_TYPES.PILOT ? 'Pilot' : 'Production'} license limit reached (${result.limit} subscribers max)`
    };
  };

  /**
   * Check if adding subscriptions would violate any org's license limit
   */
  const validateSubscriptionChanges = (currentSubs, newSubs, userEmail) => {
    const violations = [];
    
    // Find which orgs are gaining a NEW subscriber
    const currentOrgSubs = new Set();
    const newOrgSubs = new Set();
    
    // Get orgs user currently has active subs to
    Object.entries(currentSubs || {}).forEach(([key, value]) => {
      if (value === true) {
        const orgId = key.split('_')[0];
        currentOrgSubs.add(orgId);
      }
    });
    
    // Get orgs user will have active subs to after changes
    Object.entries(newSubs || {}).forEach(([key, value]) => {
      if (value === true) {
        const orgId = key.split('_')[0];
        newOrgSubs.add(orgId);
      }
    });
    
    // Check each org that's gaining a subscriber
    newOrgSubs.forEach(targetOrgId => {
      if (!currentOrgSubs.has(targetOrgId)) {
        const check = canOrgAddSubscriber(targetOrgId);
        if (!check.allowed) {
          const org = getOrgById(targetOrgId);
          violations.push({
            orgId: targetOrgId,
            orgName: org?.name || targetOrgId,
            reason: check.reason,
            limit: check.limit,
            current: check.current
          });
        }
      }
    });

    return {
      allowed: violations.length === 0,
      violations
    };
  };

  // Filter users based on search and org filter
  const filteredUsers = useMemo(() => {
    let result = users;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user => 
        user.email?.toLowerCase().includes(term)
      );
    }

    // Org filter (for super admin)
    if (role === 'admin' && filterOrg !== 'all') {
      result = result.filter(user => userHasOrgSubscription(user, filterOrg));
    }

    // For org admin, only show users with subscriptions to their org
    if (role === 'org_admin' && orgId) {
      result = result.filter(user => userHasOrgSubscription(user, orgId));
    }

    return result;
  }, [users, searchTerm, filterOrg, role, orgId]);

  // Get license info for display
  const getLicenseInfo = (targetOrgId) => {
    const org = getOrgById(targetOrgId);
    if (!org) return null;
    
    const limits = getProductLicenseLimits(org, PRODUCTS.NOTIFY);
    const currentCount = countOrgSubscribers(targetOrgId);
    
    return {
      ...limits,
      current: currentCount,
      remaining: limits.maxUsers === Infinity ? null : Math.max(0, limits.maxUsers - currentCount)
    };
  };

  // Add new user
  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      addToast?.('Please enter an email address', 'error');
      return;
    }

    const email = newUserEmail.trim().toLowerCase();
    
    // Check if user already exists
    const existingUser = users.find(u => u.email?.toLowerCase() === email);
    if (existingUser) {
      addToast?.('User already exists. Edit their subscriptions instead.', 'warning');
      setShowAddUser(false);
      setEditingUser(existingUser);
      return;
    }

    setSaving(true);
    try {
      // Create new user document
      const userRef = doc(collection(db, PATHS.users));
      await setDoc(userRef, {
        email,
        createdAt: serverTimestamp(),
        subscriptions: {}
      });

      addToast?.(`User ${email} added successfully`, 'success');
      setNewUserEmail('');
      setShowAddUser(false);
    } catch (error) {
      console.error('[UserManagement] Add user error:', error);
      addToast?.('Failed to add user. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save user subscriptions
  const handleSaveSubscriptions = async (userId, newSubscriptions) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Validate license limits
    const validation = validateSubscriptionChanges(user.subscriptions, newSubscriptions, user.email);

    if (!validation.allowed) {
      const violationList = validation.violations
        .map(v => `• ${v.orgName}: ${v.reason}`)
        .join('\n');

      addToast?.(`Cannot save: License limits exceeded\n${violationList}`, 'error');
      return false;
    }

    setSaving(true);
    try {
      const userRef = doc(db, PATHS.users, userId);
      await updateDoc(userRef, {
        subscriptions: newSubscriptions,
        updatedAt: serverTimestamp()
      });

      // Also sync org-specific notifySubscribers subcollections for org admin access
      await syncNotifySubscribers(userId, user.email, user.subscriptions || {}, newSubscriptions);

      addToast?.('Subscriptions updated successfully', 'success');
      setEditingUser(null);
      return true;
    } catch (error) {
      console.error('[UserManagement] Save error:', error);
      addToast?.('Failed to save changes. Please try again.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Sync notifySubscribers subcollections for all affected orgs
  const syncNotifySubscribers = async (userId, userEmail, oldSubscriptions, newSubscriptions) => {
    // Find all affected orgs (orgs that have subscription changes)
    const allKeys = new Set([...Object.keys(oldSubscriptions || {}), ...Object.keys(newSubscriptions || {})]);
    const affectedOrgs = new Set();

    allKeys.forEach(key => {
      const orgId = key.split('_')[0];
      if (orgId) affectedOrgs.add(orgId);
    });

    // Update each affected org's notifySubscribers subcollection
    for (const orgId of affectedOrgs) {
      try {
        // Get subscriptions for this org
        const orgSubscriptions = {};
        Object.entries(newSubscriptions || {}).forEach(([key, value]) => {
          if (key.startsWith(`${orgId}_`)) {
            orgSubscriptions[key] = value;
          }
        });

        const hasActiveSubscription = Object.values(orgSubscriptions).some(v => v === true);
        const subscriberRef = doc(db, PATHS.notifySubscriber(orgId, userId));
        const subscriberSnap = await getDoc(subscriberRef);

        if (hasActiveSubscription) {
          if (subscriberSnap.exists()) {
            await updateDoc(subscriberRef, {
              subscriptions: orgSubscriptions,
              updatedAt: serverTimestamp()
            });
          } else {
            await setDoc(subscriberRef, {
              uid: userId,
              email: userEmail,
              subscriptions: orgSubscriptions,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } else if (subscriberSnap.exists()) {
          // No active subscriptions - remove from org's subscriber list
          await deleteDoc(subscriberRef);
        }
      } catch (err) {
        console.warn(`Failed to sync notifySubscribers for org ${orgId}:`, err);
        // Continue with other orgs even if one fails
      }
    }
  };

  // Suspend user
  const handleSuspendUser = async (user) => {
    confirm?.({
      title: 'Suspend User',
      message: `Are you sure you want to suspend ${user.email}? They will not be able to access Notify until unsuspended.`,
      confirmLabel: 'Suspend',
      destructive: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          const userRef = doc(db, PATHS.users, user.id);
          await updateDoc(userRef, {
            suspended: true,
            suspendedAt: serverTimestamp(),
            suspendReason: 'Suspended by admin'
          });
          addToast?.(`User ${user.email} has been suspended`, 'success');
        } catch (error) {
          console.error('[UserManagement] Suspend error:', error);
          addToast?.('Failed to suspend user', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  // Unsuspend user
  const handleUnsuspendUser = async (user) => {
    setSaving(true);
    try {
      const userRef = doc(db, PATHS.users, user.id);
      await updateDoc(userRef, {
        suspended: false,
        suspendedAt: null,
        suspendReason: null,
        unsuspendedAt: serverTimestamp()
      });
      addToast?.(`User ${user.email} has been unsuspended`, 'success');
    } catch (error) {
      console.error('[UserManagement] Unsuspend error:', error);
      addToast?.('Failed to unsuspend user', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Get active subscription count for a user
  const getUserSubCount = (user) => {
    if (!user.subscriptions) return 0;
    return Object.values(user.subscriptions).filter(v => v === true).length;
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
            Subscribers
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {role === 'admin' 
              ? 'Manage notification subscribers across all organizations'
              : 'Manage subscribers for your notifications'}
          </p>
        </div>

        {/* License Badge for Org Admin */}
        {orgLicenseInfo && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            orgLicenseInfo.type === LICENSE_TYPES.PRODUCTION
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
          <div className="relative">
            <select
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': accentColor }}
            >
              <option value="all">All Organizations</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name || org.id}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Add User Button */}
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium text-sm transition"
          style={{ backgroundColor: accentColor }}
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add New User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-opacity-50"
                  style={{ '--tw-ring-color': accentColor }}
                />
              </div>

              {/* License limit warning */}
              {orgLicenseInfo && orgLicenseInfo.remaining !== null && orgLicenseInfo.remaining <= 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <strong>License limit reached.</strong> Your {orgLicenseInfo.label} license allows {orgLicenseInfo.maxUsers} users. 
                    Contact your administrator to upgrade.
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddUser(false); setNewUserEmail(''); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={saving || !newUserEmail.trim()}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Add User
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
                  User
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Subscriptions
                </th>
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
                  const isSuspended = user.suspended === true;
                  // Get display name - prefer firstName/lastName, then email
                  const displayName = (user.firstName || user.lastName)
                    ? [user.firstName, user.lastName].filter(Boolean).join(' ')
                    : null;
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
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                          <Bell className="w-3 h-3" />
                          {getUserSubCount(user)} active
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                            <Ban className="w-3 h-3" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            title="Edit subscriptions"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {isSuspended ? (
                            <button
                              onClick={() => handleUnsuspendUser(user)}
                              disabled={saving}
                              className="flex items-center gap-1 px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded text-xs disabled:opacity-50"
                              title="Unsuspend user"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspendUser(user)}
                              disabled={saving}
                              className="flex items-center gap-1 px-2 py-1 text-amber-600 hover:bg-amber-50 rounded text-xs disabled:opacity-50"
                              title="Suspend user"
                            >
                              <Ban className="w-4 h-4" />
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

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          availableOptions={availableOptions}
          optionsMap={optionsMap}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveSubscriptions}
          saving={saving}
          accentColor={accentColor}
          validateChanges={validateSubscriptionChanges}
          role={role}
          orgId={orgId}
        />
      )}
    </div>
  );
}

/**
 * User Edit Modal Component
 */
function UserEditModal({
  user,
  availableOptions,
  optionsMap,
  onClose,
  onSave,
  saving,
  accentColor,
  validateChanges,
  role,
  orgId
}) {
  const [subscriptions, setSubscriptions] = useState({ ...user.subscriptions });
  const [validationError, setValidationError] = useState(null);

  // Filter options for org admin
  const filteredOptions = role === 'org_admin' && orgId
    ? availableOptions.filter(opt => opt.orgId === orgId)
    : availableOptions;

  // Group options by organization
  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    if (!acc[opt.organization]) {
      acc[opt.organization] = [];
    }
    acc[opt.organization].push(opt);
    return acc;
  }, {});

  // Toggle subscription
  const toggleSubscription = (key) => {
    const newSubs = { ...subscriptions, [key]: !subscriptions[key] };
    setSubscriptions(newSubs);
    
    // Validate
    const validation = validateChanges(user.subscriptions, newSubs, user.email);
    if (!validation.allowed) {
      setValidationError(validation.violations[0]?.reason || 'License limit exceeded');
    } else {
      setValidationError(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    const success = await onSave(user.id, subscriptions);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">Edit Subscriptions</h3>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {validationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{validationError}</span>
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(groupedOptions).map(([orgName, options]) => (
              <div key={orgName}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-semibold text-slate-700">{orgName}</h4>
                </div>
                <div className="space-y-2 ml-6">
                  {options.map(opt => (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition
                        ${subscriptions[opt.key] 
                          ? 'bg-emerald-50 border border-emerald-200' 
                          : 'hover:bg-slate-50 border border-transparent'}`}
                    >
                      <input
                        type="checkbox"
                        checked={!!subscriptions[opt.key]}
                        onChange={() => toggleSubscription(opt.key)}
                        className="w-4 h-4 rounded border-slate-300"
                        style={{ accentColor }}
                      />
                      <div className="flex-1">
                        <span className="text-sm text-slate-700">{opt.label}</span>
                        {opt.access === 'private' && (
                          <Lock className="inline w-3 h-3 ml-1 text-slate-400" />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || validationError}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
