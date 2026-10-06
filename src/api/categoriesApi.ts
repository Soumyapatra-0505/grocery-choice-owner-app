/**
 * Grocery Choice Owner App - Categories API
 */

import apiClient from './client';
import { Category } from '@/types';

export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    return apiClient.get('/categories');
  },

  getById: async (id: number): Promise<Category> => {
    return apiClient.get(`/categories/${id}`);
  },

  create: async (data: Partial<Category>): Promise<Category> => {
    return apiClient.post('/categories', data);
  },

  update: async (id: number, data: Partial<Category>): Promise<Category> => {
    return apiClient.put(`/categories/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    return apiClient.delete(`/categories/${id}`);
  }
};

export default categoriesApi;
