// src/notify/components/AccountTab.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { updateUserProfile } from '@shared/services/users';
import { Settings, Ban, Loader2, User, Check } from 'lucide-react';

export default function AccountTab({ user, userData }) {
  const [disabling, setDisabling] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
