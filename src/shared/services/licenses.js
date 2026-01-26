// src/shared/services/licenses.js
// License management service for CivQuest platform
// Provides license types, limits, and validation helpers
// 
// Supports separate licensing for Notify and Atlas products

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { PATHS } from './paths';

/**
 * Product Types
 */
export const PRODUCTS = {
  NOTIFY: 'notify',
  ATLAS: 'atlas'
};

/**
 * License Types
 */
export const LICENSE_TYPES = {
  PROFESSIONAL: 'professional',
  ORGANIZATION: 'organization'
};

/**
 * License Configuration
 * Defines the limits and restrictions for each license type per product
 */
export const LICENSE_CONFIG = {
  [LICENSE_TYPES.PROFESSIONAL]: {
    label: 'Professional',
    description: 'For professionals with limited secure users',
    color: 'amber',
    limits: {
      [PRODUCTS.NOTIFY]: {
        maxUsers: 3,
        allowPublic: false
      },
      [PRODUCTS.ATLAS]: {
        maxUsers: 3,
        allowPublic: false
      }
    }
  },
  [LICENSE_TYPES.ORGANIZATION]: {
    label: 'Organization',
    description: 'Full access for organizations',
    color: 'emerald',
    limits: {
      [PRODUCTS.NOTIFY]: {
        maxUsers: Infinity,
        allowPublic: true
      },
      [PRODUCTS.ATLAS]: {
        maxUsers: Infinity,
        allowPublic: true
      }
    }
  }
};

/**
 * Default license for new organizations (per product)
 */
export const DEFAULT_LICENSE = LICENSE_TYPES.PROFESSIONAL;

/**
 * Get license type for a specific product
 * @param {object} orgData - Organization data object
 * @param {string} product - Product type ('notify' or 'atlas')
 * @returns {string} License type
 */
export function getProductLicenseType(orgData, product) {
  // Check for product-specific license first
  const productLicense = orgData?.license?.[product]?.type;
  if (productLicense && LICENSE_CONFIG[productLicense]) {
    return productLicense;
  }
  
  // Fall back to legacy single license type
  const legacyLicense = orgData?.license?.type;
  if (legacyLicense && LICENSE_CONFIG[legacyLicense]) {
    return legacyLicense;
  }
  
  return DEFAULT_LICENSE;
}

/**
 * Get full license info for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<object>} License info for both products
 */
export async function getOrgLicense(orgId) {
  try {
    const orgRef = doc(db, PATHS.organization(orgId));
    const orgSnap = await getDoc(orgRef);
    
    if (!orgSnap.exists()) {
      return null;
    }
    
    const orgData = orgSnap.data();
    
    return {
      notify: {
        type: getProductLicenseType(orgData, PRODUCTS.NOTIFY),
        updatedAt: orgData.license?.notify?.updatedAt || orgData.license?.updatedAt || null,
        updatedBy: orgData.license?.notify?.updatedBy || orgData.license?.updatedBy || null
      },
      atlas: {
        type: getProductLicenseType(orgData, PRODUCTS.ATLAS),
        updatedAt: orgData.license?.atlas?.updatedAt || orgData.license?.updatedAt || null,
        updatedBy: orgData.license?.atlas?.updatedBy || orgData.license?.updatedBy || null
      }
    };
  } catch (error) {
    console.error('[licenses] Error getting org license:', error);
    return null;
  }
}

/**
 * Update license for a specific product (super admin only)
 * @param {string} orgId - Organization ID
 * @param {string} product - Product type ('notify' or 'atlas')
 * @param {string} licenseType - New license type ('team' or 'organization')
 * @param {string} adminEmail - Email of admin making the change
 * @returns {Promise<boolean>} Success status
 */
export async function updateProductLicense(orgId, product, licenseType, adminEmail) {
  if (!LICENSE_CONFIG[licenseType]) {
    throw new Error(`Invalid license type: ${licenseType}`);
  }
  if (!Object.values(PRODUCTS).includes(product)) {
    throw new Error(`Invalid product: ${product}`);
  }
  
  try {
    const orgRef = doc(db, PATHS.organization(orgId));
    await updateDoc(orgRef, {
      [`license.${product}.type`]: licenseType,
      [`license.${product}.updatedAt`]: serverTimestamp(),
      [`license.${product}.updatedBy`]: adminEmail
    });
    return true;
  } catch (error) {
    console.error('[licenses] Error updating product license:', error);
    throw error;
  }
}

/**
 * Check if an organization can add more users for a product
 * @param {object} orgData - Organization data object
 * @param {string} product - Product type ('notify' or 'atlas')
 * @param {number} currentUserCount - Current number of users
 * @returns {object} { allowed: boolean, limit: number, remaining: number, licenseType: string }
 */
export function canAddUser(orgData, product, currentUserCount) {
  const licenseType = getProductLicenseType(orgData, product);
  const config = LICENSE_CONFIG[licenseType];
  const limit = config.limits[product].maxUsers;
  
  return {
    allowed: currentUserCount < limit,
    limit: limit === Infinity ? null : limit,
    remaining: limit === Infinity ? null : Math.max(0, limit - currentUserCount),
    licenseType
  };
}

/**
 * Check if an organization can add more Notify users
 * @param {object} orgData - Organization data object
 * @param {number} currentUserCount - Current number of Notify users
 * @returns {object} { allowed: boolean, limit: number, remaining: number }
 */
export function canAddNotifyUser(orgData, currentUserCount) {
  return canAddUser(orgData, PRODUCTS.NOTIFY, currentUserCount);
}

/**
 * Check if an organization can add more Atlas users
 * @param {object} orgData - Organization data object
 * @param {number} currentUserCount - Current number of Atlas users
 * @returns {object} { allowed: boolean, limit: number, remaining: number }
 */
export function canAddAtlasUser(orgData, currentUserCount) {
  return canAddUser(orgData, PRODUCTS.ATLAS, currentUserCount);
}

/**
 * Check if an organization can have public items for a product
 * @param {object} orgData - Organization data object
 * @param {string} product - Product type ('notify' or 'atlas')
 * @returns {boolean}
 */
export function canHavePublic(orgData, product) {
  const licenseType = getProductLicenseType(orgData, product);
  const config = LICENSE_CONFIG[licenseType];
  return config.limits[product].allowPublic;
}

/**
 * Check if an organization can have public notifications
 * @param {object} orgData - Organization data object
 * @returns {boolean}
 */
export function canHavePublicNotifications(orgData) {
  return canHavePublic(orgData, PRODUCTS.NOTIFY);
}

/**
 * Check if an organization can have public maps
 * @param {object} orgData - Organization data object
 * @returns {boolean}
 */
export function canHavePublicMaps(orgData) {
  return canHavePublic(orgData, PRODUCTS.ATLAS);
}

/**
 * Get the license limits for a specific product
 * @param {object} orgData - Organization data object
 * @param {string} product - Product type ('notify' or 'atlas')
 * @returns {object} License limits for the product
 */
export function getProductLicenseLimits(orgData, product) {
  const licenseType = getProductLicenseType(orgData, product);
  const config = LICENSE_CONFIG[licenseType];
  return {
    type: licenseType,
    label: config.label,
    maxUsers: config.limits[product].maxUsers,
    allowPublic: config.limits[product].allowPublic
  };
}

/**
 * Get the license limits for all products
 * @param {object} orgData - Organization data object
 * @returns {object} License limits for both products
 */
export function getLicenseLimits(orgData) {
  return {
    notify: getProductLicenseLimits(orgData, PRODUCTS.NOTIFY),
    atlas: getProductLicenseLimits(orgData, PRODUCTS.ATLAS)
  };
}

/**
 * Get a user-friendly label for a license type
 * @param {string} licenseType - License type
 * @returns {string} Label
 */
export function getLicenseLabel(licenseType) {
  return LICENSE_CONFIG[licenseType]?.label || 'Unknown';
}

/**
 * Get all available license types for UI display
 * @returns {Array} Array of license options
 */
export function getLicenseOptions() {
  return Object.entries(LICENSE_CONFIG).map(([type, config]) => ({
    value: type,
    label: config.label,
    description: config.description,
    color: config.color
  }));
}

export default {
  PRODUCTS,
  LICENSE_TYPES,
  LICENSE_CONFIG,
  DEFAULT_LICENSE,
  getProductLicenseType,
  getOrgLicense,
  updateProductLicense,
  canAddUser,
  canAddNotifyUser,
  canAddAtlasUser,
  canHavePublic,
  canHavePublicNotifications,
  canHavePublicMaps,
  getProductLicenseLimits,
  getLicenseLimits,
  getLicenseLabel,
  getLicenseOptions
};
