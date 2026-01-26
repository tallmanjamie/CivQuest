// src/atlas/components/ChatView.jsx
// CivQuest Atlas - Chat View Component  
// AI-powered conversational property search interface
// Search input has been moved to unified SearchToolbar in AtlasApp

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  HelpCircle, 
  Clock, 
  MapPin,
  Loader2,
  AlertCircle,
  Lightbulb,
  X,
  Map,
  Table2,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

// Centralized Gemini configuration - update model in one place
import { getGeminiUrl, GEMINI_QUERY_CONFIG } from '../../config/geminiConfig';

/**
 * ChatView Component
 * Conversational interface for property search
 * Exposes handleSearch method for parent component to call
 */
const ChatView = forwardRef(function ChatView(props, ref) {
  const {
    config,
    activeMap,
    searchResults,
    updateSearchResults,
    searchLocation,
    setSearchLocation,
    isSearching,
    setIsSearching,
    mode,
    setMode,
    enabledModes,
    mapViewRef,
    tableViewRef,
    showHistory,
    setShowHistory,
    showAdvanced,
    setShowAdvanced
  } = useAtlas();

  // State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [loadingText, setLoadingText] = useState('Processing...');

  // Refs
  const chatContainerRef = useRef(null);

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
  const addMessage = useCallback((type, content, metadata = {}) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    }]);
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  /**
   * Translate natural language to SQL using Gemini
   */
  const translateQuery = useCallback(async (query) => {
    const systemPrompt = activeMap?.systemPrompt || config?.data?.systemPrompt;
    
    if (!systemPrompt) {
      // Fallback to simple address search
      return {
        type: 'simple',
        address: query
      };
    }

    try {
      const geminiUrl = getGeminiUrl();
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }]
          }],
          generationConfig: GEMINI_QUERY_CONFIG
        })
      });

      if (!response.ok) {
        throw new Error('Gemini API error');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Invalid response format');
    } catch (err) {
      console.warn('[ChatView] Gemini translation failed:', err);
      // Fallback to simple address search
      return {
        type: 'simple',
        address: query
      };
    }
  }, [activeMap?.systemPrompt, config?.data?.systemPrompt]);

  /**
   * Execute query against ArcGIS FeatureServer
   */
  const executeQuery = useCallback(async (queryParams) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) {
      throw new Error('No endpoint configured');
    }

    const params = new URLSearchParams({
      f: 'json',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326'
    });

    if (queryParams.type === 'simple') {
      // Simple address search
      params.set('where', `PROPERTYADDRESS LIKE '%${queryParams.address.toUpperCase()}%'`);
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
  }, [activeMap?.endpoint, config?.data?.endpoint]);

  /**
   * Handle search submission (called from parent via ref)
   */
  const handleSearch = useCallback(async (query) => {
    if (!query?.trim() || isLoading) return;

    const trimmedQuery = query.trim();

    // Add user message
    addMessage('user', trimmedQuery);

    setIsLoading(true);
    setIsSearching?.(true);
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
      setIsSearching?.(false);
    }
  }, [isLoading, addMessage, translateQuery, executeQuery, updateSearchResults, saveToHistory, mapViewRef, enabledModes, setIsSearching]);

  /**
   * Handle example question click
   */
  const handleExampleClick = useCallback((question) => {
    handleSearch(question);
  }, [handleSearch]);

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    const key = `atlas_history_${config?.id || 'default'}`;
    setSearchHistory([]);
    localStorage.removeItem(key);
  }, [config?.id]);

  // Expose handleSearch method to parent via ref
  useImperativeHandle(ref, () => ({
    handleSearch
  }), [handleSearch]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Chat Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Welcome message if no messages */}
        {messages.length === 0 && (
          <WelcomeMessage 
            config={config} 
            botAvatar={botAvatar}
            onExampleClick={handleExampleClick}
          />
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            botAvatar={botAvatar}
            themeColor={themeColor}
            onViewMap={() => setMode('map')}
            onViewTable={() => setMode('table')}
          />
        ))}

        {/* Loading indicator */}
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

      {/* Tip Footer */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>Tip: Use the search bar {config?.ui?.searchBarPosition === 'bottom' ? 'below' : 'above'} to ask questions about properties</span>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          history={searchHistory}
          onSelect={(query) => { handleSearch(query); setShowHistory(false); }}
          onClear={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
});

/**
 * Welcome Message Component
 */
function WelcomeMessage({ config, botAvatar, onExampleClick }) {
  const themeColor = config?.ui?.themeColor || 'sky';
  const exampleQuestions = config?.messages?.exampleQuestions || [];

  return (
    <>
      {/* Bot Welcome */}
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
          {botAvatar ? (
            <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
          ) : (
            <div className={`w-full h-full bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
              <HelpCircle className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2">
              {config?.messages?.welcomeTitle || 'Welcome!'}
            </h3>
            <p className="text-slate-600 text-sm">
              {config?.messages?.welcomeText || 'Search for properties using natural language. Try asking questions like:'}
            </p>
          </div>
          
          {/* Example Questions */}
          {exampleQuestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {exampleQuestions.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => onExampleClick(q)}
                  className={`px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-${themeColor}-50 hover:border-${themeColor}-200 hover:text-${themeColor}-700 transition`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Important Note */}
      {config?.messages?.importantNote && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong className="font-semibold">Note:</strong> {config.messages.importantNote}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Message Bubble Component
 */
function MessageBubble({ message, botAvatar, themeColor, onViewMap, onViewTable }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className={`max-w-[80%] bg-${themeColor}-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm`}>
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-red-100 flex-shrink-0 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl rounded-tl-none">
          <p className="text-sm text-red-800">{message.content}</p>
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
        {botAvatar ? (
          <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
        ) : (
          <div className={`w-full h-full bg-${themeColor}-100 rounded-full flex items-center justify-center`}>
            <HelpCircle className={`w-5 h-5 text-${themeColor}-600`} />
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200">
          {/* Render markdown-like content */}
          <p className="text-sm text-slate-700" dangerouslySetInnerHTML={{
            __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          }} />
          
          {/* Feature details */}
          {message.showDetails && message.feature && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <FeatureDetails feature={message.feature} themeColor={themeColor} />
            </div>
          )}
          
          {/* Result actions */}
          {message.showResultActions && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={onViewMap}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-${themeColor}-50 text-${themeColor}-700 rounded-lg text-sm font-medium hover:bg-${themeColor}-100 transition`}
              >
                <Map className="w-4 h-4" />
                View on Map
              </button>
              <button
                onClick={onViewTable}
                className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition`}
              >
                <Table2 className="w-4 h-4" />
                View in Table
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Feature Details Component
 */
function FeatureDetails({ feature, themeColor }) {
  const attrs = feature.attributes || {};
  const displayFields = Object.entries(attrs)
    .filter(([k, v]) => !k.startsWith('_') && v != null && k !== 'OBJECTID')
    .slice(0, 8);

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {displayFields.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium text-slate-500 uppercase">{key}</dt>
          <dd className="text-slate-800">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * History Panel Component
 */
function HistoryPanel({ history, onSelect, onClear, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:w-96 max-h-[80vh] rounded-t-2xl md:rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Search History</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[60vh]">
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No search history yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(item.query)}
                  className="w-full p-4 text-left hover:bg-slate-50 transition"
                >
                  <p className="text-sm text-slate-800">{item.query}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-200">
            <button
              onClick={onClear}
              className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Clear History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatView;
