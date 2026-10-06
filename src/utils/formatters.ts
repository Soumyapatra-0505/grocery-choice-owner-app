/**
 * Grocery Choice Owner App - Formatters & Validators
 */

import { OrderStatus } from '@/types';

/**
 * Formats a numeric value into INR currency string: ₹1,299
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Formats date string into readable format: "15 Oct 2026, 04:30 PM"
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats order status into user-friendly title
 */
export function formatStatusLabel(status: OrderStatus | string | null | undefined): string {
  if (!status) return 'Placed';
  switch (status.toUpperCase()) {
    case 'PLACED':
      return 'Placed';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PROCESSING':
      return 'Processing';
    case 'OUT_FOR_DELIVERY':
      return 'Out for Delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

/**
 * Maps order status to UI color theme variant
 */
export function getStatusVariant(
  status: OrderStatus | string | null | undefined
): 'success' | 'warning' | 'info' | 'danger' | 'default' {
  if (!status) return 'default';
  switch (status.toUpperCase()) {
    case 'DELIVERED':
    case 'CONFIRMED':
      return 'success';
    case 'OUT_FOR_DELIVERY':
      return 'info';
    case 'PROCESSING':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    case 'PLACED':
    default:
      return 'default';
  }
}

/**
 * Normalizes email or mobile number for consistent lookup
 */
export function normalizeOwnerIdentifier(identifier: string): string {
  if (!identifier) return '';
  const trimmed = identifier.trim();
  if (!trimmed.includes('@') && /^\+?[\d\s-]{8,}$/.test(trimmed)) {
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return digitsOnly.slice(2);
    }
    return digitsOnly;
  }
  return trimmed.toLowerCase();
}

/**
 * Validates whether the identifier is a valid 10-digit mobile number or valid email
 */
export function validateOwnerIdentifier(input: string): {
  isValid: boolean;
  type: 'email' | 'mobile' | null;
  normalized?: string;
  error: string | null;
} {
  if (!input || !input.trim()) {
    return { isValid: false, type: null, error: 'Please enter your email or mobile number' };
  }

  const trimmed = input.trim();

  // Email validation
  if (trimmed.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, type: 'email', error: 'Please enter a valid email address' };
    }
    return { isValid: true, type: 'email', normalized: trimmed.toLowerCase(), error: null };
  }

  // Mobile number validation
  const digits = trimmed.replace(/\D/g, '');
  const is10Digit = digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
  const is11Digit = digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.slice(1));
  const is12Digit = digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2));

  if (is10Digit || is11Digit || is12Digit) {
    const normalizedMobile = is10Digit ? digits : is11Digit ? digits.slice(1) : digits.slice(2);
    return { isValid: true, type: 'mobile', normalized: normalizedMobile, error: null };
  }

  return {
    isValid: false,
    type: 'mobile',
    error: 'Please enter a valid 10-digit mobile number (e.g. 9876543210)'
  };
}
