// src/admin/components/UserManagement.jsx
// User/Subscriber Management for Notify module
// Supports both super admin (all orgs) and org admin (single org) views
//
// LICENSE ENFORCEMENT: Enforces user limits based on organization license type
// - Professional: Max 3 subscribers per organization
// - Organization: Unlimited subscribers
//
// A "subscriber" counts toward an org's limit if they have ANY active subscription
// to any notification in that organization.

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { 
  Users, 
  Search, 
  Edit2, 
  Trash2,
  UserPlus,
  Send,
  Check,
  X,
  Plus,
  Ban,
  Clock,
  Mail,
  Bell,
  Building2,
  Lock,
  ChevronDown,
  Save,
  Loader2,
  AlertTriangle,
  Shield
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
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {object} auth - Firebase auth instance
 * @param {string} role - 'admin' | 'org_admin'
 * @param {string} [orgId] - Required for 'org_admin' role
 * @param {object} [orgData] - Organization data (for org_admin)
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color
 */
export default function UserManagementPanel({ 
  db, 
  auth,
  role = 'admin',
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor = '#004E7C'
}) {
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [availableOptions, setAvailableOptions] = useState([]);
  const [optionsMap, setOptionsMap] = useState({});

  // Filter states
  const [organizations, setOrganizations] = useState([]);
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterNotification, setFilterNotification] = useState('all');

  // Fetch users with real-time listener
  useEffect(() => {
    setLoading(true);
    const unsubUsers = onSnapshot(collection(db, PATHS.users), (snapshot) => {
      const allUsers = snapshot.docs.map(docSnap => ({
        uid: docSnap.id,
        isRegistered: true,
        ...docSnap.data()
      }));
      setUsers(allUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubUsers();
  }, [db]);

  // Fetch invites with real-time listener
  useEffect(() => {
    const unsubInvites = onSnapshot(collection(db, PATHS.invitations), (snapshot) => {
      const allInvites = snapshot.docs.map(docSnap => ({
        uid: docSnap.id, 
        isRegistered: false,
        isInvite: true,
        ...docSnap.data()
      }));
      setInvites(allInvites);
    }, (error) => {
      console.error("Error fetching invites:", error);
    });

    return () => unsubInvites();
  }, [db]);

  // Fetch notification configs and organizations
  useEffect(() => {
    if (role === 'org_admin' && orgData?.notifications) {
      // For org admin, use org-specific notifications
      const options = [];
      const map = {};
      
      orgData.notifications.forEach(notif => {
        const key = `${orgId}_${notif.id}`;
        const obj = { 
          key, 
          label: notif.name, 
          organization: orgData.name, 
          access: notif.access || 'public', 
          paused: notif.paused || false, 
          orgId, 
          notifId: notif.id 
        };
        options.push(obj);
        map[key] = obj;
      });
      
      setAvailableOptions(options);
      setOptionsMap(map);
      setOrganizations([{ id: orgId, ...orgData }]);
    } else if (role === 'admin') {
      // For admin, fetch all organizations
      fetchAllConfigs();
    }
  }, [role, orgId, orgData]);

  const fetchAllConfigs = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, PATHS.organizations));
      const options = [];
      const map = {};
      const orgs = [];
      
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        orgs.push({ id: docSnap.id, name: data.name, ...data });
        if (data.notifications) {
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
      console.error("Error fetching configs for options", e);
    }
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
        : `${result.licenseType === LICENSE_TYPES.PROFESSIONAL ? 'Professional' : 'Organization'} license limit reached (${result.limit} subscribers max)`
    };
  };

  /**
   * Check if adding subscriptions would violate any org's license limit
   * @param {object} currentSubs - Current subscriptions
   * @param {object} newSubs - New subscriptions to apply
   * @param {string} userEmail - User's email for checking existing subscriptions
   * @returns {object} { allowed: boolean, violations: array }
   */
  const validateSubscriptionChanges = (currentSubs, newSubs, userEmail) => {
    const violations = [];
    
    // Find which orgs are gaining a NEW subscriber (user didn't have subs before, now does)
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
        // This org is gaining a new subscriber - check limit
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

  // ============================================================
  // END LICENSE ENFORCEMENT HELPERS
  // ============================================================

  // Combine users and invites into a single list
  const combinedList = useMemo(() => {
    let filteredUsersList = users;
    let filteredInvitesList = invites;
    
    // For org_admin, filter to only users with subscriptions to this org
    if (role === 'org_admin' && orgId) {
      filteredUsersList = users.filter(user => userHasOrgSubscription(user, orgId));
      filteredInvitesList = invites.filter(inv => inv.orgId === orgId);
    }
    
    const map = new Map();
    filteredUsersList.forEach(u => {
      if(u.email) map.set(u.email.toLowerCase(), u);
      else map.set(u.uid, u);
    });
    filteredInvitesList.forEach(inv => {
      const email = inv.email.toLowerCase();
      if (!map.has(email)) {
        map.set(email, inv);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users, invites, role, orgId]);

  // Get filtered notification options based on selected org (for admin)
  const filteredNotificationOptions = useMemo(() => {
    if (role === 'org_admin') {
      return availableOptions;
    }
    if (filterOrg === 'all') {
      return availableOptions;
    }
    return availableOptions.filter(opt => opt.orgId === filterOrg);
  }, [role, filterOrg, availableOptions]);

  // Reset notification filter when org filter changes
  useEffect(() => {
    if (role === 'admin') {
      setFilterNotification('all');
    }
  }, [filterOrg, role]);

  // Handle save subscriptions WITH LICENSE CHECK
  const handleSaveSubscriptions = async (userId, newSubs, userEmail, currentSubs) => {
    // Validate against license limits
    const validation = validateSubscriptionChanges(currentSubs, newSubs, userEmail);
    
    if (!validation.allowed) {
      const violationMessages = validation.violations.map(v => 
        `${v.orgName}: ${v.reason}`
      ).join('\n');
      addToast(`Cannot save: License limit exceeded\n${violationMessages}`, 'error');
      return false;
    }

    try {
      const userRef = doc(db, PATHS.users, userId);
      await updateDoc(userRef, { subscriptions: newSubs });
      setEditingUser(null);
      addToast("Subscriptions updated", "success");
      return true;
    } catch (error) {
      console.error("Failed to save:", error);
      addToast("Failed to save changes", "error");
      return false;
    }
  };

  // Handle send invite WITH LICENSE CHECK
  const handleSendInvite = async (data) => {
    // Check license limits for each org being subscribed to
    const orgIds = new Set();
    Object.entries(data.subscriptions).forEach(([key, value]) => {
      if (value === true) {
        orgIds.add(key.split('_')[0]);
      }
    });

    // Validate each org
    const violations = [];
    orgIds.forEach(targetOrgId => {
      // Check if this user already has subscriptions to this org
      const existingUser = users.find(u => u.email?.toLowerCase() === data.email.toLowerCase());
      const alreadySubscribed = existingUser && userHasOrgSubscription(existingUser, targetOrgId);
      
      if (!alreadySubscribed) {
        const check = canOrgAddSubscriber(targetOrgId);
        if (!check.allowed) {
          const org = getOrgById(targetOrgId);
          violations.push({
            orgId: targetOrgId,
            orgName: org?.name || targetOrgId,
            reason: check.reason
          });
        }
      }
    });

    if (violations.length > 0) {
      const msg = violations.map(v => `${v.orgName}: ${v.reason}`).join('\n');
      addToast(`Cannot send invite: License limit exceeded\n${msg}`, 'error');
      return;
    }

    try {
      const inviteRef = doc(db, PATHS.invitations, data.email.toLowerCase());
      await setDoc(inviteRef, {
        email: data.email,
        subscriptions: data.subscriptions,
        orgId: data.orgId,
        orgName: data.orgName,
        notifName: data.notifName,
        notifCount: data.notifCount || 1,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setShowInviteModal(false);
      addToast(`Invitation queued for ${data.email} (${data.notifCount} feed${data.notifCount !== 1 ? 's' : ''})`, "success");
    } catch (error) {
      console.error("Failed to create invite:", error);
      addToast("Failed to create invitation", "error");
    }
  };

  const initiateToggleStatus = (user) => {
    const type = user.disabled ? 'enable' : 'disable';
    
    confirm({
      title: user.disabled ? 'Enable Account' : 'Disable Account',
      message: `Are you sure you want to ${type} ${user.email}? ${type === 'disable' ? 'This will pause all notifications.' : ''}`,
      destructive: type === 'disable',
      confirmLabel: user.disabled ? 'Enable' : 'Disable',
      onConfirm: async () => {
        try {
          const userRef = doc(db, PATHS.users, user.uid);
          if (type === 'disable') {
            await updateDoc(userRef, { disabled: true, subscriptions: {} });
          } else {
            await updateDoc(userRef, { disabled: false });
          }
          addToast(`User ${type}d successfully`, "success");
        } catch (err) {
          console.error(`Error toggling user:`, err);
          addToast(`Failed to update user`, "error");
        }
      }
    });
  };

  const resendInvite = async (invite) => {
    addToast(`Resending invitation to ${invite.email}...`, "info");
    // In a real implementation, this would trigger an email
    setTimeout(() => {
      addToast(`Invitation resent to ${invite.email}`, "success");
    }, 1000);
  };

  const deleteInvite = (invite) => {
    confirm({
      title: 'Delete Invitation',
      message: `Are you sure you want to delete the invitation for ${invite.email}?`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, PATHS.invitations, invite.uid));
          addToast("Invitation deleted", "success");
        } catch (err) {
          addToast("Failed to delete invitation", "error");
        }
      }
    });
  };

  const filteredUsers = useMemo(() => {
    let result = combinedList;
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(u => 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.uid.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // For admin: filter by org if selected
    if (role === 'admin' && filterOrg !== 'all') {
      result = result.filter(u => {
        if (u.isInvite) return u.orgId === filterOrg;
        return userHasOrgSubscription(u, filterOrg);
      });
    }
    
    // Filter by notification if selected (both roles)
    if (filterNotification !== 'all') {
      result = result.filter(u => {
        if (u.isInvite) {
          return u.subscriptions && u.subscriptions[filterNotification] === true;
        }
        if (!u.subscriptions) return false;
        return u.subscriptions[filterNotification] === true;
      });
    }
    
    return result;
  }, [combinedList, searchTerm, role, filterOrg, filterNotification]);

  const formatDate = (value) => {
    if (!value) return 'N/A';
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return 'Invalid Date';
  };

  // Get org-specific subscriptions for org_admin view
  const getOrgSubscriptions = (user) => {
    if (role !== 'org_admin' || !user.subscriptions) return user.subscriptions || {};
    const orgSubs = {};
    Object.entries(user.subscriptions).forEach(([key, value]) => { 
      if (key.startsWith(`${orgId}_`)) orgSubs[key] = value; 
    });
    return orgSubs;
  };

  // Calculate valid keys for the audit (admin only)
  const validSubscriptionKeys = useMemo(() => {
    return new Set(availableOptions.map(o => o.key));
  }, [availableOptions]);

  // Get license info for current org (org_admin view)
  const currentOrgLicenseInfo = useMemo(() => {
    if (role !== 'org_admin' || !orgId) return null;
    const org = getOrgById(orgId);
    if (!org) return null;
    
    const limits = getProductLicenseLimits(org, PRODUCTS.NOTIFY);
    const currentCount = countOrgSubscribers(orgId);
    
    return {
      ...limits,
      current: currentCount,
      remaining: limits.maxUsers === Infinity ? Infinity : limits.maxUsers - currentCount
    };
  }, [role, orgId, organizations, users]);

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {role === 'admin' ? 'All Subscribers' : 'Subscribers'}
          </h2>
          <p className="text-slate-500 text-sm">
            {role === 'admin' 
              ? 'Manage subscribers across all organizations.' 
              : `Manage subscribers for ${orgData?.name || 'your organization'}.`}
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
          style={{ backgroundColor: accentColor }}
        >
          <UserPlus className="w-4 h-4" /> Invite User
        </button>
      </div>

      {/* License Info Banner - Org Admin Only */}
      {role === 'org_admin' && currentOrgLicenseInfo && (
        <LicenseInfoBanner 
          licenseInfo={currentOrgLicenseInfo}
          accentColor={accentColor}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none"
            style={{ '--tw-ring-color': accentColor }}
          />
        </div>

        {/* Org Filter - Admin only */}
        {role === 'admin' && organizations.length > 0 && (
          <div className="relative">
            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={filterOrg}
              onChange={e => setFilterOrg(e.target.value)}
              className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm appearance-none bg-white focus:ring-2 outline-none min-w-[180px]"
              style={{ '--tw-ring-color': accentColor }}
            >
              <option value="all">All Organizations</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Notification Filter - Both roles */}
        {filteredNotificationOptions.length > 0 && (
          <div className="relative">
            <Bell className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={filterNotification}
              onChange={e => setFilterNotification(e.target.value)}
              className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm appearance-none bg-white focus:ring-2 outline-none min-w-[180px]"
              style={{ '--tw-ring-color': accentColor }}
            >
              <option value="all">All Notifications</option>
              {filteredNotificationOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {role === 'admin' && filterOrg === 'all' ? `${opt.organization} - ${opt.label}` : opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Clear Filters */}
        {(filterOrg !== 'all' || filterNotification !== 'all' || searchTerm) && (
          <button
            onClick={() => {
              setFilterOrg('all');
              setFilterNotification('all');
              setSearchTerm('');
            }}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Email / User ID</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Last Activity</th>
              <th className="px-6 py-3">{role === 'admin' ? 'Active Subscriptions' : 'Subscriptions'}</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading users...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                {role === 'admin' ? 'No users found.' : 'No subscribers found.'}
              </td></tr>
            ) : (
              filteredUsers.map(user => {
                const displaySubs = getOrgSubscriptions(user);
                return (
                  <tr key={user.uid} className={`hover:bg-slate-50 transition-colors ${user.disabled ? 'bg-red-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{user.email || "No Email"}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{user.uid}</div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isInvite ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700 uppercase">
                          <Mail className="w-3 h-3" /> Invited
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${user.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {user.disabled ? <Ban className="w-3 h-3"/> : <Check className="w-3 h-3"/>}
                          {user.disabled ? 'Disabled' : 'Active'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {user.isInvite ? formatDate(user.createdAt) : formatDate(user.lastLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isInvite ? (
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0"></span>
                          <span className="text-xs text-slate-700">
                            <strong>Invite:</strong> {role === 'admin' ? `${user.orgName || user.orgId} - ` : ''}{user.notifName || `${user.notifCount || 1} feed(s)`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(displaySubs).filter(([_, v]) => v).slice(0, 3).map(([key]) => {
                            const opt = optionsMap[key];
                            return (
                              <span key={key} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {opt ? (role === 'admin' ? `${opt.organization?.slice(0,3)}:${opt.label?.slice(0,8)}` : opt.label?.slice(0,12)) : key.slice(0,15)}
                              </span>
                            );
                          })}
                          {Object.values(displaySubs).filter(v => v).length > 3 && (
                            <span className="text-xs text-slate-400">+{Object.values(displaySubs).filter(v => v).length - 3} more</span>
                          )}
                          {Object.values(displaySubs).filter(v => v).length === 0 && (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.isInvite ? (
                          <>
                            <button 
                              onClick={() => resendInvite(user)}
                              className="font-medium text-xs flex items-center gap-1 hover:opacity-80"
                              style={{ color: accentColor }}
                              title="Resend Invitation Email"
                            >
                              <Send className="w-3 h-3" /> Resend
                            </button>
                            <button 
                              onClick={() => deleteInvite(user)}
                              className="text-red-500 hover:text-red-700 font-medium text-xs flex items-center gap-1"
                              title="Delete Invitation"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => setEditingUser(user)}
                              className="font-medium text-sm flex items-center gap-1 hover:opacity-80"
                              style={{ color: accentColor }}
                              title="Edit Subscriptions"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            
                            {/* Enable/Disable - Admin only */}
                            {role === 'admin' && (
                              <button 
                                onClick={() => initiateToggleStatus(user)}
                                className={`font-medium text-sm flex items-center gap-1 ${user.disabled ? 'text-green-600 hover:text-green-700' : 'text-red-400 hover:text-red-600'}`}
                                title={user.disabled ? "Enable User" : "Disable User"}
                              >
                                {user.disabled ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                            )}
                          </>
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

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal 
          user={editingUser} 
          availableOptions={availableOptions}
          organizations={organizations}
          users={users}
          role={role}
          orgId={orgId}
          db={db}
          addToast={addToast}
          confirm={confirm}
          accentColor={accentColor}
          onClose={() => setEditingUser(null)} 
          onSave={handleSaveSubscriptions}
          canOrgAddSubscriber={canOrgAddSubscriber}
          userHasOrgSubscription={userHasOrgSubscription}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal 
          availableOptions={availableOptions}
          organizations={organizations}
          users={users}
          role={role}
          accentColor={accentColor}
          onClose={() => setShowInviteModal(false)}
          onSend={handleSendInvite}
          canOrgAddSubscriber={canOrgAddSubscriber}
          userHasOrgSubscription={userHasOrgSubscription}
        />
      )}
    </div>
  );
}

// --- License Info Banner ---
function LicenseInfoBanner({ licenseInfo, accentColor }) {
  const isAtLimit = licenseInfo.remaining === 0;
  const isProfessional = licenseInfo.licenseType === LICENSE_TYPES.PROFESSIONAL;
  
  return (
    <div className={`rounded-xl p-4 border ${isAtLimit ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAtLimit ? 'bg-amber-100' : 'bg-slate-200'}`}>
            <Shield className={`w-5 h-5 ${isAtLimit ? 'text-amber-600' : 'text-slate-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{licenseInfo.label} License</span>
              {isAtLimit && (
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                  At Limit
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {licenseInfo.maxUsers === Infinity 
                ? `${licenseInfo.current} subscribers (unlimited)`
                : `${licenseInfo.current} / ${licenseInfo.maxUsers} subscribers`}
              {isProfessional && licenseInfo.remaining > 0 && ` • ${licenseInfo.remaining} remaining`}
            </p>
          </div>
        </div>
        
        {isAtLimit && isProfessional && (
          <div className="text-right">
            <p className="text-sm text-amber-700 font-medium">Upgrade for unlimited subscribers</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- User Edit Modal WITH LICENSE CHECKS ---
function UserEditModal({ 
  user, 
  availableOptions, 
  organizations,
  users,
  role, 
  orgId, 
  db, 
  addToast, 
  confirm, 
  accentColor, 
  onClose, 
  onSave,
  canOrgAddSubscriber,
  userHasOrgSubscription
}) {
  const [subs, setSubs] = useState(user.subscriptions || {});
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);

  // Group options by org for admin view
  const groupedOptions = availableOptions.reduce((acc, opt) => {
    if (!acc[opt.organization]) acc[opt.organization] = { orgId: opt.orgId, items: [] };
    acc[opt.organization].items.push(opt);
    return acc;
  }, {});

  // Check if toggling a subscription ON would violate license limits
  const canToggleOn = (subscriptionKey) => {
    const targetOrgId = subscriptionKey.split('_')[0];
    
    // If user already has active subscription to this org, they're already counted
    if (userHasOrgSubscription(user, targetOrgId)) {
      return { allowed: true };
    }
    
    // Check if org can add another subscriber
    return canOrgAddSubscriber(targetOrgId);
  };

  const toggleSub = (key) => {
    const currentlyOn = subs[key] === true;
    
    if (!currentlyOn) {
      // Turning ON - check license
      const check = canToggleOn(key);
      if (!check.allowed) {
        addToast(check.reason || 'License limit reached', 'error');
        return;
      }
    }
    
    setSubs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addManualSub = () => {
    if (!newKey) return;
    
    // Check license for manual key
    const check = canToggleOn(newKey);
    if (!check.allowed) {
      addToast(check.reason || 'License limit reached', 'error');
      return;
    }
    
    setSubs(prev => ({ ...prev, [newKey]: true }));
    setNewKey('');
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await onSave(user.uid, subs, user.email, user.subscriptions);
    setSaving(false);
    if (!success) {
      // Error was shown by onSave
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Edit Subscriptions</h3>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Subscriptions grouped by org */}
          <div className="space-y-4">
            {role === 'admin' ? (
              // Admin view: grouped by organization
              Object.entries(groupedOptions).map(([orgName, orgData]) => {
                const orgCheck = canOrgAddSubscriber(orgData.orgId);
                const userHasSub = userHasOrgSubscription(user, orgData.orgId);
                const isAtLimit = !orgCheck.allowed && !userHasSub;
                
                return (
                  <div key={orgName} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {orgName}
                      </span>
                      {isAtLimit && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" /> At Limit
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-slate-50">
                      {orgData.items.map(opt => {
                        const isOn = subs[opt.key] === true;
                        const canTurnOn = !isOn && canToggleOn(opt.key).allowed;
                        const disabled = !isOn && !canTurnOn;
                        
                        return (
                          <div 
                            key={opt.key}
                            className={`px-3 py-2 flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}
                          >
                            <span className="text-sm text-slate-600 flex items-center gap-2">
                              {opt.label}
                              {opt.access === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                            </span>
                            <button
                              onClick={() => !disabled && toggleSub(opt.key)}
                              disabled={disabled}
                              className={`relative w-9 h-5 rounded-full transition-colors ${isOn ? '' : disabled ? 'bg-slate-200 cursor-not-allowed' : 'bg-slate-300'}`}
                              style={{ backgroundColor: isOn ? accentColor : undefined }}
                            >
                              <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isOn ? 'translate-x-4' : ''}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              // Org admin view: flat list
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-50">
                {availableOptions.map(opt => {
                  const isOn = subs[opt.key] === true;
                  const canTurnOn = !isOn && canToggleOn(opt.key).allowed;
                  const disabled = !isOn && !canTurnOn;
                  
                  return (
                    <div 
                      key={opt.key}
                      className={`px-3 py-3 flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}
                    >
                      <div>
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          {opt.label}
                          {opt.access === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                        </span>
                      </div>
                      <button
                        onClick={() => !disabled && toggleSub(opt.key)}
                        disabled={disabled}
                        className={`relative w-9 h-5 rounded-full transition-colors ${isOn ? '' : disabled ? 'bg-slate-200 cursor-not-allowed' : 'bg-slate-300'}`}
                        style={{ backgroundColor: isOn ? accentColor : undefined }}
                        title={disabled ? 'License limit reached' : ''}
                      >
                        <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isOn ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Manual subscription key input - Admin only */}
          {role === 'admin' && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-4">
              <label className="text-xs font-semibold text-slate-500 block mb-2">Manually Add Subscription Key (Advanced)</label>
              <div className="flex gap-2">
                <input 
                  value={newKey} 
                  onChange={e => setNewKey(e.target.value)} 
                  className="flex-1 px-3 py-1.5 text-sm border rounded" 
                  placeholder="org_id_notif_id" 
                />
                <button onClick={addManualSub} className="px-3 py-1.5 bg-white border border-slate-300 rounded">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 mt-auto shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-slate-600">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-white rounded-lg flex items-center gap-2"
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

// --- Invite User Modal WITH LICENSE CHECKS ---
function InviteUserModal({ 
  availableOptions, 
  organizations,
  users,
  role, 
  accentColor, 
  onClose, 
  onSend,
  canOrgAddSubscriber,
  userHasOrgSubscription
}) {
  const [email, setEmail] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [licenseWarnings, setLicenseWarnings] = useState([]);

  // Group options by organization (for admin view)
  const groupedOptions = availableOptions.reduce((acc, opt) => {
    if (!acc[opt.organization]) acc[opt.organization] = { orgId: opt.orgId, items: [] };
    acc[opt.organization].items.push(opt);
    return acc;
  }, {});

  // Check if selecting a key would violate license
  const canSelectKey = (key) => {
    const targetOrgId = key.split('_')[0];
    
    // Check if user already exists and has subscription to this org
    const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser && userHasOrgSubscription(existingUser, targetOrgId)) {
      return { allowed: true };
    }
    
    // Check if any other selected keys are for this org (user will already count)
    const orgAlreadySelected = selectedKeys.some(k => k.startsWith(`${targetOrgId}_`));
    if (orgAlreadySelected) {
      return { allowed: true };
    }
    
    return canOrgAddSubscriber(targetOrgId);
  };

  const toggleKey = (key) => {
    const isSelected = selectedKeys.includes(key);
    
    if (!isSelected) {
      // Selecting - check license
      const check = canSelectKey(key);
      if (!check.allowed) {
        // Show warning but allow continue
        const targetOrgId = key.split('_')[0];
        const org = organizations.find(o => o.id === targetOrgId);
        setLicenseWarnings(prev => {
          const existing = prev.find(w => w.orgId === targetOrgId);
          if (existing) return prev;
          return [...prev, { orgId: targetOrgId, orgName: org?.name || targetOrgId, reason: check.reason }];
        });
        return; // Don't select
      }
    } else {
      // Deselecting - remove warnings for this org if no other keys selected
      const targetOrgId = key.split('_')[0];
      const otherKeysForOrg = selectedKeys.filter(k => k !== key && k.startsWith(`${targetOrgId}_`));
      if (otherKeysForOrg.length === 0) {
        setLicenseWarnings(prev => prev.filter(w => w.orgId !== targetOrgId));
      }
    }
    
    setSelectedKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAllInOrg = (orgName) => {
    const orgData = groupedOptions[orgName];
    if (!orgData) return;
    
    const orgKeys = orgData.items.map(opt => opt.key);
    const allSelected = orgKeys.every(k => selectedKeys.includes(k));
    
    if (allSelected) {
      // Deselect all
      setSelectedKeys(prev => prev.filter(k => !orgKeys.includes(k)));
      setLicenseWarnings(prev => prev.filter(w => w.orgId !== orgData.orgId));
    } else {
      // Check license before selecting all
      const check = canSelectKey(orgKeys[0]); // Just need to check one
      if (!check.allowed) {
        const org = organizations.find(o => o.id === orgData.orgId);
        setLicenseWarnings(prev => {
          const existing = prev.find(w => w.orgId === orgData.orgId);
          if (existing) return prev;
          return [...prev, { orgId: orgData.orgId, orgName: org?.name || orgData.orgId, reason: check.reason }];
        });
        return;
      }
      // Select all
      setSelectedKeys(prev => [...new Set([...prev, ...orgKeys])]);
    }
  };

  const handleSubmit = () => {
    if (!email || selectedKeys.length === 0) return;
    
    // Build subscriptions object
    const subscriptions = {};
    selectedKeys.forEach(key => { subscriptions[key] = true; });
    
    // Get org info for the first selected subscription
    const firstKey = selectedKeys[0];
    const firstOpt = availableOptions.find(o => o.key === firstKey);
    
    onSend({
      email,
      subscriptions,
      orgId: firstOpt?.orgId,
      orgName: firstOpt?.organization,
      notifName: selectedKeys.length === 1 ? firstOpt?.label : null,
      notifCount: selectedKeys.length
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">Invite New Subscriber</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Email Input */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 outline-none"
              style={{ '--tw-ring-color': accentColor }}
            />
          </div>

          {/* License Warnings */}
          {licenseWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">License Limit Reached</p>
                  {licenseWarnings.map(w => (
                    <p key={w.orgId} className="text-xs text-amber-700 mt-1">
                      {w.orgName}: {w.reason}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subscription Selection */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Select Notifications</label>
            <p className="text-xs text-slate-500 mb-2">
              The user will be automatically subscribed when they sign up.
            </p>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {role === 'admin' ? (
                // Admin view: grouped by organization
                Object.entries(groupedOptions).map(([orgName, orgData]) => {
                  const orgKeys = orgData.items.map(opt => opt.key);
                  const orgAllSelected = orgKeys.every(k => selectedKeys.includes(k));
                  const orgSomeSelected = orgKeys.some(k => selectedKeys.includes(k));
                  const orgCheck = canOrgAddSubscriber(orgData.orgId);
                  const isAtLimit = !orgCheck.allowed;
                  
                  return (
                    <div key={orgName} className="border-b border-slate-100 last:border-b-0">
                      <div 
                        className={`bg-slate-50 px-3 py-2 flex items-center justify-between ${isAtLimit ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}
                        onClick={() => !isAtLimit && selectAllInOrg(orgName)}
                      >
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {orgName}
                          {isAtLimit && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Limit
                            </span>
                          )}
                        </span>
                        <div 
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                          style={{ 
                            backgroundColor: orgAllSelected ? accentColor : orgSomeSelected ? `${accentColor}33` : undefined,
                            borderColor: orgAllSelected || orgSomeSelected ? accentColor : '#d1d5db',
                            opacity: isAtLimit && !orgSomeSelected ? 0.5 : 1
                          }}
                        >
                          {orgAllSelected && <Check className="w-3 h-3 text-white" />}
                          {orgSomeSelected && !orgAllSelected && <div className="w-2 h-0.5" style={{ backgroundColor: accentColor }} />}
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {orgData.items.map(opt => {
                          const isSelected = selectedKeys.includes(opt.key);
                          const canSelect = isSelected || canSelectKey(opt.key).allowed;
                          
                          return (
                            <div 
                              key={opt.key}
                              className={`px-3 py-2 pl-9 flex items-center justify-between ${canSelect ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-50'}`}
                              onClick={() => canSelect && toggleKey(opt.key)}
                            >
                              <span className="text-sm text-slate-600 flex items-center gap-2">
                                {opt.label}
                                {opt.access === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                              </span>
                              <div 
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                                style={{ 
                                  backgroundColor: isSelected ? accentColor : undefined,
                                  borderColor: isSelected ? accentColor : '#d1d5db'
                                }}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Org admin view: flat list
                availableOptions.map(opt => {
                  const isSelected = selectedKeys.includes(opt.key);
                  const canSelect = isSelected || canSelectKey(opt.key).allowed;
                  
                  return (
                    <div 
                      key={opt.key}
                      className={`px-3 py-2 flex items-center justify-between border-b border-slate-50 last:border-b-0 ${canSelect ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-50'}`}
                      onClick={() => canSelect && toggleKey(opt.key)}
                    >
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        {opt.label}
                        {opt.access === 'private' && <Lock className="w-3 h-3 text-amber-500" />}
                      </span>
                      <div 
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center`}
                        style={{ 
                          backgroundColor: isSelected ? accentColor : undefined,
                          borderColor: isSelected ? accentColor : '#d1d5db'
                        }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <span className="text-sm text-slate-500">
            {selectedKeys.length} notification{selectedKeys.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600">Cancel</button>
            <button 
              onClick={handleSubmit}
              disabled={!email || selectedKeys.length === 0}
              className="px-4 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              <Send className="w-4 h-4" /> Send Invitation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
