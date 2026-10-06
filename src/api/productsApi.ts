/**
 * Grocery Choice Owner App - Products API
 * Centralized API client for all catalog operations.
 */

import apiClient from './client';
import { Product, ProductPayload } from '@/types';

export const productsApi = {
  // Fetch all products
  getAll: async (): Promise<Product[]> => {
    return apiClient.get('/products');
  },
  getProducts: async (): Promise<Product[]> => {
    return apiClient.get('/products');
  },

  // Fetch product by ID
  getById: async (id: number): Promise<Product> => {
    return apiClient.get(`/products/${id}`);
  },
  getProductById: async (id: number): Promise<Product> => {
    return apiClient.get(`/products/${id}`);
  },

  // Fetch products by category ID
  getByCategory: async (categoryId: number): Promise<Product[]> => {
    return apiClient.get(`/products/category/${categoryId}`);
  },
  getProductsByCategory: async (categoryId: number): Promise<Product[]> => {
    return apiClient.get(`/products/category/${categoryId}`);
  },

  // Search products by name or SKU
  search: async (query: string): Promise<Product[]> => {
    return apiClient.get(`/products/search?query=${encodeURIComponent(query || '')}`);
  },
  searchProducts: async (query: string): Promise<Product[]> => {
    return apiClient.get(`/products/search?query=${encodeURIComponent(query || '')}`);
  },

  // Create product
  create: async (data: Partial<ProductPayload>): Promise<Product> => {
    return apiClient.post('/products', data);
  },
  createProduct: async (data: Partial<ProductPayload>): Promise<Product> => {
    return apiClient.post('/products', data);
  },

  // Update product
  update: async (id: number, data: Partial<ProductPayload>): Promise<Product> => {
    return apiClient.put(`/products/${id}`, data);
  },
  updateProduct: async (id: number, data: Partial<ProductPayload>): Promise<Product> => {
    return apiClient.put(`/products/${id}`, data);
  },

  // Delete / deactivate product
  delete: async (id: number): Promise<void> => {
    return apiClient.delete(`/products/${id}`);
  },
  deleteProduct: async (id: number): Promise<void> => {
    return apiClient.delete(`/products/${id}`);
  },

  // Quick stock update
  updateStock: async (id: number, stockQuantity: number): Promise<Product> => {
    return apiClient.patch(`/products/${id}/stock`, { stockQuantity: Number(stockQuantity) });
  }
};

export default productsApi;

