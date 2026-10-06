/**
 * Grocery Choice Owner App - Orders API
 */

import apiClient from './client';
import { Order, OrderStatus } from '@/types';

export const ordersApi = {
  getAll: async (): Promise<Order[]> => {
    return apiClient.get('/orders');
  },

  getByStatus: async (status: OrderStatus): Promise<Order[]> => {
    return apiClient.get(`/orders/status/${status}`);
  },

  getById: async (id: number): Promise<Order> => {
    return apiClient.get(`/orders/${id}`);
  },

  getByNumber: async (orderNumber: string): Promise<Order> => {
    return apiClient.get(`/orders/number/${encodeURIComponent(orderNumber)}`);
  },

  updateStatus: async (id: number, status: OrderStatus): Promise<Order> => {
    return apiClient.patch(`/orders/${id}/status`, { status });
  },

  cancel: async (id: number): Promise<Order> => {
    return apiClient.post(`/orders/${id}/cancel`);
  }
};

export default ordersApi;
