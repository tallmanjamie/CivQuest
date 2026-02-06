// src/admin/components/FirebaseCleanup.jsx
// Firebase Data Cleanup Tool for Super Admins
// Scans for and removes orphaned data across all Firestore collections

import React, { useState, useCallback } from 'react';
import {
  Trash2,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Shield,
  Bell,
  Map,
  Users,
  UserX,
  UserPlus,
  History,
  Clock,
  Archive,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertOctagon,
  Info
} from 'lucide-react';
import {
  runFullScan,
  cleanCategory,
  CLEANUP_CATEGORIES
} from '../../shared/services/firebaseCleanup';

const ICON_MAP = {
  Bell,
  Map,
  Users,
  UserX,
  Shield,
  UserPlus,
  History,
  Clock,
  Archive
};

const SEVERITY_COLORS = {
  high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' }
};

/**
 * Format an issue for display based on its type.
 */
function formatIssue(issue) {
  switch (issue.type) {
    case 'orphaned_user_document':
      return {
        primary: issue.email,
        secondary: `UID: ${issue.userId}`,
        detail: issue.reason
      };
    case 'orphaned_subscription':
      return {
        primary: issue.email,
        secondary: `Subscription key: ${issue.key}`,
        detail: issue.reason
      };
    case 'orphaned_atlas_access':
      return {
        primary: issue.email,
        secondary: `Atlas access for org: ${issue.orgId}`,
        detail: issue.reason
      };
    case 'orphaned_notify_subscriber':
      return {
        primary: issue.email,
        secondary: `Subscriber in org: ${issue.orgId}`,
        detail: issue.reason
      };
    case 'orphaned_admin':
      return {
        primary: issue.email,
        secondary: `Org admin for: ${issue.organizationId}`,
        detail: issue.reason
      };
    case 'orphaned_invitation':
      return {
        primary: issue.email,
        secondary: `${issue.orphanedKeys.length} orphaned key${issue.orphanedKeys.length !== 1 ? 's' : ''}`,
        detail: issue.orphanedKeys.join(', ')
      };
    case 'orphaned_log':
      return {
        primary: `Log ${issue.logId.substring(0, 12)}...`,
        secondary: `Organization: ${issue.organizationId}`,
        detail: issue.reason
      };
    case 'orphaned_force_queue':
      return {
        primary: `Queue ${issue.queueId.substring(0, 12)}...`,
        secondary: `Org: ${issue.organizationId}${issue.notificationId ? ` / Notif: ${issue.notificationId}` : ''}`,
        detail: issue.reason
      };
    case 'legacy_data':
      return {
        primary: issue.label,
        secondary: `Path: ${issue.path}`,
        detail: issue.reason
      };
    default:
      return {
        primary: issue.type,
        secondary: JSON.stringify(issue),
        detail: ''
      };
  }
}

/**
 * Category card component showing scan results and cleanup actions.
 */
function CategoryCard({ categoryKey, meta, issues, onClean, cleaning, cleaned, accentColor }) {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = ICON_MAP[meta.icon] || Info;
  const severity = SEVERITY_COLORS[meta.severity] || SEVERITY_COLORS.low;
  const count = issues.length;
  const isClean = count === 0;

  return (
    <div className={`rounded-lg border ${isClean ? 'border-slate-200 bg-white' : severity.border + ' ' + severity.bg}`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => !isClean && setExpanded(!expanded)}
      >
        <div className={`p-2 rounded-lg ${isClean ? 'bg-green-100' : severity.badge.split(' ')[0]}`}>
          <IconComponent className={`w-5 h-5 ${isClean ? 'text-green-600' : severity.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-800">{meta.label}</h3>
            {isClean ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" /> Clean
              </span>
            ) : cleaned ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" /> Cleaned
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severity.badge}`}>
                {count} issue{count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{meta.description}</p>
        </div>

        {!isClean && !cleaned && (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClean(categoryKey);
              }}
              disabled={cleaning}
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {cleaning ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cleaning...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Clean
                </span>
              )}
            </button>
            {count > 0 && (
              expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </div>
        )}
      </div>

      {expanded && count > 0 && !cleaned && (
        <div className="border-t border-slate-200 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Item</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Details</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.map((issue, idx) => {
                const formatted = formatIssue(issue);
                return (
                  <tr key={idx} className="hover:bg-white/60">
                    <td className="px-4 py-2 text-slate-800 font-medium">{formatted.primary}</td>
                    <td className="px-4 py-2 text-slate-600">{formatted.secondary}</td>
                    <td className="px-4 py-2 text-slate-500">{formatted.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Main Firebase Cleanup component for the super admin System section.
 */
export default function FirebaseCleanup({ db, addToast, confirm, accentColor = '#004E7C' }) {
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({});
  const [cleaningCategory, setCleaningCategory] = useState(null);
  const [cleanedCategories, setCleanedCategories] = useState(new Set());

  const totalIssues = scanResults
    ? Object.values(scanResults).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResults(null);
    setScanProgress({});
    setCleanedCategories(new Set());

    try {
      const results = await runFullScan((category, status) => {
        setScanProgress(prev => ({ ...prev, [category]: status }));
      });
      setScanResults(results);

      const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
      if (total === 0) {
        addToast('Scan complete - no orphaned data found', 'success');
      } else {
        addToast(`Scan complete - found ${total} issue${total !== 1 ? 's' : ''} across ${Object.values(results).filter(a => a.length > 0).length} categories`, 'warning');
      }
    } catch (err) {
      console.error('[FirebaseCleanup] Scan error:', err);
      addToast(`Scan failed: ${err.message}`, 'error');
    } finally {
      setScanning(false);
    }
  }, [addToast]);

  const handleClean = useCallback((categoryKey) => {
    const issues = scanResults[categoryKey];
    const meta = CLEANUP_CATEGORIES[categoryKey];

    confirm({
      title: `Clean ${meta.label}?`,
      message: `This will permanently remove ${issues.length} orphaned item${issues.length !== 1 ? 's' : ''}. This action cannot be undone.`,
      confirmLabel: `Clean ${issues.length} item${issues.length !== 1 ? 's' : ''}`,
      destructive: true,
      onConfirm: async () => {
        setCleaningCategory(categoryKey);
        try {
          const cleaned = await cleanCategory(categoryKey, issues);
          setCleanedCategories(prev => new Set([...prev, categoryKey]));
          addToast(`Cleaned ${cleaned} item${cleaned !== 1 ? 's' : ''} from ${meta.label}`, 'success');
        } catch (err) {
          console.error(`[FirebaseCleanup] Clean error for ${categoryKey}:`, err);
          addToast(`Cleanup failed: ${err.message}`, 'error');
        } finally {
          setCleaningCategory(null);
        }
      }
    });
  }, [scanResults, confirm, addToast]);

  const handleCleanAll = useCallback(() => {
    const categoriesToClean = Object.entries(scanResults)
      .filter(([key, issues]) => issues.length > 0 && !cleanedCategories.has(key));

    if (categoriesToClean.length === 0) {
      addToast('Nothing to clean', 'info');
      return;
    }

    const totalToClean = categoriesToClean.reduce((sum, [, issues]) => sum + issues.length, 0);

    confirm({
      title: 'Clean All Orphaned Data?',
      message: `This will permanently remove ${totalToClean} orphaned item${totalToClean !== 1 ? 's' : ''} across ${categoriesToClean.length} categor${categoriesToClean.length !== 1 ? 'ies' : 'y'}. This action cannot be undone.`,
      confirmLabel: `Clean all ${totalToClean} items`,
      destructive: true,
      onConfirm: async () => {
        for (const [categoryKey, issues] of categoriesToClean) {
          setCleaningCategory(categoryKey);
          try {
            await cleanCategory(categoryKey, issues);
            setCleanedCategories(prev => new Set([...prev, categoryKey]));
          } catch (err) {
            console.error(`[FirebaseCleanup] Clean error for ${categoryKey}:`, err);
            addToast(`Failed to clean ${CLEANUP_CATEGORIES[categoryKey].label}: ${err.message}`, 'error');
            setCleaningCategory(null);
            return;
          }
        }
        setCleaningCategory(null);
        addToast(`Successfully cleaned ${totalToClean} orphaned items`, 'success');
      }
    });
  }, [scanResults, cleanedCategories, confirm, addToast]);

  const scanSteps = [
    { key: 'index', label: 'Loading organization & user index' },
    { key: 'authVerify', label: 'Verifying users against Firebase Auth' },
    { key: 'userDocuments', label: 'Scanning orphaned user documents' },
    { key: 'subscriptions', label: 'Scanning subscriptions' },
    { key: 'atlasAccess', label: 'Scanning Atlas access' },
    { key: 'notifySubscribers', label: 'Scanning notify subscribers' },
    { key: 'admins', label: 'Scanning admin entries' },
    { key: 'invitations', label: 'Scanning invitations' },
    { key: 'logs', label: 'Scanning logs' },
    { key: 'forceQueue', label: 'Scanning force queue' },
    { key: 'legacy', label: 'Scanning legacy collections' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Firebase Cleanup</h2>
          <p className="text-slate-500 mt-1">
            Scan for and remove orphaned data across all Firestore collections
          </p>
        </div>

        <div className="flex items-center gap-3">
          {scanResults && totalIssues > 0 && (
            <button
              onClick={handleCleanAll}
              disabled={scanning || cleaningCategory || cleanedCategories.size === Object.keys(scanResults).filter(k => scanResults[k].length > 0).length}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clean All
            </button>
          )}
          <button
            onClick={handleScan}
            disabled={scanning || cleaningCategory}
            className="px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : scanResults ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-scan
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Run Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan Progress */}
      {scanning && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Scan Progress</h3>
          <div className="space-y-2">
            {scanSteps.map(step => {
              const status = scanProgress[step.key];
              return (
                <div key={step.key} className="flex items-center gap-3">
                  {status === 'done' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : status === 'scanning' || status === 'loading' ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                  )}
                  <span className={`text-sm ${status === 'done' ? 'text-slate-500' : status ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Scan Yet */}
      {!scanning && !scanResults && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Scan Results</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Run a scan to check all Firestore collections for orphaned data including
            deleted user references, non-existent organization links, and legacy collection remnants.
          </p>
          <button
            onClick={handleScan}
            className="px-6 py-2.5 text-white rounded-lg font-medium inline-flex items-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            <Search className="w-4 h-4" />
            Run Full Scan
          </button>
        </div>
      )}

      {/* Scan Results */}
      {scanResults && !scanning && (
        <>
          {/* Summary */}
          <div className={`rounded-lg border p-4 flex items-center gap-3 ${
            totalIssues === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            {totalIssues === 0 ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-800">All clean</p>
                  <p className="text-sm text-green-600">No orphaned data was found across any collections.</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    Found {totalIssues} orphaned item{totalIssues !== 1 ? 's' : ''} across {Object.values(scanResults).filter(a => a.length > 0).length} categor{Object.values(scanResults).filter(a => a.length > 0).length !== 1 ? 'ies' : 'y'}
                  </p>
                  <p className="text-sm text-amber-600">Review and clean each category below, or use Clean All to remove everything at once.</p>
                </div>
              </>
            )}
          </div>

          {/* Category Cards */}
          <div className="space-y-3">
            {Object.entries(CLEANUP_CATEGORIES).map(([key, meta]) => (
              <CategoryCard
                key={key}
                categoryKey={key}
                meta={meta}
                issues={scanResults[key] || []}
                onClean={handleClean}
                cleaning={cleaningCategory === key}
                cleaned={cleanedCategories.has(key)}
                accentColor={accentColor}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
