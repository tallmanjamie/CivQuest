import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  History, 
  MessageSquare, 
  LinkIcon, 
  Lock, 
  ListFilter, 
  LayoutList, 
  ArrowUp, 
  ArrowDown, 
  Save,
  Loader2,
  AlertCircle,
  Check,
  Play,
  Search,
  Map as MapIcon,
  Trash2,
  FlaskConical
} from 'lucide-react';
import ServiceFinder from './ServiceFinder';
import SpatialFilter from './SpatialFilter';

export default function NotificationEditModal({ data, onClose, onSave }) {
  const [formData, setFormData] = useState({
      ...data,
      source: {
          ...data.source,
          // Ensure queryConfig structure exists and has defaults
          queryConfig: {
            mode: 'none',
            rules: [],
            logic: 'AND',
            ...(data.source?.queryConfig || {})
          },
          // Ensure spatial filter is initialized
          spatialFilter: data.source?.spatialFilter || null
      },
      // Ensure runTime has a default if missing for calendar types
      runTime: data.runTime || (['monthly', 'weekly', 'daily'].includes(data.type) ? '00:00' : undefined),
      // Handle public/private access - support both legacy isPublic and access property
      access: data.access || (data.isPublic ? 'public' : 'private')
  });

  const [availableFields, setAvailableFields] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null); // { type: 'success'|'error', message: '', recordCount?: number }
  
  // Track if the service is a table (no geometry support)
  const [isTable, setIsTable] = useState(false);
  
  // Query Validation State
  const [isQueryValidating, setIsQueryValidating] = useState(false);
  const [queryValidationResult, setQueryValidationResult] = useState(null); // { type: 'success'|'warning'|'error', message: '' }

  // Service Finder Modal State
  const [showServiceFinder, setShowServiceFinder] = useState(false);

  // Spatial Filter Modal State
  const [showSpatialFilter, setShowSpatialFilter] = useState(false);

  // Configuration for the proxy service
  const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://notify.civ.quest';

  const handleChange = (field, value) => {
    let finalValue = value;
    
    // Enforce strict ID naming convention (no spaces, special chars)
    if (field === 'id') {
      finalValue = value.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleSourceChange = (field, value) => {
    setFormData(prev => ({ 
      ...prev, 
      source: { ...prev.source, [field]: value } 
    }));
  };

  /**
   * Convert technical error messages to plain English
   */
  const getPlainEnglishMessage = (type, rawMessage, fieldCount = 0) => {
    if (type === 'success') {
      if (fieldCount === 1) {
        return `Found 1 field`;
      }
      return `Found ${fieldCount} fields`;
    }
    
    // Error messages - convert to plain English
    const lowerMessage = rawMessage.toLowerCase();
    
    if (lowerMessage.includes('fetch') || lowerMessage.includes('network') || lowerMessage.includes('cors')) {
      return `Couldn't connect to the server. Check the URL and try again.`;
    }
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return `Access denied. Check your username and password.`;
    }
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
      return `You don't have permission to access this service.`;
    }
    if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
      return `Service not found. Double-check the URL.`;
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) {
      return `The server had an error. Try again later.`;
    }
    if (lowerMessage.includes('timeout')) {
      return `Request timed out. The server might be slow or unavailable.`;
    }
    if (lowerMessage.includes('no fields')) {
      return `No data fields found. Make sure this is a valid map layer.`;
    }
    if (lowerMessage.includes('token') || lowerMessage.includes('expired')) {
      return `Login expired. Re-enter your credentials and try again.`;
    }
    if (lowerMessage.includes('invalid url') || lowerMessage.includes('malformed')) {
      return `The URL doesn't look right. Check for typos.`;
    }
    
    // If we can't match it, return a simplified version
    return `Something went wrong. ${rawMessage}`;
  };

  /**
   * Calculate the date range that would be used if the notification ran today.
   * This mirrors the logic in notification_engine.js
   */
  const calculateTestDateRange = () => {
    const now = new Date();
    const type = (formData.type || 'daily').toLowerCase();
    const lagDays = formData.lag || 0;
    const runDay = formData.runDay || 1;
    const lookbackMinutes = formData.lookbackMinutes;
    
    // Apply lag - shift the "effective now" back by lagDays
    const effectiveNow = new Date(now);
    effectiveNow.setDate(effectiveNow.getDate() - lagDays);
    
    let startDate, endDate;
    
    switch (type) {
      case 'minutes': {
        const interval = runDay || 15;
        const lookback = lookbackMinutes || interval;
        endDate = new Date(effectiveNow);
        startDate = new Date(effectiveNow);
        startDate.setMinutes(startDate.getMinutes() - lookback);
        break;
      }
      case 'hours': {
        const interval = runDay || 1;
        const lookback = lookbackMinutes || (interval * 60);
        endDate = new Date(effectiveNow);
        startDate = new Date(effectiveNow);
        startDate.setMinutes(startDate.getMinutes() - lookback);
        break;
      }
      case 'daily': {
        // Yesterday to today (or with lag applied)
        endDate = new Date(effectiveNow);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(effectiveNow);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'weekly': {
        // Last 7 days
        endDate = new Date(effectiveNow);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(effectiveNow);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'monthly': {
        // Last 30 days (sliding window)
        endDate = new Date(effectiveNow);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(effectiveNow);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      default: {
        // Default to last 24 hours
        endDate = new Date(effectiveNow);
        startDate = new Date(effectiveNow);
        startDate.setDate(startDate.getDate() - 1);
      }
    }
    
    return { startDate, endDate, type };
  };

  /**
   * Build the WHERE clause for the test query based on date field and range
   */
  const buildTestWhereClause = (dateField, dateFieldType, dateRange, definitionQuery) => {
    const isDateOnlyField = dateFieldType === 'esriFieldTypeDateOnly';
    const isSubDaily = ['hours', 'minutes'].includes(dateRange.type);
    
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const formatTimestamp = (d) => {
      const date = formatDate(d);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const secs = String(d.getSeconds()).padStart(2, '0');
      return `${date} ${hours}:${mins}:${secs}`;
    };
    
    let whereClause;
    
    if (isDateOnlyField || !isSubDaily) {
      // Use date-only syntax
      whereClause = `${dateField} >= date '${formatDate(dateRange.startDate)}' AND ${dateField} <= date '${formatDate(dateRange.endDate)}'`;
    } else {
      // Use timestamp syntax for sub-daily
      whereClause = `${dateField} >= timestamp '${formatTimestamp(dateRange.startDate)}' AND ${dateField} <= timestamp '${formatTimestamp(dateRange.endDate)}'`;
    }
    
    // Append definition query if exists
    if (definitionQuery && definitionQuery.trim() !== '') {
      whereClause = `(${whereClause}) AND (${definitionQuery})`;
    }
    
    return whereClause;
  };

  /**
   * Test the ArcGIS service: load field metadata and run a test query.
   * Also detects if the service is a table (no geometry support).
   * Uses the backend proxy service to avoid CORS issues with authentication.
   * @param {Object} overrideSource - Optional source object (url, username, password) to use instead of state (for immediate validation)
   */
  const validateAndLoadFields = async (overrideSource = null) => {
    // Determine the source data to use (override takes precedence for immediate validation)
    const sourceData = overrideSource ? { ...formData.source, ...overrideSource } : formData.source;

    if (!sourceData?.url) return;
    
    setIsValidating(true);
    setValidationResult(null);
    setAvailableFields([]);
    setIsTable(false);

    try {
        let url = sourceData.url.trim();
        // Basic ArcGIS REST URL cleanup/check
        if (url.endsWith('/')) url = url.slice(0, -1);
        
        const hasCredentials = sourceData.username && sourceData.password;
        
        // Helper to fetch metadata
        const fetchMetadata = async () => {
            if (hasCredentials) {
                const proxyResponse = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/metadata`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serviceUrl: url,
                        username: sourceData.username,
                        password: sourceData.password
                    })
                });
                const data = await proxyResponse.json();
                if (!proxyResponse.ok) {
                    throw new Error(data.error || `Proxy Error: ${proxyResponse.status}`);
                }
                return data;
            } else {
                // Try direct fetch first
                try {
                    const jsonUrl = url.includes('?') ? `${url}&f=json` : `${url}?f=json`;
                    const res = await fetch(jsonUrl);
                    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message || "ArcGIS Service Error");
                    return data;
                } catch (directErr) {
                    // Fallback to proxy
                    const proxyResponse = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/metadata`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serviceUrl: url })
                    });
                    const data = await proxyResponse.json();
                    if (!proxyResponse.ok) {
                        throw new Error(data.error || directErr.message);
                    }
                    return data;
                }
            }
        };
        
        // Helper to run test query for record count (mirrors executeQueryRequest pattern)
        const runTestQuery = async (whereClause) => {
            const payload = {
                serviceUrl: url,
                where: whereClause,
                returnCountOnly: true
            };
            
            if (hasCredentials) {
                payload.username = sourceData.username;
                payload.password = sourceData.password;
            }

            const handleResponse = async (res) => {
                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.error || `Server Error: ${res.status}`);
                }
                const json = await res.json();
                if (json.error) throw new Error(json.error.message || 'Query failed');
                return json;
            };

            // 1. Try Authenticated Proxy (if creds exist) - return immediately
            if (hasCredentials) {
                const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await handleResponse(res);
                return data.count ?? (data.features ? data.features.length : 0);
            }

            // 2. Try Direct Fetch (if public)
            try {
                const queryParams = new URLSearchParams({ 
                    f: 'json', 
                    where: whereClause,
                    returnCountOnly: 'true'
                });
                const res = await fetch(`${url}/query?${queryParams.toString()}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (json.error) throw new Error(json.error.message);
                return json.count ?? (json.features ? json.features.length : 0);
            } catch (directErr) {
                // 3. Fallback to Proxy (Unauthenticated)
                const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await handleResponse(res);
                return data.count ?? (data.features ? data.features.length : 0);
            }
        };

        // 1. Fetch metadata
        const metadata = await fetchMetadata();
        
        if (!metadata.fields || !Array.isArray(metadata.fields)) {
            throw new Error("No fields found in metadata. Is this a MapServer/FeatureServer layer?");
        }
        
        // 2. Detect if this is a table (no geometry)
        const serviceIsTable = !metadata.geometryType || metadata.type === 'Table';
        setIsTable(serviceIsTable);
        
        // 3. Store fields
        setAvailableFields(metadata.fields);
        
        // 4. Auto-detect Date Field if not set
        let activeDateField = sourceData.dateField;
        let activeDateFieldType = sourceData.dateFieldType;
        
        if (!activeDateField) {
            const dateF = metadata.fields.find(f => f.type === 'esriFieldTypeDate' || f.type === 'esriFieldTypeDateOnly');
            if (dateF) {
                activeDateField = dateF.name;
                activeDateFieldType = dateF.type;
                handleSourceChange('dateField', dateF.name);
                handleSourceChange('dateFieldType', dateF.type);
            }
        } else if (!activeDateFieldType) {
            // Field is set but type isn't - look it up
            const dateF = metadata.fields.find(f => f.name === activeDateField);
            if (dateF) {
                activeDateFieldType = dateF.type;
                handleSourceChange('dateFieldType', dateF.type);
            }
        }
        
        // 5. Run test query if we have a date field
        let recordCount = null;
        let dateRangeInfo = '';
        
        if (activeDateField) {
            try {
                const dateRange = calculateTestDateRange();
                const whereClause = buildTestWhereClause(
                    activeDateField, 
                    activeDateFieldType, 
                    dateRange, 
                    sourceData.definitionQuery
                );
                
                console.log('Test query WHERE:', whereClause);
                recordCount = await runTestQuery(whereClause);
                
                // Format date range for display
                const formatDisplayDate = (d) => {
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                };
                const formatDisplayDateTime = (d) => {
                    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                };
                
                const isSubDaily = ['hours', 'minutes'].includes(dateRange.type);
                if (isSubDaily) {
                    dateRangeInfo = `${formatDisplayDateTime(dateRange.startDate)} - ${formatDisplayDateTime(dateRange.endDate)}`;
                } else {
                    dateRangeInfo = `${formatDisplayDate(dateRange.startDate)} - ${formatDisplayDate(dateRange.endDate)}`;
                }
                
            } catch (queryErr) {
                console.warn('Test query failed:', queryErr.message);
                // Don't fail the whole validation, just note we couldn't count
                recordCount = -1; // Flag that query failed
            }
        }
        
        // 6. Build frequency text for display
        const getFrequencyText = () => {
            const type = (formData.type || 'daily').toLowerCase();
            const runDay = formData.runDay || 1;
            
            switch (type) {
                case 'minutes':
                    return `every ${runDay} minute${runDay !== 1 ? 's' : ''}`;
                case 'hours':
                    return `every ${runDay} hour${runDay !== 1 ? 's' : ''}`;
                case 'daily':
                    return 'daily';
                case 'weekly':
                    return 'weekly';
                case 'monthly':
                    return 'monthly';
                default:
                    return '';
            }
        };
        
        // 7. Build result message
        let message = `Found ${metadata.fields.length} fields`;
        if (serviceIsTable) {
            message += ' (Table)';
        }
        
        const frequencyText = getFrequencyText();
        if (recordCount !== null && recordCount >= 0) {
            message += ` • ${recordCount} record${recordCount !== 1 ? 's' : ''} would be sent now based on your ${frequencyText} frequency`;
        } else if (recordCount === -1) {
            message += ' • Could not count records';
        } else if (!activeDateField) {
            message += ' • Select a date field to test';
        }
        
        setValidationResult({ 
            type: 'success', 
            message,
            recordCount,
            dateRange: dateRangeInfo,
            isTable: serviceIsTable
        });

    } catch (err) {
        setValidationResult({ 
            type: 'error', 
            message: getPlainEnglishMessage('error', err.message)
        });
    } finally {
        setIsValidating(false);
    }
  };

  /**
   * Validate the specific SQL query against the service
   * Applies both definition query AND spatial filter (geofence) if present
   * Robust validation that retries with a fallback strategy if the primary count query fails
   */
  const validateQuery = async () => {
    setQueryValidationResult(null);
    
    if (!formData.source?.url) {
        setQueryValidationResult({ type: 'error', message: 'No Service URL provided.' });
        return;
    }

    const whereClause = formData.source.definitionQuery || '1=1';
    setIsQueryValidating(true);

    let url = formData.source.url.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    const hasCredentials = formData.source?.username && formData.source?.password;

    // Parse spatial filter if present
    // The spatial filter is stored as a JSON string containing a FeatureCollection
    // Use buffer geometry if present (role='buffer'), otherwise use filter geometry (role='filter')
    let spatialFilterGeometry = null;
    let spatialFilterType = null;
    let hasSpatialFilter = false;
    
    if (formData.source?.spatialFilter) {
        console.log('[validateQuery] Raw spatialFilter:', formData.source.spatialFilter);
        try {
            let filterData = formData.source.spatialFilter;
            // Parse if it's a string
            if (typeof filterData === 'string') {
                filterData = JSON.parse(filterData);
                console.log('[validateQuery] Parsed spatialFilter:', filterData);
            }
            
            if (filterData.type === 'FeatureCollection' && Array.isArray(filterData.features)) {
                // Prefer buffer geometry over filter geometry for spatial query
                const bufferFeature = filterData.features.find(f => f.role === 'buffer');
                const filterFeature = filterData.features.find(f => f.role === 'filter');
                const featureToUse = bufferFeature || filterFeature;
                
                console.log('[validateQuery] FeatureCollection - buffer:', !!bufferFeature, 'filter:', !!filterFeature);
                
                if (featureToUse?.geometry) {
                    spatialFilterGeometry = featureToUse.geometry;
                    // Determine geometry type for ArcGIS query
                    if (spatialFilterGeometry.rings) {
                        spatialFilterType = 'esriGeometryPolygon';
                    } else if (spatialFilterGeometry.paths) {
                        spatialFilterType = 'esriGeometryPolyline';
                    } else if (spatialFilterGeometry.x !== undefined) {
                        spatialFilterType = 'esriGeometryPoint';
                    }
                    hasSpatialFilter = true;
                    console.log('[validateQuery] Using spatial filter:', spatialFilterType, bufferFeature ? '(with buffer)' : '(filter only)');
                    console.log('[validateQuery] Geometry:', spatialFilterGeometry);
                }
            } else if (filterData.rings || filterData.paths || filterData.x !== undefined) {
                // Legacy single geometry format
                spatialFilterGeometry = filterData;
                if (filterData.rings) {
                    spatialFilterType = 'esriGeometryPolygon';
                } else if (filterData.paths) {
                    spatialFilterType = 'esriGeometryPolyline';
                } else {
                    spatialFilterType = 'esriGeometryPoint';
                }
                hasSpatialFilter = true;
                console.log('[validateQuery] Using legacy spatial filter:', spatialFilterType);
            }
        } catch (parseErr) {
            console.warn('[validateQuery] Failed to parse spatial filter:', parseErr);
        }
    } else {
        console.log('[validateQuery] No spatial filter present');
    }

    // Helper to execute query request with configurable params
    const executeQueryRequest = async (params = {}) => {
        const payload = {
            serviceUrl: url,
            where: whereClause,
            ...params
        };
        
        // Add spatial filter parameters if present
        if (hasSpatialFilter && spatialFilterGeometry && spatialFilterType) {
            payload.geometry = JSON.stringify(spatialFilterGeometry);
            payload.geometryType = spatialFilterType;
            payload.spatialRel = 'esriSpatialRelIntersects';
            // Include spatial reference if present in geometry
            if (spatialFilterGeometry.spatialReference) {
                payload.inSR = JSON.stringify(spatialFilterGeometry.spatialReference);
            }
        }
        
        if (hasCredentials) {
            payload.username = formData.source.username;
            payload.password = formData.source.password;
        }

        console.log('[validateQuery] Sending query payload:', {
            ...payload,
            password: payload.password ? '***' : undefined, // Don't log password
            geometry: payload.geometry ? `${payload.geometryType} (${payload.geometry.length} chars)` : undefined
        });

        const handleResponse = async (res) => {
            if (!res.ok) {
                 const errJson = await res.json().catch(() => ({}));
                 throw new Error(errJson.error || `Server Error: ${res.status}`);
            }
            const json = await res.json();
            if (json.error) throw new Error(json.error.message);
            return json;
        };

        // 1. Try Authenticated Proxy (if creds exist)
        if (hasCredentials) {
            console.log('[validateQuery] Using authenticated proxy');
            const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return handleResponse(res);
        }

        // 2. Try Direct Fetch (if public)
        try {
            console.log('[validateQuery] Trying direct fetch...');
            const queryParams = new URLSearchParams({ f: 'json', where: whereClause });
            // Add spatial filter params for direct fetch
            if (hasSpatialFilter && spatialFilterGeometry && spatialFilterType) {
                queryParams.append('geometry', JSON.stringify(spatialFilterGeometry));
                queryParams.append('geometryType', spatialFilterType);
                queryParams.append('spatialRel', 'esriSpatialRelIntersects');
                if (spatialFilterGeometry.spatialReference) {
                    queryParams.append('inSR', JSON.stringify(spatialFilterGeometry.spatialReference));
                }
            }
            Object.keys(params).forEach(key => queryParams.append(key, params[key]));
            
            const fullUrl = `${url}/query?${queryParams.toString()}`;
            console.log('[validateQuery] Direct fetch URL length:', fullUrl.length);
            
            const res = await fetch(fullUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error.message);
            console.log('[validateQuery] Direct fetch succeeded');
            return json;

        } catch (directErr) {
            // 3. Fallback to Proxy (Unauthenticated)
            console.log('[validateQuery] Direct fetch failed, using proxy fallback:', directErr.message);
            const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return handleResponse(res);
        }
    };

    try {
        let data;
        let count = 0;
        let isFallback = false;
        let fallbackMethod = 'count'; // 'count', 'ids', 'limit'
        
        // Attempt 1: Get Count Only (Preferred, but can fail on empty tables on some servers)
        try {
            data = await executeQueryRequest({ returnCountOnly: true });
            count = data.count ?? (data.features ? data.features.length : 0);
        } catch (countErr) {
            console.warn("Count query failed, retrying with IDs check...", countErr);
            
            // Attempt 2: Fallback to IDs Only (Robust on empty tables)
            try {
                data = await executeQueryRequest({ returnIdsOnly: true });
                const ids = data.objectIds || data.globalIds || [];
                count = ids ? ids.length : 0;
                isFallback = true;
                fallbackMethod = 'ids';
            } catch (idsErr) {
                console.warn("IDs query failed, retrying with 1 feature check...", idsErr);
                
                // Attempt 3: Fallback to getting 1 feature (Last Resort)
                // Use 'outFields: *' only if absolutely necessary, sometimes causes payload issues
                data = await executeQueryRequest({ returnCountOnly: false, resultRecordCount: 1, outFields: '*' });
                const features = data.features || [];
                count = features.length;
                isFallback = true;
                fallbackMethod = 'limit';
            }
        }

        // Build result message - indicate what filters were applied
        const filtersApplied = [];
        if (whereClause && whereClause !== '1=1') {
            filtersApplied.push('query');
        }
        if (hasSpatialFilter) {
            filtersApplied.push('geofence');
        }
        const filterText = filtersApplied.length > 0 ? ` (${filtersApplied.join(' + ')})` : '';

        // Handle Results
        if (count === 0) {
            setQueryValidationResult({
                type: 'warning',
                message: `Valid${filterText}, but 0 records matched.`
            });
        } else {
            // Display logic: if we used limit=1, we don't know the full count
            const displayVal = (fallbackMethod === 'limit' && count >= 1) ? "1+" : count;
            
            setQueryValidationResult({
                type: 'success',
                message: `Valid${filterText}! Matches ${displayVal} records.`
            });
        }

    } catch (err) {
        setQueryValidationResult({
            type: 'error',
            message: getPlainEnglishMessage('error', err.message)
        });
    } finally {
        setIsQueryValidating(false);
    }
  };

  // Auto-load fields when modal opens if URL exists
  useEffect(() => {
    if (formData.source?.url) {
      validateAndLoadFields();
    }
  }, []); // Empty dependency array = run once on mount

  // --- Field Editor Logic ---

  const addDisplayField = () => {
    const newField = { field: "", label: "", format: "string" };
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        displayFields: [...(prev.source.displayFields || []), newField]
      }
    }));
  };

  const updateDisplayField = (index, field, val) => {
    const newFields = [...(formData.source.displayFields || [])];
    newFields[index] = { ...newFields[index], [field]: val };
    setFormData(prev => ({ ...prev, source: { ...prev.source, displayFields: newFields } }));
  };

  const removeDisplayField = (index) => {
    const newFields = (formData.source.displayFields || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, source: { ...prev.source, displayFields: newFields } }));
  };

  const moveField = (index, direction) => {
    const fields = [...(formData.source.displayFields || [])];
    if (direction === -1 && index > 0) {
      [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
    } else if (direction === 1 && index < fields.length - 1) {
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
    }
    setFormData(prev => ({ ...prev, source: { ...prev.source, displayFields: fields } }));
  };

  // --- Query Builder Logic ---

  const handleQueryModeChange = (mode) => {
      const currentConfig = formData.source.queryConfig || { rules: [], logic: 'AND' };
      let newDefinitionQuery = formData.source.definitionQuery || "";
      
      // If switching to None, clear query
      if (mode === 'none') {
          newDefinitionQuery = "";
      } 
      
      setFormData(prev => ({
          ...prev,
          source: {
              ...prev.source,
              definitionQuery: newDefinitionQuery,
              queryConfig: { ...currentConfig, mode: mode }
          }
      }));
  };

  const handleLogicChange = (newLogic) => {
      // Logic is stored in queryConfig.logic
      updateBuilderRules(formData.source.queryConfig?.rules || [], newLogic);
  };

  const addBuilderRule = () => {
      const currentRules = formData.source.queryConfig?.rules || [];
      const newRules = [...currentRules, { field: '', operator: '=', value: '' }];
      updateBuilderRules(newRules);
  };

  const updateBuilderRule = (index, key, value) => {
      const currentRules = [...(formData.source.queryConfig?.rules || [])];
      currentRules[index] = { ...currentRules[index], [key]: value };
      updateBuilderRules(currentRules);
  };

  const removeBuilderRule = (index) => {
      const currentRules = (formData.source.queryConfig?.rules || []).filter((_, i) => i !== index);
      updateBuilderRules(currentRules);
  };

  const updateBuilderRules = (newRules, logicOverride = null) => {
      const currentLogic = logicOverride || formData.source.queryConfig?.logic || 'AND';
      const newConfig = { 
          ...(formData.source.queryConfig || {}), 
          rules: newRules,
          logic: currentLogic
      };
      
      const sqlParts = newRules.filter(r => r.field).map(r => {
          let val = r.value;
          const fieldDef = availableFields.find(f => f.name === r.field);
          
          if (r.operator === 'IS NULL' || r.operator === 'IS NOT NULL') {
              return `${r.field} ${r.operator}`;
          }

          // Determine if we should treat as number (no quotes) or string/date (quotes)
          let isNumeric = false;
          if (fieldDef) {
              const numericTypes = [
                  'esriFieldTypeInteger', 
                  'esriFieldTypeSmallInteger', 
                  'esriFieldTypeDouble', 
                  'esriFieldTypeSingle', 
                  'esriFieldTypeOID'
              ];
              isNumeric = numericTypes.includes(fieldDef.type);
          } else {
              // Fallback for manual entry if no metadata available
              isNumeric = !isNaN(parseFloat(val)) && isFinite(val);
          }
          
          if (r.operator === 'LIKE') {
              return `${r.field} LIKE '%${val}%'`;
          }

          if (!isNumeric) {
             val = `'${val}'`;
          }

          return `${r.field} ${r.operator} ${val}`;
      });
      
      // Join with the selected logic (AND/OR)
      const generatedSql = sqlParts.join(` ${currentLogic} `);

      setFormData(prev => ({
          ...prev,
          source: {
              ...prev.source,
              definitionQuery: generatedSql,
              queryConfig: newConfig
          }
      }));
  };

  // --- Spatial Filter Handlers (NEW) ---
  const handleSpatialFilterSave = (geometry) => {
      setFormData(prev => ({
          ...prev,
          source: {
              ...prev.source,
              spatialFilter: geometry
          }
      }));
  };

  const handleServiceSelect = (serviceData) => {
      // Handle both string (legacy) and object formats to be safe
      const url = typeof serviceData === 'string' ? serviceData : serviceData.url;
      const username = typeof serviceData === 'object' ? serviceData.username : '';
      const password = typeof serviceData === 'object' ? serviceData.password : '';
      
      // Update State with URL and Credentials
      setFormData(prev => ({ 
        ...prev, 
        source: { 
            ...prev.source, 
            url,
            username, 
            password
        } 
      }));

      // Trigger validation immediately with new values
      // We pass the new values explicitly because the state update above might not have processed yet
      validateAndLoadFields({ url, username, password });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      
      {/* Service Finder Modal Overlay */}
      <ServiceFinder 
        isOpen={showServiceFinder} 
        onClose={() => setShowServiceFinder(false)} 
        onSelect={handleServiceSelect} 
      />

      {/* Spatial Filter Modal Overlay (NEW) - Now receives credentials and proxy URL */}
      <SpatialFilter
        isOpen={showSpatialFilter}
        onClose={() => setShowSpatialFilter(false)}
        serviceUrl={formData.source?.url}
        credentials={{
            username: formData.source?.username,
            password: formData.source?.password
        }}
        proxyUrl={ARCGIS_PROXY_URL}
        initialGeometry={formData.source?.spatialFilter}
        onSave={handleSpatialFilterSave}
      />

      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Edit Notification Rule</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Settings */}
            <div className="space-y-6">
              {/* General Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><Settings className="w-4 h-4" /> General Settings</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">System ID</label>
                  <input 
                      value={formData.id || ''} 
                      onChange={e => handleChange('id', e.target.value)} 
                      className="w-full px-3 py-2 border rounded font-mono text-xs"
                      placeholder="e.g. permit-expiry-alert"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Unique ID. No spaces or special characters allowed.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Display Name</label>
                  <input value={formData.name || ''} onChange={e => handleChange('name', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>

                {/* Frequency Selector */}
                <div className="grid grid-cols-12 gap-4">
                  <div className={`${['monthly', 'weekly', 'daily'].includes(formData.type) ? 'col-span-4' : 'col-span-6'}`}>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                    <select 
                      value={formData.type || 'monthly'} 
                      onChange={e => {
                          const newType = e.target.value;
                          let defaultRunDay = 15;
                          if (newType === 'weekly') defaultRunDay = 1;
                          if (newType === 'daily') defaultRunDay = 0;
                          if (newType === 'hours') defaultRunDay = 1; 
                          if (newType === 'minutes') defaultRunDay = 15; 
                          
                          setFormData(prev => ({
                            ...prev,
                            type: newType,
                            runDay: defaultRunDay,
                            // Set default runtime to midnight if switching to calendar types and no time set
                            runTime: (['monthly', 'weekly', 'daily'].includes(newType)) 
                                ? (prev.runTime || '00:00') 
                                : prev.runTime,
                            // Force sendEmpty to false for high-frequency notifications
                            sendEmpty: ['hours', 'minutes'].includes(newType) ? false : prev.sendEmpty
                          }));
                      }} 
                      className="w-full px-2 py-2 border rounded text-xs bg-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                      <option value="hours">Hourly</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </div>
                  <div className={`${['monthly', 'weekly', 'daily'].includes(formData.type) ? 'col-span-4' : 'col-span-6'}`}>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {formData.type === 'monthly' ? 'Day of Month' : 
                       formData.type === 'weekly' ? 'Day of Week' : 
                       formData.type === 'hours' ? 'Interval (Hours)' : 
                       formData.type === 'minutes' ? 'Interval (Minutes)' : 
                       'Run Schedule'}
                    </label>

                    {formData.type === 'monthly' && (
                       <input 
                         value={formData.runDay || 15} 
                         onChange={e => handleChange('runDay', e.target.value)} 
                         className="w-full px-2 py-2 border rounded text-xs" 
                         placeholder="Day (1-31)" 
                         type="number" 
                         min="1" max="31"
                       />
                    )}

                    {formData.type === 'weekly' && (
                       <select 
                         value={formData.runDay || 1} 
                         onChange={e => handleChange('runDay', parseInt(e.target.value))} 
                         className="w-full px-2 py-2 border rounded text-xs bg-white"
                       >
                         <option value={0}>Sunday</option>
                         <option value={1}>Monday</option>
                         <option value={2}>Tuesday</option>
                         <option value={3}>Wednesday</option>
                         <option value={4}>Thursday</option>
                         <option value={5}>Friday</option>
                         <option value={6}>Saturday</option>
                       </select>
                    )}
                    
                    {formData.type === 'daily' && (
                       <input value="Every Day" disabled className="w-full px-2 py-2 border rounded text-xs bg-slate-50 text-slate-500" />
                    )}

                    {formData.type === 'hours' && (
                       <select 
                         value={formData.runDay || 1} 
                         onChange={e => handleChange('runDay', parseInt(e.target.value))} 
                         className="w-full px-2 py-2 border rounded text-xs bg-white"
                       >
                         <option value={1}>Every 1 Hour</option>
                         <option value={2}>Every 2 Hours</option>
                         <option value={3}>Every 3 Hours</option>
                         <option value={4}>Every 4 Hours</option>
                         <option value={6}>Every 6 Hours</option>
                         <option value={8}>Every 8 Hours</option>
                         <option value={12}>Every 12 Hours</option>
                       </select>
                    )}
                    
                    {formData.type === 'minutes' && (
                       <select 
                         value={formData.runDay || 15} 
                         onChange={e => handleChange('runDay', parseInt(e.target.value))} 
                         className="w-full px-2 py-2 border rounded text-xs bg-white"
                       >
                         <option value={5}>Every 5 Minutes</option>
                         <option value={10}>Every 10 Minutes</option>
                         <option value={15}>Every 15 Minutes</option>
                         <option value={30}>Every 30 Minutes</option>
                         <option value={45}>Every 45 Minutes</option>
                       </select>
                    )}
                  </div>

                  {/* Run Time Input - Only for Calendar Types */}
                  {['monthly', 'weekly', 'daily'].includes(formData.type) && (
                      <div className="col-span-4">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Run Time (UTC)</label>
                        <input 
                            type="time" 
                            value={formData.runTime || '00:00'} 
                            onChange={e => handleChange('runTime', e.target.value)} 
                            className="w-full px-2 py-2 border rounded text-xs" 
                        />
                      </div>
                  )}
                </div>
                
                {/* Options */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input type="checkbox" checked={formData.paused || false} onChange={e => handleChange('paused', e.target.checked)} className="rounded" />
                      <span className="text-slate-700 group-hover:text-slate-900">
                          Pause Notification
                      </span>
                  </label>
                  
                  {/* Conditionally hide sendEmpty for high-frequency types */}
                  {!['hours', 'minutes'].includes(formData.type) && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer group">
                          <input type="checkbox" checked={formData.sendEmpty || false} onChange={e => handleChange('sendEmpty', e.target.checked)} className="rounded" />
                          <span className="text-slate-700 group-hover:text-slate-900">Send notification even if empty</span>
                      </label>
                  )}
                  
                  {['hours', 'minutes'].includes(formData.type) && (
                      <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                          <input type="checkbox" checked={false} disabled className="rounded opacity-50" />
                          <span>Send empty disabled for high-frequency notifications</span>
                      </div>
                  )}
                  
                  {/* Public/Private visibility */}
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input type="checkbox" checked={formData.access === 'public'} onChange={e => handleChange('access', e.target.checked ? 'public' : 'private')} className="rounded" />
                      <span className="text-slate-700 group-hover:text-slate-900">Make notification public</span>
                  </label>
                  {formData.access !== 'public' && (
                      <p className="text-[10px] text-slate-400 ml-6 -mt-1">Private: Only invited users can subscribe</p>
                  )}
                  {formData.access === 'public' && (
                      <p className="text-[10px] text-slate-400 ml-6 -mt-1">Public: Anyone can discover and subscribe</p>
                  )}
                </div>

                {/* Lookback Settings - for sub-daily types */}
                {['hours', 'minutes'].includes(formData.type) && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <label className="block text-xs font-medium text-amber-800 mb-1 flex items-center gap-1">
                            <History className="w-3 h-3" /> Lookback Window
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                value={formData.lookbackMinutes || (formData.type === 'hours' ? (formData.runDay || 1) * 60 : (formData.runDay || 15))}
                                onChange={e => handleChange('lookbackMinutes', parseInt(e.target.value))}
                                className="flex-1 px-2 py-1.5 border rounded text-sm bg-white"
                            >
                                <option value={5}>5 minutes</option>
                                <option value={10}>10 minutes</option>
                                <option value={15}>15 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={60}>1 hour</option>
                                <option value={120}>2 hours</option>
                                <option value={240}>4 hours</option>
                                <option value={480}>8 hours</option>
                                <option value={1440}>24 hours</option>
                            </select>
                        </div>
                        <p className="text-[10px] text-amber-700 mt-1.5 leading-tight">
                            Records modified within this window will be included. Defaults to your notification interval.
                        </p>
                    </div>
                )}
                
                {/* Lag Settings - Hidden for sub-daily types */}
                {!['hours', 'minutes'].includes(formData.type) && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <History className="w-3 h-3" /> Data Lag (Days)
                        </label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="number" 
                                min="0" 
                                value={formData.lag || 0} 
                                onChange={e => handleChange('lag', parseInt(e.target.value))} 
                                className="w-20 px-2 py-1.5 border rounded text-sm"
                            />
                            <p className="text-[10px] text-slate-500 leading-tight">
                                0 = Realtime (ends today)<br/>
                                1 = Ends yesterday<br/>
                                2 = Ends 2 days ago
                            </p>
                        </div>
                    </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <input value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
              </div>

              {/* Email Settings */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Email Message</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Custom Intro Text (Standard)</label>
                  <textarea 
                    value={formData.emailIntro || ''} 
                    onChange={e => handleChange('emailIntro', e.target.value)} 
                    className="w-full px-3 py-2 border rounded h-24 text-sm"
                    placeholder="Message to display when records ARE found..."
                  />
                </div>
                
                {/* Empty State Message - Conditional on sendEmpty */}
                {formData.sendEmpty && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Empty State Message (0 Records)</label>
                    <textarea 
                      value={formData.emailZeroStateMessage || ''} 
                      onChange={e => handleChange('emailZeroStateMessage', e.target.value)} 
                      className="w-full px-3 py-2 border rounded h-24 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      placeholder="Message to display when NO records are found..."
                    />
                    <p className="text-[10px] text-slate-400 mt-1">This message replaces the table and standard intro when 0 records are found.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Source & Data */}
            <div className="space-y-6 flex flex-col">
              
              {/* Source Settings */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Data Source</h4>
                
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">REST Endpoint URL</label>
                  <div className="flex gap-2">
                    <input 
                        value={formData.source?.url || ''} 
                        onChange={e => handleSourceChange('url', e.target.value)} 
                        className="flex-1 px-3 py-2 border rounded font-mono text-xs"
                        placeholder="https://services.arcgis.com/..."
                    />
                    <button 
                        onClick={() => setShowServiceFinder(true)}
                        className="bg-slate-100 border border-slate-300 text-slate-700 px-3 rounded hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                        title="Browse for Services"
                    >
                         <Search className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={() => validateAndLoadFields()}
                        disabled={isValidating || !formData.source?.url}
                        className="bg-[#004E7C] border border-[#003B5C] text-white px-3 rounded hover:bg-[#003B5C] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        title="Test service connection and query"
                    >
                        {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                        <span className="text-xs font-medium">Test</span>
                    </button>
                  </div>
                  
                  {/* Validation Feedback */}
                  {validationResult && (
                      <div className={`mt-2 p-2 rounded text-xs ${validationResult.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                          <div className="flex items-center gap-2">
                              {validationResult.type === 'error' ? <AlertCircle className="w-3 h-3 shrink-0" /> : <Check className="w-3 h-3 shrink-0" />}
                              <span className="flex-1 font-medium">{validationResult.message}</span>
                          </div>
                          {validationResult.dateRange && (
                              <div className="mt-1 text-[10px] text-green-600 ml-5">
                                  Date range tested: {validationResult.dateRange}
                              </div>
                          )}
                      </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Secure Access (Optional)
                    </div>
                    <input 
                        value={formData.source?.username || ''} 
                        onChange={e => handleSourceChange('username', e.target.value)} 
                        className="px-2 py-1.5 border rounded text-xs"
                        placeholder="Username"
                    />
                    <input 
                        type="password"
                        value={formData.source?.password || ''} 
                        onChange={e => handleSourceChange('password', e.target.value)} 
                        className="px-2 py-1.5 border rounded text-xs"
                        placeholder="Password"
                    />
                </div>

                {/* Date Field - Now a dynamic dropdown if fields loaded */}
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date Field (for Queries)</label>
                    {availableFields.length > 0 ? (
                        <select
                            value={formData.source?.dateField || ''}
                            onChange={e => {
                                const selectedField = availableFields.find(f => f.name === e.target.value);
                                handleSourceChange('dateField', e.target.value);
                                // Store the field type so the engine knows how to query it
                                handleSourceChange('dateFieldType', selectedField?.type || null);
                            }}
                            className="w-full px-2 py-2 border rounded text-xs font-mono bg-white"
                        >
                            <option value="">-- Select Date Field --</option>
                            {availableFields.filter(f => f.type === 'esriFieldTypeDate' || f.type === 'esriFieldTypeDateOnly').map(f => (
                                <option key={f.name} value={f.name}>
                                    {f.name} ({f.alias}){f.type === 'esriFieldTypeDateOnly' ? ' [DateOnly]' : ''}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input 
                            value={formData.source?.dateField || ''} 
                            onChange={e => handleSourceChange('dateField', e.target.value)} 
                            className="w-full px-3 py-2 border rounded font-mono text-xs"
                            placeholder="e.g. EditDate"
                        />
                    )}
                    {formData.source?.dateFieldType === 'esriFieldTypeDateOnly' && (
                        <p className="text-[10px] text-amber-600 mt-1">
                            ⚠️ DateOnly fields only support date-based queries (no time/timestamp precision).
                        </p>
                    )}
                </div>
              </div>

              {/* Spatial Filter Section (Moved here) */}
              <div className={`space-y-3 pt-4 border-t border-slate-100 ${isTable ? 'opacity-50' : ''}`}>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <MapIcon className="w-4 h-4" /> Spatial Filter (Geofence)
                </h4>
                {isTable ? (
                    <p className="text-xs text-slate-500 italic">
                        Spatial filtering is not available for table services (no geometry).
                    </p>
                ) : (
                    <>
                        <p className="text-xs text-slate-500">Optionally restrict notifications to a specific geographic area.</p>

                        <div className="flex items-center gap-3 mt-2">
                            <button 
                                onClick={() => setShowSpatialFilter(true)}
                                className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded flex items-center gap-2 hover:bg-slate-50 hover:text-[#004E7C] transition-colors shadow-sm"
                            >
                                <MapIcon className="w-3 h-3" />
                                {formData.source?.spatialFilter ? 'Edit Geofence' : 'Draw Geofence'}
                            </button>
                            
                            {formData.source?.spatialFilter && (
                                <div className="flex items-center gap-2 bg-green-100 text-green-800 px-2 py-1.5 rounded text-xs border border-green-200 animate-in fade-in">
                                    <Check className="w-3 h-3" /> 
                                    <span>Filter Active</span>
                                    <button 
                                        onClick={() => handleSpatialFilterSave(null)}
                                        className="ml-2 text-green-700 hover:text-red-600 transition-colors"
                                        title="Remove Filter"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            {!formData.source?.spatialFilter && (
                                    <span className="text-xs text-slate-400 italic">No spatial filter applied</span>
                            )}
                        </div>
                    </>
                )}
              </div>

              {/* Definition Query / Filter Builder */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><ListFilter className="w-4 h-4" /> Definition Query (Filter)</h4>
                <p className="text-xs text-slate-500">Optionally filter results using an SQL WHERE clause or a visual builder.</p>

                 {/* Mode Tabs */}
                 <div className="flex border-b border-slate-200">
                     <button 
                        onClick={() => handleQueryModeChange('none')}
                        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${formData.source?.queryConfig?.mode === 'none' || !formData.source?.queryConfig?.mode ? 'border-[#004E7C] text-[#004E7C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                     >
                         None
                     </button>
                     <button 
                        onClick={() => handleQueryModeChange('builder')}
                        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${formData.source?.queryConfig?.mode === 'builder' ? 'border-[#004E7C] text-[#004E7C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                     >
                         Visual Builder
                     </button>
                     <button 
                        onClick={() => handleQueryModeChange('sql')}
                        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${formData.source?.queryConfig?.mode === 'sql' ? 'border-[#004E7C] text-[#004E7C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                     >
                         Raw SQL
                     </button>
                 </div>

                 {/* Mode: Builder */}
                 {(formData.source?.queryConfig?.mode === 'builder') && (
                     <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                         
                         {/* Logic Switcher (AND/OR) */}
                         <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
                             <span className="text-xs text-slate-500">Match</span>
                             <select 
                                 className="text-xs border rounded px-2 py-1 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004E7C]"
                                 value={formData.source.queryConfig?.logic || 'AND'}
                                 onChange={(e) => handleLogicChange(e.target.value)}
                             >
                                 <option value="AND">ALL (AND)</option>
                                 <option value="OR">ANY (OR)</option>
                             </select>
                             <span className="text-xs text-slate-500">of the following rules:</span>
                         </div>

                         <div className="space-y-2">
                             {(formData.source.queryConfig.rules || []).map((rule, idx) => (
                                 <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                                     {idx > 0 && <span className="text-[10px] text-slate-400 font-bold uppercase w-6 text-center">{formData.source.queryConfig?.logic || 'AND'}</span>}
                                     {idx === 0 && <span className="w-6"></span>} {/* Spacer for first item alignment */}
                                     
                                     {availableFields.length > 0 ? (
                                         <select
                                            className="flex-1 text-xs px-2 py-1.5 border rounded font-mono"
                                            value={rule.field}
                                            onChange={e => updateBuilderRule(idx, 'field', e.target.value)}
                                         >
                                             <option value="">Field...</option>
                                             {availableFields.map(f => (
                                                 <option key={f.name} value={f.name}>{f.name}</option>
                                             ))}
                                         </select>
                                     ) : (
                                         <input 
                                            placeholder="Field Name"
                                            className="flex-1 text-xs px-2 py-1.5 border rounded font-mono"
                                            value={rule.field}
                                            onChange={e => updateBuilderRule(idx, 'field', e.target.value)}
                                         />
                                     )}
                                     <select
                                        className="w-20 text-xs px-1 py-1.5 border rounded"
                                        value={rule.operator}
                                        onChange={e => updateBuilderRule(idx, 'operator', e.target.value)}
                                     >
                                         <option value="=">=</option>
                                         <option value="<>">!=</option>
                                         <option value=">">&gt;</option>
                                         <option value="<">&lt;</option>
                                         <option value="LIKE">contains</option>
                                         <option value="IS NULL">is null</option>
                                         <option value="IS NOT NULL">not null</option>
                                     </select>
                                     {rule.operator !== 'IS NULL' && rule.operator !== 'IS NOT NULL' && (
                                         <input 
                                            placeholder="Value"
                                            className="flex-1 text-xs px-2 py-1.5 border rounded"
                                            value={rule.value}
                                            onChange={e => updateBuilderRule(idx, 'value', e.target.value)}
                                         />
                                     )}
                                     <button onClick={() => removeBuilderRule(idx)} className="text-slate-400 hover:text-red-500">
                                         <X className="w-4 h-4" />
                                     </button>
                                 </div>
                             ))}
                             {(formData.source.queryConfig.rules || []).length === 0 && (
                                 <p className="text-xs text-slate-400 italic text-center py-2">No filters applied. Add a rule to start.</p>
                             )}
                         </div>
                         <button 
                            onClick={addBuilderRule}
                            className="w-full py-1.5 border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:text-[#004E7C] hover:border-[#004E7C] hover:bg-white"
                         >
                             + Add Filter Rule
                         </button>
                         <div className="mt-2 pt-2 border-t border-slate-200">
                             <p className="text-[10px] text-slate-400 font-mono break-all">Result: {formData.source.definitionQuery}</p>
                         </div>
                     </div>
                 )}

                 {/* Mode: SQL */}
                 {(formData.source?.queryConfig?.mode === 'sql') && (
                     <div>
                         <textarea 
                            value={formData.source.definitionQuery || ''}
                            onChange={e => handleSourceChange('definitionQuery', e.target.value)}
                            className="w-full h-24 p-2 text-xs font-mono border rounded bg-slate-50 text-slate-700"
                            placeholder="e.g. TYPE = 'Permit' AND STATUS = 'Open'"
                         />
                         <p className="text-[10px] text-slate-400 mt-1">
                             Enter standard ArcGIS SQL WHERE clause. This will be appended to the date query.
                         </p>
                     </div>
                 )}
                 
                 {(formData.source?.queryConfig?.mode === 'none' || !formData.source?.queryConfig?.mode) && !formData.source?.spatialFilter && (
                     <p className="text-xs text-slate-400 italic">No additional definition query will be applied.</p>
                 )}

                 {/* Test Query Button - Show when there's a definition query OR a spatial filter */}
                 {((formData.source?.queryConfig?.mode !== 'none' && formData.source?.queryConfig?.mode) || formData.source?.spatialFilter) && (
                     <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                         <div className="flex-1">
                             {queryValidationResult && (
                                  <div className={`text-xs flex items-center gap-2 ${
                                      queryValidationResult.type === 'error' ? 'text-red-600' : 
                                      queryValidationResult.type === 'warning' ? 'text-amber-600' : 'text-green-600'
                                  }`}>
                                     {queryValidationResult.type === 'error' ? <AlertCircle className="w-3 h-3" /> : 
                                      queryValidationResult.type === 'warning' ? <AlertCircle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                     {queryValidationResult.message}
                                  </div>
                             )}
                         </div>
                         <button
                             onClick={validateQuery}
                             disabled={isQueryValidating || !formData.source?.url}
                             className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                         >
                             {isQueryValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                             Test Filters
                         </button>
                     </div>
                 )}
              </div>

              {/* Data Fields */}
              <div className="space-y-4 pt-4 border-t border-slate-100 flex flex-col flex-1 min-h-[320px]">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2"><LayoutList className="w-4 h-4" /> Data Fields & Export</h4>
                  <button onClick={addDisplayField} className="text-xs bg-indigo-50 text-[#004E7C] px-2 py-1 rounded font-medium hover:bg-indigo-100">
                    + Add Field
                  </button>
                </div>
                <p className="text-xs text-slate-500">Define the columns for the CSV export and Email table. Order matters.</p>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 border rounded-lg p-2 bg-slate-50 min-h-[240px]">
                  {(formData.source.displayFields || []).length === 0 && <p className="text-sm italic text-slate-400 text-center mt-8">No fields defined.</p>}
                  
                  {(formData.source.displayFields || []).map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 shadow-sm">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={() => moveField(idx, 1)} disabled={idx === (formData.source.displayFields.length - 1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-20"><ArrowDown className="w-3 h-3" /></button>
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                            {availableFields.length > 0 ? (
                                <select
                                   className="w-full text-xs px-2 py-1 border rounded font-mono"
                                   value={field.field}
                                   onChange={e => {
                                       const selected = availableFields.find(f => f.name === e.target.value);
                                       const newFields = [...formData.source.displayFields];
                                       newFields[idx] = { 
                                           ...newFields[idx], 
                                           field: e.target.value,
                                           // Auto-fill label if empty
                                           label: !field.label && selected ? selected.alias : field.label
                                       };
                                       setFormData(prev => ({ ...prev, source: { ...prev.source, displayFields: newFields } }));
                                   }}
                                >
                                    <option value="">Field...</option>
                                    {availableFields.map(f => (
                                        <option key={f.name} value={f.name}>{f.name}</option>
                                    ))}
                                </select>
                            ) : (
                               <input 
                                 placeholder="DB Field Name" 
                                 className="w-full text-xs px-2 py-1 border rounded font-mono"
                                 value={field.field}
                                 onChange={e => updateDisplayField(idx, 'field', e.target.value)}
                               />
                            )}
                        </div>
                        <div className="col-span-4">
                           <input 
                             placeholder="Label" 
                             className="w-full text-xs px-2 py-1 border rounded"
                             value={field.label}
                             onChange={e => updateDisplayField(idx, 'label', e.target.value)}
                           />
                        </div>
                        <div className="col-span-3">
                           <select 
                             className="w-full text-xs px-1 py-1 border rounded"
                             value={field.format || 'string'}
                             onChange={e => updateDisplayField(idx, 'format', e.target.value)}
                           >
                             <option value="string">Text</option>
                             <option value="date">Date</option>
                             <option value="currency">$$$</option>
                           </select>
                        </div>
                      </div>
                      <button onClick={() => removeDisplayField(idx)} className="text-slate-400 hover:text-red-500 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800">Cancel</button>
          <button onClick={() => onSave(formData)} className="px-4 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}