/**
 * Grocery Choice Owner App - Authentication API
 * Official Spring Boot authentication endpoints for Store Managers and Owners.
 */

import apiClient from './client';
import {
  AuthResponse,
  SendOtpResponse,
  OwnerUser,
  UpdateProfileRequest
} from '@/types';

export const authApi = {
  /**
   * Password Authentication
   * POST /api/auth/owner/login
   */
  login: async (identifier: string, password?: string): Promise<AuthResponse> => {
    return apiClient.post('/auth/owner/login', {
      identifier: identifier.trim(),
      password
    });
  },

  /**
   * Send 6-digit OTP to store owner/manager
   * POST /api/auth/owner/send-otp
   */
  sendOtp: async (identifier: string): Promise<SendOtpResponse> => {
    return apiClient.post('/auth/owner/send-otp', {
      identifier: identifier.trim()
    });
  },

  /**
   * Verify 6-digit OTP and obtain Owner JWT
   * POST /api/auth/owner/verify-otp
   */
  verifyOtp: async (identifier: string, otp: string): Promise<AuthResponse> => {
    return apiClient.post('/auth/owner/verify-otp', {
      identifier: identifier.trim(),
      otp: otp.trim()
    });
  },

  /**
   * Development Mode OTP Helper
   * GET /api/auth/dev-otp/{identifier}
   */
  getDevOtp: async (identifier: string): Promise<{ otp: string; identifier: string }> => {
    return apiClient.get(`/auth/dev-otp/${encodeURIComponent(identifier.trim())}`);
  },

  /**
   * Get Current Authenticated User Profile
   * GET /api/auth/me
   */
  getMe: async (): Promise<OwnerUser> => {
    return apiClient.get('/auth/me');
  },

  /**
   * Update Profile Details
   * PUT /api/auth/me
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<OwnerUser> => {
    return apiClient.put('/auth/me', data);
  }
};

export default authApi;
