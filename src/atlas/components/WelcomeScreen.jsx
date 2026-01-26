// src/atlas/components/WelcomeScreen.jsx
// Welcome screen shown on first load

import React from 'react';
import { Map, Search, Table2, MessageSquare } from 'lucide-react';

export default function WelcomeScreen({ config, onGetStarted }) {
  const themeColor = config?.ui?.themeColor || 'sky';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          {config?.ui?.logoLeft && (
            <img 
              src={config.ui.logoLeft} 
              alt="Logo" 
              className="w-20 h-20 object-contain mx-auto mb-4 rounded-full bg-white shadow-lg p-2"
            />
          )}
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            {config?.messages?.welcomeTitle || 'Welcome to CivQuest Atlas'}
          </h1>
          <p className="text-slate-600 max-w-md mx-auto">
            {config?.messages?.welcomeText || 'Explore property data through interactive maps, tables, and AI-powered search.'}
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className={`w-12 h-12 bg-${themeColor}-100 rounded-lg flex items-center justify-center mb-4`}>
              <MessageSquare className={`w-6 h-6 text-${themeColor}-600`} />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Chat Search</h3>
            <p className="text-sm text-slate-600">
              Ask questions in natural language to find properties
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className={`w-12 h-12 bg-${themeColor}-100 rounded-lg flex items-center justify-center mb-4`}>
              <Map className={`w-6 h-6 text-${themeColor}-600`} />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Interactive Map</h3>
            <p className="text-sm text-slate-600">
              Explore properties visually with powerful mapping tools
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className={`w-12 h-12 bg-${themeColor}-100 rounded-lg flex items-center justify-center mb-4`}>
              <Table2 className={`w-6 h-6 text-${themeColor}-600`} />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Data Table</h3>
            <p className="text-sm text-slate-600">
              Sort, filter, and export property data with ease
            </p>
          </div>
        </div>

        {/* Get Started Button */}
        <div className="text-center">
          <button
            onClick={onGetStarted}
            className={`px-8 py-3 bg-${themeColor}-600 text-white rounded-full font-semibold hover:bg-${themeColor}-700 transition shadow-lg shadow-${themeColor}-200`}
          >
            Get Started
          </button>
        </div>

        {/* Example Questions */}
        {config?.messages?.exampleQuestions?.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 mb-3">Try asking:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {config.messages.exampleQuestions.slice(0, 3).map((q, i) => (
                <span 
                  key={i}
                  className="text-xs bg-white px-3 py-1.5 rounded-full text-slate-600 shadow-sm"
                >
                  "{q}"
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
