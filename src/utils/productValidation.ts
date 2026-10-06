/**
 * Grocery Choice Owner App - Product Validation & Helpers
 * Enforces business rules matching the Spring Boot backend validation.
 */

import { Product, ProductPayload, ProductUnit } from '@/types';

export const VALID_PRODUCT_UNITS: ProductUnit[] = [
  'PIECE',
  'KG',
  'GRAM',
  'LITRE',
  'MILLILITRE',
  'PACK',
  'BOX',
  'DOZEN'
];

export interface ProductFormData {
  name: string;
  description: string;
  sku: string;
  categoryId: number | null;
  unit: ProductUnit;
  mrp: string;
  sellingPrice: string;
  stockQuantity: string;
  imageUrl: string;
  active: boolean;
}

export interface ProductFormErrors {
  name?: string;
  sku?: string;
  categoryId?: string;
  unit?: string;
  mrp?: string;
  sellingPrice?: string;
  stockQuantity?: string;
  imageUrl?: string;
  general?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ProductFormErrors;
  sanitizedPayload?: ProductPayload;
}

/**
 * Validates product form data according to backend constraints:
 * - Name: not blank, max 200 chars
 * - SKU: not blank, max 50 chars
 * - Category: valid ID selected
 * - Unit: one of the 8 allowed units
 * - MRP: > 0
 * - Selling Price: > 0
 * - MRP >= Selling Price
 * - Stock Quantity: integer >= 0
 */
export function validateProductForm(data: Partial<ProductFormData>): ValidationResult {
  const errors: ProductFormErrors = {};

  // 1. Name validation
  const trimmedName = data.name ? data.name.trim() : '';
  if (!trimmedName) {
    errors.name = 'Product name is required';
  } else if (trimmedName.length > 200) {
    errors.name = 'Product name cannot exceed 200 characters';
  }

  // 2. SKU validation
  const trimmedSku = data.sku ? data.sku.trim() : '';
  if (!trimmedSku) {
    errors.sku = 'SKU is required';
  } else if (trimmedSku.length > 50) {
    errors.sku = 'SKU cannot exceed 50 characters';
  }

  // 3. Category validation
  if (!data.categoryId || Number(data.categoryId) <= 0) {
    errors.categoryId = 'Please select a product category';
  }

  // 4. Unit validation
  if (!data.unit || !VALID_PRODUCT_UNITS.includes(data.unit)) {
    errors.unit = 'Please select a valid measurement unit';
  }

  // 5. MRP validation
  const mrpStr = data.mrp != null ? String(data.mrp).trim() : '';
  const mrpNum = parseFloat(mrpStr);
  if (!mrpStr || isNaN(mrpNum) || mrpNum <= 0) {
    errors.mrp = 'MRP must be greater than zero';
  }

  // 6. Selling Price validation
  const spStr = data.sellingPrice != null ? String(data.sellingPrice).trim() : '';
  const spNum = parseFloat(spStr);
  if (!spStr || isNaN(spNum) || spNum <= 0) {
    errors.sellingPrice = 'Selling price must be greater than zero';
  }

  // 7. Comparative price validation: MRP >= Selling Price
  if (!errors.mrp && !errors.sellingPrice && mrpNum < spNum) {
    errors.sellingPrice = 'Selling price cannot be greater than MRP';
  }

  // 8. Stock Quantity validation
  const stockStr = data.stockQuantity != null ? String(data.stockQuantity).trim() : '';
  const stockNum = parseInt(stockStr, 10);
  if (stockStr === '' || isNaN(stockNum)) {
    errors.stockQuantity = 'Stock quantity is required';
  } else if (stockNum < 0) {
    errors.stockQuantity = 'Stock quantity cannot be negative';
  }

  const isValid = Object.keys(errors).length === 0;

  if (!isValid) {
    return { isValid: false, errors };
  }

  const sanitizedPayload: ProductPayload = {
    name: trimmedName,
    description: data.description ? data.description.trim() : undefined,
    sku: trimmedSku.toUpperCase(),
    categoryId: Number(data.categoryId),
    imageUrl: data.imageUrl ? data.imageUrl.trim() : undefined,
    unit: data.unit as ProductUnit,
    mrp: Math.round(mrpNum * 100) / 100,
    sellingPrice: Math.round(spNum * 100) / 100,
    stockQuantity: stockNum,
    active: data.active !== false
  };

  return { isValid: true, errors: {}, sanitizedPayload };
}

/**
 * Computes live stock status, label, and theme variant
 */
export function getProductStockStatus(stockQuantity: number | null | undefined): {
  status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
  label: string;
  variant: 'danger' | 'warning' | 'success';
} {
  const quantity = Number(stockQuantity) || 0;
  if (quantity === 0) {
    return { status: 'OUT_OF_STOCK', label: 'Out of Stock', variant: 'danger' };
  }
  if (quantity <= 10) {
    return { status: 'LOW_STOCK', label: `Low Stock (${quantity})`, variant: 'warning' };
  }
  return { status: 'IN_STOCK', label: `${quantity} in stock`, variant: 'success' };
}

export type ProductStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'LOW_STOCK' | 'OUT_OF_STOCK';

/**
 * Filters products based on status, category, and search query
 */
export function filterProductsList(
  products: Product[],
  options: {
    statusFilter?: ProductStatusFilter;
    categoryId?: number | 'ALL';
    searchQuery?: string;
  }
): Product[] {
  let result = [...products];

  // 1. Search Query filter (name or sku)
  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.name.toLowerCase().includes(q))
    );
  }

  // 2. Category filter
  if (options.categoryId && options.categoryId !== 'ALL') {
    result = result.filter(
      (p) =>
        p.categoryId === options.categoryId ||
        (p.category && p.category.id === options.categoryId)
    );
  }

  // 3. Status filter
  if (options.statusFilter && options.statusFilter !== 'ALL') {
    switch (options.statusFilter) {
      case 'ACTIVE':
        result = result.filter((p) => p.active !== false);
        break;
      case 'INACTIVE':
        result = result.filter((p) => p.active === false);
        break;
      case 'LOW_STOCK':
        result = result.filter((p) => p.stockQuantity <= 10 && p.stockQuantity > 0);
        break;
      case 'OUT_OF_STOCK':
        result = result.filter((p) => p.stockQuantity === 0);
        break;
    }
  }

  return result;
}
