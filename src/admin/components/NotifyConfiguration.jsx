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
  Zap,
  Eye,
  X,
  Monitor,
  Smartphone
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';
import { generateSampleContext } from './customTemplate/validation';
import { DASHBOARD_ICONS } from './customTemplate/constants';

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
  const [previewingEmail, setPreviewingEmail] = useState(null);

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
  const handleForceRunBroadcast = (targetOrgId, notifId, notifName, notification, targetOrgData) => {
    confirm({
      title: "Force Run Broadcast",
      message: `This will immediately run "${notifName}" and send emails to all subscribers. Continue?`,
      confirmLabel: "Run Now",
      onConfirm: async () => {
        try {
          addToast("Generating email content...", "info");

          // Generate the complete email HTML with real data
          const emailResult = await generateBroadcastEmailHtml(notification, targetOrgData);

          if (!emailResult || !emailResult.html) {
            throw new Error('Failed to generate email content');
          }

          const forceRef = doc(db, 'force_queue', `${targetOrgId}_${notifId}_${Date.now()}`);
          await setDoc(forceRef, {
            orgId: targetOrgId,
            notificationId: notifId,
            notificationName: notifName,
            emailHtml: emailResult.html,
            recordCount: emailResult.recordCount,
            dateRangeStart: emailResult.dateRange.startStr,
            dateRangeEnd: emailResult.dateRange.endStr,
            requestedAt: serverTimestamp(),
            status: 'pending',
            isForce: true
          });
          addToast("Broadcast queued with content", "success");
        } catch (err) {
          addToast("Error: " + err.message, "error");
        }
      }
    });
  };

  // Preview email
  const handlePreviewEmail = (targetOrgId, notif, targetOrgData) => {
    setPreviewingEmail({
      orgId: targetOrgId,
      orgData: targetOrgData,
      notification: notif
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
                onPreviewEmail={(notif) => handlePreviewEmail(org.id, notif, org)}
                onForceRun={(notifId, notifName, notif) => handleForceRunBroadcast(org.id, notifId, notifName, notif, org)}
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

        {/* Email Preview Modal */}
        {previewingEmail && (
          <EmailPreviewModal
            notification={previewingEmail.notification}
            orgData={previewingEmail.orgData}
            onClose={() => setPreviewingEmail(null)}
            accentColor={accentColor}
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
                  onPreviewEmail={() => handlePreviewEmail(orgId, notif, orgData)}
                  onForceRun={() => handleForceRunBroadcast(orgId, notif.id, notif.name, notif, orgData)}
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

      {/* Email Preview Modal */}
      {previewingEmail && (
        <EmailPreviewModal
          notification={previewingEmail.notification}
          orgData={previewingEmail.orgData}
          onClose={() => setPreviewingEmail(null)}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

// --- Notification Card Component ---
function NotificationCard({ notification, accentColor, onEdit, onDelete, onDuplicate, onPreviewEmail, onForceRun }) {
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
            onClick={onPreviewEmail}
            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
            title="Preview Email"
          >
            <Eye className="w-4 h-4" />
          </button>
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
  onPreviewEmail,
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
                          onClick={(e) => { e.stopPropagation(); onPreviewEmail(notif); }}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-white rounded"
                          title="Preview Email"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onForceRun(notif.id, notif.name, notif); }}
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

// Configuration for the proxy service
const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://api.civ.quest';

/**
 * Generate complete email HTML for a broadcast
 * This function fetches real data and generates the fully-rendered email HTML
 * @param {object} notification - The notification configuration
 * @param {object} orgData - The organization data
 * @returns {Promise<{ html: string, recordCount: number, dateRange: object } | null>}
 */
async function generateBroadcastEmailHtml(notification, orgData) {
  const source = notification?.source;
  const endpoint = source?.endpoint;
  const customTemplate = notification?.customTemplate || {};
  const theme = customTemplate.theme || {};

  // Calculate date range based on notification type
  const dateRange = calculateDateRange(notification?.type || 'daily', notification?.lag || 0);

  // Default context values
  const context = {
    organizationName: orgData?.name || 'Organization',
    organizationId: orgData?.id || '',
    notificationName: notification?.name || 'Notification',
    notificationId: notification?.id || '',
    dateRangeStart: dateRange.startStr,
    dateRangeEnd: dateRange.endStr,
    dateRangeStartTime: dateRange.startTimeStr,
    dateRangeEndTime: dateRange.endTimeStr,
    recordCount: '0',
    dataTable: '',
    moreRecordsMessage: '',
    statisticsHtml: '',
    downloadButton: customTemplate.includeCSV !== false
      ? `<div style="margin: 20px 0;"><a href="#" style="display: inline-block; background-color: ${theme.primaryColor || '#004E7C'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: ${theme.borderRadius || '4px'}; font-weight: bold;">Download Full CSV Report</a></div>`
      : '',
    downloadUrl: '',
    primaryColor: theme.primaryColor || '#004E7C',
    secondaryColor: theme.secondaryColor || '#f2f2f2',
    accentColor: theme.accentColor || '#0077B6',
    textColor: theme.textColor || '#333333',
    mutedTextColor: theme.mutedTextColor || '#666666',
    backgroundColor: theme.backgroundColor || '#ffffff',
    borderColor: theme.borderColor || '#dddddd',
    fontFamily: theme.fontFamily || 'Arial, sans-serif',
    emailIntro: notification?.emailIntro || '<p style="margin: 0 0 15px 0; color: #444;">Here is your notification summary with the latest data.</p>',
    emailZeroStateMessage: notification?.emailZeroStateMessage || 'No new records found for this period.',
    logoHtml: '',
    logoUrl: ''
  };

  // Generate logo HTML if configured
  const branding = customTemplate.branding || {};
  if (branding.logoUrl) {
    const alignment = branding.logoAlignment || 'left';
    const width = branding.logoWidth || '150';
    const textAlign = alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left';
    context.logoHtml = `<div style="text-align: ${textAlign}; margin-bottom: 15px;">
      <img src="${branding.logoUrl}" alt="Logo" style="max-width: ${width}px; height: auto; display: inline-block;" />
    </div>`;
    context.logoUrl = branding.logoUrl;
  }

  // If no endpoint configured, return with default template
  if (!endpoint) {
    return {
      html: generateFinalHtml(notification, context, theme),
      recordCount: 0,
      dateRange
    };
  }

  try {
    const baseUrl = endpoint.replace(/\/$/, '');
    const dateField = source?.dateField;
    const username = source?.username;
    const password = source?.password;
    const displayFields = source?.displayFields || [];

    // Build the where clause
    let whereClause = '1=1';

    // Add date filter if dateField is configured
    if (dateField) {
      const startTimestamp = dateRange.start.getTime();
      const endTimestamp = dateRange.end.getTime();
      whereClause = `${dateField} >= ${startTimestamp} AND ${dateField} <= ${endTimestamp}`;
    }

    // Add definition query if configured
    if (source?.definitionQuery) {
      whereClause = whereClause === '1=1'
        ? source.definitionQuery
        : `(${whereClause}) AND (${source.definitionQuery})`;
    }

    // Get the fields to query
    const outFields = displayFields.length > 0
      ? displayFields.map(f => typeof f === 'string' ? f : f.field).join(',')
      : '*';

    // Fetch record count
    const countRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceUrl: baseUrl,
        where: whereClause,
        returnCountOnly: true,
        ...(username && password ? { username, password } : {})
      })
    });

    let recordCount = 0;
    if (countRes.ok) {
      const countData = await countRes.json();
      recordCount = countData.count ?? 0;
    }

    context.recordCount = String(recordCount);

    // Fetch sample records for data table
    const dataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceUrl: baseUrl,
        where: whereClause,
        outFields,
        resultRecordCount: 10,
        orderByFields: dateField ? `${dateField} DESC` : undefined,
        ...(username && password ? { username, password } : {})
      })
    });

    let records = [];
    if (dataRes.ok) {
      const dataResult = await dataRes.json();
      const features = dataResult.features || [];
      records = features.map(f => f.attributes);
    }

    // Generate data table HTML
    context.dataTable = generateDataTableHtml(records, displayFields, theme);

    // Generate more records message
    context.moreRecordsMessage = recordCount > 10
      ? `<p style="font-style: italic; color: ${theme.mutedTextColor || '#666'}; margin-top: 15px; font-size: 13px;">Showing first 10 of ${recordCount} records. Download the CSV to see all data.</p>`
      : '';

    // Fetch statistics if configured
    const statistics = customTemplate.statistics || [];
    if (statistics.length > 0) {
      const statValues = await fetchStatistics(baseUrl, whereClause, statistics, username, password);
      Object.assign(context, statValues);
      context.statisticsHtml = generateStatisticsHtmlForBroadcast(statistics, statValues, theme);
    }

    return {
      html: generateFinalHtml(notification, context, theme),
      recordCount,
      dateRange
    };

  } catch (err) {
    console.error('Error generating broadcast email:', err);
    // Return with default content on error
    return {
      html: generateFinalHtml(notification, context, theme),
      recordCount: 0,
      dateRange
    };
  }
}

/**
 * Fetch statistics from ArcGIS service
 */
async function fetchStatistics(baseUrl, whereClause, statistics, username, password) {
  const statValues = {};

  // Separate server-side and client-side statistics
  const serverStats = statistics.filter(s => ['count', 'sum', 'min', 'max', 'avg', 'stddev', 'var'].includes(s.operation));
  const clientStats = statistics.filter(s => ['mean', 'median', 'distinct'].includes(s.operation));

  // Fetch server-calculated statistics
  if (serverStats.length > 0) {
    const outStatistics = serverStats.map(stat => ({
      statisticType: stat.operation === 'mean' ? 'avg' : stat.operation,
      onStatisticField: stat.field,
      outStatisticFieldName: `stat_${stat.id}`
    }));

    try {
      const statsRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: whereClause,
          outStatistics: JSON.stringify(outStatistics),
          ...(username && password ? { username, password } : {})
        })
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.features && statsData.features.length > 0) {
          const statsAttrs = statsData.features[0].attributes;
          serverStats.forEach(stat => {
            const rawValue = statsAttrs[`stat_${stat.id}`];
            statValues[`stat_${stat.id}`] = formatStatValue(rawValue, stat.format);
            statValues[`stat_${stat.id}_value`] = rawValue;
            statValues[`stat_${stat.id}_label`] = stat.label || stat.id;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch server statistics:', err);
    }
  }

  // Calculate client-side statistics
  if (clientStats.length > 0) {
    const fieldsNeeded = [...new Set(clientStats.map(s => s.field))];

    try {
      const allRecordsRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: baseUrl,
          where: whereClause,
          outFields: fieldsNeeded.join(','),
          returnGeometry: false,
          ...(username && password ? { username, password } : {})
        })
      });

      if (allRecordsRes.ok) {
        const allData = await allRecordsRes.json();
        const allRecords = (allData.features || []).map(f => f.attributes);

        clientStats.forEach(stat => {
          const values = allRecords
            .map(r => r[stat.field])
            .filter(v => v !== null && v !== undefined);

          let result;
          if (stat.operation === 'median') {
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            result = sorted.length % 2 !== 0
              ? sorted[mid]
              : (sorted[mid - 1] + sorted[mid]) / 2;
          } else if (stat.operation === 'distinct') {
            result = new Set(values).size;
          } else if (stat.operation === 'mean') {
            result = values.length > 0
              ? values.reduce((a, b) => a + b, 0) / values.length
              : 0;
          }

          statValues[`stat_${stat.id}`] = formatStatValue(result, stat.format);
          statValues[`stat_${stat.id}_value`] = result;
          statValues[`stat_${stat.id}_label`] = stat.label || stat.id;
        });
      }
    } catch (err) {
      console.warn('Failed to calculate client statistics:', err);
    }
  }

  return statValues;
}

/**
 * Generate data table HTML from records
 */
function generateDataTableHtml(records, displayFields, theme) {
  if (!records || records.length === 0) {
    return '<p style="color: #666; font-style: italic;">No records found for this period.</p>';
  }

  const fields = displayFields.length > 0
    ? displayFields.slice(0, 5)
    : Object.keys(records[0]).slice(0, 3).map(f => ({ field: f, label: f }));

  const secondaryColor = theme?.secondaryColor || '#f2f2f2';
  const borderColor = theme?.borderColor || '#dddddd';

  const headerCells = fields.map(f => {
    const label = typeof f === 'string' ? f : (f.label || f.field);
    return `<th style="text-align: left; padding: 10px 8px; background-color: ${secondaryColor}; border-bottom: 2px solid ${borderColor};">${label}</th>`;
  }).join('');

  const bodyRows = records.slice(0, 10).map(record => {
    const cells = fields.map(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      let value = record[fieldName];
      if (value && typeof value === 'number' && value > 1000000000000) {
        value = new Date(value).toLocaleDateString();
      }
      return `<td style="padding: 10px 8px; border-bottom: 1px solid ${borderColor};">${value ?? '-'}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

/**
 * Generate statistics HTML for broadcast emails
 */
function generateStatisticsHtmlForBroadcast(statistics, statValues, theme) {
  if (!statistics || statistics.length === 0) return '';

  const primaryColor = theme.primaryColor || '#004E7C';
  const secondaryColor = theme.secondaryColor || '#f2f2f2';
  const mutedTextColor = theme.mutedTextColor || '#666666';

  const cards = statistics.map(stat => {
    const value = statValues[`stat_${stat.id}`] || '-';
    const label = stat.label || stat.id;

    return `<td style="width: ${100 / statistics.length}%; padding: 10px; text-align: center; vertical-align: top;">
      <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="margin: 0; font-size: 11px; color: ${mutedTextColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
        <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: ${primaryColor};">${value}</p>
      </div>
    </td>`;
  }).join('');

  return `<div style="padding: 15px 0; margin-bottom: 15px;">
    <table style="width: 100%; border-collapse: collapse; background-color: ${secondaryColor}; border-radius: 8px;">
      <tr>${cards}</tr>
    </table>
  </div>`;
}

/**
 * Generate final HTML by replacing placeholders in template
 */
function generateFinalHtml(notification, context, theme) {
  const customTemplate = notification?.customTemplate || {};
  const hasCustomTemplate = customTemplate?.html;

  if (hasCustomTemplate) {
    let html = customTemplate.html;

    // Replace all placeholders from context
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value || '');
    });

    return html;
  }

  // Default template
  const accentColor = theme.primaryColor || '#004E7C';
  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: ${accentColor}; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">${context.organizationName}</h1>
      <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 16px;">${context.notificationName}</h2>
    </div>

    <div style="padding: 20px;">
      ${context.logoHtml}

      <p style="color: #666; margin: 0 0 15px 0;">
        <strong>Period:</strong> ${context.dateRangeStart} to ${context.dateRangeEnd}<br>
        <strong>Records:</strong> ${context.recordCount}
      </p>

      ${context.emailIntro}

      ${context.statisticsHtml}

      ${context.downloadButton}

      ${context.dataTable}

      ${context.moreRecordsMessage}
    </div>

    <div style="padding: 15px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #888;">
      You are receiving this because you subscribed to notifications.<br>
      <a href="#" style="color: #666;">Manage Preferences</a>
    </div>
  </div>`;
}

/**
 * Calculate date range based on notification type
 * @param {string} type - Notification type (monthly, weekly, daily, immediate)
 * @param {number} lag - Number of days lag
 * @returns {{ start: Date, end: Date, startStr: string, endStr: string }}
 */
function calculateDateRange(type, lag = 0) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - lag);

  let start = new Date(end);

  switch (type) {
    case 'monthly':
      // Previous month
      start.setMonth(start.getMonth() - 1);
      break;
    case 'weekly':
      // Previous week
      start.setDate(start.getDate() - 7);
      break;
    case 'daily':
      // Previous day
      start.setDate(start.getDate() - 1);
      break;
    case 'immediate':
    default:
      // Last 24 hours
      start.setDate(start.getDate() - 1);
      break;
  }

  const formatDate = (d) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatDateTime = (d) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  };

  return {
    start,
    end,
    startStr: formatDate(start),
    endStr: formatDate(end),
    startTimeStr: formatDateTime(start),
    endTimeStr: formatDateTime(end)
  };
}

/**
 * Format a statistic value based on format options
 */
function formatStatValue(value, formatOptions = {}) {
  if (value === null || value === undefined) {
    return formatOptions.nullValue || '-';
  }

  const { format = 'auto', decimals, prefix = '', suffix = '', currency = 'USD', locale = 'en-US', thousandsSeparator = true } = formatOptions;

  if (format === 'currency') {
    try {
      const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0
      }).format(value);
      return prefix + formatted + suffix;
    } catch {
      return prefix + '$' + value.toLocaleString(locale) + suffix;
    }
  }

  if (format === 'percent') {
    const percentValue = value * 100;
    return prefix + percentValue.toFixed(decimals ?? 2) + '%' + suffix;
  }

  if (format === 'number' || format === 'auto') {
    if (typeof value === 'number') {
      const formattedNumber = thousandsSeparator
        ? value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : value.toFixed(decimals);
      return prefix + formattedNumber + suffix;
    }
  }

  return prefix + String(value) + suffix;
}

// --- Email Preview Modal Component ---
function EmailPreviewModal({ notification, orgData, onClose, accentColor = '#004E7C' }) {
  const [previewMode, setPreviewMode] = React.useState('desktop');
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);
  const [realData, setRealData] = React.useState(null);

  // Fetch actual data from the service when modal opens
  React.useEffect(() => {
    const fetchRealData = async () => {
      const source = notification?.source;
      const endpoint = source?.endpoint;

      // If no endpoint configured, fall back to sample data
      if (!endpoint) {
        setIsLoading(false);
        setLoadError('No data source configured');
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);

        const baseUrl = endpoint.replace(/\/$/, '');
        const dateField = source?.dateField;
        const username = source?.username;
        const password = source?.password;
        const displayFields = source?.displayFields || [];

        // Calculate date range based on notification type
        const dateRange = calculateDateRange(notification?.type || 'daily', notification?.lag || 0);

        // Build the where clause
        let whereClause = '1=1';

        // Add date filter if dateField is configured
        if (dateField) {
          const startTimestamp = dateRange.start.getTime();
          const endTimestamp = dateRange.end.getTime();
          whereClause = `${dateField} >= ${startTimestamp} AND ${dateField} <= ${endTimestamp}`;
        }

        // Add definition query if configured
        if (source?.definitionQuery) {
          whereClause = whereClause === '1=1'
            ? source.definitionQuery
            : `(${whereClause}) AND (${source.definitionQuery})`;
        }

        // Get the fields to query
        const outFields = displayFields.length > 0
          ? displayFields.map(f => typeof f === 'string' ? f : f.field).join(',')
          : '*';

        // First, get the record count
        const countRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceUrl: baseUrl,
            where: whereClause,
            returnCountOnly: true,
            ...(username && password ? { username, password } : {})
          })
        });

        if (!countRes.ok) {
          throw new Error('Failed to fetch record count');
        }

        const countData = await countRes.json();
        const recordCount = countData.count ?? 0;

        // Fetch sample records (first 10 for the data table)
        const dataRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceUrl: baseUrl,
            where: whereClause,
            outFields,
            resultRecordCount: 10,
            orderByFields: dateField ? `${dateField} DESC` : undefined,
            ...(username && password ? { username, password } : {})
          })
        });

        if (!dataRes.ok) {
          throw new Error('Failed to fetch records');
        }

        const dataResult = await dataRes.json();
        const features = dataResult.features || [];
        const records = features.map(f => f.attributes);

        // Fetch statistics if configured
        const customTemplate = notification?.customTemplate || {};
        const statistics = customTemplate.statistics || [];
        const statValues = {};

        if (statistics.length > 0) {
          // Separate server-side and client-side statistics
          const serverStats = statistics.filter(s => ['count', 'sum', 'min', 'max', 'avg', 'stddev', 'var'].includes(s.operation));
          const clientStats = statistics.filter(s => ['mean', 'median', 'distinct'].includes(s.operation));

          // Fetch server-calculated statistics
          if (serverStats.length > 0) {
            const outStatistics = serverStats.map(stat => ({
              statisticType: stat.operation === 'mean' ? 'avg' : stat.operation,
              onStatisticField: stat.field,
              outStatisticFieldName: `stat_${stat.id}`
            }));

            try {
              const statsRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  serviceUrl: baseUrl,
                  where: whereClause,
                  outStatistics: JSON.stringify(outStatistics),
                  ...(username && password ? { username, password } : {})
                })
              });

              if (statsRes.ok) {
                const statsData = await statsRes.json();
                if (statsData.features && statsData.features.length > 0) {
                  const statsAttrs = statsData.features[0].attributes;
                  serverStats.forEach(stat => {
                    const rawValue = statsAttrs[`stat_${stat.id}`];
                    statValues[`stat_${stat.id}`] = formatStatValue(rawValue, stat.format);
                    statValues[`stat_${stat.id}_value`] = rawValue;
                    statValues[`stat_${stat.id}_label`] = stat.label || stat.id;
                  });
                }
              }
            } catch (statsErr) {
              console.warn('Failed to fetch statistics:', statsErr);
            }
          }

          // Calculate client-side statistics (median, distinct)
          if (clientStats.length > 0) {
            const fieldsNeeded = [...new Set(clientStats.map(s => s.field))];

            try {
              const allRecordsRes = await fetch(`${ARCGIS_PROXY_URL}/arcgis/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  serviceUrl: baseUrl,
                  where: whereClause,
                  outFields: fieldsNeeded.join(','),
                  returnGeometry: false,
                  ...(username && password ? { username, password } : {})
                })
              });

              if (allRecordsRes.ok) {
                const allData = await allRecordsRes.json();
                const allRecords = (allData.features || []).map(f => f.attributes);

                clientStats.forEach(stat => {
                  const values = allRecords
                    .map(r => r[stat.field])
                    .filter(v => v !== null && v !== undefined);

                  let result;
                  if (stat.operation === 'median') {
                    const sorted = [...values].sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    result = sorted.length % 2 !== 0
                      ? sorted[mid]
                      : (sorted[mid - 1] + sorted[mid]) / 2;
                  } else if (stat.operation === 'distinct') {
                    result = new Set(values).size;
                  } else if (stat.operation === 'mean') {
                    result = values.length > 0
                      ? values.reduce((a, b) => a + b, 0) / values.length
                      : 0;
                  }

                  statValues[`stat_${stat.id}`] = formatStatValue(result, stat.format);
                  statValues[`stat_${stat.id}_value`] = result;
                  statValues[`stat_${stat.id}_label`] = stat.label || stat.id;
                });
              }
            } catch (clientStatsErr) {
              console.warn('Failed to calculate client statistics:', clientStatsErr);
            }
          }
        }

        setRealData({
          recordCount,
          records,
          dateRange,
          statValues
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching real data for preview:', err);
        setLoadError(err.message || 'Failed to load data');
        setIsLoading(false);
      }
    };

    fetchRealData();
  }, [notification]);

  // Helper: Get icon SVG by name
  const getIconSvg = (iconName) => {
    const icon = DASHBOARD_ICONS.find(i => i.id === iconName.toLowerCase() || i.name.toLowerCase() === iconName.toLowerCase());
    return icon?.svg || '';
  };

  // Helper: Generate icon HTML for {{icon_Name_Size}} placeholders
  const generateIconHtml = (iconName, size, color) => {
    const svg = getIconSvg(iconName);
    if (!svg) return '';
    // Replace width/height in SVG
    return svg.replace(/width="\d+"/, `width="${size}"`)
              .replace(/height="\d+"/, `height="${size}"`)
              .replace(/stroke="currentColor"/, `stroke="${color || '#004E7C'}"`);
  };

  // Helper: Generate statistics HTML for custom parameters
  const generateCustomStatisticsHtml = (statistics, statValues, theme, options = {}) => {
    if (!statistics || statistics.length === 0) return '';

    const primaryColor = theme?.primaryColor || '#004E7C';
    const secondaryColor = theme?.secondaryColor || '#f2f2f2';
    const mutedTextColor = theme?.mutedTextColor || '#666666';
    const valueSize = options.valueSize || '24';
    const valueAlignment = options.valueAlignment || 'center';
    const containerWidth = options.containerWidth || '100';
    const containerAlignment = options.containerAlignment || 'center';
    const labelSize = Math.max(9, Math.round(parseInt(valueSize) * 0.45));

    const cards = statistics.map(stat => {
      const value = statValues[`stat_${stat.id}`] || '-';
      const label = stat.label || stat.id;

      return `<td style="width: ${100 / statistics.length}%; padding: 10px; text-align: ${valueAlignment}; vertical-align: top;">
        <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="margin: 0; font-size: ${labelSize}px; color: ${mutedTextColor}; text-transform: uppercase; letter-spacing: 0.5px;">${label}</p>
          <p style="margin: 8px 0 0 0; font-size: ${valueSize}px; font-weight: bold; color: ${primaryColor};">${value}</p>
        </div>
      </td>`;
    }).join('');

    const tableMargin = containerAlignment === 'left'
      ? 'margin-right: auto;'
      : containerAlignment === 'right'
        ? 'margin-left: auto;'
        : 'margin: 0 auto;';
    const widthValue = containerWidth === '100' ? '100%' : `${containerWidth}%`;

    return `<div style="padding: 0; margin: 0;">
      <table style="width: ${widthValue}; border-collapse: collapse; background-color: ${secondaryColor}; border-radius: 8px; ${tableMargin}">
        <tr>${cards}</tr>
      </table>
    </div>`;
  };

  // Helper: Generate sample graph HTML
  const generateGraphHtml = (graphType, theme, options = {}) => {
    const primaryColor = theme?.primaryColor || '#004E7C';
    const accentColor = theme?.accentColor || '#0077B6';
    const textColor = theme?.textColor || '#333333';
    const mutedTextColor = theme?.mutedTextColor || '#666666';
    const title = options.title || 'Chart Preview';
    const height = parseInt(options.height) || 250;
    const alignment = options.alignment || 'center';

    // Sample data for preview
    const sampleData = [
      { label: 'Category A', value: 120 },
      { label: 'Category B', value: 85 },
      { label: 'Category C', value: 150 },
      { label: 'Category D', value: 70 },
      { label: 'Category E', value: 95 }
    ];

    const colors = [primaryColor, accentColor, '#4CAF50', '#FF9800', '#9C27B0'];
    const maxValue = Math.max(...sampleData.map(d => d.value));
    const containerMargin = alignment === 'left' ? 'margin-right: auto;'
      : alignment === 'right' ? 'margin-left: auto;'
      : 'margin: 0 auto;';

    const svgWidth = 400;
    const svgHeight = height;
    const padding = { top: 40, right: 20, bottom: 60, left: 50 };
    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;

    if (graphType === 'pie') {
      // Pie chart
      const total = sampleData.reduce((sum, d) => sum + d.value, 0);
      let currentAngle = 0;
      const cx = svgWidth / 2;
      const cy = svgHeight / 2;
      const radius = Math.min(chartWidth, chartHeight) / 2 - 20;

      const paths = sampleData.map((d, i) => {
        const angle = (d.value / total) * 2 * Math.PI;
        const x1 = cx + radius * Math.cos(currentAngle);
        const y1 = cy + radius * Math.sin(currentAngle);
        const x2 = cx + radius * Math.cos(currentAngle + angle);
        const y2 = cy + radius * Math.sin(currentAngle + angle);
        const largeArc = angle > Math.PI ? 1 : 0;
        const path = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}"/>`;
        currentAngle += angle;
        return path;
      }).join('');

      return `<div style="width: 100%; max-width: 400px; ${containerMargin}">
        ${title ? `<p style="text-align: center; font-weight: bold; margin-bottom: 10px; color: ${textColor};">${title}</p>` : ''}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto;">
          ${paths}
        </svg>
      </div>`;
    }

    // Bar chart (default)
    const barWidth = chartWidth / sampleData.length * 0.7;
    const barGap = chartWidth / sampleData.length * 0.3;

    const bars = sampleData.map((d, i) => {
      const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const y = padding.top + chartHeight - barHeight;
      const color = colors[i % colors.length];

      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>
        <text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="${textColor}">${d.value}</text>
        <text x="${x + barWidth/2}" y="${svgHeight - 25}" text-anchor="middle" font-size="9" fill="${mutedTextColor}">${d.label}</text>`;
    }).join('');

    return `<div style="width: 100%; max-width: 400px; ${containerMargin}">
      ${title ? `<p style="text-align: center; font-weight: bold; margin-bottom: 10px; color: ${textColor};">${title}</p>` : ''}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto;">
        <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${svgWidth - padding.right}" y2="${padding.top + chartHeight}" stroke="#ddd" stroke-width="1"/>
        ${bars}
      </svg>
    </div>`;
  };

  // Helper: Generate data table HTML from real records
  const generateRealDataTable = (records, displayFields, theme) => {
    if (!records || records.length === 0) {
      return '<p style="color: #666; font-style: italic;">No records found for this period.</p>';
    }

    const fields = displayFields.length > 0
      ? displayFields.slice(0, 5) // Limit to 5 columns max
      : Object.keys(records[0]).slice(0, 3).map(f => ({ field: f, label: f }));

    const secondaryColor = theme?.secondaryColor || '#f2f2f2';
    const borderColor = theme?.borderColor || '#dddddd';

    const headerCells = fields.map(f => {
      const label = typeof f === 'string' ? f : (f.label || f.field);
      return `<th style="text-align: left; padding: 10px 8px; background-color: ${secondaryColor}; border-bottom: 2px solid ${borderColor};">${label}</th>`;
    }).join('');

    const bodyRows = records.slice(0, 10).map(record => {
      const cells = fields.map(f => {
        const fieldName = typeof f === 'string' ? f : f.field;
        let value = record[fieldName];
        // Format date values
        if (value && typeof value === 'number' && value > 1000000000000) {
          value = new Date(value).toLocaleDateString();
        }
        return `<td style="padding: 10px 8px; border-bottom: 1px solid ${borderColor};">${value ?? '-'}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  };

  // Use generateSampleContext to get all standard placeholders (as fallback)
  const customTemplate = notification?.customTemplate || {};
  const sampleContext = generateSampleContext(notification || {}, customTemplate, orgData || {}, {
    mockRecordCount: realData?.recordCount ?? 42
  });

  // Override with notification-specific values
  sampleContext.organizationName = orgData?.name || 'Organization Name';
  sampleContext.organizationId = orgData?.id || 'org_id';
  sampleContext.notificationName = notification?.name || 'Notification';
  sampleContext.notificationId = notification?.id || 'notif_id';

  // Override with real data when available
  if (realData) {
    const theme = customTemplate.theme || {};

    // Use real record count
    sampleContext.recordCount = String(realData.recordCount);

    // Use real date range
    sampleContext.dateRangeStart = realData.dateRange.startStr;
    sampleContext.dateRangeEnd = realData.dateRange.endStr;
    sampleContext.dateRangeStartTime = realData.dateRange.startTimeStr;
    sampleContext.dateRangeEndTime = realData.dateRange.endTimeStr;

    // Use real data table
    sampleContext.dataTable = generateRealDataTable(
      realData.records,
      notification?.source?.displayFields || [],
      theme
    );

    // Use real statistics
    if (realData.statValues) {
      Object.assign(sampleContext, realData.statValues);
    }

    // Update more records message
    sampleContext.moreRecordsMessage = realData.recordCount > 10
      ? `<p style="font-style: italic; color: ${theme.mutedTextColor || '#666'}; margin-top: 15px; font-size: 13px;">Showing first 10 of ${realData.recordCount} records. Download the CSV to see all data.</p>`
      : '';
  }

  // Pre-generate dynamic placeholders for visual elements (icons, statistics, graphs)
  const theme = customTemplate.theme || {};
  const statistics = customTemplate.statistics || [];
  const visualElements = customTemplate.visualElements || [];

  // Generate statistics HTML placeholders for each statistics/row element
  visualElements.forEach(el => {
    if (el.type === 'statistics') {
      const selectedIds = el.selectedStatistics || [];
      const statsToShow = selectedIds.length > 0
        ? statistics.filter(s => selectedIds.includes(s.id))
        : statistics;

      const valueSize = el.valueSize || '24';
      const valueAlignment = el.valueAlignment || 'center';
      const containerWidth = el.containerWidth || '100';
      const containerAlignment = el.containerAlignment || 'center';
      const key = `statisticsHtml_${el.id}_${valueSize}_${valueAlignment}_${containerWidth}_${containerAlignment}`;
      sampleContext[key] = generateCustomStatisticsHtml(statsToShow, sampleContext, theme, {
        valueSize,
        valueAlignment,
        containerWidth,
        containerAlignment
      });
    } else if (el.type === 'row' && el.contentType === 'statistics') {
      const selectedIds = el.selectedStatistics || [];
      const statsToShow = selectedIds.length > 0
        ? statistics.filter(s => selectedIds.includes(s.id))
        : statistics;

      const valueSize = el.statisticsValueSize || '24';
      const valueAlignment = el.statisticsValueAlignment || 'left';
      const containerWidth = el.statisticsContainerWidth || '100';
      const containerAlignment = el.statisticsContainerAlignment || 'center';
      const key = `statisticsHtml_${el.id}_${valueSize}_${valueAlignment}_${containerWidth}_${containerAlignment}`;
      sampleContext[key] = generateCustomStatisticsHtml(statsToShow, sampleContext, theme, {
        valueSize,
        valueAlignment,
        containerWidth,
        containerAlignment
      });
    } else if (el.type === 'graph') {
      sampleContext[`graph_${el.id}`] = generateGraphHtml(el.graphType || 'bar', theme, {
        title: el.title || '',
        height: el.height || '250',
        alignment: el.alignment || 'center'
      });
    }

    // Generate icon placeholder if element has an icon
    if (el.iconName) {
      const iconSize = el.iconSize || '32';
      sampleContext[`icon_${el.iconName}_${iconSize}`] = generateIconHtml(el.iconName, iconSize, theme.primaryColor || accentColor);
    }
  });

  // Check for custom template
  const hasCustomTemplate = notification?.customTemplate?.html;

  // Generate email HTML preview
  const generateEmailHtml = () => {
    if (hasCustomTemplate) {
      let html = notification.customTemplate.html;

      // Replace all placeholders from sampleContext (including pre-generated dynamic ones)
      Object.entries(sampleContext).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        html = html.replace(regex, value);
      });

      // Process any remaining icon placeholders that weren't pre-generated: {{icon_IconName_Size}}
      html = html.replace(/\{\{icon_(\w+)_(\d+)\}\}/g, (match, iconName, size) => {
        return generateIconHtml(iconName, size, theme.primaryColor || accentColor);
      });

      // Process any remaining graph placeholders: {{graph_elementId}}
      html = html.replace(/\{\{graph_([^}]+)\}\}/g, (match, elementId) => {
        // Find the graph element configuration
        const graphElement = visualElements.find(el => el.id === elementId && el.type === 'graph');
        if (graphElement) {
          return generateGraphHtml(graphElement.graphType || 'bar', theme, {
            title: graphElement.title,
            height: graphElement.height,
            alignment: graphElement.alignment
          });
        }
        // Default bar chart for unknown graphs
        return generateGraphHtml('bar', theme, { title: 'Chart Preview' });
      });

      // Process any remaining statistics placeholders as fallback
      html = html.replace(/\{\{statisticsHtml_([^}]+)\}\}/g, () => {
        // Return basic statistics HTML if we have statistics defined
        if (statistics.length > 0) {
          return generateCustomStatisticsHtml(statistics, sampleContext, theme, {});
        }
        return '';
      });

      return html;
    }

    // Default template
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: ${accentColor}; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${sampleContext.organizationName}</h1>
        <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 16px;">${sampleContext.notificationName}</h2>
      </div>

      <div style="padding: 20px;">
        <p style="color: #666; margin: 0 0 15px 0;">
          <strong>Period:</strong> ${sampleContext.dateRangeStart} to ${sampleContext.dateRangeEnd}<br>
          <strong>Records:</strong> ${sampleContext.recordCount}
        </p>

        ${sampleContext.emailIntro}

        ${sampleContext.downloadButton}

        ${sampleContext.dataTable}

        ${sampleContext.moreRecordsMessage}
      </div>

      <div style="padding: 15px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #888;">
        You are receiving this because you subscribed to notifications.<br>
        <a href="#" style="color: #666;">Manage Preferences</a>
      </div>
    </div>`;
  };

  const previewWidth = previewMode === 'mobile' ? '375px' : '600px';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5" style={{ color: accentColor }} />
            <div>
              <h3 className="font-bold text-slate-800">Email Preview</h3>
              <p className="text-xs text-slate-500">{notification?.name} - {realData ? 'Live data preview' : isLoading ? 'Loading...' : 'Sample data'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop/Mobile Toggle */}
            <div className="flex items-center bg-slate-100 rounded p-0.5">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`p-1.5 rounded transition-colors ${
                  previewMode === 'desktop'
                    ? 'bg-white shadow-sm text-slate-700'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Desktop view (600px)"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`p-1.5 rounded transition-colors ${
                  previewMode === 'mobile'
                    ? 'bg-white shadow-sm text-slate-700'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Mobile view (375px)"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Data Status Notice */}
        {realData ? (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs text-emerald-700 shrink-0">
            <Bell className="w-4 h-4" />
            <span>
              Showing live data: <strong>{realData.recordCount} records</strong> from {realData.dateRange.startStr} to {realData.dateRange.endStr}
            </span>
          </div>
        ) : loadError ? (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-700 shrink-0">
            <Bell className="w-4 h-4" />
            <span>Using sample data. {loadError === 'No data source configured' ? 'Configure a data source to see live data.' : `Could not load live data: ${loadError}`}</span>
          </div>
        ) : isLoading ? (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-xs text-blue-700 shrink-0">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span>Loading live data from service...</span>
          </div>
        ) : (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-700 shrink-0">
            <Bell className="w-4 h-4" />
            <span>This preview uses sample data. Actual emails will contain real data from your configured source.</span>
          </div>
        )}

        {/* Preview Container */}
        <div className="flex-1 overflow-auto bg-slate-100 p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin w-10 h-10 border-3 border-t-transparent rounded-full mb-4" style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
              <p className="text-slate-500 text-sm">Loading email preview with live data...</p>
            </div>
          ) : (
            <div
              className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
              style={{ maxWidth: previewWidth }}
            >
              <div dangerouslySetInnerHTML={{ __html: generateEmailHtml() }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center shrink-0 bg-white">
          <p className="text-xs text-slate-400">
            Preview width: {previewMode === 'mobile' ? '375px (mobile)' : '600px (desktop)'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-white rounded-lg text-sm font-medium"
            style={{ backgroundColor: accentColor }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
