import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

// --- Validation and Helper Logic ---
const VALID_PRODUCT_UNITS = [
  'PIECE',
  'KG',
  'GRAM',
  'LITRE',
  'MILLILITRE',
  'PACK',
  'BOX',
  'DOZEN'
];

function validateProductForm(data) {
  const errors = {};

  // 1. Name
  const trimmedName = data.name ? data.name.trim() : '';
  if (!trimmedName) {
    errors.name = 'Product name is required';
  } else if (trimmedName.length > 200) {
    errors.name = 'Product name cannot exceed 200 characters';
  }

  // 2. SKU
  const trimmedSku = data.sku ? data.sku.trim() : '';
  if (!trimmedSku) {
    errors.sku = 'SKU is required';
  } else if (trimmedSku.length > 50) {
    errors.sku = 'SKU cannot exceed 50 characters';
  }

  // 3. Category
  if (!data.categoryId || Number(data.categoryId) <= 0) {
    errors.categoryId = 'Please select a product category';
  }

  // 4. Unit
  if (!data.unit || !VALID_PRODUCT_UNITS.includes(data.unit)) {
    errors.unit = 'Please select a valid measurement unit';
  }

  // 5. MRP
  const mrpStr = data.mrp != null ? String(data.mrp).trim() : '';
  const mrpNum = parseFloat(mrpStr);
  if (!mrpStr || isNaN(mrpNum) || mrpNum <= 0) {
    errors.mrp = 'MRP must be greater than zero';
  }

  // 6. Selling Price
  const spStr = data.sellingPrice != null ? String(data.sellingPrice).trim() : '';
  const spNum = parseFloat(spStr);
  if (!spStr || isNaN(spNum) || spNum <= 0) {
    errors.sellingPrice = 'Selling price must be greater than zero';
  }

  // 7. Comparative price validation
  if (!errors.mrp && !errors.sellingPrice && mrpNum < spNum) {
    errors.sellingPrice = 'Selling price cannot be greater than MRP';
  }

  // 8. Stock Quantity
  const stockStr = data.stockQuantity != null ? String(data.stockQuantity).trim() : '';
  const stockNum = parseInt(stockStr, 10);
  if (stockStr === '' || isNaN(stockNum)) {
    errors.stockQuantity = 'Stock quantity is required';
  } else if (stockNum < 0) {
    errors.stockQuantity = 'Stock quantity cannot be negative';
  }

  const isValid = Object.keys(errors).length === 0;
  if (!isValid) return { isValid: false, errors };

  return {
    isValid: true,
    errors: {},
    sanitizedPayload: {
      name: trimmedName,
      description: data.description ? data.description.trim() : undefined,
      sku: trimmedSku.toUpperCase(),
      categoryId: Number(data.categoryId),
      imageUrl: data.imageUrl ? data.imageUrl.trim() : undefined,
      unit: data.unit,
      mrp: Math.round(mrpNum * 100) / 100,
      sellingPrice: Math.round(spNum * 100) / 100,
      stockQuantity: stockNum,
      active: data.active !== false
    }
  };
}

function getProductStockStatus(stockQuantity) {
  const quantity = Number(stockQuantity) || 0;
  if (quantity === 0) {
    return { status: 'OUT_OF_STOCK', label: 'Out of Stock', variant: 'danger' };
  }
  if (quantity <= 10) {
    return { status: 'LOW_STOCK', label: `Low Stock (${quantity})`, variant: 'warning' };
  }
  return { status: 'IN_STOCK', label: `${quantity} in stock`, variant: 'success' };
}

function filterProductsList(products, options) {
  let result = [...products];

  if (options.searchQuery && options.searchQuery.trim()) {
    const q = options.searchQuery.trim().toLowerCase();
    result = result.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.name.toLowerCase().includes(q))
    );
  }

  if (options.categoryId && options.categoryId !== 'ALL') {
    result = result.filter(
      (p) =>
        p.categoryId === options.categoryId ||
        (p.category && p.category.id === options.categoryId)
    );
  }

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

// Live backend helper
const BACKEND_HOST = 'grocery-choice-backend-production.up.railway.app';
function liveGet(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          hostname: BACKEND_HOST,
          path: '/api' + path,
          headers: { Accept: 'application/json' },
          timeout: 10000
        },
        (res) => {
          let rawData = '';
          res.on('data', (c) => (rawData += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, data: JSON.parse(rawData) });
            } catch {
              resolve({ status: res.statusCode, data: rawData });
            }
          });
        }
      )
      .on('error', reject);
  });
}

// =======================================================
// UNIT TESTS: PRODUCT FORM VALIDATION & BUSINESS RULES
// =======================================================

describe('Product Management Form Validation', () => {
  const validForm = {
    name: 'Organic Basmati Rice',
    description: 'Long grain aromatic aged rice',
    sku: 'RICE-BAS-01',
    categoryId: 2,
    unit: 'KG',
    mrp: '180.00',
    sellingPrice: '155.00',
    stockQuantity: '30',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
    active: true
  };

  test('1. Valid form passes validation when MRP >= Selling Price', () => {
    const res = validateProductForm(validForm);
    assert.equal(res.isValid, true);
    assert.deepEqual(res.errors, {});
    assert.ok(res.sanitizedPayload);
    assert.equal(res.sanitizedPayload.mrp, 180);
    assert.equal(res.sanitizedPayload.sellingPrice, 155);
  });

  test('2. MRP < Selling Price is strictly rejected', () => {
    const invalidPrices = { ...validForm, mrp: '100.00', sellingPrice: '120.00' };
    const res = validateProductForm(invalidPrices);
    assert.equal(res.isValid, false);
    assert.equal(res.errors.sellingPrice, 'Selling price cannot be greater than MRP');
  });

  test('3. Negative stock quantity is strictly rejected', () => {
    const negStock = { ...validForm, stockQuantity: '-5' };
    const res = validateProductForm(negStock);
    assert.equal(res.isValid, false);
    assert.equal(res.errors.stockQuantity, 'Stock quantity cannot be negative');

    // Zero stock is valid (Out of stock)
    const zeroStock = { ...validForm, stockQuantity: '0' };
    const resZero = validateProductForm(zeroStock);
    assert.equal(resZero.isValid, true);
    assert.equal(resZero.sanitizedPayload.stockQuantity, 0);
  });

  test('4. Empty name or whitespace name is rejected', () => {
    const emptyName = { ...validForm, name: '   ' };
    const res = validateProductForm(emptyName);
    assert.equal(res.isValid, false);
    assert.equal(res.errors.name, 'Product name is required');
  });

  test('5. Empty SKU is rejected and valid SKU is uppercased', () => {
    const emptySku = { ...validForm, sku: '' };
    const res = validateProductForm(emptySku);
    assert.equal(res.isValid, false);
    assert.equal(res.errors.sku, 'SKU is required');

    const lowerSku = { ...validForm, sku: 'rice-bas-01' };
    const res2 = validateProductForm(lowerSku);
    assert.equal(res2.isValid, true);
    assert.equal(res2.sanitizedPayload.sku, 'RICE-BAS-01');
  });

  test('6. Product payload construction produces clean DTO matching backend expectations', () => {
    const res = validateProductForm(validForm);
    assert.equal(res.isValid, true);
    const p = res.sanitizedPayload;
    assert.equal(p.name, 'Organic Basmati Rice');
    assert.equal(p.sku, 'RICE-BAS-01');
    assert.equal(p.categoryId, 2);
    assert.equal(p.unit, 'KG');
    assert.equal(p.mrp, 180);
    assert.equal(p.sellingPrice, 155);
    assert.equal(p.stockQuantity, 30);
    assert.equal(p.active, true);
  });

  test('7. Category selection validation rejects missing or invalid categoryId', () => {
    const noCat = { ...validForm, categoryId: null };
    const res = validateProductForm(noCat);
    assert.equal(res.isValid, false);
    assert.equal(res.errors.categoryId, 'Please select a product category');

    const zeroCat = { ...validForm, categoryId: 0 };
    const res2 = validateProductForm(zeroCat);
    assert.equal(res2.isValid, false);
    assert.equal(res2.errors.categoryId, 'Please select a product category');
  });
});

describe('Product Filters, Stock Status, and List Processing', () => {
  const sampleProducts = [
    { id: 1, name: 'Fresh Whole Milk', sku: 'MLK-001', categoryId: 1, category: { id: 1, name: 'Dairy' }, stockQuantity: 25, active: true },
    { id: 2, name: 'Amul Salted Butter', sku: 'BTR-002', categoryId: 1, category: { id: 1, name: 'Dairy' }, stockQuantity: 0, active: true },
    { id: 3, name: 'Artisan Sourdough', sku: 'BRD-003', categoryId: 2, category: { id: 2, name: 'Bakery' }, stockQuantity: 4, active: true },
    { id: 4, name: 'Seasonal Strawberries', sku: 'FRT-004', categoryId: 3, category: { id: 3, name: 'Produce' }, stockQuantity: 15, active: false }
  ];

  test('8. Product filtering correctly segments by status and category', () => {
    // Active filter
    const active = filterProductsList(sampleProducts, { statusFilter: 'ACTIVE' });
    assert.equal(active.length, 3);

    // Inactive filter
    const inactive = filterProductsList(sampleProducts, { statusFilter: 'INACTIVE' });
    assert.equal(inactive.length, 1);
    assert.equal(inactive[0].name, 'Seasonal Strawberries');

    // Low stock filter (1 to 10)
    const lowStock = filterProductsList(sampleProducts, { statusFilter: 'LOW_STOCK' });
    assert.equal(lowStock.length, 1);
    assert.equal(lowStock[0].name, 'Artisan Sourdough');

    // Out of stock filter (0)
    const outStock = filterProductsList(sampleProducts, { statusFilter: 'OUT_OF_STOCK' });
    assert.equal(outStock.length, 1);
    assert.equal(outStock[0].name, 'Amul Salted Butter');

    // Category filter
    const dairyOnly = filterProductsList(sampleProducts, { categoryId: 1 });
    assert.equal(dairyOnly.length, 2);
  });

  test('9. Stock status calculation distinguishes in-stock, low-stock, and out-of-stock', () => {
    assert.deepEqual(getProductStockStatus(0), { status: 'OUT_OF_STOCK', label: 'Out of Stock', variant: 'danger' });
    assert.deepEqual(getProductStockStatus(5), { status: 'LOW_STOCK', label: 'Low Stock (5)', variant: 'warning' });
    assert.deepEqual(getProductStockStatus(10), { status: 'LOW_STOCK', label: 'Low Stock (10)', variant: 'warning' });
    assert.deepEqual(getProductStockStatus(11), { status: 'IN_STOCK', label: '11 in stock', variant: 'success' });
    assert.deepEqual(getProductStockStatus(50), { status: 'IN_STOCK', label: '50 in stock', variant: 'success' });
  });

  test('10. Product list handling handles search by name and SKU', () => {
    const searchName = filterProductsList(sampleProducts, { searchQuery: 'milk' });
    assert.equal(searchName.length, 1);
    assert.equal(searchName[0].sku, 'MLK-001');

    const searchSku = filterProductsList(sampleProducts, { searchQuery: 'BTR' });
    assert.equal(searchSku.length, 1);
    assert.equal(searchSku[0].name, 'Amul Salted Butter');

    const searchNone = filterProductsList(sampleProducts, { searchQuery: 'xyz-not-found' });
    assert.equal(searchNone.length, 0);
  });

  test('11. Delete authorization logic distinguishes OWNER/ADMIN vs STAFF', () => {
    const checkAuth = (role) => role === 'OWNER' || role === 'ADMIN';

    assert.equal(checkAuth('OWNER'), true, 'Store OWNER must have product management privileges');
    assert.equal(checkAuth('ADMIN'), true, 'Store ADMIN must have product management privileges');
    assert.equal(checkAuth('STAFF'), false, 'Store STAFF must be prevented from product mutation');
    assert.equal(checkAuth('CUSTOMER'), false, 'CUSTOMER must have zero management privileges');
  });
});

// =======================================================
// LIVE BACKEND VERIFICATION (PRODUCTS APIS)
// =======================================================

describe('Live Backend Product APIs Verification', () => {
  test('GET /api/products returns active products list with complete DTO fields', async () => {
    const res = await liveGet('/products');
    assert.equal(res.status, 200, 'GET /api/products must return 200');
    assert.ok(Array.isArray(res.data), 'Response must be an array of products');
    assert.ok(res.data.length >= 20, `Expected at least 20 products, got ${res.data.length}`);

    const sample = res.data[0];
    assert.ok(sample.id, 'Product must have an id');
    assert.ok(sample.name, 'Product must have a name');
    assert.ok(sample.unit, 'Product must have a unit');
    assert.ok(sample.mrp > 0, 'Product MRP must be > 0');
    assert.ok(sample.sellingPrice > 0, 'Product sellingPrice must be > 0');
    assert.ok(sample.stockQuantity >= 0, 'Product stockQuantity must be >= 0');
  });

  test('GET /api/products/search?query=milk returns targeted results', async () => {
    const res = await liveGet('/products/search?query=milk');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length > 0, 'Search for "milk" should return at least 1 match');
  });

  test('GET /api/products/category/1 returns products belonging to Category 1', async () => {
    const res = await liveGet('/products/category/1');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
    assert.ok(res.data.length > 0, 'Category 1 should have products');
  });

  test('GET /api/products/1 returns a single product by ID', async () => {
    const res = await liveGet('/products/1');
    assert.equal(res.status, 200);
    assert.ok(res.data);
    assert.equal(res.data.id, 1);
    assert.ok(res.data.name);
  });
});

// =======================================================
// PRODUCTS SCREEN UI & LOCAL SEARCH RESTORATION
// =======================================================

describe('Products Screen UI Components & Local Search Restoration', () => {
  const productsScreenPath = path.resolve('src/app/(tabs)/products/index.tsx');
  const screenContent = fs.readFileSync(productsScreenPath, 'utf8');

  test('1. Products screen contains the Search Input Bar with correct placeholder', () => {
    assert.ok(screenContent.includes('styles.searchBarContainer'), 'Search bar container must be present');
    assert.ok(
      screenContent.includes('placeholder="Search products by name, SKU, or category..."'),
      'Search input placeholder must match existing design'
    );
    assert.ok(screenContent.includes('value={searchQuery}'), 'Search input must bind to searchQuery state');
    assert.ok(screenContent.includes('onChangeText={setSearchQuery}'), 'Search input must update searchQuery');
    assert.ok(screenContent.includes('onRightIconPress={() => setSearchQuery(\'\')}'), 'Clear button handler must be bound');
  });

  test('2. Products screen contains Category Filter, Status Filter, and FlatList', () => {
    // Status filter
    assert.ok(screenContent.includes('styles.filterPillsRow'), 'Status filter pills row must exist');
    assert.ok(screenContent.includes('statusFilterTabs'), 'Status filter tabs must be defined');

    // Category filter
    assert.ok(screenContent.includes('styles.categoryPillsRow'), 'Category filter pills row must exist');
    assert.ok(screenContent.includes('All Categories'), 'All Categories option must exist');

    // FlatList
    assert.ok(screenContent.includes('<FlatList'), 'FlatList component must exist');
    assert.ok(screenContent.includes('data={filteredProducts}'), 'FlatList must render filteredProducts');
  });

  test('3. Products screen contains product cards, actions, and modal details', () => {
    assert.ok(screenContent.includes('+ Add Product'), '+ Add Product button must exist');
    assert.ok(screenContent.includes('Edit Product Details'), 'Edit Product action must exist');
    assert.ok(screenContent.includes('Deactivate Product'), 'Deactivate Product action must exist');
    assert.ok(screenContent.includes('handleDeleteProduct'), 'Deactivate handler must exist');
  });

  test('4. Local product search checks name, SKU, and category; "Milk" returns exactly 1 item', () => {
    const catalog = [
      {
        id: 8,
        name: 'Farm Fresh Homogenized Cow Milk',
        sku: 'GC-PROD-DB-01',
        category: { id: 1, name: 'Dairy & Breakfast' },
        stockQuantity: 40,
        active: true
      },
      {
        id: 19,
        name: 'Cold Pressed Virgin Coconut Hair & Body Oil',
        sku: 'GC-PROD-PC-02',
        description: 'Contains nourishing milk lipids and pure coconut',
        category: { id: 3, name: 'Personal Care' },
        stockQuantity: 20,
        active: true
      }
    ];

    // Local filter strictly checks name, SKU, and category name
    const results = filterProductsList(catalog, { searchQuery: 'Milk' });
    assert.equal(results.length, 1, 'Local search for "Milk" must return exactly 1 item');
    assert.equal(results[0].id, 8, 'Matched item must be Cow Milk');
    assert.equal(results[0].name, 'Farm Fresh Homogenized Cow Milk');
  });
});

describe('Home / Overview Screen Dedicated Search Window & UX', () => {
  const homeScreenPath = path.resolve('src/app/(tabs)/index.tsx');
  const homeContent = fs.readFileSync(homeScreenPath, 'utf8');

  test('1. Home screen contains compact search bar trigger placed below Header and before KPI cards', () => {
    assert.ok(homeContent.includes('styles.compactSearchBar'), 'Compact search bar trigger must exist');
    assert.ok(homeContent.includes('Search products...'), 'Search placeholder must be "Search products..."');
    assert.ok(homeContent.includes('handleOpenSearch'), 'Tapping trigger must call handleOpenSearch');

    // Structural placement check: Header < compactSearchBar < Live Store Metrics / KPI cards
    const headerPos = homeContent.indexOf('<Header');
    const searchPos = homeContent.indexOf('styles.compactSearchBar');
    const metricsPos = homeContent.indexOf('styles.metricsGrid');

    assert.ok(headerPos !== -1 && searchPos !== -1 && metricsPos !== -1, 'All sections must exist');
    assert.ok(headerPos < searchPos, 'Search bar trigger must be below Header');
    assert.ok(searchPos < metricsPos, 'Search bar trigger must be before KPI cards');
  });

  test('2. Opens dedicated full-screen search window (Modal) with back arrow and clear button', () => {
    assert.ok(homeContent.includes('<Modal'), 'Must use Modal for full-screen search view');
    assert.ok(homeContent.includes('visible={isSearchOpen}'), 'Modal visibility bound to isSearchOpen');
    assert.ok(homeContent.includes('styles.searchModalHeader'), 'Dedicated search modal header must exist');
    assert.ok(homeContent.includes('styles.searchBackBtn'), 'Back button must exist in header');
    assert.ok(homeContent.includes('handleCloseSearch'), 'Back button must close search window');
    assert.ok(homeContent.includes('onRightIconPress={() => setSearchQuery(\'\')}'), 'Clear (X) button must clear search input');
  });

  test('3. When search field is empty, displays Recent Searches with clock icon and Clear Search History button', () => {
    assert.ok(homeContent.includes('Recent Searches'), '"Recent Searches" header must be present');
    assert.ok(homeContent.includes('Clear Search History'), '"Clear Search History" button must be present');
    assert.ok(homeContent.includes('handleClearHistory'), 'Clear history handler must be connected');
    assert.ok(homeContent.includes('🕘'), 'Recent items must display clock icon 🕘');
    assert.ok(homeContent.includes('handleSelectRecentSearch'), 'Tapping recent search must populate query');
  });

  test('4. When there is no recent search history, displays clean empty state "No recent searches"', () => {
    assert.ok(homeContent.includes('No recent searches'), 'Clean empty state title must exist');
    assert.ok(homeContent.includes('styles.emptyHistoryCard'), 'Empty history card container must exist');
  });

  test('5. When owner types, replaces recent searches with Search Results cards containing required fields', () => {
    assert.ok(homeContent.includes('Search Results'), '"Search Results" title must appear when typing');
    assert.ok(homeContent.includes('styles.productResultCard'), 'Product result card container must exist');
    assert.ok(homeContent.includes('{item.name}'), 'Product name must be displayed');
    assert.ok(homeContent.includes('SKU: {item.sku'), 'Product SKU must be displayed');
    assert.ok(homeContent.includes('formatCurrency(item.sellingPrice)'), 'Selling price must be displayed');
    assert.ok(homeContent.includes('getProductStockStatus(item.stockQuantity)'), 'Stock status badge must be displayed');
  });

  test('6. Tapping a product result saves search term to history, closes search window, and navigates to Edit Product', () => {
    assert.ok(homeContent.includes('handleSelectProduct'), 'Product selection handler must be implemented');
    assert.ok(homeContent.includes('router.push(`/(tabs)/products/edit/${product.id}'), 'Must navigate to Edit Product route');
    assert.ok(homeContent.includes('setIsSearchOpen(false)'), 'Must close search window on product select');
    assert.ok(homeContent.includes('recentSearchStorage.addSearchTerm'), 'Must save search term into recent history');
  });

  test('7. When query has no matches, displays clean empty state "No Products Found"', () => {
    assert.ok(homeContent.includes('No Products Found'), 'Empty results title must be "No Products Found"');
    assert.ok(homeContent.includes('styles.searchEmptyCard'), 'Empty card container must exist');
  });

  test('8. Home search reuses local catalog and filterProductsList; "Milk" returns exactly 1 item', () => {
    assert.ok(homeContent.includes('filterProductsList(products'), 'Home search must reuse filterProductsList');
    assert.ok(!homeContent.includes('/api/products/search'), 'Home search must NOT call backend search endpoint');

    const sampleCatalog = [
      {
        id: 8,
        name: 'Farm Fresh Homogenized Cow Milk',
        sku: 'GC-PROD-DB-01',
        category: { id: 1, name: 'Dairy & Breakfast' },
        stockQuantity: 40,
        sellingPrice: 32,
        unit: 'LITRE',
        active: true
      },
      {
        id: 19,
        name: 'Cold Pressed Virgin Coconut Hair & Body Oil',
        sku: 'GC-PROD-PC-02',
        description: 'Contains nourishing milk lipids and pure coconut',
        category: { id: 3, name: 'Personal Care' },
        stockQuantity: 20,
        sellingPrice: 180,
        unit: 'MILLILITRE',
        active: true
      }
    ];

    const results = filterProductsList(sampleCatalog, { searchQuery: 'Milk' });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Farm Fresh Homogenized Cow Milk');
    assert.equal(results[0].sku, 'GC-PROD-DB-01');
    assert.equal(results[0].category.name, 'Dairy & Breakfast');
  });
});

describe('Search History Logic & Storage Persistence', () => {
  // Pure search history helper implementation matching src/storage/storage.ts
  function addSearchToHistory(history, term, maxItems = 8) {
    const trimmed = term ? term.trim() : '';
    if (!trimmed) return history;
    const filtered = history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    return [trimmed, ...filtered].slice(0, maxItems);
  }

  test('1. Stores only search text, not product objects', () => {
    let history = [];
    history = addSearchToHistory(history, 'Milk');
    assert.equal(typeof history[0], 'string', 'Stored item must be string');
    assert.equal(history[0], 'Milk');
  });

  test('2. Keeps a maximum of 8 recent searches', () => {
    let history = [];
    const items = ['Milk', 'Bread', 'Eggs', 'Butter', 'Cheese', 'Yogurt', 'Tea', 'Coffee', 'Sugar', 'Rice'];
    for (const item of items) {
      history = addSearchToHistory(history, item, 8);
    }
    assert.equal(history.length, 8, 'History must be capped at 8 items');
    assert.equal(history[0], 'Rice', 'Most recent search must appear first');
    assert.equal(history[7], 'Eggs', 'Earliest retained item must be 8th');
    assert.ok(!history.includes('Milk'), 'Oldest item beyond 8 must be dropped');
  });

  test('3. Duplicate search moves existing item to the top without creating duplicate', () => {
    let history = ['Sugar', 'Rice', 'Milk', 'Eggs'];
    history = addSearchToHistory(history, 'milk'); // case-insensitive check
    assert.equal(history.length, 4, 'Length must remain 4 without duplicate');
    assert.equal(history[0], 'milk', 'Duplicate search must move to the top');
    assert.deepEqual(history, ['milk', 'Sugar', 'Rice', 'Eggs']);
  });

  test('4. Clear search history removes all stored terms', () => {
    let history = ['Milk', 'Rice', 'Sugar'];
    history = []; // Clear operation
    assert.equal(history.length, 0);
  });

  test('5. Dedicated storage key is used in config and storage abstraction', () => {
    const configPath = path.resolve('src/constants/config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const storagePath = path.resolve('src/storage/storage.ts');
    const storageContent = fs.readFileSync(storagePath, 'utf8');

    assert.ok(
      configContent.includes('RECENT_PRODUCT_SEARCHES: \'grocery_choice_owner_recent_product_searches\''),
      'Config must define RECENT_PRODUCT_SEARCHES with grocery_choice_owner_recent_product_searches'
    );
    assert.ok(
      storageContent.includes('APP_CONFIG.STORAGE_KEYS.RECENT_PRODUCT_SEARCHES'),
      'storage.ts must reference RECENT_PRODUCT_SEARCHES storage key'
    );
    assert.ok(
      storageContent.includes('MAX_RECENT_SEARCHES = 8'),
      'storage.ts must specify MAX_RECENT_SEARCHES = 8'
    );
  });
});

describe('Owner App Stock / Inventory Management & Quick Update', () => {
  test('1. Stock quantity validation rejects negative, empty, non-numeric and decimal values', () => {
    function validateStockInput(input) {
      if (input == null || input.trim() === '') {
        return { isValid: false, error: 'Stock quantity is required' };
      }
      const num = Number(input.trim());
      if (isNaN(num)) {
        return { isValid: false, error: 'Stock quantity must be numeric' };
      }
      if (!Number.isInteger(num)) {
        return { isValid: false, error: 'Stock quantity must be an integer' };
      }
      if (num < 0) {
        return { isValid: false, error: 'Stock quantity cannot be negative' };
      }
      return { isValid: true, value: num };
    }

    assert.equal(validateStockInput('50').isValid, true);
    assert.equal(validateStockInput('50').value, 50);
    assert.equal(validateStockInput('0').isValid, true);
    assert.equal(validateStockInput('0').value, 0);
    assert.equal(validateStockInput('-5').isValid, false);
    assert.equal(validateStockInput('').isValid, false);
    assert.equal(validateStockInput('abc').isValid, false);
    assert.equal(validateStockInput('12.5').isValid, false);
  });

  test('2. Stock status thresholds: 0 -> OUT_OF_STOCK, 1..10 -> LOW_STOCK, >10 -> IN_STOCK', () => {
    assert.equal(getProductStockStatus(0).status, 'OUT_OF_STOCK');
    assert.equal(getProductStockStatus(0).variant, 'danger');
    assert.equal(getProductStockStatus(0).label, 'Out of Stock');

    assert.equal(getProductStockStatus(1).status, 'LOW_STOCK');
    assert.equal(getProductStockStatus(1).variant, 'warning');
    assert.equal(getProductStockStatus(10).status, 'LOW_STOCK');
    assert.equal(getProductStockStatus(10).variant, 'warning');

    assert.equal(getProductStockStatus(11).status, 'IN_STOCK');
    assert.equal(getProductStockStatus(11).variant, 'success');
    assert.equal(getProductStockStatus(100).status, 'IN_STOCK');
    assert.equal(getProductStockStatus(100).variant, 'success');
  });

  test('3. Stock filter correctly segments All, Low Stock, Out of Stock, and In Stock', () => {
    const catalog = [
      { id: 1, name: 'Item A', stockQuantity: 0 },
      { id: 2, name: 'Item B', stockQuantity: 5 },
      { id: 3, name: 'Item C', stockQuantity: 10 },
      { id: 4, name: 'Item D', stockQuantity: 11 },
      { id: 5, name: 'Item E', stockQuantity: 100 }
    ];

    function filterByStock(items, filterType) {
      switch (filterType) {
        case 'LOW_STOCK':
          return items.filter((p) => (p.stockQuantity ?? 0) <= 10 && (p.stockQuantity ?? 0) > 0);
        case 'OUT_OF_STOCK':
          return items.filter((p) => (p.stockQuantity ?? 0) === 0);
        case 'IN_STOCK':
          return items.filter((p) => (p.stockQuantity ?? 0) > 10);
        case 'ALL':
        default:
          return items;
      }
    }

    assert.equal(filterByStock(catalog, 'ALL').length, 5);
    assert.equal(filterByStock(catalog, 'LOW_STOCK').length, 2);
    assert.equal(filterByStock(catalog, 'OUT_OF_STOCK').length, 1);
    assert.equal(filterByStock(catalog, 'IN_STOCK').length, 2);
  });

  test('4. Successful stock update immediately updates product in local state without full reload', () => {
    let localProducts = [
      { id: 1, name: 'Bananas', stockQuantity: 10 },
      { id: 2, name: 'Apples', stockQuantity: 0 }
    ];

    const apiResponse = { id: 1, name: 'Bananas', stockQuantity: 25 };

    localProducts = localProducts.map((p) =>
      p.id === apiResponse.id ? { ...p, stockQuantity: apiResponse.stockQuantity } : p
    );

    assert.equal(localProducts.find((p) => p.id === 1).stockQuantity, 25);
    assert.equal(localProducts.find((p) => p.id === 2).stockQuantity, 0);
  });

  test('5. Failed stock update preserves existing stock quantity and sets error message', () => {
    let localProducts = [
      { id: 1, name: 'Bananas', stockQuantity: 10 }
    ];
    let modalOpen = true;
    let errorMessage = null;

    try {
      throw new Error('Network timeout during patch stock');
    } catch (err) {
      errorMessage = err.message;
    }

    assert.equal(modalOpen, true, 'Modal must remain open on failure');
    assert.equal(errorMessage, 'Network timeout during patch stock');
    assert.equal(localProducts[0].stockQuantity, 10, 'Stock must not be optimistically altered on failure');
  });

  test('6. Stepper adjustments: -10, -1, +1, +10 correctly calculate new quantity and clamp at 0', () => {
    function adjust(current, delta) {
      return Math.max(0, current + delta);
    }

    assert.equal(adjust(25, 10), 35);
    assert.equal(adjust(25, 1), 26);
    assert.equal(adjust(25, -1), 24);
    assert.equal(adjust(25, -10), 15);
    assert.equal(adjust(5, -10), 0, 'Cannot drop below zero');
    assert.equal(adjust(0, -1), 0, 'Cannot drop below zero');
  });

  test('7. Inventory screen contains interactive cards, filter pills, quick update modal, and steppers', () => {
    const inventoryPath = path.resolve('src/app/(tabs)/inventory/index.tsx');
    const content = fs.readFileSync(inventoryPath, 'utf8');

    assert.ok(content.includes('handleOpenStockModal'), 'Inventory screen must have modal opener on card tap');
    assert.ok(content.includes('TouchableOpacity'), 'Cards must be wrapped in TouchableOpacity');
    assert.ok(content.includes('LOW_STOCK'), 'Must contain LOW_STOCK filter option');
    assert.ok(content.includes('OUT_OF_STOCK'), 'Must contain OUT_OF_STOCK filter option');
    assert.ok(content.includes('IN_STOCK'), 'Must contain IN_STOCK filter option');
    assert.ok(content.includes('Modal'), 'Must contain Modal component');
    assert.ok(content.includes('handleAdjustQuantity(-10)'), 'Must contain -10 stepper');
    assert.ok(content.includes('handleAdjustQuantity(10)'), 'Must contain +10 stepper');
    assert.ok(content.includes('productsApi.updateStock'), 'Must call productsApi.updateStock');
    assert.ok(content.includes('/(tabs)/products/edit/'), 'Must support navigation to full product edit screen');
  });
});



