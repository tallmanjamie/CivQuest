// src/atlas/AtlasApp.jsx
import React from 'react';
import Header from '@shared/components/Header';

export default function AtlasApp() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="CivQuest Atlas" subtitle="GIS Mapping Tools" />
      
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Atlas Module
          </h2>
          <p className="text-slate-600">
            Coming in Phase 2: GIS mapping and property research tools.
          </p>
        </div>
      </main>
    </div>
  );
}