/**
 * Grocery Choice Owner App - Staff, Designations & Ownership API
 */

import apiClient from './client';
import { OwnerUser, Designation, AuditLog, Role } from '@/types';

export const staffApi = {
  getAll: async (): Promise<OwnerUser[]> => {
    return apiClient.get('/staff');
  },

  getById: async (id: number): Promise<OwnerUser> => {
    return apiClient.get(`/staff/${id}`);
  },

  create: async (data: any): Promise<OwnerUser> => {
    return apiClient.post('/staff', data);
  },

  updateContact: async (id: number, data: any): Promise<OwnerUser> => {
    return apiClient.put(`/staff/${id}/contact`, data);
  },

  changeRole: async (id: number, role: Role): Promise<OwnerUser> => {
    return apiClient.patch(`/staff/${id}/role`, { role });
  },

  changeStatus: async (id: number, status: string): Promise<OwnerUser> => {
    return apiClient.patch(`/staff/${id}/status`, { status });
  },

  removeAccess: async (id: number): Promise<OwnerUser> => {
    return apiClient.delete(`/staff/${id}`);
  },

  getDesignations: async (): Promise<Designation[]> => {
    return apiClient.get('/designations');
  },

  getPrimaryOwner: async (): Promise<OwnerUser> => {
    return apiClient.get('/ownership/primary-owner');
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    return apiClient.get('/ownership/audit-logs');
  }
};

export default staffApi;
