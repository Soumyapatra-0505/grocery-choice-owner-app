/**
 * Grocery Choice Owner App - Type Definitions
 * Maps precisely to Spring Boot backend DTOs and database models.
 */

export type Role = 'OWNER' | 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type ProductUnit =
  | 'PIECE'
  | 'KG'
  | 'GRAM'
  | 'LITRE'
  | 'MILLILITRE'
  | 'PACK'
  | 'BOX'
  | 'DOZEN';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OwnerUser {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  primaryOwner: boolean;
  status: UserStatus;
  designation?: string | null;
  storeHub?: string | null;
  permissions?: string[];
  gender?: string | null;
  dateOfBirth?: string | null;
  createdAt?: string;
  avatar?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  tokenType?: string;
  user?: OwnerUser;
}

export interface SendOtpResponse {
  success: boolean;
  message?: string;
  type?: string;
  identifier?: string;
  expiresInSeconds?: number;
}

export interface OwnerLoginRequest {
  identifier: string;
  password?: string;
}

export interface OwnerOtpRequest {
  identifier: string;
  otp: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  sku?: string;
  category?: Category;
  categoryId?: number;
  imageUrl?: string;
  unit: ProductUnit;
  mrp: number;
  sellingPrice: number;
  stockQuantity: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductPayload {
  name: string;
  description?: string;
  sku?: string;
  categoryId: number;
  imageUrl?: string;
  unit: ProductUnit;
  mrp: number;
  sellingPrice: number;
  stockQuantity: number;
  active?: boolean;
}

export interface OrderItem {
  id?: number;
  productId: number;
  productName: string;
  unit?: string;
  quantity: number;
  price: number;
  subtotal: number;
  unitPrice?: number;
  totalPrice?: number;
  imageUrl?: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddressId?: number;
  deliveryAddressText: string;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  deliverySlot?: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface Designation {
  id: number;
  title: string;
  description?: string;
  createdAt?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  performedBy: string;
  targetUser?: string;
  details?: string;
  createdAt: string;
}
