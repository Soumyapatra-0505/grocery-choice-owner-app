/**
 * Grocery Choice Owner App - Owner Authentication Context
 * Manages Owner JWT authentication, session hydration, and role validation.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '@/storage/storage';
import { APP_CONFIG } from '@/constants/config';
import { authApi } from '@/api/authApi';
import { OwnerUser, AuthResponse, SendOtpResponse, UpdateProfileRequest } from '@/types';

interface OwnerAuthContextType {
  owner: OwnerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPassword: (identifier: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  sendOtp: (identifier: string) => Promise<SendOtpResponse>;
  verifyOtpAndLogin: (identifier: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export const OwnerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [owner, setOwner] = useState<OwnerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Checks whether the user holds an approved management/staff role
  const isAllowedRole = (user: OwnerUser | null | undefined): boolean => {
    if (!user || !user.role) return false;
    return APP_CONFIG.ALLOWED_ROLES.includes(user.role as any);
  };

  // Perform clean local logout
  const logout = useCallback(async () => {
    try {
      await Promise.all([
        storage.removeItem(APP_CONFIG.STORAGE_KEYS.OWNER_TOKEN),
        storage.removeItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE)
      ]);
    } catch (e) {
      console.warn('Error clearing owner session storage', e);
    } finally {
      setOwner(null);
    }
  }, []);

  // Save authenticated session
  const saveSession = async (token: string, user: OwnerUser) => {
    if (!isAllowedRole(user)) {
      throw new Error('Access restricted to store staff, managers, and owners.');
    }

    await storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_TOKEN, token);
    await storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE, JSON.stringify(user));
    setOwner(user);
  };

  // Startup Session Hydration
  const hydrateSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await storage.getItem(APP_CONFIG.STORAGE_KEYS.OWNER_TOKEN);
      const storedProfile = await storage.getItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE);

      if (!storedToken) {
        setOwner(null);
        setIsLoading(false);
        return;
      }

      // Fast initial UI render from cached profile if present
      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile);
          if (isAllowedRole(parsed)) {
            setOwner(parsed);
          }
        } catch {
          // ignore cache parse error
        }
      }

      // Live verification with backend: GET /api/auth/me
      try {
        const liveUser = await authApi.getMe();
        if (liveUser && isAllowedRole(liveUser)) {
          setOwner(liveUser);
          await storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE, JSON.stringify(liveUser));
        } else {
          // Role is CUSTOMER or invalid -> Clear session immediately
          await logout();
        }
      } catch (apiErr: any) {
        // If explicitly 401 or 403, clear token
        if (apiErr?.status === 401 || apiErr?.status === 403) {
          await logout();
        } else {
          // Temporary network failure: retain cached profile if available
          console.debug('Network note during owner session hydration:', apiErr?.message);
        }
      }
    } catch (err) {
      console.error('Failed to restore owner session', err);
      await logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  // Method 1: Password Login (POST /api/auth/owner/login)
  const loginWithPassword = async (identifier: string, password?: string) => {
    try {
      const response: AuthResponse = await authApi.login(identifier, password);
      if (response && response.token && response.user) {
        if (!isAllowedRole(response.user)) {
          return { success: false, error: 'Access restricted to store staff, managers, and owners.' };
        }
        await saveSession(response.token, response.user);
        return { success: true };
      }
      return { success: false, error: response?.message || 'Authentication failed' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid credentials or server unavailable.'
      };
    }
  };

  // Method 2: Send OTP (POST /api/auth/owner/send-otp)
  const sendOtp = async (identifier: string): Promise<SendOtpResponse> => {
    return authApi.sendOtp(identifier);
  };

  // Method 2: Verify OTP and Login (POST /api/auth/owner/verify-otp)
  const verifyOtpAndLogin = async (identifier: string, otp: string) => {
    try {
      const response: AuthResponse = await authApi.verifyOtp(identifier, otp);
      if (response && response.token && response.user) {
        if (!isAllowedRole(response.user)) {
          return { success: false, error: 'Access restricted to store staff, managers, and owners.' };
        }
        await saveSession(response.token, response.user);
        return { success: true };
      }
      return { success: false, error: response?.message || 'OTP verification failed' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid or expired OTP.'
      };
    }
  };

  // Refresh profile
  const refreshProfile = async () => {
    try {
      const liveUser = await authApi.getMe();
      if (liveUser && isAllowedRole(liveUser)) {
        setOwner(liveUser);
        await storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE, JSON.stringify(liveUser));
      }
    } catch (e) {
      console.warn('Failed to refresh owner profile', e);
    }
  };

  // Update profile
  const updateProfile = async (data: UpdateProfileRequest) => {
    try {
      const updated = await authApi.updateProfile(data);
      if (updated && isAllowedRole(updated)) {
        setOwner(updated);
        await storage.setItem(APP_CONFIG.STORAGE_KEYS.OWNER_PROFILE, JSON.stringify(updated));
        return { success: true };
      }
      return { success: false, error: 'Failed to update profile' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to update profile'
      };
    }
  };

  return (
    <OwnerAuthContext.Provider
      value={{
        owner,
        isAuthenticated: !!owner && isAllowedRole(owner),
        isLoading,
        loginWithPassword,
        sendOtp,
        verifyOtpAndLogin,
        logout,
        updateProfile,
        refreshProfile
      }}
    >
      {children}
    </OwnerAuthContext.Provider>
  );
};

export const useOwnerAuth = (): OwnerAuthContextType => {
  const context = useContext(OwnerAuthContext);
  if (!context) {
    throw new Error('useOwnerAuth must be used within an OwnerAuthProvider');
  }
  return context;
};

export default OwnerAuthContext;
