// src/atlas/components/ChatView.jsx
// CivQuest Atlas - Chat View Component  
// AI-powered conversational property search interface

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  HelpCircle, 
  Plus, 
  Clock, 
  Filter, 
  MapPin,
  ChevronDown,
  Loader2,
  AlertCircle,
  Lightbulb,
  X,
  Map,
  Table2
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

// Gemini API for query translation
const GEMINI_API_KEY = 'AIzaSyBhvt_ue8AiQy8ChwQM2JMK-0oBvUBaGes';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * ChatView Component
 * Conversational interface for property search
 */
export default function ChatView() {
  const {
    config,
    activeMap,
    searchResults,
    updateSearchResults,
    searchLocation,
    setSearchLocation,
    isSearching,
    mode,
    setMode,
    enabledModes,
    mapViewRef,
    tableViewRef
  } = useAtlas();

  // State
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingText, setLoadingText] = useState('Processing...');

  // Refs
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Theme
  const themeColor = config?.ui?.themeColor || 'sky';
  const botAvatar = config?.ui?.botAvatar || config?.ui?.logoLeft;

  /**
   * Load search history from localStorage
   */
  useEffect(() => {
    const key = `atlas_history_${config?.id || 'default'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, [config?.id]);

  /**
   * Save search to history
   */
  const saveToHistory = useCallback((query) => {
    const key = `atlas_history_${config?.id || 'default'}`;
    const newHistory = [
      { query, timestamp: Date.now() },
      ...searchHistory.filter(h => h.query !== query).slice(0, 19)
    ];
    setSearchHistory(newHistory);
    localStorage.setItem(key, JSON.stringify(newHistory));
  }, [config?.id, searchHistory]);

  /**
   * Scroll to bottom of chat
   */
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  /**
   * Add message to chat
   */
  const addMessage = useCallback((type, content, extra = {}) => {
    const message = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    };
    setMessages(prev => [...prev, message]);
    setTimeout(scrollToBottom, 50);
    return message;
  }, [scrollToBottom]);

  /**
   * Translate natural language to SQL using Gemini
   */
  const translateQuery = useCallback(async (userQuery) => {
    const systemPrompt = activeMap?.systemPrompt || config?.data?.systemPrompt;
    if (!systemPrompt) {
      throw new Error('No system prompt configured');
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Query: ${userQuery}` }] }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to translate query');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    return JSON.parse(jsonMatch[0]);
  }, [activeMap?.systemPrompt, config?.data?.systemPrompt]);

  /**
   * Execute ArcGIS query
   */
  const executeQuery = useCallback(async (queryParams) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) {
      throw new Error('No data endpoint configured');
    }

    const params = new URLSearchParams({
      f: 'json',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326'
    });

    // Handle different query types
    if (queryParams.parcelId) {
      // Direct parcel lookup
      params.set('where', `PARCELID = '${queryParams.parcelId}'`);
    } else if (queryParams.address) {
      // Address geocoding first, then spatial query
      const geocodeResult = await geocodeAddress(queryParams.address);
      if (geocodeResult) {
        params.set('geometry', JSON.stringify(geocodeResult.location));
        params.set('geometryType', 'esriGeometryPoint');
        params.set('spatialRel', 'esriSpatialRelIntersects');
        params.set('inSR', '4326');
        setSearchLocation(geocodeResult);
      } else {
        // Fallback to address text search
        params.set('where', `PROPERTYADDRESS LIKE '%${queryParams.address.toUpperCase()}%'`);
      }
    } else if (queryParams.where) {
      // SQL query
      params.set('where', queryParams.where);
      
      if (queryParams.orderBy) {
        params.set('orderByFields', queryParams.orderBy);
      }
      
      if (queryParams.limit) {
        params.set('resultRecordCount', String(queryParams.limit));
      }
    } else {
      throw new Error('Invalid query parameters');
    }

    const response = await fetch(`${endpoint}/query?${params}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Query failed');
    }

    return data;
  }, [activeMap?.endpoint, config?.data?.endpoint, setSearchLocation]);

  /**
   * Geocode an address
   */
  const geocodeAddress = useCallback(async (address) => {
    const geocoder = activeMap?.geocoder || config?.data?.geocoder;
    if (!geocoder?.url) return null;

    try {
      const params = new URLSearchParams({
        SingleLine: address,
        f: 'json',
        outSR: '4326',
        maxLocations: 1,
        ...geocoder.params
      });

      const response = await fetch(`${geocoder.url}/findAddressCandidates?${params}`);
      const data = await response.json();

      if (data.candidates?.length > 0) {
        const candidate = data.candidates[0];
        return {
          location: {
            x: candidate.location.x,
            y: candidate.location.y
          },
          address: candidate.address,
          score: candidate.score
        };
      }
    } catch (e) {
      console.warn('[ChatView] Geocoding failed:', e);
    }

    return null;
  }, [activeMap?.geocoder, config?.data?.geocoder]);

  /**
   * Handle search submission
   */
  const handleSearch = useCallback(async (query = inputValue) => {
    if (!query?.trim() || isLoading) return;

    const trimmedQuery = query.trim();
    setInputValue('');
    setShowMenu(false);
    setSuggestions([]);

    // Add user message
    addMessage('user', trimmedQuery);

    setIsLoading(true);
    setLoadingText('Analyzing your question...');

    try {
      // Translate to SQL
      const queryParams = await translateQuery(trimmedQuery);
      
      setLoadingText('Searching database...');

      // Execute query
      const results = await executeQuery(queryParams);
      const features = results.features || [];

      // Update results
      updateSearchResults({ features });

      // Save to history
      saveToHistory(trimmedQuery);

      // Add result message
      if (features.length === 0) {
        addMessage('ai', 'I couldn\'t find any properties matching your search. Try adjusting your criteria or check the spelling of any addresses.');
      } else if (features.length === 1) {
        const feature = features[0];
        const address = feature.attributes?.PROPERTYADDRESS || 'Property';
        addMessage('ai', `I found **${address}**. Here are the details:`, {
          feature,
          showDetails: true
        });
        
        // Zoom to feature on map if map mode enabled
        if (mapViewRef?.current?.zoomToFeature && enabledModes.includes('map')) {
          mapViewRef.current.zoomToFeature(feature);
        }
      } else {
        addMessage('ai', `I found **${features.length}** properties matching your search.`, {
          features,
          showResultActions: true
        });
        
        // Render on map
        if (mapViewRef?.current?.renderResults) {
          mapViewRef.current.renderResults(features);
        }
      }

    } catch (err) {
      console.error('[ChatView] Search error:', err);
      addMessage('error', `Sorry, I encountered an error: ${err.message}. Please try rephrasing your question.`);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, addMessage, translateQuery, executeQuery, updateSearchResults, saveToHistory, mapViewRef, enabledModes]);

  /**
   * Handle example question click
   */
  const handleExampleClick = useCallback((question) => {
    setInputValue(question);
    inputRef.current?.focus();
  }, []);

  /**
   * Handle input change with autocomplete
   */
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInputValue(value);

    // Clear suggestions if empty
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    // Check autocomplete patterns
    const autocompleteConfig = activeMap?.autocomplete || [];
    for (const ac of autocompleteConfig) {
      const pattern = new RegExp(ac.pattern);
      if (pattern.test(value)) {
        // Could fetch suggestions from API here
        // For now, just show the type hint
        setSuggestions([{
          type: ac.type,
          label: ac.label,
          icon: ac.icon
        }]);
        return;
      }
    }

    setSuggestions([]);
  }, [activeMap?.autocomplete]);

  /**
   * Handle key press
   */
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  /**
   * Clear chat history
   */
  const clearHistory = useCallback(() => {
    const key = `atlas_history_${config?.id || 'default'}`;
    localStorage.removeItem(key);
    setSearchHistory([]);
    setShowHistory(false);
  }, [config?.id]);

  // Example questions from config
  const exampleQuestions = config?.messages?.exampleQuestions || [];

  return (
    <div className="flex flex-col h-full">
      {/* Chat Container */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome Message */}
          <WelcomeMessage 
            config={config}
            botAvatar={botAvatar}
            onExampleClick={handleExampleClick}
          />

          {/* Messages */}
          {messages.map((msg) => (
            <ChatMessage 
              key={msg.id}
              message={msg}
              botAvatar={botAvatar}
              themeColor={themeColor}
              onViewOnMap={() => {
                if (msg.feature && mapViewRef?.current) {
                  mapViewRef.current.zoomToFeature(msg.feature);
                  if (enabledModes.includes('map')) setMode('map');
                }
              }}
              onViewInTable={() => {
                if (enabledModes.includes('table')) setMode('table');
              }}
              enabledModes={enabledModes}
            />
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
                {botAvatar ? (
                  <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
                ) : (
                  <div className={`w-full h-full bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
                    <Loader2 className={`w-5 h-5 text-${themeColor}-600 animate-spin`} />
                  </div>
                )}
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 flex items-center gap-2">
                <Loader2 className={`w-4 h-4 text-${themeColor}-600 animate-spin`} />
                <span className="text-sm text-slate-500">{loadingText}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <footer className="border-t border-slate-200 bg-white p-3">
        <div className="max-w-4xl mx-auto relative">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
                  <span>{s.icon}</span>
                  <span>{s.label} detected</span>
                </div>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div className="relative flex items-center gap-2">
            {/* Menu Button */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Menu Dropdown */}
            {showMenu && (
              <div className="absolute bottom-12 left-0 bg-white border border-slate-200 shadow-xl rounded-xl w-56 p-1.5 z-50">
                <button
                  onClick={() => { setShowAdvanced(true); setShowMenu(false); }}
                  className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left"
                >
                  <div className={`w-8 h-8 rounded-full bg-${themeColor}-100 text-${themeColor}-600 flex items-center justify-center`}>
                    <Filter className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-700">Advanced Search</span>
                    <span className="block text-xs text-slate-400">Filter by specific fields</span>
                  </div>
                </button>
                <button
                  onClick={() => { setShowHistory(true); setShowMenu(false); }}
                  className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-700">History</span>
                    <span className="block text-xs text-slate-400">View previous searches</span>
                  </div>
                </button>
              </div>
            )}

            {/* Input Field */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={activeMap?.searchPlaceholder || 'Ask about properties...'}
              className="flex-1 border border-slate-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-700"
              disabled={isLoading}
            />

            {/* Send Button */}
            <button
              onClick={() => inputValue.trim() ? handleSearch() : null}
              disabled={isLoading}
              className={`p-2 rounded-full ${
                inputValue.trim() 
                  ? `bg-${themeColor}-600 text-white hover:bg-${themeColor}-700` 
                  : 'bg-slate-100 text-slate-400'
              } transition-colors`}
              title={inputValue.trim() ? 'Search' : 'Help'}
            >
              {inputValue.trim() ? (
                <Send className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          history={searchHistory}
          onSelect={(query) => { handleSearch(query); setShowHistory(false); }}
          onClear={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}

/**
 * Welcome Message Component
 */
function WelcomeMessage({ config, botAvatar, onExampleClick }) {
  const themeColor = config?.ui?.themeColor || 'sky';

  return (
    <>
      {/* Bot Welcome */}
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
          {botAvatar ? (
            <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
          ) : (
            <div className={`w-full h-full bg-${themeColor}-100 rounded-full`} />
          )}
        </div>
        
        <div className="bg-white p-6 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] border border-slate-200">
          <h2 className="font-bold text-slate-800 text-lg mb-2">
            {config?.messages?.welcomeTitle || 'Welcome!'}
          </h2>
          <p className="text-slate-600 text-sm mb-4">
            {config?.messages?.welcomeText || 'Search for properties by address, parcel ID, or ask questions about the data.'}
          </p>

          {/* Example Questions */}
          {config?.messages?.exampleQuestions?.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Try asking:
              </h3>
              <ul className="space-y-2">
                {config.messages.exampleQuestions.map((q, i) => (
                  <li 
                    key={i}
                    onClick={() => onExampleClick(q)}
                    className={`text-sm text-${themeColor}-700 cursor-pointer hover:underline`}
                  >
                    • {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Important Note */}
      {config?.messages?.importantNote && (
        <div className="flex justify-center">
          <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-3 text-sm text-${themeColor}-800 max-w-[85%] flex items-start gap-2`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Important Note:</strong>
              <p className="mt-1">{config.messages.importantNote}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Chat Message Component
 */
function ChatMessage({ message, botAvatar, themeColor, onViewOnMap, onViewInTable, enabledModes }) {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className={`bg-${themeColor}-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[80%]`}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
        {botAvatar ? (
          <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
        ) : (
          <div className={`w-full h-full bg-${themeColor}-100 rounded-full`} />
        )}
      </div>
      
      <div className={`p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[80%] border ${
        isError 
          ? 'bg-red-50 border-red-200 text-red-800' 
          : 'bg-white border-slate-200'
      }`}>
        {/* Render markdown-style bold */}
        <div 
          className="text-sm prose prose-sm"
          dangerouslySetInnerHTML={{ 
            __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
          }}
        />

        {/* Result Actions */}
        {message.showResultActions && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
            {enabledModes.includes('map') && (
              <button
                onClick={onViewOnMap}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-${themeColor}-100 text-${themeColor}-700 rounded-full hover:bg-${themeColor}-200`}
              >
                <Map className="w-3.5 h-3.5" />
                View on Map
              </button>
            )}
            {enabledModes.includes('table') && (
              <button
                onClick={onViewInTable}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200"
              >
                <Table2 className="w-3.5 h-3.5" />
                View in Table
              </button>
            )}
          </div>
        )}

        {/* Single Feature Details */}
        {message.showDetails && message.feature && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <FeaturePreview feature={message.feature} />
            {enabledModes.includes('map') && (
              <button
                onClick={onViewOnMap}
                className={`mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-${themeColor}-100 text-${themeColor}-700 rounded-full hover:bg-${themeColor}-200`}
              >
                <MapPin className="w-3.5 h-3.5" />
                View on Map
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Feature Preview Component
 */
function FeaturePreview({ feature }) {
  const attrs = feature.attributes || {};
  const previewFields = [
    { key: 'PROPERTYADDRESS', label: 'Address' },
    { key: 'PARCELID', label: 'Parcel ID' },
    { key: 'CURRENTOWNER', label: 'Owner' },
    { key: 'PARCELCLASSDESC', label: 'Class' },
    { key: 'SALEAMOUNT', label: 'Last Sale', format: 'currency' },
    { key: 'SALEDATE', label: 'Sale Date', format: 'date' }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {previewFields.map(({ key, label, format }) => {
        let value = attrs[key];
        if (value === null || value === undefined) return null;

        if (format === 'currency' && typeof value === 'number') {
          value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
        } else if (format === 'date' && value > 1000000000000) {
          value = new Date(value).toLocaleDateString();
        }

        return (
          <div key={key}>
            <span className="text-slate-500">{label}:</span>
            <span className="ml-1 text-slate-800 font-medium">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * History Panel Component
 */
function HistoryPanel({ history, onSelect, onClear, onClose }) {
  return (
    <div className="absolute bottom-16 left-2 right-2 md:left-4 md:right-auto md:w-[450px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 flex flex-col max-h-[70vh]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600" />
          Search History
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
          >
            Clear All
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No search history found.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((item, i) => (
              <li
                key={i}
                onClick={() => onSelect(item.query)}
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
              >
                <div className="text-sm text-slate-700">{item.query}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
