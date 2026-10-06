/**
 * Grocery Choice Owner App - Persistent Storage Module
 * High reliability AsyncStorage wrapper with in-memory fallback.
 * Modeled after the production-tested customer-app storage architecture.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from '@/constants/config';
import { OwnerUser } from '@/types';

// In-memory fallback dictionary for test or unsupported native environments
const memoryFallback = new Map<string, string>();

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const value = await AsyncStorage.getItem(key);
        if (value !== null && value !== undefined) {
          memoryFallback.set(key, value);
          return value;
        }
      }
      return memoryFallback.get(key) ?? null;
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryFallback.set(key, value);
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      // Memory fallback is already populated
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryFallback.delete(key);
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Memory fallback is already cleared
    }
  },

  async clear(): Promise<void> {
    memoryFallback.clear();
    try {
      if (AsyncStorage && typeof AsyncStorage.clear === 'function') {
        await AsyncStorage.clear();
      }
    } catch {
      // Handled
    }
  },

  // Convenience aliases matching customer-app pattern
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.setItem(key, serialized);
  },

  async remove(key: string): Promise<void> {
    await this.removeItem(key);
  }
};

export const ownerStorageService = {
  // Owner Token
  getToken: () => storage.getItem(APP_CONFIG.STORAGE_KEYS.OWNER_TOKEN),
  setToken: (token: string) => storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_TOKEN, token),
  removeToken: () => storage.removeItem(APP_CONFIG.STORAGE_KEYS.OWNER_TOKEN),

  // Owner Profile
  getProfile: async (): Promise<OwnerUser | null> => {
    const raw = await storage.getItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OwnerUser;
    } catch {
      return null;
    }
  },
  setProfile: (user: OwnerUser) =>
    storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE, JSON.stringify(user)),
  removeProfile: () => storage.removeItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE)
};

export const MAX_RECENT_SEARCHES = 8;

/**
 * Pure helper for managing recent search history list:
 * - Trims input term
 * - Case-insensitive deduplication
 * - Moves most recent term to the top
 * - Caps at maxItems (default 8)
 */
export function addSearchToHistory(
  history: string[],
  term: string,
  maxItems = MAX_RECENT_SEARCHES
): string[] {
  const trimmed = term.trim();
  if (!trimmed) return history;
  const filtered = history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...filtered].slice(0, maxItems);
}

/**
 * Dedicated persistence service for owner recent product searches
 */
export const recentSearchStorage = {
  getRecentSearches: async (): Promise<string[]> => {
    try {
      const raw = await storage.getItem(APP_CONFIG.STORAGE_KEYS.RECENT_PRODUCT_SEARCHES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, MAX_RECENT_SEARCHES);
      }
      return [];
    } catch {
      return [];
    }
  },

  saveRecentSearches: async (searches: string[]): Promise<void> => {
    try {
      await storage.setItem(
        APP_CONFIG.STORAGE_KEYS.RECENT_PRODUCT_SEARCHES,
        JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
      );
    } catch {
      // Memory fallback handled
    }
  },

  addSearchTerm: async (term: string): Promise<string[]> => {
    const trimmed = term.trim();
    if (!trimmed) return await recentSearchStorage.getRecentSearches();
    const existing = await recentSearchStorage.getRecentSearches();
    const updated = addSearchToHistory(existing, trimmed, MAX_RECENT_SEARCHES);
    await recentSearchStorage.saveRecentSearches(updated);
    return updated;
  },

  clearRecentSearches: async (): Promise<void> => {
    await storage.removeItem(APP_CONFIG.STORAGE_KEYS.RECENT_PRODUCT_SEARCHES);
  }
};

export default storage;

