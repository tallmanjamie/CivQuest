// src/atlas/utils/dataExclusion.js
// Utility for applying data exclusion rules to search results
//
// Data exclusion allows admins to redact specific field values for records
// that match exclusion criteria. This is used for owner exclusion (e.g., hiding
// personal information for certain property owners).
//
// The exclusion config is stored per-map in mapConfig.dataExclusion:
// {
//   enabled: boolean,
//   mode: 'fieldValues' | 'definitionQuery',
//   identifierField: string,       // field to check for exclusion (fieldValues mode)
//   identifierValues: string[],    // values that trigger exclusion (fieldValues mode)
//   definitionQuery: string,       // SQL WHERE clause (definitionQuery mode)
//   excludedFields: [{ field: string, replacement: string }]
// }

/**
 * Check if a feature matches the exclusion criteria
 * @param {Object} feature - Feature with attributes
 * @param {Object} exclusionConfig - Data exclusion configuration
 * @returns {boolean} True if the feature should have fields redacted
 */
function isFeatureExcluded(feature, exclusionConfig) {
  if (!feature?.attributes || !exclusionConfig) return false;

  const { mode, identifierField, identifierValues, definitionQuery } = exclusionConfig;

  if (mode === 'fieldValues') {
    if (!identifierField || !identifierValues?.length) return false;

    const fieldValue = feature.attributes[identifierField];
    if (fieldValue == null) return false;

    // Case-insensitive comparison for string values
    const normalizedValue = String(fieldValue).trim().toUpperCase();
    return identifierValues.some(v => String(v).trim().toUpperCase() === normalizedValue);
  }

  if (mode === 'definitionQuery') {
    if (!definitionQuery?.trim()) return false;
    return evaluateSimpleWhereClause(feature.attributes, definitionQuery);
  }

  return false;
}

/**
 * Evaluate a simple SQL WHERE clause against feature attributes.
 * Supports basic comparisons: =, !=, <>, LIKE, IN, IS NULL, IS NOT NULL
 * Supports AND/OR connectors.
 *
 * This is a client-side approximation for common patterns.
 * Complex expressions may not be fully supported.
 *
 * @param {Object} attributes - Feature attributes
 * @param {string} whereClause - SQL WHERE clause
 * @returns {boolean} True if attributes match the clause
 */
function evaluateSimpleWhereClause(attributes, whereClause) {
  if (!whereClause?.trim()) return false;

  try {
    // Handle OR groups: split by OR first, any group matching means true
    const orGroups = whereClause.split(/\bOR\b/i);

    for (const group of orGroups) {
      // Handle AND conditions within each OR group
      const andConditions = group.split(/\bAND\b/i);
      let allMatch = true;

      for (const condition of andConditions) {
        if (!evaluateSingleCondition(attributes, condition.trim())) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) return true;
    }

    return false;
  } catch (err) {
    console.warn('[dataExclusion] Error evaluating WHERE clause:', err.message);
    return false;
  }
}

/**
 * Evaluate a single SQL condition (e.g., "FIELD = 'value'")
 * @param {Object} attributes
 * @param {string} condition
 * @returns {boolean}
 */
function evaluateSingleCondition(attributes, condition) {
  if (!condition?.trim()) return true; // Empty conditions pass

  const trimmed = condition.trim();

  // IS NOT NULL
  const isNotNullMatch = trimmed.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
  if (isNotNullMatch) {
    const field = isNotNullMatch[1];
    return attributes[field] != null && attributes[field] !== '';
  }

  // IS NULL
  const isNullMatch = trimmed.match(/^(\w+)\s+IS\s+NULL$/i);
  if (isNullMatch) {
    const field = isNullMatch[1];
    return attributes[field] == null || attributes[field] === '';
  }

  // IN clause: FIELD IN ('val1', 'val2', ...)
  const inMatch = trimmed.match(/^(\w+)\s+IN\s*\((.+)\)$/i);
  if (inMatch) {
    const field = inMatch[1];
    const valuesStr = inMatch[2];
    const values = valuesStr.split(',').map(v => v.trim().replace(/^'|'$/g, '').toUpperCase());
    const fieldValue = attributes[field];
    if (fieldValue == null) return false;
    return values.includes(String(fieldValue).trim().toUpperCase());
  }

  // LIKE clause: FIELD LIKE 'pattern'
  const likeMatch = trimmed.match(/^(\w+)\s+LIKE\s+'(.+)'$/i);
  if (likeMatch) {
    const field = likeMatch[1];
    const pattern = likeMatch[2];
    const fieldValue = attributes[field];
    if (fieldValue == null) return false;
    // Convert SQL LIKE pattern to regex: % = .*, _ = .
    const regexStr = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$';
    return new RegExp(regexStr, 'i').test(String(fieldValue));
  }

  // Not equal: FIELD != 'value' or FIELD <> 'value'
  const neqMatch = trimmed.match(/^(\w+)\s*(?:!=|<>)\s*'?([^']*)'?$/i);
  if (neqMatch) {
    const field = neqMatch[1];
    const value = neqMatch[2];
    const fieldValue = attributes[field];
    if (fieldValue == null) return value !== '';
    return String(fieldValue).trim().toUpperCase() !== value.trim().toUpperCase();
  }

  // Equality: FIELD = 'value' or FIELD = number
  const eqMatch = trimmed.match(/^(\w+)\s*=\s*'?([^']*)'?$/i);
  if (eqMatch) {
    const field = eqMatch[1];
    const value = eqMatch[2];
    const fieldValue = attributes[field];
    if (fieldValue == null) return false;
    return String(fieldValue).trim().toUpperCase() === value.trim().toUpperCase();
  }

  // Greater than: FIELD > value
  const gtMatch = trimmed.match(/^(\w+)\s*>\s*'?([^']*)'?$/i);
  if (gtMatch) {
    const field = gtMatch[1];
    const value = Number(gtMatch[2]);
    const fieldValue = Number(attributes[field]);
    if (isNaN(fieldValue) || isNaN(value)) return false;
    return fieldValue > value;
  }

  // Less than: FIELD < value
  const ltMatch = trimmed.match(/^(\w+)\s*<\s*'?([^']*)'?$/i);
  if (ltMatch) {
    const field = ltMatch[1];
    const value = Number(ltMatch[2]);
    const fieldValue = Number(attributes[field]);
    if (isNaN(fieldValue) || isNaN(value)) return false;
    return fieldValue < value;
  }

  // If we can't parse the condition, don't match (safe default)
  console.warn('[dataExclusion] Unrecognized condition:', trimmed);
  return false;
}

/**
 * Apply data exclusion rules to a set of features.
 * Returns new feature objects with excluded fields replaced by their
 * configured replacement values. Original features are not mutated.
 *
 * @param {Array} features - Array of features with { attributes, geometry, ... }
 * @param {Object} mapConfig - Map configuration containing dataExclusion settings
 * @returns {Array} New array of features with exclusions applied
 */
export function applyDataExclusions(features, mapConfig) {
  if (!features?.length) return features;

  const exclusionConfig = mapConfig?.dataExclusion;
  if (!exclusionConfig?.enabled) return features;

  const { excludedFields } = exclusionConfig;
  if (!excludedFields?.length) return features;

  return features.map(feature => {
    if (!isFeatureExcluded(feature, exclusionConfig)) {
      return feature;
    }

    // Create a shallow copy with redacted attributes
    const newAttributes = { ...feature.attributes };

    for (const { field, replacement } of excludedFields) {
      if (field in newAttributes) {
        newAttributes[field] = replacement || 'REDACTED';
      }
    }

    return {
      ...feature,
      attributes: newAttributes,
      _isExcluded: true // Flag for UI to optionally style differently
    };
  });
}

/**
 * Get the list of field names that are configured for exclusion
 * @param {Object} mapConfig - Map configuration
 * @returns {string[]} Array of field names that may be redacted
 */
export function getExcludedFieldNames(mapConfig) {
  const exclusionConfig = mapConfig?.dataExclusion;
  if (!exclusionConfig?.enabled || !exclusionConfig?.excludedFields?.length) return [];
  return exclusionConfig.excludedFields.map(ef => ef.field);
}

/**
 * Check if data exclusion is enabled for a map
 * @param {Object} mapConfig - Map configuration
 * @returns {boolean}
 */
export function isDataExclusionEnabled(mapConfig) {
  return !!mapConfig?.dataExclusion?.enabled;
}
