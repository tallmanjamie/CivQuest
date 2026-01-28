// src/atlas/components/ChatView.jsx
// CivQuest Atlas - Chat View Component  
// AI-powered conversational property search interface
// Search input has been moved to unified SearchToolbar in AtlasApp
//
// CHANGES:
// - Removed buffer fallback from spatialQueryForParcel - now only returns exact intersecting parcel
// - Address searches should only return 1 parcel (the one the address point falls within)
// - Uses themeColors utility for proper dynamic theming

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  HelpCircle,
  MapPin,
  Loader2,
  AlertCircle,
  Lightbulb,
  Map,
  Table2,
  ExternalLink,
  Copy,
  Check,
  Download,
  FileText
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// Centralized Gemini configuration - update model in one place
import { getGeminiUrl, getGeminiFallbackUrl, GEMINI_QUERY_CONFIG, GEMINI_CONFIG } from '../../config/geminiConfig';

/**
 * Detect if a query looks like a simple address search
 */
function isSimpleAddressQuery(query) {
  const trimmed = query.trim().toLowerCase();
  const addressPattern = /^\d+\s+[\w\s]+(?:st|street|ave|avenue|ln|lane|rd|road|dr|drive|ct|court|blvd|boulevard|way|pl|place|cir|circle|ter|terrace|pkwy|parkway)?\.?$/i;
  const questionWords = ['what', 'which', 'who', 'how', 'when', 'where', 'show', 'find', 'list', 'get', 'top', 'largest', 'biggest', 'most', 'recent', 'latest', 'sold', 'sale', 'over', 'under', 'between', 'greater', 'less', 'more', 'than'];
  const hasQuestionWord = questionWords.some(word => trimmed.includes(word));
  
  if (hasQuestionWord) return false;
  if (addressPattern.test(trimmed)) return true;
  
  const words = trimmed.split(/\s+/);
  if (words.length <= 5 && /^\d+$/.test(words[0])) return true;
  
  return false;
}

/**
 * Detect if a query looks like a parcel ID
 */
function isParcelIdQuery(query) {
  const trimmed = query.trim();
  return /^[\d\-A-Z]{5,}$/i.test(trimmed) && !/\s/.test(trimmed);
}

/**
 * Get center point from ArcGIS geometry
 */
function getGeometryCenter(geometry) {
  if (!geometry) return null;
  
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { lat: geometry.y, lng: geometry.x };
  }
  
  if (geometry.rings && geometry.rings.length > 0) {
    const ring = geometry.rings[0];
    let sumX = 0, sumY = 0;
    for (const point of ring) {
      sumX += point[0];
      sumY += point[1];
    }
    return { lng: sumX / ring.length, lat: sumY / ring.length };
  }
  
  if (geometry.paths && geometry.paths.length > 0) {
    const path = geometry.paths[0];
    const midIndex = Math.floor(path.length / 2);
    return { lng: path[midIndex][0], lat: path[midIndex][1] };
  }
  
  return null;
}

/**
 * ChatView Component
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
    // Use shared search history from context
    saveToHistory
  } = useAtlas();

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');

  const chatContainerRef = useRef(null);
  const messageIdCounterRef = useRef(0);

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const botAvatar = config?.ui?.botAvatar || config?.ui?.logoLeft;

  /**
   * Get field names from config
   */
  const getFieldNames = useCallback(() => {
    let parcelField = 'PARCELID';
    let addressField = 'PROPERTYADDRESS';
    
    const searchFields = activeMap?.searchFields || config?.data?.searchFields;
    if (searchFields) {
      const pObj = searchFields.find(f => 
        /PARCEL|GPIN|LRSN|PIN/i.test(f.label) || 
        /PARCEL|GPIN|LRSN|PIN/i.test(f.field)
      );
      if (pObj) parcelField = pObj.field;
      
      const aObj = searchFields.find(f => 
        /ADDRESS|SITE|SITUS/i.test(f.label) || 
        /ADDRESS|SITUS/i.test(f.field)
      );
      if (aObj) addressField = aObj.field;
    }
    
    return { parcelField, addressField };
  }, [activeMap?.searchFields, config?.data?.searchFields]);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  const addMessage = useCallback((type, content, metadata = {}) => {
    // Use timestamp + counter to ensure unique IDs even when messages are added in same millisecond
    const uniqueId = `${Date.now()}-${++messageIdCounterRef.current}`;
    setMessages(prev => [...prev, {
      id: uniqueId,
      type,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    }]);
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const callGeminiApi = useCallback(async (prompt, useFallback = false) => {
    const url = useFallback ? getGeminiFallbackUrl() : getGeminiUrl();
    const modelName = useFallback ? GEMINI_CONFIG.fallbackModel : GEMINI_CONFIG.model;
    
    console.log(`[ChatView] Calling Gemini API with model: ${modelName}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: GEMINI_QUERY_CONFIG
      })
    });

    const data = await response.json();
    
    if (data.error) {
      const errorMessage = data.error.message || data.error.status || 'Unknown API error';
      console.error(`[ChatView] Gemini API error (${modelName}):`, data.error);
      
      if (!useFallback && GEMINI_CONFIG.fallbackModel) {
        console.log('[ChatView] Trying fallback model...');
        return callGeminiApi(prompt, true);
      }
      
      throw new Error(`Gemini API error: ${errorMessage}`);
    }

    if (!response.ok) {
      const errorText = JSON.stringify(data);
      console.error(`[ChatView] HTTP ${response.status}:`, errorText);
      
      if (!useFallback && GEMINI_CONFIG.fallbackModel) {
        return callGeminiApi(prompt, true);
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return data;
  }, []);

  const geocodeAddress = useCallback(async (address) => {
    const geocoderConfig = activeMap?.geocoder || config?.data?.geocoder;
    const geocoderUrl = geocoderConfig?.url || 
      'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
    
    console.log('[ChatView] Geocoding address:', address);
    
    const params = new URLSearchParams({
      f: 'json',
      SingleLine: address,
      outFields: '*',
      outSR: '4326',
      maxLocations: 1
    });

    const response = await fetch(`${geocoderUrl}/findAddressCandidates?${params}`);
    const data = await response.json();

    if (data.error) throw new Error(data.error.message || 'Geocoder error');

    if (data.candidates && data.candidates.length > 0) {
      const result = data.candidates[0];
      return { lat: result.location.y, lng: result.location.x, formatted: result.address };
    }

    throw new Error('ADDRESS_NOT_FOUND');
  }, [activeMap?.geocoder, config?.data?.geocoder]);

  const searchExternalAddressLayer = useCallback(async (address) => {
    const addressSearchConfig = activeMap?.addressSearch || config?.data?.addressSearch;
    
    if (!addressSearchConfig?.useExternalLayer || !addressSearchConfig?.externalLayer?.endpoint) {
      return null;
    }
    
    const externalLayer = addressSearchConfig.externalLayer;
    const searchField = externalLayer.searchField || 'FullAdd';
    const searchVal = address.toUpperCase();
    
    console.log('[ChatView] Searching external address layer:', externalLayer.endpoint);
    
    const useExactMatch = externalLayer.exactMatch === true;
    const whereClause = useExactMatch 
      ? `UPPER(${searchField}) = '${searchVal}'`
      : `UPPER(${searchField}) LIKE '%${searchVal}%'`;
    
    const params = new URLSearchParams({ 
      f: 'json', 
      where: whereClause, 
      outFields: '*', 
      returnGeometry: 'true', 
      outSR: '4326',
      resultRecordCount: 1
    });
    
    const response = await fetch(`${externalLayer.endpoint}/query?${params}`);
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) return null;
    
    const addressFeature = data.features[0];
    let coords = addressFeature.geometry ? getGeometryCenter(addressFeature.geometry) : null;
    
    if (!coords) return null;
    
    const displayField = externalLayer.displayField || searchField;
    return { lat: coords.lat, lng: coords.lng, formatted: addressFeature.attributes[displayField] || address };
  }, [activeMap?.addressSearch, config?.data?.addressSearch]);

  /**
   * Spatial query for parcel - NO BUFFER
   * Only returns the parcel that the point actually intersects with
   * This ensures address searches only return 1 result
   */
  const spatialQueryForParcel = useCallback(async (coords) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) throw new Error('No endpoint configured');
    
    console.log('[ChatView] Spatial query at:', coords);
    
    // FIXED: Only use exact point query, no buffer fallback
    // This ensures address searches return only the parcel containing the address point
    const params = new URLSearchParams({ 
      f: 'json', 
      where: '1=1', 
      geometry: `${coords.lng},${coords.lat}`, 
      geometryType: 'esriGeometryPoint', 
      spatialRel: 'esriSpatialRelIntersects', 
      outFields: '*', 
      returnGeometry: 'true', 
      outSR: '4326', 
      inSR: '4326', 
      resultRecordCount: 1  // Only return 1 result
    });
    
    const response = await fetch(`${endpoint}/query?${params}`);
    const data = await response.json();
    
    console.log('[ChatView] Spatial query result:', data.features?.length || 0, 'features');
    
    return data;
    
    // REMOVED: Buffer fallback that was causing multiple results
    // The old code would fall back to an envelope query with resultRecordCount: 5
    // which caused address searches to return multiple parcels
  }, [activeMap?.endpoint, config?.data?.endpoint]);

  const lookupParcelById = useCallback(async (parcelId) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) throw new Error('No endpoint configured');
    
    const { parcelField } = getFieldNames();
    console.log('[ChatView] Looking up parcel by ID:', parcelId, 'field:', parcelField);
    
    const params = new URLSearchParams({ 
      f: 'json', 
      where: `${parcelField} = '${parcelId}'`, 
      outFields: '*', 
      returnGeometry: 'true', 
      outSR: '4326'
    });
    
    const response = await fetch(`${endpoint}/query?${params}`);
    return response.json();
  }, [activeMap?.endpoint, config?.data?.endpoint, getFieldNames]);

  const executeSqlQuery = useCallback(async (queryParams) => {
    const endpoint = activeMap?.endpoint || config?.data?.endpoint;
    if (!endpoint) throw new Error('No endpoint configured');
    
    console.log('[ChatView] Executing SQL query:', queryParams);
    
    const params = new URLSearchParams({
      f: 'json',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      where: queryParams.where
    });
    
    if (queryParams.orderBy) params.set('orderByFields', queryParams.orderBy);
    if (queryParams.limit) params.set('resultRecordCount', String(queryParams.limit));
    
    const response = await fetch(`${endpoint}/query?${params}`);
    return response.json();
  }, [activeMap?.endpoint, config?.data?.endpoint]);

  /**
   * Translate natural language query to SQL using AI
   * Uses the configured System Prompt for AI Query Translation
   */
  const translateQueryWithAI = useCallback(async (query) => {
    // Check multiple paths for the system prompt
    // Priority: activeMap.systemPrompt > config.data.systemPrompt
    const systemPrompt = activeMap?.systemPrompt || config?.data?.systemPrompt;
    
    console.log('[ChatView] translateQueryWithAI called');
    console.log('[ChatView] activeMap?.systemPrompt:', activeMap?.systemPrompt ? 'SET' : 'NOT SET');
    console.log('[ChatView] config?.data?.systemPrompt:', config?.data?.systemPrompt ? 'SET' : 'NOT SET');
    
    if (!systemPrompt || systemPrompt.trim() === '') {
      console.warn('[ChatView] No system prompt configured - AI translation disabled');
      console.warn('[ChatView] To enable AI query translation, configure the "System Prompt (for AI Query Translation)" in Atlas Admin Settings');
      return null;
    }

    console.log('[ChatView] Using system prompt (first 200 chars):', systemPrompt.substring(0, 200) + '...');

    try {
      // Build the full prompt with context
      const fullPrompt = `${systemPrompt}

User Query: ${query}

Remember to respond with ONLY a valid JSON object, no additional text or markdown.`;

      console.log('[ChatView] Sending query to Gemini AI...');
      const data = await callGeminiApi(fullPrompt);
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[ChatView] Gemini raw response:', text);
      
      // Try to extract JSON from the response
      // Handle cases where AI might wrap in markdown code blocks
      let jsonText = text;
      
      // Remove markdown code blocks if present
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      }
      
      // Find JSON object in the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('[ChatView] Successfully parsed AI response:', parsed);
          
          // Validate the response has expected fields
          if (parsed.where || parsed.parcelId || parsed.address) {
            return parsed;
          } else {
            console.warn('[ChatView] AI response missing expected fields (where/parcelId/address):', parsed);
            return parsed; // Return anyway, let the caller handle it
          }
        } catch (parseErr) {
          console.error('[ChatView] Failed to parse JSON from AI response:', parseErr);
          console.error('[ChatView] Raw JSON text:', jsonMatch[0]);
          return null;
        }
      }
      
      console.warn('[ChatView] No JSON found in AI response');
      return null;
    } catch (err) {
      console.error('[ChatView] Gemini AI translation failed:', err);
      return null;
    }
  }, [activeMap?.systemPrompt, config?.data?.systemPrompt, callGeminiApi]);

  const handleSearch = useCallback(async (query) => {
    if (!query?.trim() || isLoading) return;

    const trimmedQuery = query.trim();
    addMessage('user', trimmedQuery);

    setIsLoading(true);
    setIsSearching?.(true);

    try {
      let results = null;
      let location = null;
      const { parcelField, addressField } = getFieldNames();

      if (isParcelIdQuery(trimmedQuery)) {
        setLoadingText('Looking up parcel...');
        console.log('[ChatView] Detected parcel ID query');
        
        results = await lookupParcelById(trimmedQuery);
        
        if (results.features && results.features.length > 0) {
          const center = getGeometryCenter(results.features[0].geometry);
          if (center) location = { ...center, formatted: `ID: ${trimmedQuery}` };
        }
      }
      else if (isSimpleAddressQuery(trimmedQuery)) {
        setLoadingText('Searching address...');
        console.log('[ChatView] Detected simple address query');
        
        try {
          location = await searchExternalAddressLayer(trimmedQuery);
          console.log('[ChatView] External layer result:', location);
        } catch (e) {
          console.log('[ChatView] External layer search failed:', e);
        }
        
        if (!location) {
          try {
            location = await geocodeAddress(trimmedQuery);
            console.log('[ChatView] Geocoder result:', location);
          } catch (e) {
            console.log('[ChatView] Geocoding failed:', e);
          }
        }
        
        if (location) {
          setLoadingText('Finding property...');
          results = await spatialQueryForParcel(location);
        } else {
          console.log('[ChatView] Falling back to LIKE search');
          setLoadingText('Searching database...');
          const searchTerm = trimmedQuery.toUpperCase();
          results = await executeSqlQuery({
            where: `UPPER(${addressField}) LIKE '%${searchTerm}%'`
          });
        }
      }
      else {
        // Complex query - use AI translation
        setLoadingText('Analyzing your question...');
        console.log('[ChatView] Complex query detected, attempting AI translation');
        
        const aiResult = await translateQueryWithAI(trimmedQuery);
        
        if (aiResult) {
          console.log('[ChatView] AI translation successful:', aiResult);
          
          if (aiResult.parcelId) {
            setLoadingText('Looking up parcel...');
            results = await lookupParcelById(aiResult.parcelId);
          } else if (aiResult.address) {
            setLoadingText('Searching address...');
            try {
              location = await searchExternalAddressLayer(aiResult.address);
              if (!location) location = await geocodeAddress(aiResult.address);
              if (location) results = await spatialQueryForParcel(location);
            } catch (e) {
              console.log('[ChatView] Address from AI failed:', e);
            }
          } else if (aiResult.where) {
            setLoadingText('Searching database...');
            console.log('[ChatView] Executing AI-generated WHERE clause:', aiResult.where);
            results = await executeSqlQuery({
              where: aiResult.where,
              orderBy: aiResult.orderBy || aiResult.orderByFields,
              limit: aiResult.limit || aiResult.resultRecordCount
            });
          } else {
            console.warn('[ChatView] AI response had no actionable fields');
          }
        } else {
          // AI translation failed or not configured
          console.log('[ChatView] AI translation unavailable, falling back to text search');
          
          // Check if system prompt is configured
          const hasSystemPrompt = activeMap?.systemPrompt || config?.data?.systemPrompt;
          if (!hasSystemPrompt) {
            console.warn('[ChatView] No system prompt configured - complex queries will use basic text matching');
          }
        }
        
        // Fallback: try LIKE search if no results yet
        if (!results || !results.features || results.features.length === 0) {
          console.log('[ChatView] Falling back to LIKE search');
          setLoadingText('Searching database...');
          const searchTerm = trimmedQuery.toUpperCase();
          results = await executeSqlQuery({
            where: `UPPER(${addressField}) LIKE '%${searchTerm}%'`
          });
        }
      }

      const features = results?.features || [];
      
      if (results?.error) throw new Error(results.error.message || 'Query failed');

      updateSearchResults({ features });
      if (location) setSearchLocation?.(location);
      saveToHistory(trimmedQuery);

      if (features.length === 0) {
        addMessage('ai', 'I couldn\'t find any properties matching your search. Try:\n• Checking the spelling\n• Using a different format (e.g., "306 Cedar Lane" or "306 CEDAR LN")\n• Searching by parcel ID instead');
      } else if (features.length === 1) {
        const feature = features[0];
        const address = feature.attributes?.[addressField] || feature.attributes?.PROPERTYADDRESS || feature.attributes?.ADDRESS || 'Property';
        addMessage('ai', `I found **${address}**. Here are the details:`, { feature, showDetails: true });

        // Zoom to feature and select it to open popup on single result
        if (mapViewRef?.current && enabledModes.includes('map')) {
          if (mapViewRef.current.zoomToFeature) {
            mapViewRef.current.zoomToFeature(feature);
          }
          if (mapViewRef.current.selectFeature) {
            mapViewRef.current.selectFeature(feature);
          }
        }
      } else {
        addMessage('ai', `I found **${features.length}** properties matching your search.`, { features, showResultActions: true });
        if (mapViewRef?.current?.renderResults) mapViewRef.current.renderResults(features);
      }

    } catch (err) {
      console.error('[ChatView] Search error:', err);
      addMessage('error', `Sorry, I encountered an error: ${err.message}. Please try rephrasing your question.`);
    } finally {
      setIsLoading(false);
      setIsSearching?.(false);
    }
  }, [
    isLoading, addMessage, getFieldNames, lookupParcelById, searchExternalAddressLayer,
    geocodeAddress, spatialQueryForParcel, executeSqlQuery, translateQueryWithAI,
    updateSearchResults, setSearchLocation, saveToHistory, mapViewRef, enabledModes, setIsSearching,
    activeMap, config
  ]);

  const handleExampleClick = useCallback((question) => {
    handleSearch(question);
  }, [handleSearch]);

  /**
   * Export search results to CSV
   */
  const exportCSV = useCallback(() => {
    const features = searchResults?.features;
    if (!features || features.length === 0) return;

    const tableColumns = activeMap?.tableColumns || [];
    let columns;
    if (tableColumns.length > 0) {
      columns = tableColumns.map(col => ({
        field: col.field,
        headerName: col.headerName || col.field
      }));
    } else {
      // Auto-generate columns from first feature
      columns = Object.keys(features[0].attributes)
        .filter(k => !k.startsWith('_') && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
        .map(field => ({ field, headerName: field }));
    }

    // Build CSV content
    const headers = columns.map(col => col.headerName).join(',');
    const rows = features.map(feature =>
      columns.map(col => {
        const value = feature.attributes?.[col.field];
        if (value == null) return '';
        // Escape quotes and wrap in quotes if contains comma or quotes
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [searchResults, activeMap?.tableColumns]);

  /**
   * Export single feature to PDF
   */
  const exportPDF = useCallback((feature) => {
    if (!feature) return;

    const tableColumns = activeMap?.tableColumns || [];
    let fields;
    if (tableColumns.length > 0) {
      fields = tableColumns
        .filter(col => feature.attributes?.[col.field] != null)
        .map(col => ({
          label: col.headerName || col.field,
          value: feature.attributes[col.field]
        }));
    } else {
      // Auto-generate from attributes
      fields = Object.entries(feature.attributes || {})
        .filter(([k, v]) => !k.startsWith('_') && v != null && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
        .map(([key, value]) => ({
          label: key.replace(/_/g, ' '),
          value
        }));
    }

    // Get address for title
    const { addressField } = getFieldNames();
    const title = feature.attributes?.[addressField] || feature.attributes?.PROPERTYADDRESS || feature.attributes?.ADDRESS || 'Property Details';

    // Create printable HTML and open in new window for PDF export
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .details { margin-top: 20px; }
          .field { display: flex; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
          .label { font-weight: 600; color: #64748b; width: 200px; text-transform: uppercase; font-size: 12px; }
          .value { color: #1e293b; flex: 1; }
          .footer { margin-top: 40px; color: #94a3b8; font-size: 12px; text-align: center; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="details">
          ${fields.map(f => `
            <div class="field">
              <span class="label">${f.label}</span>
              <span class="value">${String(f.value)}</span>
            </div>
          `).join('')}
        </div>
        <div class="footer">
          Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
  }, [activeMap?.tableColumns, getFieldNames]);

  useImperativeHandle(ref, () => ({ handleSearch, addMessage }), [handleSearch, addMessage]);

  // Get the search tip text from config (empty = hidden)
  const searchTipText = config?.messages?.searchTip || '';

  // Get important note from config (empty = hidden)
  const importantNote = config?.messages?.importantNote || '';

  // Get example questions
  const exampleQuestions = config?.messages?.exampleQuestions || [];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Chat Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Welcome Message - ALWAYS VISIBLE */}
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
            {botAvatar ? (
              <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
            ) : (
              <div 
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors.bg100 }}
              >
                <HelpCircle className="w-5 h-5" style={{ color: colors.text600 }} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-2">
                {config?.messages?.welcomeTitle || 'Welcome!'}
              </h3>
              <p className="text-slate-600 text-sm">
                {config?.messages?.welcomeText || 'Search for properties using natural language. Try asking questions like the examples below.'}
              </p>
            </div>
          </div>
        </div>

        {/* Example Questions - ALWAYS VISIBLE */}
        {exampleQuestions.length > 0 && (
          <div className="ml-14 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(question)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                  style={{ 
                    '--hover-border': colors.border300,
                    '--hover-bg': colors.bg50 
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = colors.border300;
                    e.target.style.backgroundColor = colors.bg50;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '';
                    e.target.style.backgroundColor = '';
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Important Note / Disclaimer - ALWAYS VISIBLE */}
        {importantNote && (
          <div className="ml-14 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{importantNote}</p>
            </div>
          </div>
        )}

        {/* Conversation Messages - appear below the welcome section */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            botAvatar={botAvatar}
            colors={colors}
            tableColumns={activeMap?.tableColumns}
            searchFields={activeMap?.searchFields || config?.data?.searchFields}
            onViewMap={(features) => {
              // Restore search results from this message before switching to map view
              if (features) {
                const featureArray = Array.isArray(features) ? features : [features];
                updateSearchResults({ features: featureArray });
                // Also render on map immediately
                if (mapViewRef?.current?.renderResults) {
                  mapViewRef.current.renderResults(featureArray);
                }
                // For single result, zoom and select
                if (featureArray.length === 1 && mapViewRef?.current) {
                  if (mapViewRef.current.zoomToFeature) {
                    mapViewRef.current.zoomToFeature(featureArray[0]);
                  }
                  if (mapViewRef.current.selectFeature) {
                    mapViewRef.current.selectFeature(featureArray[0]);
                  }
                }
              }
              setMode('map');
            }}
            onViewTable={(features) => {
              // Restore search results from this message before switching to table view
              if (features) {
                const featureArray = Array.isArray(features) ? features : [features];
                updateSearchResults({ features: featureArray });
                // Also render on map to keep in sync
                if (mapViewRef?.current?.renderResults) {
                  mapViewRef.current.renderResults(featureArray);
                }
              }
              setMode('table');
            }}
            onExportCSV={exportCSV}
            onExportPDF={exportPDF}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden p-1">
              {botAvatar ? (
                <img src={botAvatar} alt="AI" className="w-full h-full object-contain" />
              ) : (
                <div 
                  className="w-full h-full rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100 }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.text600 }} />
                </div>
              )}
            </div>
            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.text600 }} />
              <span className="text-sm text-slate-500">{loadingText}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tip Footer */}
      {searchTipText && (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>{searchTipText}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Results Table Component - shows preview of multiple results
 * Uses searchFields with chatResults: true, or falls back to tableColumns
 */
function ResultsTable({ features, tableColumns, searchFields, colors }) {
  // Priority: searchFields with chatResults: true > tableColumns > auto-generate
  let columns;

  // First, check for searchFields with chatResults enabled
  const chatResultsFields = searchFields?.filter(sf => sf.chatResults === true) || [];

  if (chatResultsFields.length > 0) {
    // Use fields marked for chat results (limit to 5 for table preview)
    columns = chatResultsFields.slice(0, 5).map(sf => ({
      field: sf.field,
      headerName: sf.label || sf.field
    }));
  } else if (tableColumns && tableColumns.length > 0) {
    // Fall back to tableColumns if no chatResults fields configured
    columns = tableColumns.slice(0, 5).map(col => ({
      field: col.field,
      headerName: col.headerName || col.field
    }));
  } else if (features?.[0]?.attributes) {
    // Fallback to auto-generated columns
    columns = Object.keys(features[0].attributes)
      .filter(k => !k.startsWith('_') && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
      .slice(0, 5)
      .map(field => ({ field, headerName: field }));
  } else {
    return null;
  }

  // Show up to 5 rows
  const displayFeatures = features.slice(0, 5);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map(col => (
              <th
                key={col.field}
                className="px-2 py-1.5 text-left font-medium text-slate-500 uppercase tracking-wider"
              >
                {col.headerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {displayFeatures.map((feature, idx) => (
            <tr key={idx} className="hover:bg-slate-50">
              {columns.map(col => (
                <td key={col.field} className="px-2 py-1.5 text-slate-700 truncate max-w-[150px]">
                  {feature.attributes?.[col.field] != null ? String(feature.attributes[col.field]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {features.length > 5 && (
        <p className="text-xs text-slate-400 mt-2 text-center">
          Showing 5 of {features.length} results
        </p>
      )}
    </div>
  );
}

/**
 * Message Bubble Component
 */
function MessageBubble({ message, botAvatar, colors, onViewMap, onViewTable, onExportCSV, onExportPDF, tableColumns, searchFields }) {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="text-white p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[80%]"
          style={{ backgroundColor: colors.bg600 }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex-shrink-0 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div className="bg-red-50 p-4 rounded-2xl rounded-tl-none shadow-sm border border-red-200 max-w-[80%]">
          <p className="text-sm text-red-800">{message.content}</p>
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
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.bg100 }}
          >
            <HelpCircle className="w-5 h-5" style={{ color: colors.text600 }} />
          </div>
        )}
      </div>
      <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 max-w-[80%]">
        <div className="text-sm text-slate-700 prose prose-sm" dangerouslySetInnerHTML={{
          __html: message.content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />

        {/* Single result: show details with View in Map and Export PDF buttons */}
        {message.showDetails && message.feature && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <FeatureDetails feature={message.feature} colors={colors} tableColumns={tableColumns} searchFields={searchFields} />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onViewMap(message.feature)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
              >
                <Map className="w-4 h-4" />
                View in Map
              </button>
              <button
                onClick={() => onExportPDF?.(message.feature)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>
        )}

        {/* Multiple results: show table preview with View on Map, View in Table, and Export CSV buttons */}
        {message.showResultActions && message.features && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <ResultsTable features={message.features} tableColumns={tableColumns} searchFields={searchFields} colors={colors} />
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => onViewMap(message.features)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                style={{ backgroundColor: colors.bg50, color: colors.text700 }}
                onMouseEnter={(e) => e.target.style.backgroundColor = colors.bg100}
                onMouseLeave={(e) => e.target.style.backgroundColor = colors.bg50}
              >
                <Map className="w-4 h-4" />
                View on Map
              </button>
              <button
                onClick={() => onViewTable(message.features)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
              >
                <Table2 className="w-4 h-4" />
                View in Table
              </button>
              <button
                onClick={onExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Feature Details Component - uses searchFields with chatResults: true, or falls back to tableColumns
 */
function FeatureDetails({ feature, colors, tableColumns, searchFields }) {
  const attrs = feature.attributes || {};

  // Priority: searchFields with chatResults: true > tableColumns > auto-generated
  let displayFields;

  // First, check for searchFields with chatResults enabled
  const chatResultsFields = searchFields?.filter(sf => sf.chatResults === true) || [];

  if (chatResultsFields.length > 0) {
    // Use fields marked for chat results
    displayFields = chatResultsFields
      .filter(sf => attrs[sf.field] != null)
      .map(sf => ({
        key: sf.field,
        label: sf.label || sf.field,
        value: attrs[sf.field]
      }));
  } else if (tableColumns && tableColumns.length > 0) {
    // Fall back to tableColumns if no chatResults fields configured
    displayFields = tableColumns
      .filter(col => attrs[col.field] != null)
      .map(col => ({
        key: col.field,
        label: col.headerName || col.field,
        value: attrs[col.field]
      }));
  } else {
    // Fallback to auto-generated from attributes
    displayFields = Object.entries(attrs)
      .filter(([k, v]) => !k.startsWith('_') && v != null && k !== 'OBJECTID' && k !== 'Shape__Area' && k !== 'Shape__Length')
      .slice(0, 8)
      .map(([key, value]) => ({
        key,
        label: key.replace(/_/g, ' '),
        value
      }));
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {displayFields.map(({ key, label, value }) => (
        <div key={key}>
          <dt className="text-xs font-medium text-slate-500 uppercase">{label}</dt>
          <dd className="text-slate-800">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default ChatView;
