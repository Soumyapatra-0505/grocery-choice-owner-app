/**
 * Grocery Choice Owner App - Global Configuration & Constants
 */

declare const process: any;

export const APP_CONFIG = {
  APP_NAME: 'Grocery Choice Owner',
  TAGLINE: 'Store Management & Order Operations',
  APP_VERSION: '1.0.0',

  // Backend API Base URL (defaults to production Railway backend, overridable locally)
  API_BASE_URL:
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
    'https://grocery-choice-backend-production.up.railway.app/api',

  // Dedicated Owner Token & Session Keys (distinct from Customer App)
  STORAGE_KEYS: {
    OWNER_TOKEN: 'grocery_choice_owner_token',
    OWNER_PROFILE: 'grocery_choice_owner_auth',
    REMEMBER_IDENTIFIER: 'grocery_choice_owner_remember_id',
    RECENT_PRODUCT_SEARCHES: 'grocery_choice_owner_recent_product_searches'
  },

  // Allowed Staff & Management Roles (Customer role is strictly forbidden)
  ALLOWED_ROLES: ['OWNER', 'ADMIN', 'STAFF'] as const,

  // Thresholds & Defaults
  LOW_STOCK_THRESHOLD: 10,
  OTP_LENGTH: 6,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  REQUEST_TIMEOUT_MS: 15000,

  // Fallback Product Image
  FALLBACK_PRODUCT_IMAGE:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'
};

export const PRODUCT_UNITS = [
  { label: 'Piece (pc)', value: 'PIECE' },
  { label: 'Kilogram (kg)', value: 'KG' },
  { label: 'Gram (g)', value: 'GRAM' },
  { label: 'Litre (L)', value: 'LITRE' },
  { label: 'Millilitre (ml)', value: 'MILLILITRE' },
  { label: 'Pack (pk)', value: 'PACK' },
  { label: 'Box (bx)', value: 'BOX' },
  { label: 'Dozen (dz)', value: 'DOZEN' }
] as const;
