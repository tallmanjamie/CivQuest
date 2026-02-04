// src/atlas/components/AccountSettings.jsx
// Account Settings modal for Atlas users
// Allows users to update their profile (first/last name) and manage ArcGIS account linking

import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  User,
  Globe,
  Loader2,
  Check,
  Unlink,
  AlertTriangle,
  Monitor
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { updateUserProfile, unlinkArcGISAccount, updateUserPreferences } from '@shared/services/users';
import {
  initiateArcGISLogin,
  getOAuthRedirectUri
} from '@shared/services/arcgis-auth';
import { getESRISettings } from '@shared/services/systemConfig';

export default function AccountSettings({ isOpen, onClose }) {
  const { user, userData, colors, config } = useAtlas();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Display preferences
  const [searchBarSize, setSearchBarSize] = useState('medium');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savedPreferences, setSavedPreferences] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setSearchBarSize(userData.preferences?.searchBarSize || 'medium');
    }
  }, [userData, config?.ui?.defaultSearchBarSize]);

  // Reset saved preferences state after showing
  useEffect(() => {
    if (savedPreferences) {
      const timer = setTimeout(() => setSavedPreferences(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [savedPreferences]);

  // Reset saved state after showing
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const hasLinkedArcGIS = userData?.linkedArcGISUsername;

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      setSaved(true);
    } catch (error) {
      console.error('[AccountSettings] Save error:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkArcGIS = async () => {
    if (!user) return;

    setUnlinking(true);
    try {
      await unlinkArcGISAccount(user.uid);
      setShowUnlinkConfirm(false);
    } catch (error) {
      console.error('[AccountSettings] Unlink error:', error);
      alert('Failed to unlink ArcGIS account. Please try again.');
    } finally {
      setUnlinking(false);
    }
  };

  const handleLinkArcGIS = async () => {
    // Fetch admin-configured ESRI client ID
    let esriClientId = null;
    try {
      const esriSettings = await getESRISettings();
      esriClientId = esriSettings?.clientId || null;
    } catch (err) {
      console.warn('Could not fetch ESRI settings, using default client ID:', err);
    }

    const redirectUri = getOAuthRedirectUri();
    // Store that we want to link (not create new account)
    sessionStorage.setItem('arcgis_oauth_action', 'link');
    initiateArcGISLogin(redirectUri, 'signin', esriClientId);
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setSavingPreferences(true);
    try {
      await updateUserPreferences(user.uid, {
        searchBarSize
      });
      setSavedPreferences(true);
    } catch (error) {
      console.error('[AccountSettings] Save preferences error:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Search bar size options
  const searchBarSizeOptions = [
    { id: 'small', label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large', label: 'Large' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: colors.bg50 }}
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5" style={{ color: colors.text600 }} />
            <h2 className="text-lg font-semibold text-slate-800">Account Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Profile Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile Information
            </h3>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-slate-900 font-medium">{user?.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': colors.bg500 }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': colors.bg500 }}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium text-sm transition disabled:opacity-50"
                style={{ backgroundColor: colors.bg600 }}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : null}
                {saved ? 'Saved!' : 'Save Profile'}
              </button>
            </div>
          </div>

          {/* Display Settings Section */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Display Settings
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Bar Size
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Adjust the size of the search bar icons and text on desktop. This setting does not affect the mobile view.
                {config?.ui?.defaultSearchBarSize && (
                  <span className="block mt-1">
                    Organization default: <span className="font-medium capitalize">{config.ui.defaultSearchBarSize}</span>
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {searchBarSizeOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSearchBarSize(option.id)}
                    className={`flex-1 px-4 py-2 border rounded-lg text-sm font-medium transition ${
                      searchBarSize === option.id
                        ? 'border-transparent text-white'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                    style={searchBarSize === option.id ? { backgroundColor: colors.bg600 } : {}}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSavePreferences}
                disabled={savingPreferences}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium text-sm transition disabled:opacity-50"
                style={{ backgroundColor: colors.bg600 }}
              >
                {savingPreferences ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedPreferences ? (
                  <Check className="w-4 h-4" />
                ) : null}
                {savedPreferences ? 'Saved!' : 'Save Preferences'}
              </button>
            </div>
          </div>

          {/* ArcGIS Account Section */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4" />
              ArcGIS Online Account
            </h3>

            {hasLinkedArcGIS ? (
              <>
                {/* Linked Account Display */}
                <div className="p-4 bg-[#E6F0F6] rounded-lg border border-[#004E7C]/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#004E7C]/10 rounded-lg">
                      <Globe className="w-5 h-5 text-[#004E7C]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#004E7C] font-medium uppercase tracking-wider mb-1">
                        Linked Account
                      </p>
                      <p className="text-slate-900 font-semibold">
                        {userData.linkedArcGISUsername}
                      </p>
                      {userData.arcgisProfile?.fullName && (
                        <p className="text-sm text-slate-600">
                          {userData.arcgisProfile.fullName}
                        </p>
                      )}
                      {userData.arcgisOrganization?.name && (
                        <p className="text-xs text-slate-500 mt-1">
                          Organization: {userData.arcgisOrganization.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unlink Button */}
                {!showUnlinkConfirm ? (
                  <button
                    onClick={() => setShowUnlinkConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition"
                  >
                    <Unlink className="w-4 h-4" />
                    Unlink ArcGIS Account
                  </button>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">
                          Unlink ArcGIS Account?
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          You can link a different ArcGIS account later.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => setShowUnlinkConfirm(false)}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleUnlinkArcGIS}
                            disabled={unlinking}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
                          >
                            {unlinking && <Loader2 className="w-3 h-3 animate-spin" />}
                            Unlink
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Link Account Button */
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">Link ArcGIS Account</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Connect your ArcGIS account for enhanced features.
                    </p>
                  </div>
                  <button
                    onClick={handleLinkArcGIS}
                    className="px-4 py-2 bg-[#0079C1] text-white rounded-lg font-medium text-sm hover:bg-[#006699] transition flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Link Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
