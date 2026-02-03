// src/notify/components/AccountTab.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import {
  initiateArcGISLogin,
  getOAuthRedirectUri
} from '@shared/services/arcgis-auth';
import { getESRISettings } from '@shared/services/systemConfig';
import {
  updateUserProfile,
  unlinkArcGISAccount
} from '@shared/services/users';
import { Settings, Ban, Globe, Loader2, User, Check, Unlink, AlertTriangle } from 'lucide-react';

export default function AccountTab({ user, userData }) {
  const [disabling, setDisabling] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
    }
  }, [userData]);

  // Reset saved state after showing
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleDisableAccount = async () => {
    setDisabling(true);
    try {
      await updateDoc(doc(db, PATHS.user(user.uid)), {
        disabled: true,
        subscriptions: {}
      });
      await signOut(auth);
    } catch (error) {
      console.error("Disable account error", error);
      alert("Failed to disable account. Please try again.");
      setDisabling(false);
    }
  };

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
      console.error('[AccountTab] Save error:', error);
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
      console.error('[AccountTab] Unlink error:', error);
      alert('Failed to unlink ArcGIS account. Please try again.');
    } finally {
      setUnlinking(false);
    }
  };

  // Handle linking ArcGIS account
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
    initiateArcGISLogin(redirectUri, 'signin', esriClientId);
  };

  const hasLinkedArcGIS = userData?.linkedArcGISUsername;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" />
          Account Settings
        </h3>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile Information
            </h4>

            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-slate-900 font-semibold">{user.email}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004E7C]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium text-sm transition hover:bg-[#003d5f] disabled:opacity-50"
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

          {/* ArcGIS Account Section */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4" />
              ArcGIS Online Account
            </h4>

            {hasLinkedArcGIS ? (
              <>
                <div className="p-4 bg-[#E6F0F6] rounded-lg border border-[#004E7C]/20">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#004E7C]/10 rounded-lg">
                      <Globe className="w-5 h-5 text-[#004E7C]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#004E7C] font-medium uppercase tracking-wider mb-1">Linked ArcGIS Account</p>
                      <p className="text-slate-900 font-semibold">{userData.linkedArcGISUsername}</p>
                      {userData.arcgisProfile?.fullName && (
                        <p className="text-sm text-slate-600">{userData.arcgisProfile.fullName}</p>
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
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">Link ArcGIS Account</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Connect your ArcGIS account for seamless authentication.
                    </p>
                  </div>
                  <button
                    onClick={handleLinkArcGIS}
                    className="px-4 py-2 bg-[#0079C1] text-white rounded-lg font-medium hover:bg-[#006699] transition-colors flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Link Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pause Feeds Section */}
          <div className="border-t border-slate-200 pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-slate-900">Pause Feeds</h4>
                <p className="text-sm text-slate-600 mt-1">Temporarily disable your account to stop receiving all updates.</p>
              </div>
              
              {!showDisableConfirm ? (
                <button 
                  onClick={() => setShowDisableConfirm(true)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Ban className="w-4 h-4" />
                  Disable Account
                </button>
              ) : (
                <div className="flex items-center gap-3 shrink-0 animate-in fade-in slide-in-from-right-4 duration-200">
                  <span className="text-sm font-medium text-slate-700 hidden sm:inline">Are you sure?</span>
                  <button 
                    onClick={() => setShowDisableConfirm(false)}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDisableAccount}
                    disabled={disabling}
                    className="px-4 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {disabling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                    Yes, Pause
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
