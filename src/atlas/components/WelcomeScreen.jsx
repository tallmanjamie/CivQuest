// src/atlas/components/WelcomeScreen.jsx
// Welcome screen shown on first load
// Uses themeColors utility for proper dynamic theming

import React from 'react';
import { Map, Search, Table2, MessageSquare } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

export default function WelcomeScreen({ config, onGetStarted }) {
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
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
          {config?.messages?.welcomeTitle && (
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              {config.messages.welcomeTitle}
            </h1>
          )}
          {config?.messages?.welcomeText && (
            <p className="text-slate-600 max-w-md mx-auto">
              {config.messages.welcomeText}
            </p>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: colors.bg100 }}
            >
              <MessageSquare className="w-6 h-6" style={{ color: colors.text600 }} />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Chat Search</h3>
            <p className="text-sm text-slate-600">
              Ask questions in natural language to find properties
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: colors.bg100 }}
            >
              <Map className="w-6 h-6" style={{ color: colors.text600 }} />
            </div>
            <h3 className="font-semibold text-slate-800 mb-2">Interactive Map</h3>
            <p className="text-sm text-slate-600">
              Explore properties visually with powerful mapping tools
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: colors.bg100 }}
            >
              <Table2 className="w-6 h-6" style={{ color: colors.text600 }} />
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
            className="px-8 py-3 text-white rounded-full font-semibold transition shadow-lg"
            style={{ 
              backgroundColor: colors.bg600,
              boxShadow: `0 4px 14px 0 ${colors.bg200}`
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg700}
            onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg600}
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
