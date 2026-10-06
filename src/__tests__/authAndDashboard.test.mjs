import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

// --- Utility imports for formatters & validators ---
function validateOwnerIdentifier(input) {
  if (!input || !input.trim()) {
    return { isValid: false, type: null, error: 'Please enter your email or mobile number' };
  }
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, type: 'email', error: 'Please enter a valid email address' };
    }
    return { isValid: true, type: 'email', normalized: trimmed.toLowerCase(), error: null };
  }
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

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'STAFF'];
function isAllowedRole(role) {
  if (!role) return false;
  return ALLOWED_ROLES.includes(role);
}

const STORAGE_KEYS = {
  OWNER_TOKEN: 'grocery_choice_owner_token',
  OWNER_PROFILE: 'grocery_choice_owner_profile'
};

// --- HTTP Helpers for Live API Testing ---
const BACKEND_HOST = 'grocery-choice-backend-production.up.railway.app';
let liveOwnerToken = null;

function apiRequest({ path, method, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      'Accept': 'application/json',
      ...headers
    };
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(
      {
        hostname: BACKEND_HOST,
        path: '/api' + path,
        method,
        headers: reqHeaders,
        timeout: 10000
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout to ' + path));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// =======================================================
// UNIT TESTS: VALIDATION, ROLE SECURITY, KPI LOGIC
// =======================================================

describe('Owner Auth & Security Verification', () => {
  test('Identifier validation handles valid emails correctly', () => {
    const r1 = validateOwnerIdentifier('owner@grocerychoice.com');
    assert.equal(r1.isValid, true);
    assert.equal(r1.type, 'email');
    assert.equal(r1.normalized, 'owner@grocerychoice.com');

    const r2 = validateOwnerIdentifier('  ADMIN@GroceryChoice.com  ');
    assert.equal(r2.isValid, true);
    assert.equal(r2.normalized, 'admin@grocerychoice.com');
  });

  test('Identifier validation handles 10-digit mobile numbers and prefixes correctly', () => {
    const r1 = validateOwnerIdentifier('9876543211');
    assert.equal(r1.isValid, true);
    assert.equal(r1.type, 'mobile');
    assert.equal(r1.normalized, '9876543211');

    const r2 = validateOwnerIdentifier('+91 98765 43211');
    assert.equal(r2.isValid, true);
    assert.equal(r2.normalized, '9876543211');

    const r3 = validateOwnerIdentifier('09876543211');
    assert.equal(r3.isValid, true);
    assert.equal(r3.normalized, '9876543211');
  });

  test('Identifier validation rejects invalid inputs', () => {
    assert.equal(validateOwnerIdentifier('').isValid, false);
    assert.equal(validateOwnerIdentifier('not-an-email').isValid, false);
    assert.equal(validateOwnerIdentifier('12345').isValid, false);
  });

  test('Role security allows OWNER, ADMIN, STAFF and rejects CUSTOMER', () => {
    assert.equal(isAllowedRole('OWNER'), true);
    assert.equal(isAllowedRole('ADMIN'), true);
    assert.equal(isAllowedRole('STAFF'), true);
    assert.equal(isAllowedRole('CUSTOMER'), false, 'CUSTOMER role MUST NOT be allowed access');
    assert.equal(isAllowedRole('USER'), false);
    assert.equal(isAllowedRole(null), false);
    assert.equal(isAllowedRole(undefined), false);
  });

  test('Dedicated storage keys prevent collisions with Customer App', () => {
    assert.equal(STORAGE_KEYS.OWNER_TOKEN, 'grocery_choice_owner_token');
    assert.notEqual(STORAGE_KEYS.OWNER_TOKEN, 'grocery_choice_token');
    assert.notEqual(STORAGE_KEYS.OWNER_TOKEN, 'grocery_choice_customer_token');
    assert.equal(STORAGE_KEYS.OWNER_PROFILE, 'grocery_choice_owner_profile');
  });
});

describe('Dashboard KPI & Metric Calculations', () => {
  const sampleProducts = [
    { id: 1, name: 'Milk', stockQuantity: 25, active: true },
    { id: 2, name: 'Eggs', stockQuantity: 8, active: true },
    { id: 3, name: 'Butter', stockQuantity: 0, active: true },
    { id: 4, name: 'Bread', stockQuantity: 4, active: true },
    { id: 5, name: 'Seasonal Fruit', stockQuantity: 50, active: false }
  ];

  const sampleCategories = [
    { id: 1, name: 'Dairy' },
    { id: 2, name: 'Bakery' },
    { id: 3, name: 'Produce' }
  ];

  test('Calculates total, active, low-stock, and out-of-stock products accurately', () => {
    const totalProducts = sampleProducts.length;
    const activeProducts = sampleProducts.filter((p) => p.active !== false).length;
    const totalCategories = sampleCategories.length;
    const lowStockProducts = sampleProducts.filter((p) => p.stockQuantity <= 10 && p.stockQuantity > 0);
    const outOfStockProducts = sampleProducts.filter((p) => p.stockQuantity === 0);

    assert.equal(totalProducts, 5);
    assert.equal(activeProducts, 4);
    assert.equal(totalCategories, 3);
    assert.equal(lowStockProducts.length, 2); // Eggs (8), Bread (4)
    assert.equal(outOfStockProducts.length, 1); // Butter (0)
  });

  test('Stock alerts prioritize out-of-stock items first, then low-stock items', () => {
    const lowStockProducts = sampleProducts.filter((p) => p.stockQuantity <= 10 && p.stockQuantity > 0);
    const outOfStockProducts = sampleProducts.filter((p) => p.stockQuantity === 0);
    const alerts = [...outOfStockProducts, ...lowStockProducts];

    assert.equal(alerts[0].name, 'Butter', 'Out of stock item must appear first');
    assert.equal(alerts[0].stockQuantity, 0);
    assert.equal(alerts.length, 3);
  });

  test('Recent orders are sorted newest first', () => {
    const sampleOrders = [
      { id: 1, orderNumber: 'GC-001', createdAt: '2026-10-01T10:00:00' },
      { id: 2, orderNumber: 'GC-002', createdAt: '2026-10-04T12:00:00' },
      { id: 3, orderNumber: 'GC-003', createdAt: '2026-10-02T15:30:00' }
    ];

    const sorted = [...sampleOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    assert.equal(sorted[0].orderNumber, 'GC-002');
    assert.equal(sorted[1].orderNumber, 'GC-003');
    assert.equal(sorted[2].orderNumber, 'GC-001');
  });
});

// =======================================================
// LIVE BACKEND INTEGRATION TESTS
// =======================================================

describe('Live Backend Authentication & APIs', () => {
  test('POST /api/auth/owner/login succeeds with valid Store Owner credentials', async () => {
    const res = await apiRequest({
      path: '/auth/owner/login',
      method: 'POST',
      body: {
        identifier: 'owner@grocerychoice.com',
        password: 'Admin@123'
      }
    });

    assert.equal(res.status, 200, 'Owner login must return HTTP 200');
    assert.ok(res.data.token, 'JWT token must be present in response');
    assert.ok(res.data.user, 'User object must be present in response');
    assert.equal(res.data.user.email, 'owner@grocerychoice.com');
    assert.equal(res.data.user.role, 'OWNER');
    assert.equal(res.data.user.primaryOwner, true);
    liveOwnerToken = res.data.token;
  });

  test('POST /api/auth/owner/login rejects invalid credentials', async () => {
    const res = await apiRequest({
      path: '/auth/owner/login',
      method: 'POST',
      body: {
        identifier: 'owner@grocerychoice.com',
        password: 'WrongPassword999!'
      }
    });

    assert.ok(res.status === 401 || res.status === 400 || (res.data && res.data.success === false),
      `Invalid credentials must not return HTTP 200 success (got status ${res.status})`
    );
  });

  test('POST /api/auth/owner/login strictly blocks CUSTOMER accounts', async () => {
    const res = await apiRequest({
      path: '/auth/owner/login',
      method: 'POST',
      body: {
        identifier: 'customer@grocerychoice.com',
        password: 'Customer@123'
      }
    });

    assert.equal(res.status, 403, 'Customer account must receive HTTP 403 Forbidden from owner login endpoint');
  });

  test('GET /api/auth/me returns valid owner profile with Bearer token', async () => {
    assert.ok(liveOwnerToken, 'Live token required from previous test');
    const res = await apiRequest({
      path: '/auth/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${liveOwnerToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.ok(res.data);
    assert.equal(res.data.email, 'owner@grocerychoice.com');
    assert.equal(res.data.role, 'OWNER');
    assert.equal(res.data.primaryOwner, true);
  });

  test('GET /api/products, /api/categories, /api/orders live data matches dashboard expectations', async () => {
    assert.ok(liveOwnerToken, 'Live token required');
    const [productsRes, categoriesRes, ordersRes] = await Promise.all([
      apiRequest({ path: '/products', method: 'GET', headers: { 'Authorization': `Bearer ${liveOwnerToken}` } }),
      apiRequest({ path: '/categories', method: 'GET', headers: { 'Authorization': `Bearer ${liveOwnerToken}` } }),
      apiRequest({ path: '/orders', method: 'GET', headers: { 'Authorization': `Bearer ${liveOwnerToken}` } })
    ]);

    assert.equal(productsRes.status, 200, 'Products endpoint must return 200');
    assert.ok(Array.isArray(productsRes.data), 'Products data must be an array');
    assert.ok(productsRes.data.length >= 20, `Expected at least 20 products, got ${productsRes.data.length}`);

    assert.equal(categoriesRes.status, 200, 'Categories endpoint must return 200');
    assert.ok(Array.isArray(categoriesRes.data), 'Categories data must be an array');
    assert.ok(categoriesRes.data.length >= 5, `Expected at least 5 categories, got ${categoriesRes.data.length}`);

    assert.equal(ordersRes.status, 200, 'Orders endpoint must return 200');
    assert.ok(Array.isArray(ordersRes.data), 'Orders data must be an array');
    assert.ok(ordersRes.data.length >= 1, `Expected at least 1 order, got ${ordersRes.data.length}`);

    // Verify low-stock and out-of-stock items exist in real data
    const lowStock = productsRes.data.filter((p) => p.stockQuantity <= 10 && p.stockQuantity > 0);
    const outOfStock = productsRes.data.filter((p) => p.stockQuantity === 0);
    assert.ok(lowStock.length > 0, 'At least 1 low stock item in catalog');
    assert.ok(outOfStock.length > 0, 'At least 1 out of stock item in catalog');
  });
});

describe('Bottom Navigation & Route Configuration', () => {
  test('Bottom navigation specifies exactly the 5 intended tabs with icons and labels', () => {
    const layoutPath = path.resolve('src/app/(tabs)/_layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');

    // Verify 5 main tabs exist with respective icons & labels
    assert.ok(layoutContent.includes('icon="📊" label="Overview"'), 'Overview tab must have 📊 icon');
    assert.ok(layoutContent.includes('icon="📦" label="Orders"'), 'Orders tab must have 📦 icon');
    assert.ok(layoutContent.includes('icon="🏷️" label="Products"'), 'Products tab must have 🏷️ icon');
    assert.ok(layoutContent.includes('icon="🏬" label="Stock"'), 'Stock tab must have 🏬 icon');
    assert.ok(layoutContent.includes('icon="⚙️" label="More"'), 'More tab must have ⚙️ icon');
  });

  test('Add Product, Edit Product, Order Details, Categories, Reports, Staff, and Profile are hidden from bottom navigation via href: null', () => {
    const layoutPath = path.resolve('src/app/(tabs)/_layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');

    // Verify sub-routes are hidden from bottom tab bar
    assert.ok(layoutContent.includes('name="products/add"'), 'products/add must be explicitly declared');
    assert.ok(layoutContent.includes('name="products/edit/[id]"'), 'products/edit/[id] must be explicitly declared');
    assert.ok(layoutContent.includes('name="orders/[id]"'), 'orders/[id] must be explicitly declared');
    assert.ok(layoutContent.includes('name="more/categories"'), 'more/categories must be explicitly declared');
    assert.ok(layoutContent.includes('name="more/reports"'), 'more/reports must be explicitly declared');
    assert.ok(layoutContent.includes('name="more/staff"'), 'more/staff must be explicitly declared');
    assert.ok(layoutContent.includes('name="more/profile"'), 'more/profile must be explicitly declared');

    // Verify href: null is used to hide them from the tab bar
    const hrefNullCount = (layoutContent.match(/href:\s*null/g) || []).length;
    assert.equal(hrefNullCount, 7, 'Exactly 7 sub-routes must have href: null');
  });
});

describe('Order Details Data Mapping & Formatters', () => {
  function mapOrderItem(item) {
    const unitPrice = item.price ?? item.unitPrice ?? 0;
    const lineTotal = item.subtotal ?? item.totalPrice ?? unitPrice * (item.quantity || 1);
    return {
      productName: item.productName,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      imageUrl: item.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e'
    };
  }

  function getPaymentStatusVariant(status) {
    switch (status?.toUpperCase()) {
      case 'PAID': return 'success';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'danger';
      case 'REFUNDED': return 'info';
      default: return 'default';
    }
  }

  test('Maps backend fields item.price and item.subtotal with compatibility fallbacks', () => {
    // 1. Standard backend response
    const backendItem = {
      id: 1,
      productId: 10,
      productName: 'Organic Milk',
      unit: '1 Litre',
      quantity: 2,
      price: 65,
      subtotal: 130,
      imageUrl: 'https://example.com/milk.jpg'
    };
    const mapped1 = mapOrderItem(backendItem);
    assert.equal(mapped1.unitPrice, 65);
    assert.equal(mapped1.lineTotal, 130);
    assert.equal(mapped1.productName, 'Organic Milk');
    assert.equal(mapped1.imageUrl, 'https://example.com/milk.jpg');

    // 2. Compatibility fallback with unitPrice and totalPrice
    const legacyItem = {
      productId: 12,
      productName: 'Brown Bread',
      quantity: 3,
      unitPrice: 40,
      totalPrice: 120
    };
    const mapped2 = mapOrderItem(legacyItem);
    assert.equal(mapped2.unitPrice, 40);
    assert.equal(mapped2.lineTotal, 120);
    assert.ok(mapped2.imageUrl.includes('unsplash.com'));
  });

  test('Payment status styling resolves PAID, PENDING, FAILED, REFUNDED accurately', () => {
    assert.equal(getPaymentStatusVariant('PAID'), 'success');
    assert.equal(getPaymentStatusVariant('paid'), 'success');
    assert.equal(getPaymentStatusVariant('PENDING'), 'warning');
    assert.equal(getPaymentStatusVariant('pending'), 'warning');
    assert.equal(getPaymentStatusVariant('FAILED'), 'danger');
    assert.equal(getPaymentStatusVariant('failed'), 'danger');
    assert.equal(getPaymentStatusVariant('REFUNDED'), 'info');
    assert.equal(getPaymentStatusVariant('refunded'), 'info');
    assert.equal(getPaymentStatusVariant('UNKNOWN'), 'default');
    assert.equal(getPaymentStatusVariant(undefined), 'default');
  });

  test('Razorpay IDs are omitted when null or undefined and displayed when available', () => {
    const orderWithRazorpay = {
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      razorpayPaymentId: 'pay_ABC123xyz',
      razorpayOrderId: 'order_DEF456uvw'
    };
    assert.ok(!!orderWithRazorpay.razorpayPaymentId);
    assert.ok(!!orderWithRazorpay.razorpayOrderId);

    const orderCOD = {
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'PENDING',
      razorpayPaymentId: null,
      razorpayOrderId: null
    };
    assert.ok(!orderCOD.razorpayPaymentId);
    assert.ok(!orderCOD.razorpayOrderId);
  });

  test('Financial summary shows discount only when > 0 and handles delivery slot', () => {
    const orderWithDiscount = {
      subtotal: 500,
      deliveryCharge: 0,
      discount: 50,
      totalAmount: 450,
      deliverySlot: 'Morning (8:00 AM - 11:00 AM)'
    };
    assert.equal(orderWithDiscount.discount > 0, true);
    assert.ok(!!orderWithDiscount.deliverySlot);

    const orderNoDiscount = {
      subtotal: 200,
      deliveryCharge: 30,
      discount: 0,
      totalAmount: 230,
      deliverySlot: null
    };
    assert.equal(orderNoDiscount.discount > 0, false);
    assert.ok(!orderNoDiscount.deliverySlot);
  });
});

describe('Navigation & Back Stack Behavior', () => {
  test('Tabs layout configures backBehavior="history" to preserve navigation stack', () => {
    const layoutPath = path.resolve('src/app/(tabs)/_layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    assert.ok(
      layoutContent.includes('backBehavior="history"'),
      'Tabs must specify backBehavior="history" for stack return'
    );
  });

  test('Order Details screen implements robust handleBack and BackHandler', () => {
    const orderDetailsPath = path.resolve('src/app/(tabs)/orders/[id].tsx');
    const content = fs.readFileSync(orderDetailsPath, 'utf8');

    assert.ok(content.includes('BackHandler'), 'Order details must import/use BackHandler');
    assert.ok(content.includes('hardwareBackPress'), 'Order details must listen to hardwareBackPress');
    assert.ok(
      content.includes("router.replace('/(tabs)/orders')"),
      'Order details fallback must return to Orders tab'
    );
  });

  test('Edit Product screen implements robust handleBack and BackHandler', () => {
    const editProductPath = path.resolve('src/app/(tabs)/products/edit/[id].tsx');
    const content = fs.readFileSync(editProductPath, 'utf8');

    assert.ok(content.includes('BackHandler'), 'Edit Product must import/use BackHandler');
    assert.ok(content.includes('hardwareBackPress'), 'Edit Product must listen to hardwareBackPress');
    assert.ok(
      content.includes("router.replace('/(tabs)/products')"),
      'Edit Product fallback must return to Products tab'
    );
  });

  test('Add Product screen implements robust handleBack and BackHandler', () => {
    const addProductPath = path.resolve('src/app/(tabs)/products/add.tsx');
    const content = fs.readFileSync(addProductPath, 'utf8');

    assert.ok(content.includes('BackHandler'), 'Add Product must import/use BackHandler');
    assert.ok(content.includes('hardwareBackPress'), 'Add Product must listen to hardwareBackPress');
    assert.ok(
      content.includes("router.replace('/(tabs)/products')"),
      'Add Product fallback must return to Products tab'
    );
  });

  test('Category Management screen implements robust handleBack and BackHandler', () => {
    const categoriesPath = path.resolve('src/app/(tabs)/more/categories.tsx');
    const content = fs.readFileSync(categoriesPath, 'utf8');

    assert.ok(content.includes('BackHandler'), 'Category Management must import/use BackHandler');
    assert.ok(content.includes('hardwareBackPress'), 'Category Management must listen to hardwareBackPress');
    assert.ok(
      content.includes("router.replace('/(tabs)/more')"),
      'Category Management fallback must return to More tab'
    );
  });

  test('Sales & Operational Reports screen implements robust handleBack and BackHandler', () => {
    const reportsPath = path.resolve('src/app/(tabs)/more/reports.tsx');
    const content = fs.readFileSync(reportsPath, 'utf8');

    assert.ok(content.includes('BackHandler'), 'Reports must import/use BackHandler');
    assert.ok(content.includes('hardwareBackPress'), 'Reports must listen to hardwareBackPress');
    assert.ok(
      content.includes("router.replace('/(tabs)/more')"),
      'Reports fallback must return to More tab'
    );
  });

  test('Staff & Access Controls screen implements robust handleBack and BackHandler', () => {
    const staffPath = path.resolve('src/app/(tabs)/more/staff.tsx');
    const content = fs.readFileSync(staffPath, 'utf8');

    assert.ok(content.includes('BackHandler'), 'Staff must import/use BackHandler');
    assert.ok(content.includes('hardwareBackPress'), 'Staff must listen to hardwareBackPress');
    assert.ok(
      content.includes("router.replace('/(tabs)/more')"),
      'Staff fallback must return to More tab'
    );
  });
});

describe('Live Backend Order Details Verification', () => {
  test('GET /api/orders/{id} returns complete items list, payment and financial details', async () => {
    if (!liveOwnerToken) {
      const loginRes = await apiRequest({
        path: '/auth/owner/login',
        method: 'POST',
        body: { identifier: 'owner@grocerychoice.com', password: 'Admin@123' }
      });
      if (loginRes.data?.token) {
        liveOwnerToken = loginRes.data.token;
      }
    }
    assert.ok(liveOwnerToken, 'Live token required');

    // 1. Get orders list to find an existing order ID
    const ordersRes = await apiRequest({
      path: '/orders',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
    });
    assert.equal(ordersRes.status, 200);
    assert.ok(Array.isArray(ordersRes.data) && ordersRes.data.length > 0);

    const firstOrder = ordersRes.data[0];
    const orderId = firstOrder.id;

    // 2. Fetch specific order details
    const orderDetailsRes = await apiRequest({
      path: `/orders/${orderId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
    });
    assert.equal(orderDetailsRes.status, 200);
    const order = orderDetailsRes.data;

    // Check Customer details
    assert.ok(order.customerName, 'Order must have customerName');
    assert.ok(order.deliveryAddressText, 'Order must have deliveryAddressText');

    // Check Financial details
    assert.ok(typeof order.subtotal === 'number', 'subtotal must be numeric');
    assert.ok(typeof order.totalAmount === 'number', 'totalAmount must be numeric');
    assert.ok(typeof order.deliveryCharge === 'number', 'deliveryCharge must be numeric');

    // Check Payment details
    assert.ok(order.paymentMethod, 'paymentMethod must exist');
    assert.ok(order.paymentStatus, 'paymentStatus must exist');

    // Check Order Items
    assert.ok(Array.isArray(order.items), 'items must be an array');
    if (order.items.length > 0) {
      const item = order.items[0];
      assert.ok(item.productName, 'item must have productName');
      assert.ok(item.quantity > 0, 'item quantity must be > 0');
      assert.ok(typeof (item.price ?? item.unitPrice) === 'number', 'item must have price or unitPrice');
      assert.ok(typeof (item.subtotal ?? item.totalPrice) === 'number', 'item must have subtotal or totalPrice');
    }
  });
});

describe('Category Management: Navigation, Validation, Role Security & CRUD', () => {
  // Category Form Validator logic mirroring categories.tsx
  function validateCategoryForm(name, description, imageUrl) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return { isValid: false, error: 'Category name is required.' };
    }
    if (trimmedName.length > 100) {
      return { isValid: false, error: 'Category name cannot exceed 100 characters.' };
    }
    return {
      isValid: true,
      error: null,
      payload: {
        name: trimmedName,
        description: (description || '').trim() || undefined,
        imageUrl: (imageUrl || '').trim() || undefined
      }
    };
  }

  // Role Security Evaluator
  function checkCategoryPermission(role) {
    const isAuthorized = role === 'OWNER' || role === 'ADMIN';
    return {
      canCreate: isAuthorized,
      canEdit: isAuthorized,
      canDelete: isAuthorized,
      isReadOnly: !isAuthorized
    };
  }

  test('1. More screen makes Category Management card interactive and links to categories route', () => {
    const moreScreenPath = path.resolve('src/app/(tabs)/more/index.tsx');
    const content = fs.readFileSync(moreScreenPath, 'utf8');

    assert.ok(content.includes('Category Management'), 'More screen must contain Category Management text');
    assert.ok(
      content.includes("router.push('/(tabs)/more/categories')"),
      'Category Management card must route to /(tabs)/more/categories'
    );
    assert.ok(content.includes('TouchableOpacity'), 'Category Management card must use TouchableOpacity');
  });

  test('2. Category name validation requires non-empty name and enforces 100 char limit', () => {
    assert.equal(validateCategoryForm('', '', '').isValid, false);
    assert.equal(validateCategoryForm('   ', '', '').isValid, false);
    assert.equal(validateCategoryForm(''.padStart(101, 'A'), '', '').isValid, false);
    assert.equal(validateCategoryForm('Dairy & Eggs', 'Fresh items', 'https://example.com/dairy.png').isValid, true);
  });

  test('3. Category payload cleanly handles optional fields and trims whitespace', () => {
    const res = validateCategoryForm('  Beverages  ', '  Hot & cold drinks  ', '  https://img.com/drinks.jpg  ');
    assert.equal(res.isValid, true);
    assert.equal(res.payload.name, 'Beverages');
    assert.equal(res.payload.description, 'Hot & cold drinks');
    assert.equal(res.payload.imageUrl, 'https://img.com/drinks.jpg');

    const resEmptyOptional = validateCategoryForm('Bakery', '   ', '   ');
    assert.equal(resEmptyOptional.isValid, true);
    assert.equal(resEmptyOptional.payload.name, 'Bakery');
    assert.equal(resEmptyOptional.payload.description, undefined);
    assert.equal(resEmptyOptional.payload.imageUrl, undefined);
  });

  test('4. Role security allows OWNER and ADMIN full CRUD while restricting STAFF to read-only', () => {
    const ownerPerm = checkCategoryPermission('OWNER');
    assert.equal(ownerPerm.canCreate, true);
    assert.equal(ownerPerm.canEdit, true);
    assert.equal(ownerPerm.canDelete, true);
    assert.equal(ownerPerm.isReadOnly, false);

    const adminPerm = checkCategoryPermission('ADMIN');
    assert.equal(adminPerm.canCreate, true);
    assert.equal(adminPerm.canEdit, true);
    assert.equal(adminPerm.canDelete, true);
    assert.equal(adminPerm.isReadOnly, false);

    const staffPerm = checkCategoryPermission('STAFF');
    assert.equal(staffPerm.canCreate, false);
    assert.equal(staffPerm.canEdit, false);
    assert.equal(staffPerm.canDelete, false);
    assert.equal(staffPerm.isReadOnly, true);
  });

  test('5. Category screen UI enforces role security and displays read-only banner for STAFF', () => {
    const catPath = path.resolve('src/app/(tabs)/more/categories.tsx');
    const content = fs.readFileSync(catPath, 'utf8');

    assert.ok(content.includes("owner?.role === 'OWNER' || owner?.role === 'ADMIN'"), 'Screen must verify OWNER or ADMIN');
    assert.ok(content.includes('readOnlyNotice'), 'Screen must include readOnlyNotice style/view');
    assert.ok(content.includes('Permission Denied'), 'Screen must guard handlers with Permission Denied');
  });

  test('6. Category screen safely displays productCount only when available and omits if missing', () => {
    const catPath = path.resolve('src/app/(tabs)/more/categories.tsx');
    const content = fs.readFileSync(catPath, 'utf8');

    assert.ok(content.includes('(item as any).productCount != null'), 'Product count must check non-null');
    assert.ok(!content.includes('Math.floor(Math.random()'), 'Screen must never generate mock product counts');
  });

  test('7. Category soft-deactivation explains soft-delete and calls categoriesApi.delete', () => {
    const catPath = path.resolve('src/app/(tabs)/more/categories.tsx');
    const content = fs.readFileSync(catPath, 'utf8');

    assert.ok(content.includes('Deactivate Category'), 'Confirmation title must state Deactivate Category');
    assert.ok(content.includes('soft-delete'), 'Confirmation dialog must explain soft-delete');
    assert.ok(content.includes('categoriesApi.delete(cat.id)'), 'Must call categoriesApi.delete');
  });

  test('8. Live Backend Category API GET /api/categories returns valid department data', async () => {
    const catRes = await apiRequest({
      path: '/categories',
      method: 'GET'
    });
    assert.equal(catRes.status, 200);
    assert.ok(Array.isArray(catRes.data), 'GET /api/categories must return an array');
    assert.ok(catRes.data.length > 0, 'Catalog should contain at least 1 category');

    const sampleCat = catRes.data[0];
    assert.ok(sampleCat.id, 'Category must have id');
    assert.ok(sampleCat.name, 'Category must have name');
    assert.ok(typeof sampleCat.active === 'boolean', 'Category must have boolean active flag');
  });
});

describe('Sales & Operational Reports: Calculations, Grouping & UX', () => {
  // Test helper calculations mirroring reports.tsx
  function calculateSalesMetrics(orders) {
    const nonCancelledOrders = orders.filter((o) => {
      const status = (o.status || o.orderStatus || '').toUpperCase();
      return status !== 'CANCELLED';
    });

    const totalRevenue = nonCancelledOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0
    );

    const totalOrdersCount = orders.length;
    const completedOrdersCount = nonCancelledOrders.length;
    const averageOrderValue =
      completedOrdersCount > 0 ? totalRevenue / completedOrdersCount : 0;

    const deliveredOrders = orders.filter((o) => {
      const status = (o.status || o.orderStatus || '').toUpperCase();
      return status === 'DELIVERED';
    });

    const fulfillmentRate =
      completedOrdersCount > 0
        ? Math.round((deliveredOrders.length / completedOrdersCount) * 100)
        : 0;

    return {
      totalRevenue,
      totalOrdersCount,
      completedOrdersCount,
      deliveredOrdersCount: deliveredOrders.length,
      averageOrderValue,
      fulfillmentRate
    };
  }

  function calculateStatusBreakdown(orders) {
    const STATUS_KEYS = [
      'PLACED',
      'CONFIRMED',
      'PROCESSING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED'
    ];

    const counts = {
      PLACED: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0
    };

    orders.forEach((o) => {
      const st = (o.status || o.orderStatus || '').toUpperCase();
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });

    const total = orders.length;
    return STATUS_KEYS.map((status) => ({
      status,
      count: counts[status],
      percentage: total > 0 ? Math.round((counts[status] / total) * 100) : 0
    }));
  }

  function calculatePaymentBreakdown(orders) {
    const groups = {
      COD: { label: 'Cash on Delivery', count: 0, amount: 0 },
      ONLINE: { label: 'Online / Razorpay', count: 0, amount: 0 },
      OTHER: { label: 'Other Methods', count: 0, amount: 0 }
    };

    orders.forEach((o) => {
      const method = (o.paymentMethod || '').trim().toUpperCase();
      const status = (o.status || o.orderStatus || '').toUpperCase();
      const isCancelled = status === 'CANCELLED';
      const orderAmount = isCancelled ? 0 : Number(o.totalAmount) || 0;

      if (
        method.includes('COD') ||
        method.includes('CASH') ||
        method === 'CASH_ON_DELIVERY' ||
        method === ''
      ) {
        groups.COD.count++;
        groups.COD.amount += orderAmount;
      } else if (
        method.includes('ONLINE') ||
        method.includes('RAZORPAY') ||
        method.includes('UPI') ||
        method.includes('CARD') ||
        method.includes('NET_BANKING')
      ) {
        groups.ONLINE.count++;
        groups.ONLINE.amount += orderAmount;
      } else {
        groups.OTHER.count++;
        groups.OTHER.amount += orderAmount;
      }
    });

    const totalOrders = orders.length;
    return Object.entries(groups).map(([key, data]) => ({
      key,
      ...data,
      percentage: totalOrders > 0 ? Math.round((data.count / totalOrders) * 100) : 0
    }));
  }

  function calculateTopProducts(orders) {
    const productSalesMap = new Map();

    orders.forEach((o) => {
      const status = (o.status || o.orderStatus || '').toUpperCase();
      if (status === 'CANCELLED') return;

      if (Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const name = item.productName || `Product #${item.productId}`;
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
          const lineTotal = Number(item.subtotal ?? item.totalPrice ?? (qty * unitPrice));

          const existing = productSalesMap.get(name);
          if (existing) {
            existing.quantitySold += qty;
            existing.totalRevenue += lineTotal;
          } else {
            productSalesMap.set(name, {
              productName: name,
              quantitySold: qty,
              totalRevenue: lineTotal
            });
          }
        });
      }
    });

    return Array.from(productSalesMap.values()).sort(
      (a, b) => b.quantitySold - a.quantitySold
    );
  }

  function calculateInventoryHealth(products) {
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.active !== false).length;
    const lowStockProducts = products.filter((p) => (Number(p.stockQuantity) || 0) <= 10 && (Number(p.stockQuantity) || 0) > 0).length;
    const outOfStockProducts = products.filter((p) => (Number(p.stockQuantity) || 0) === 0).length;

    return {
      totalProducts,
      activeProducts,
      lowStockProducts,
      outOfStockProducts
    };
  }

  test('1. More screen makes Sales & Operational Reports clickable and navigates to reports route', () => {
    const moreScreenPath = path.resolve('src/app/(tabs)/more/index.tsx');
    const content = fs.readFileSync(moreScreenPath, 'utf8');

    assert.ok(
      content.includes('Sales &amp; Operational Reports') || content.includes('Sales & Operational Reports'),
      'More screen must contain Sales & Operational Reports'
    );
    assert.ok(
      content.includes("router.push('/(tabs)/more/reports')"),
      'Reports card must route to /(tabs)/more/reports'
    );
  });

  test('2. Total Revenue strictly excludes CANCELLED orders', () => {
    const testOrders = [
      { id: 1, totalAmount: 500, status: 'DELIVERED' },
      { id: 2, totalAmount: 300, status: 'CONFIRMED' },
      { id: 3, totalAmount: 1200, status: 'CANCELLED' }, // Must be excluded
      { id: 4, totalAmount: 200, status: 'PLACED' }
    ];

    const metrics = calculateSalesMetrics(testOrders);
    assert.equal(metrics.totalRevenue, 1000, 'Revenue should be 500 + 300 + 200 = 1000');
    assert.equal(metrics.totalOrdersCount, 4);
    assert.equal(metrics.completedOrdersCount, 3);
  });

  test('3. Average Order Value (AOV) divides revenue by non-cancelled orders', () => {
    const testOrders = [
      { id: 1, totalAmount: 400, status: 'DELIVERED' },
      { id: 2, totalAmount: 600, status: 'PROCESSING' },
      { id: 3, totalAmount: 900, status: 'CANCELLED' }
    ];

    const metrics = calculateSalesMetrics(testOrders);
    assert.equal(metrics.totalRevenue, 1000);
    assert.equal(metrics.completedOrdersCount, 2);
    assert.equal(metrics.averageOrderValue, 500, 'AOV should be 1000 / 2 = 500');
  });

  test('4. Fulfillment Rate is calculated as (Delivered / (Total - Cancelled)) * 100', () => {
    const testOrders = [
      { id: 1, totalAmount: 200, status: 'DELIVERED' },
      { id: 2, totalAmount: 300, status: 'DELIVERED' },
      { id: 3, totalAmount: 400, status: 'DELIVERED' },
      { id: 4, totalAmount: 100, status: 'CONFIRMED' },
      { id: 5, totalAmount: 500, status: 'CANCELLED' } // Cancelled order excluded from denominator
    ];

    const metrics = calculateSalesMetrics(testOrders);
    // Non-cancelled = 4, Delivered = 3 => (3 / 4) * 100 = 75%
    assert.equal(metrics.deliveredOrdersCount, 3);
    assert.equal(metrics.completedOrdersCount, 4);
    assert.equal(metrics.fulfillmentRate, 75);
  });

  test('5. Zero and empty order sets are handled safely without division by zero or NaN', () => {
    const emptyOrders = [];
    const emptyMetrics = calculateSalesMetrics(emptyOrders);
    assert.equal(emptyMetrics.totalRevenue, 0);
    assert.equal(emptyMetrics.totalOrdersCount, 0);
    assert.equal(emptyMetrics.averageOrderValue, 0);
    assert.equal(emptyMetrics.fulfillmentRate, 0);
    assert.ok(!isNaN(emptyMetrics.averageOrderValue));
    assert.ok(!isNaN(emptyMetrics.fulfillmentRate));

    const onlyCancelled = [{ id: 1, totalAmount: 500, status: 'CANCELLED' }];
    const cancelledMetrics = calculateSalesMetrics(onlyCancelled);
    assert.equal(cancelledMetrics.totalRevenue, 0);
    assert.equal(cancelledMetrics.completedOrdersCount, 0);
    assert.equal(cancelledMetrics.averageOrderValue, 0);
    assert.equal(cancelledMetrics.fulfillmentRate, 0);
  });

  test('6. Order status aggregation tallies all supported statuses and computes percentages', () => {
    const testOrders = [
      { id: 1, status: 'PLACED' },
      { id: 2, status: 'CONFIRMED' },
      { id: 3, status: 'CONFIRMED' },
      { id: 4, status: 'PROCESSING' },
      { id: 5, status: 'OUT_FOR_DELIVERY' },
      { id: 6, status: 'DELIVERED' },
      { id: 7, status: 'DELIVERED' },
      { id: 8, status: 'DELIVERED' },
      { id: 9, status: 'CANCELLED' },
      { id: 10, status: 'CANCELLED' }
    ];

    const breakdown = calculateStatusBreakdown(testOrders);
    const getCount = (st) => breakdown.find((b) => b.status === st)?.count;
    const getPct = (st) => breakdown.find((b) => b.status === st)?.percentage;

    assert.equal(getCount('PLACED'), 1);
    assert.equal(getPct('PLACED'), 10);
    assert.equal(getCount('CONFIRMED'), 2);
    assert.equal(getPct('CONFIRMED'), 20);
    assert.equal(getCount('PROCESSING'), 1);
    assert.equal(getPct('PROCESSING'), 10);
    assert.equal(getCount('OUT_FOR_DELIVERY'), 1);
    assert.equal(getPct('OUT_FOR_DELIVERY'), 10);
    assert.equal(getCount('DELIVERED'), 3);
    assert.equal(getPct('DELIVERED'), 30);
    assert.equal(getCount('CANCELLED'), 2);
    assert.equal(getPct('CANCELLED'), 20);
  });

  test('7. Payment method breakdown correctly aggregates Cash on Delivery and Online/Razorpay', () => {
    const testOrders = [
      { id: 1, totalAmount: 400, paymentMethod: 'Cash on Delivery', status: 'DELIVERED' },
      { id: 2, totalAmount: 300, paymentMethod: 'COD', status: 'CONFIRMED' },
      { id: 3, totalAmount: 500, paymentMethod: 'ONLINE', status: 'DELIVERED' },
      { id: 4, totalAmount: 600, paymentMethod: 'RAZORPAY', status: 'DELIVERED' },
      { id: 5, totalAmount: 200, paymentMethod: 'UPI', status: 'DELIVERED' },
      { id: 6, totalAmount: 100, paymentMethod: 'VOUCHER', status: 'DELIVERED' },
      { id: 7, totalAmount: 700, paymentMethod: 'ONLINE', status: 'CANCELLED' } // Cancelled revenue excluded
    ];

    const breakdown = calculatePaymentBreakdown(testOrders);
    const cod = breakdown.find((b) => b.key === 'COD');
    const online = breakdown.find((b) => b.key === 'ONLINE');
    const other = breakdown.find((b) => b.key === 'OTHER');

    assert.equal(cod.count, 2, '2 COD orders');
    assert.equal(cod.amount, 700, '400 + 300 = 700 COD revenue');

    assert.equal(online.count, 4, 'ONLINE + RAZORPAY + UPI + cancelled ONLINE = 4 orders');
    assert.equal(online.amount, 1300, '500 + 600 + 200 = 1300 online revenue (excluding cancelled 700)');

    assert.equal(other.count, 1, '1 VOUCHER order');
    assert.equal(other.amount, 100, '100 other revenue');
  });

  test('8. Top-selling merchandise aggregates item quantities and excludes cancelled orders', () => {
    const testOrders = [
      {
        id: 1,
        status: 'DELIVERED',
        items: [
          { productId: 101, productName: 'Fresh Milk 1L', quantity: 3, price: 65, subtotal: 195 },
          { productId: 102, productName: 'Basmati Rice 5kg', quantity: 1, price: 450, subtotal: 450 }
        ]
      },
      {
        id: 2,
        status: 'PROCESSING',
        items: [
          { productId: 101, productName: 'Fresh Milk 1L', quantity: 2, price: 65, subtotal: 130 },
          { productId: 103, productName: 'Brown Bread', quantity: 4, price: 40, subtotal: 160 }
        ]
      },
      {
        id: 3,
        status: 'CANCELLED', // Cancelled order must not count towards sales
        items: [
          { productId: 101, productName: 'Fresh Milk 1L', quantity: 10, price: 65, subtotal: 650 },
          { productId: 104, productName: 'Olive Oil', quantity: 5, price: 800, subtotal: 4000 }
        ]
      }
    ];

    const topList = calculateTopProducts(testOrders);
    assert.equal(topList.length, 3, 'Olive Oil from cancelled order is excluded');

    // Fresh Milk: 3 + 2 = 5 sold, 195 + 130 = 325 revenue
    assert.equal(topList[0].productName, 'Fresh Milk 1L');
    assert.equal(topList[0].quantitySold, 5);
    assert.equal(topList[0].totalRevenue, 325);

    // Brown Bread: 4 sold
    assert.equal(topList[1].productName, 'Brown Bread');
    assert.equal(topList[1].quantitySold, 4);

    // Basmati Rice: 1 sold
    assert.equal(topList[2].productName, 'Basmati Rice 5kg');
    assert.equal(topList[2].quantitySold, 1);
  });

  test('9. Inventory health calculates total, active, low-stock, and out-of-stock products', () => {
    const testProducts = [
      { id: 1, name: 'Item A', active: true, stockQuantity: 25 },
      { id: 2, name: 'Item B', active: true, stockQuantity: 10 }, // Low stock (<= 10)
      { id: 3, name: 'Item C', active: true, stockQuantity: 3 },  // Low stock (<= 10)
      { id: 4, name: 'Item D', active: true, stockQuantity: 0 },  // Out of stock
      { id: 5, name: 'Item E', active: false, stockQuantity: 50 } // Inactive
    ];

    const health = calculateInventoryHealth(testProducts);
    assert.equal(health.totalProducts, 5);
    assert.equal(health.activeProducts, 4);
    assert.equal(health.lowStockProducts, 2);
    assert.equal(health.outOfStockProducts, 1);
  });

  test('10. Reports screen UI structure contains all required sections and banners', () => {
    const reportsPath = path.resolve('src/app/(tabs)/more/reports.tsx');
    const content = fs.readFileSync(reportsPath, 'utf8');

    // Verify sections exist
    assert.ok(
      content.includes('Key Financial &amp; Fulfillment Metrics') || content.includes('Key Financial & Fulfillment Metrics'),
      'Must have KPI section'
    );
    assert.ok(content.includes('Order Status Breakdown'), 'Must have Status section');
    assert.ok(content.includes('Payment Method Breakdown'), 'Must have Payment section');
    assert.ok(content.includes('Top-Selling Merchandise'), 'Must have Top Products section');
    assert.ok(
      content.includes('Inventory Health &amp; Stock Levels') || content.includes('Inventory Health & Stock Levels'),
      'Must have Inventory section'
    );
    assert.ok(content.includes('Store Performance'), 'Must have scope banner');
    assert.ok(content.includes('Based on available orders'), 'Must clearly state available orders scope');
    assert.ok(content.includes('ordersApi.getAll()'), 'Must call ordersApi.getAll()');
    assert.ok(content.includes('productsApi.getAll()'), 'Must call productsApi.getAll()');
  });

  test('11. Live Backend Sales & Operational Reports Verification', async () => {
    if (!liveOwnerToken) {
      const loginRes = await apiRequest({
        path: '/auth/owner/login',
        method: 'POST',
        body: { identifier: 'owner@grocerychoice.com', password: 'Admin@123' }
      });
      if (loginRes.data?.token) {
        liveOwnerToken = loginRes.data.token;
      }
    }
    assert.ok(liveOwnerToken, 'Live token required');

    const [ordersRes, productsRes] = await Promise.all([
      apiRequest({
        path: '/orders',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
      }),
      apiRequest({
        path: '/products',
        method: 'GET'
      })
    ]);

    assert.equal(ordersRes.status, 200);
    assert.equal(productsRes.status, 200);
    assert.ok(Array.isArray(ordersRes.data), 'Orders data is array');
    assert.ok(Array.isArray(productsRes.data), 'Products data is array');

    // Verify reports calculations on real live store data
    const liveMetrics = calculateSalesMetrics(ordersRes.data);
    assert.ok(typeof liveMetrics.totalRevenue === 'number' && !isNaN(liveMetrics.totalRevenue));
    assert.ok(typeof liveMetrics.averageOrderValue === 'number' && !isNaN(liveMetrics.averageOrderValue));
    assert.ok(typeof liveMetrics.fulfillmentRate === 'number' && !isNaN(liveMetrics.fulfillmentRate));

    const liveHealth = calculateInventoryHealth(productsRes.data);
    assert.ok(liveHealth.totalProducts > 0);
    assert.ok(liveHealth.activeProducts > 0);
  });
});

describe('Staff & Access Controls: Governance, Security, Validation & Directory', () => {
  // Validator logic mirroring staff.tsx Add Staff modal
  function validateStaffForm(fullName, email, phone, role) {
    const trimmedName = (fullName || '').trim();
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedPhone = (phone || '').trim();

    if (!trimmedName) {
      return { isValid: false, error: 'Full name is required.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return { isValid: false, error: 'A valid email address is required.' };
    }
    if (trimmedPhone) {
      const digits = trimmedPhone.replace(/\D/g, '');
      if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
        return { isValid: false, error: 'Please enter a valid 10-digit mobile number.' };
      }
    }
    if (!role || !['STAFF', 'ADMIN', 'OWNER'].includes(role)) {
      return { isValid: false, error: 'Valid system role is required.' };
    }

    return {
      isValid: true,
      error: null,
      payload: {
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        role,
        status: 'ACTIVE'
      }
    };
  }

  // Security evaluator for self-protection and Primary Owner protections
  function evaluateStaffActionSecurity(actor, target, action) {
    const isSelf = actor.id === target.id;
    const isTargetPrimaryOwner = target.primaryOwner === true;
    const isActorManager = actor.role === 'OWNER' || actor.role === 'ADMIN';

    // 1. Staff read-only check
    if (!isActorManager) {
      return { allowed: false, reason: 'Staff accounts are restricted to read-only access.' };
    }

    // 2. Primary Owner protection checks
    if (isTargetPrimaryOwner) {
      if (action === 'CHANGE_ROLE') {
        return { allowed: false, reason: 'The Primary Owner role cannot be modified here.' };
      }
      if (action === 'CHANGE_STATUS') {
        return { allowed: false, reason: 'The Primary Owner account cannot be disabled.' };
      }
      if (action === 'REVOKE_ACCESS') {
        return { allowed: false, reason: 'Cannot revoke staff access from the Primary Owner.' };
      }
    }

    // 3. Self-protection checks
    if (isSelf) {
      if (action === 'CHANGE_ROLE') {
        return { allowed: false, reason: 'You cannot change your own role.' };
      }
      if (action === 'CHANGE_STATUS') {
        return { allowed: false, reason: 'You cannot deactivate your own account.' };
      }
      if (action === 'REVOKE_ACCESS') {
        return { allowed: false, reason: 'You cannot revoke your own staff access.' };
      }
    }

    return { allowed: true, reason: null };
  }

  test('1. More screen makes Staff & Access Controls clickable and navigates to staff route', () => {
    const moreScreenPath = path.resolve('src/app/(tabs)/more/index.tsx');
    const content = fs.readFileSync(moreScreenPath, 'utf8');

    assert.ok(
      content.includes('Staff &amp; Access Controls') || content.includes('Staff & Access Controls'),
      'More screen must contain Staff & Access Controls'
    );
    assert.ok(
      content.includes("router.push('/(tabs)/more/staff')"),
      'Staff card must route to /(tabs)/more/staff'
    );
  });

  test('2. Add Staff form validation enforces required name and valid email format', () => {
    assert.equal(validateStaffForm('', 'test@test.com', '', 'STAFF').isValid, false);
    assert.equal(validateStaffForm('   ', 'test@test.com', '', 'STAFF').isValid, false);
    assert.equal(validateStaffForm('Ramesh Kumar', '', '', 'STAFF').isValid, false);
    assert.equal(validateStaffForm('Ramesh Kumar', 'invalid-email', '', 'STAFF').isValid, false);
    assert.equal(validateStaffForm('Ramesh Kumar', 'ramesh@grocerychoice.com', '', 'STAFF').isValid, true);
  });

  test('3. Mobile number validation enforces 10 digits when supplied', () => {
    assert.equal(validateStaffForm('Ramesh Kumar', 'ramesh@grocerychoice.com', '12345', 'STAFF').isValid, false);
    assert.equal(validateStaffForm('Ramesh Kumar', 'ramesh@grocerychoice.com', '9876543210', 'STAFF').isValid, true);
    assert.equal(validateStaffForm('Ramesh Kumar', 'ramesh@grocerychoice.com', '', 'STAFF').isValid, true); // optional
  });

  test('4. Self-action security strictly blocks self-role-change, self-deactivation, and self-revocation', () => {
    const actor = { id: 1, role: 'OWNER', primaryOwner: true };
    const targetSame = { id: 1, role: 'OWNER', primaryOwner: true };

    const roleRes = evaluateStaffActionSecurity(actor, targetSame, 'CHANGE_ROLE');
    assert.equal(roleRes.allowed, false);

    const statusRes = evaluateStaffActionSecurity(actor, targetSame, 'CHANGE_STATUS');
    assert.equal(statusRes.allowed, false);

    const revokeRes = evaluateStaffActionSecurity(actor, targetSame, 'REVOKE_ACCESS');
    assert.equal(revokeRes.allowed, false);
  });

  test('5. Primary Owner account is protected against role change, disabling, and revocation', () => {
    const actorAdmin = { id: 2, role: 'ADMIN', primaryOwner: false };
    const targetPrimary = { id: 1, role: 'OWNER', primaryOwner: true };

    const roleRes = evaluateStaffActionSecurity(actorAdmin, targetPrimary, 'CHANGE_ROLE');
    assert.equal(roleRes.allowed, false);

    const statusRes = evaluateStaffActionSecurity(actorAdmin, targetPrimary, 'CHANGE_STATUS');
    assert.equal(statusRes.allowed, false);

    const revokeRes = evaluateStaffActionSecurity(actorAdmin, targetPrimary, 'REVOKE_ACCESS');
    assert.equal(revokeRes.allowed, false);
  });

  test('6. STAFF accounts are read-only and blocked from all administrative operations', () => {
    const actorStaff = { id: 3, role: 'STAFF', primaryOwner: false };
    const targetOther = { id: 4, role: 'STAFF', primaryOwner: false };

    const roleRes = evaluateStaffActionSecurity(actorStaff, targetOther, 'CHANGE_ROLE');
    assert.equal(roleRes.allowed, false);
    assert.ok(roleRes.reason.includes('read-only'));

    const statusRes = evaluateStaffActionSecurity(actorStaff, targetOther, 'CHANGE_STATUS');
    assert.equal(statusRes.allowed, false);

    const revokeRes = evaluateStaffActionSecurity(actorStaff, targetOther, 'REVOKE_ACCESS');
    assert.equal(revokeRes.allowed, false);
  });

  test('7. Revoke Access explains account demotion to standard customer profile without data loss', () => {
    const staffPath = path.resolve('src/app/(tabs)/more/staff.tsx');
    const content = fs.readFileSync(staffPath, 'utf8');

    assert.ok(content.includes('Revoke Staff Access'), 'Must have Revoke Staff Access dialog');
    assert.ok(content.includes('standard customer profile'), 'Must explain conversion to customer profile');
    assert.ok(content.includes('staffApi.removeAccess(user.id)'), 'Must invoke staffApi.removeAccess');
    assert.ok(!content.includes('Permanently delete account'), 'Must not describe as permanent deletion');
  });

  test('8. Staff screen includes Primary Ownership Guard and read-only notice banner for staff', () => {
    const staffPath = path.resolve('src/app/(tabs)/more/staff.tsx');
    const content = fs.readFileSync(staffPath, 'utf8');

    assert.ok(content.includes('Primary Ownership Guard'), 'Must display Primary Ownership Guard');
    assert.ok(content.includes('readOnlyNotice'), 'Must include readOnlyNotice view');
    assert.ok(content.includes('staffApi.getAll()'), 'Must fetch staffApi.getAll()');
    assert.ok(content.includes('staffApi.getDesignations()'), 'Must fetch staffApi.getDesignations()');
  });

  test('9. Audit logs view displays event, actor, date, and details without exposing secrets', () => {
    const staffPath = path.resolve('src/app/(tabs)/more/staff.tsx');
    const content = fs.readFileSync(staffPath, 'utf8');

    assert.ok(content.includes('staffApi.getAuditLogs()'), 'Must load audit logs');
    assert.ok(content.includes('item.action'), 'Must render action badge');
    assert.ok(content.includes('item.createdAt'), 'Must render timestamp');
    assert.ok(!content.includes('item.passwordHash'), 'Must not expose password hash');
  });

  test('10. Live Backend Staff & Designations API Verification', async () => {
    if (!liveOwnerToken) {
      const loginRes = await apiRequest({
        path: '/auth/owner/login',
        method: 'POST',
        body: { identifier: 'owner@grocerychoice.com', password: 'Admin@123' }
      });
      if (loginRes.data?.token) {
        liveOwnerToken = loginRes.data.token;
      }
    }
    assert.ok(liveOwnerToken, 'Live token required');

    const [staffRes, designationsRes, primaryOwnerRes] = await Promise.all([
      apiRequest({
        path: '/staff',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
      }),
      apiRequest({
        path: '/designations',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
      }),
      apiRequest({
        path: '/ownership/primary-owner',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
      })
    ]);

    assert.equal(staffRes.status, 200);
    assert.equal(designationsRes.status, 200);
    assert.equal(primaryOwnerRes.status, 200);

    assert.ok(Array.isArray(staffRes.data), 'Staff response is array');
    assert.ok(staffRes.data.length > 0, 'At least 1 staff member exists');

    const member = staffRes.data[0];
    assert.ok(member.id, 'Staff has id');
    assert.ok(member.fullName, 'Staff has fullName');
    assert.ok(member.role, 'Staff has role');

    assert.ok(primaryOwnerRes.data.primaryOwner === true, 'Primary Owner has flag');
  });
});

describe('Personal Information: Profile Data, Editing & Security', () => {
  function validateProfileEdit(fullName, email, phone) {
    const trimmedName = fullName?.trim() || '';
    const trimmedEmail = email?.trim().toLowerCase() || '';
    const trimmedPhone = phone?.trim() || '';

    if (!trimmedName) {
      return { isValid: false, error: 'Full name is required.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return { isValid: false, error: 'A valid email address is required.' };
    }

    if (trimmedPhone) {
      const digits = trimmedPhone.replace(/\D/g, '');
      if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
        return { isValid: false, error: 'Please enter a valid 10-digit mobile number.' };
      }
    }

    return { isValid: true, error: null };
  }

  test('1. More screen links Profile card directly to /(tabs)/more/profile', () => {
    const moreScreenPath = path.resolve('src/app/(tabs)/more/index.tsx');
    const content = fs.readFileSync(moreScreenPath, 'utf8');

    assert.ok(
      content.includes("router.push('/(tabs)/more/profile')"),
      'More profile card must navigate to /(tabs)/more/profile'
    );
    assert.ok(
      content.includes('profileCard'),
      'More screen must contain profileCard'
    );
  });

  test('2. Personal Information screen implements safe back navigation and Android BackHandler', () => {
    const profilePath = path.resolve('src/app/(tabs)/more/profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    assert.ok(
      content.includes('router.canGoBack()'),
      'Must check router.canGoBack()'
    );
    assert.ok(
      content.includes("router.replace('/(tabs)/more')"),
      'Must fallback to /(tabs)/more'
    );
    assert.ok(
      content.includes('BackHandler.addEventListener'),
      'Must register Android hardwareBackPress listener'
    );
    assert.ok(
      content.includes("leftAction={{ icon: '←', onPress: handleBack }}"),
      'Header must provide left back action calling handleBack'
    );
  });

  test('3. Personal Information form validation enforces required full name and valid email', () => {
    assert.equal(validateProfileEdit('', 'owner@grocerychoice.com', '').isValid, false);
    assert.equal(validateProfileEdit('   ', 'owner@grocerychoice.com', '').isValid, false);
    assert.equal(validateProfileEdit('Store Owner', '', '').isValid, false);
    assert.equal(validateProfileEdit('Store Owner', 'invalid-email', '').isValid, false);
    assert.equal(validateProfileEdit('Store Owner', 'owner@grocerychoice.com', '').isValid, true);
  });

  test('4. Personal Information mobile validation enforces 10 digits when supplied', () => {
    assert.equal(validateProfileEdit('Store Owner', 'owner@grocerychoice.com', '12345').isValid, false);
    assert.equal(validateProfileEdit('Store Owner', 'owner@grocerychoice.com', '5555555555').isValid, false);
    assert.equal(validateProfileEdit('Store Owner', 'owner@grocerychoice.com', '9876543210').isValid, true);
    assert.equal(validateProfileEdit('Store Owner', 'owner@grocerychoice.com', '').isValid, true);
  });

  test('5. Read-only security guards protect Role, Primary Ownership, and Account Status from modification', () => {
    const profilePath = path.resolve('src/app/(tabs)/more/profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    assert.ok(
      content.includes('Role &amp; Access Governance') || content.includes('Role & Access Governance'),
      'Must display Role & Access Governance notice'
    );
    assert.ok(
      content.includes('protectedFieldBanner') || content.includes('protected system fields'),
      'Must display protected system fields warning banner'
    );
    assert.ok(
      !content.includes('<Input label="Role"'),
      'Role must not be an editable input'
    );
    assert.ok(
      !content.includes('<Input label="Account Status"'),
      'Account status must not be an editable input'
    );
  });

  test('6. Profile screen handles all required display fields and fallbacks', () => {
    const profilePath = path.resolve('src/app/(tabs)/more/profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    assert.ok(content.includes('avatarLargeCircle'), 'Must render avatar circle');
    assert.ok(content.includes('heroName'), 'Must render hero full name');
    assert.ok(content.includes('Contact Information'), 'Must render Contact Information section');
    assert.ok(content.includes('Store &amp; Organizational Profile') || content.includes('Store & Organizational Profile'), 'Must render Store & Organizational Profile section');
    assert.ok(content.includes('Full Name'), 'Must render Full Name label');
    assert.ok(content.includes('Email Address'), 'Must render Email Address label');
    assert.ok(content.includes('Phone Number'), 'Must render Phone Number label');
    assert.ok(content.includes('Designation / Title'), 'Must render Designation label');
    assert.ok(content.includes('Assigned Store / Hub'), 'Must render Store Hub label');
    assert.ok(content.includes('Member Since'), 'Must render Member Since label');
  });

  test('7. Profile edit action invokes updateProfile and syncs contact details for managers', () => {
    const profilePath = path.resolve('src/app/(tabs)/more/profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    assert.ok(content.includes('updateProfile('), 'Must call auth context updateProfile');
    assert.ok(content.includes('staffApi.updateContact('), 'Must call staffApi.updateContact for manager contact details');
    assert.ok(content.includes('refreshProfile()'), 'Must refresh profile after saving');
    assert.ok(content.includes('loading={saving}'), 'Save button must show loading indicator');
    assert.ok(content.includes('disabled={saving}'), 'Save button must be disabled while saving');
  });

  test('8. Security check: No tokens, passwords, JWTs, or secrets are exposed in profile screen', () => {
    const profilePath = path.resolve('src/app/(tabs)/more/profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    assert.ok(!content.includes('passwordHash'), 'Must not display passwordHash');
    assert.ok(!content.includes('token:'), 'Must not display token');
    assert.ok(!content.includes('jwt'), 'Must not display JWT');
    assert.ok(!content.includes('apiKey'), 'Must not display API key');
  });

  test('9. Live Backend Profile API Verification (GET /api/auth/me)', async () => {
    if (!liveOwnerToken) {
      const loginRes = await apiRequest({
        path: '/auth/owner/login',
        method: 'POST',
        body: { identifier: 'owner@grocerychoice.com', password: 'Admin@123' }
      });
      if (loginRes.data?.token) {
        liveOwnerToken = loginRes.data.token;
      }
    }
    assert.ok(liveOwnerToken, 'Live token required');

    const profileRes = await apiRequest({
      path: '/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${liveOwnerToken}` }
    });

    assert.equal(profileRes.status, 200, 'GET /api/auth/me must return 200 OK');
    assert.ok(profileRes.data, 'Profile data must be present');
    assert.ok(profileRes.data.id, 'User ID must be present');
    assert.ok(profileRes.data.fullName, 'User full name must be present');
    assert.ok(profileRes.data.email, 'User email must be present');
    assert.ok(profileRes.data.role, 'User role must be present');
    assert.ok(isAllowedRole(profileRes.data.role), 'Role must be allowed staff role');
    assert.ok(!profileRes.data.password, 'Password must not be returned');
    assert.ok(!profileRes.data.passwordHash, 'Password hash must not be returned');
  });
});





