// src/admin/components/NotifyConfiguration.jsx
// Notification configuration management for Notify module
// Supports both super admin (all orgs) and org admin (single org) views
//
// UPDATED: Now passes orgData to NotificationEditModal for license enforcement
// This ensures license limits apply even when super admin edits notifications

import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  deleteField,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { 
  Building2, 
  Bell, 
  BellOff,
  Plus, 
  Edit2, 
  Trash2, 
  Copy,
  ChevronDown, 
  ChevronRight,
  Play,
  Pause,
  Globe,
  Lock,
  Calendar,
  Clock,
  Zap
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * NotifyConfiguration Component
 * 
 * Manages notification configurations for organizations.
 * Super Admin: View and edit all organizations' notifications
 * Org Admin: View and edit only their organization's notifications
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'admin' | 'org_admin'
 * @param {string} [orgId] - Required for 'org_admin' role: the org ID
 * @param {object} [orgData] - Required for 'org_admin' role: the org configuration
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color (default: '#004E7C')
 * @param {React.Component} NotificationEditModal - The modal component for editing notifications
 * @param {function} [onOpenWizard] - Callback to open the Notification Wizard (org_admin only)
 */
export default function NotifyConfiguration({ 
  db,
  role = 'admin',
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor = '#004E7C',
  NotificationEditModal,
  onOpenWizard
}) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNotification, setEditingNotification] = useState(null);
  const [expandedOrgs, setExpandedOrgs] = useState({});

  // Fetch all organizations for admin role
  useEffect(() => {
    if (role === 'admin') {
      const q = collection(db, PATHS.organizations);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orgs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setOrganizations(orgs);
        // All orgs collapsed by default for super admin
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // For org_admin, we use the passed orgData
      setLoading(false);
    }
  }, [db, role]);

  // Check if org has Notify initialized
  const hasNotifyConfig = (org) => {
    return org?.notifyEnabled === true || (org?.notifications && org.notifications.length > 0);
  };

  // Toggle org expansion
  const toggleOrgExpansion = (targetOrgId) => {
    setExpandedOrgs(prev => ({ ...prev, [targetOrgId]: !prev[targetOrgId] }));
  };

  // Default notification template
  const defaultNotifTemplate = {
    id: "new_notification",
    name: "New Notification",
    type: "monthly",
    access: "private", // Default to private for safety
    paused: false,
    runDay: 1,
    lag: 0,
    sendEmpty: false,
    emailZeroStateMessage: "",
    method: "email",
    description: "Description of the new alert.",
    emailIntro: "",
    source: {
      type: "arcgis_rest",
      endpoint: "",
      dateField: "",
      definitionQuery: "",
      queryConfig: { mode: 'none', rules: [] },
      displayFields: []
    }
  };

  // Initialize Notify for an organization
  const handleInitializeNotify = async (targetOrgId, orgName) => {
    confirm({
      title: "Initialize Notify",
      message: `This will enable notifications for "${orgName}". You can then add notification rules to send email alerts to subscribers.`,
      confirmLabel: "Initialize",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { 
            notifyEnabled: true,
            notifications: []
          });
          addToast("Notify initialized", "success");
        } catch (err) {
          addToast("Error: " + err.message, "error");
        }
      }
    });
  };

  // Uninitialize Notify (remove config)
  const handleUninitializeNotify = async (targetOrgId, orgName, notificationCount) => {
    if (notificationCount > 0) {
      addToast("Cannot uninitialize while notifications exist. Delete all notifications first.", "error");
      return;
    }
    
    confirm({
      title: "Uninitialize Notify",
      message: `This will disable notifications for "${orgName}". All Notify configuration will be removed. Continue?`,
      destructive: true,
      confirmLabel: "Uninitialize",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { 
            notifyEnabled: deleteField(),
            notifications: deleteField()
          });
          addToast("Notify uninitialized", "success");
        } catch (err) {
          addToast("Error: " + err.message, "error");
        }
      }
    });
  };

  // Update notifications array for an organization
  const handleUpdateNotification = async (targetOrgId, updatedNotifications) => {
    try {
      const docRef = doc(db, PATHS.organizations, targetOrgId);
      await updateDoc(docRef, { notifications: updatedNotifications });
      setEditingNotification(null);
      addToast("Notification saved", "success");
    } catch (err) {
      addToast("Error: " + err.message, "error");
    }
  };

  // Delete a notification
  const handleDeleteNotification = (targetOrgId, idx, notifName, allNotifications) => {
    confirm({
      title: "Delete Notification",
      message: `Are you sure you want to delete "${notifName}"? Subscribers will no longer receive this notification.`,
      destructive: true,
      confirmLabel: "Delete",
      requireTypedConfirmation: notifName,
      onConfirm: async () => {
        const updated = allNotifications.filter((_, i) => i !== idx);
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { notifications: updated });
          addToast("Notification deleted", "success");
        } catch (err) {
          addToast("Error: " + err.message, "error");
        }
      }
    });
  };

  // Force run a broadcast
  const handleForceRunBroadcast = (targetOrgId, notifId, notifName) => {
    confirm({
      title: "Force Run Broadcast",
      message: `This will immediately run "${notifName}" and send emails to all subscribers. Continue?`,
      confirmLabel: "Run Now",
      onConfirm: async () => {
        try {
          const forceRef = doc(db, 'force_queue', `${targetOrgId}_${notifId}_${Date.now()}`);
          await updateDoc(forceRef, {
            orgId: targetOrgId,
            notificationId: notifId,
            requestedAt: serverTimestamp(),
            status: 'pending'
          }).catch(() => {
            // If doc doesn't exist, create it
            return setDoc(forceRef, {
              orgId: targetOrgId,
              notificationId: notifId,
              requestedAt: serverTimestamp(),
              status: 'pending'
            });
          });
          addToast("Broadcast queued", "success");
        } catch (err) {
          addToast("Error: " + err.message, "error");
        }
      }
    });
  };

  // Duplicate notification
  const handleDuplicateNotification = (targetOrgId, notif, allNotifications, targetOrgData) => {
    const duplicatedNotif = {
      ...notif,
      id: `${notif.id}_copy_${Date.now()}`,
      name: `${notif.name} (Copy)`,
      source: {
        ...notif.source,
        displayFields: notif.source?.displayFields ? [...notif.source.displayFields] : [],
        queryConfig: notif.source?.queryConfig 
          ? { ...notif.source.queryConfig, rules: [...(notif.source.queryConfig.rules || [])] } 
          : { mode: 'none', rules: [] }
      }
    };
    setEditingNotification({ 
      orgId: targetOrgId, 
      orgData: targetOrgData, // Include org data for license checking
      notificationIndex: -1, 
      data: duplicatedNotif, 
      allNotifications 
    });
  };

  // Add new notification
  const handleAddNotification = (targetOrgId, allNotifications, targetOrgData) => {
    setEditingNotification({ 
      orgId: targetOrgId, 
      orgData: targetOrgData, // Include org data for license checking
      notificationIndex: -1, 
      data: {...defaultNotifTemplate, id: `notif_${Date.now()}`}, 
      allNotifications 
    });
  };

  // Edit existing notification
  const handleEditNotification = (targetOrgId, idx, data, allNotifications, targetOrgData) => {
    setEditingNotification({ 
      orgId: targetOrgId, 
      orgData: targetOrgData, // Include org data for license checking
      notificationIndex: idx, 
      data, 
      allNotifications 
    });
  };

  // Save notification (from modal)
  const handleSaveNotification = (newData) => {
    let updated = [...(editingNotification.allNotifications || [])];
    if (editingNotification.notificationIndex === -1) {
      updated.push(newData);
    } else {
      updated[editingNotification.notificationIndex] = newData;
    }
    handleUpdateNotification(editingNotification.orgId, updated);
  };

  // Helper: Get org data by ID (for super admin)
  const getOrgById = (targetOrgId) => {
    return organizations.find(o => o.id === targetOrgId) || null;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" 
             style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // --- RENDER FOR ADMIN (ALL ORGANIZATIONS) ---
  if (role === 'admin') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Notification Configuration</h2>
            <p className="text-slate-500 text-sm">Manage notification rules for all organizations.</p>
          </div>
        </div>

        {/* Organization Cards */}
        {organizations.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No organizations found.</p>
            <p className="text-sm mt-1">Create organizations in System → Organizations.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {organizations.map(org => (
              <OrganizationNotifyCard
                key={org.id}
                org={org}
                expanded={expandedOrgs[org.id]}
                onToggle={() => toggleOrgExpansion(org.id)}
                accentColor={accentColor}
                hasNotifyConfig={hasNotifyConfig(org)}
                onInitialize={() => handleInitializeNotify(org.id, org.name)}
                onUninitialize={() => handleUninitializeNotify(org.id, org.name, org.notifications?.length || 0)}
                onForceRun={(notifId, notifName) => handleForceRunBroadcast(org.id, notifId, notifName)}
                onEditNotification={(idx, data) => handleEditNotification(org.id, idx, data, org.notifications, org)}
                onDeleteNotification={(idx, name) => handleDeleteNotification(org.id, idx, name, org.notifications)}
                onDuplicateNotification={(notif) => handleDuplicateNotification(org.id, notif, org.notifications, org)}
                onAddNotification={() => handleAddNotification(org.id, org.notifications || [], org)}
              />
            ))}
          </div>
        )}

        {/* Notification Edit Modal - NOW PASSES orgData */}
        {editingNotification && NotificationEditModal && (
          <NotificationEditModal 
            data={editingNotification.data}
            orgData={editingNotification.orgData}
            onClose={() => setEditingNotification(null)}
            onSave={handleSaveNotification}
          />
        )}
      </div>
    );
  }

  // --- RENDER FOR ORG ADMIN (SINGLE ORGANIZATION) ---
  const hasConfig = hasNotifyConfig(orgData);
  const notifications = orgData?.notifications || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Notifications</h2>
          <p className="text-slate-500 text-sm">
            Configure notification rules for your organization.
          </p>
        </div>
        
        {hasConfig && (
          <div className="flex gap-2">
            {onOpenWizard && (
              <button
                onClick={onOpenWizard}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                <Zap className="w-4 h-4" />
                Wizard
              </button>
            )}
            <button
              onClick={() => handleAddNotification(orgId, notifications, orgData)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              Add Notification
            </button>
          </div>
        )}
      </div>

      {/* Not Initialized State */}
      {!hasConfig ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <BellOff className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Notify Not Configured</h3>
          <p className="text-slate-500 mb-6">Initialize Notify to start sending email notifications to subscribers.</p>
          <button
            onClick={() => handleInitializeNotify(orgId, orgData?.name)}
            className="px-6 py-2 text-white rounded-lg font-medium"
            style={{ backgroundColor: accentColor }}
          >
            Initialize Notify
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No notifications configured yet.</p>
              <p className="text-sm text-slate-400 mt-1">Click "Add Notification" to create your first one.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {notifications.map((notif, idx) => (
                <NotificationCard
                  key={notif.id || idx}
                  notification={notif}
                  accentColor={accentColor}
                  onEdit={() => handleEditNotification(orgId, idx, notif, notifications, orgData)}
                  onDelete={() => handleDeleteNotification(orgId, idx, notif.name, notifications)}
                  onDuplicate={() => handleDuplicateNotification(orgId, notif, notifications, orgData)}
                  onForceRun={() => handleForceRunBroadcast(orgId, notif.id, notif.name)}
                />
              ))}
            </div>
          )}

          {/* Uninitialize Option */}
          {notifications.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-700">Uninitialize Notify</h4>
                  <p className="text-sm text-slate-500">Remove Notify configuration from this organization.</p>
                </div>
                <button
                  onClick={() => handleUninitializeNotify(orgId, orgData?.name, 0)}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Uninitialize
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notification Edit Modal - PASSES orgData */}
      {editingNotification && NotificationEditModal && (
        <NotificationEditModal 
          data={editingNotification.data}
          orgData={editingNotification.orgData || orgData}
          onClose={() => setEditingNotification(null)}
          onSave={handleSaveNotification}
        />
      )}
    </div>
  );
}

// --- Notification Card Component ---
function NotificationCard({ notification, accentColor, onEdit, onDelete, onDuplicate, onForceRun }) {
  const scheduleLabels = {
    monthly: 'Monthly',
    weekly: 'Weekly',
    daily: 'Daily',
    immediate: 'Immediate'
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-slate-800">{notification.name}</h4>
            {notification.paused && (
              <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                <Pause className="w-3 h-3" />
                Paused
              </span>
            )}
            {notification.access === 'public' || notification.isPublic ? (
              <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                <Globe className="w-3 h-3" />
                Public
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                Private
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-2">{notification.description || 'No description'}</p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {scheduleLabels[notification.type] || notification.type}
            </span>
            {notification.runTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {notification.runTime}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={onForceRun}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
            title="Force Run"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Organization Notify Card (Admin view) ---
function OrganizationNotifyCard({ 
  org, 
  expanded, 
  onToggle, 
  accentColor, 
  hasNotifyConfig,
  onInitialize,
  onUninitialize,
  onForceRun, 
  onEditNotification, 
  onAddNotification, 
  onDeleteNotification, 
  onDuplicateNotification 
}) {
  const notifications = org.notifications || [];
  const notificationCount = notifications.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <button className="text-slate-400">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="font-bold text-slate-800">{org.name || org.id}</h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">{org.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasNotifyConfig ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                <Bell className="w-3 h-3" />
                {notificationCount} notification{notificationCount !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
              <BellOff className="w-3 h-3" />
              Not initialized
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100">
          {!hasNotifyConfig ? (
            // Not initialized - show Initialize button
            <div className="p-6 text-center">
              <BellOff className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">Notify is not initialized for this organization.</p>
              <button
                onClick={(e) => { e.stopPropagation(); onInitialize(); }}
                className="px-4 py-2 text-white rounded-lg font-medium"
                style={{ backgroundColor: accentColor }}
              >
                Initialize Notify
              </button>
            </div>
          ) : (
            // Initialized - show notifications
            <div className="p-4 space-y-3">
              {/* Add Notification Button */}
              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); onAddNotification(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
                  style={{ backgroundColor: accentColor + '15', color: accentColor }}
                >
                  <Plus className="w-4 h-4" />
                  Add Notification
                </button>
              </div>

              {/* Notification List */}
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif, idx) => (
                    <div 
                      key={notif.id || idx}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700 truncate">{notif.name}</span>
                          {notif.paused && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              Paused
                            </span>
                          )}
                          {(notif.access === 'public' || notif.isPublic) ? (
                            <Globe className="w-3 h-3 text-blue-500" title="Public" />
                          ) : (
                            <Lock className="w-3 h-3 text-slate-400" title="Private" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{notif.description || notif.id}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onForceRun(notif.id, notif.name); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded"
                          title="Force Run"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDuplicateNotification(notif); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditNotification(idx, notif); }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteNotification(idx, notif.name); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Uninitialize Option */}
              {notifications.length === 0 && (
                <div className="pt-2 border-t border-slate-100 mt-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUninitialize(); }}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Uninitialize Notify
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
