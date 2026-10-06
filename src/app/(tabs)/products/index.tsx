/**
 * Grocery Choice Owner App - Product Catalog Management Screen
 * Complete mobile-first implementation supporting list, search, filters, details, and delete.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { productsApi } from '@/api/productsApi';
import { categoriesApi } from '@/api/categoriesApi';
import { Product, Category } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import {
  getProductStockStatus,
  filterProductsList,
  ProductStatusFilter
} from '@/utils/productValidation';
import { APP_CONFIG } from '@/constants/config';

export default function ProductsListScreen() {
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // Role authorization
  const isOwnerOrAdmin = owner?.role === 'OWNER' || owner?.role === 'ADMIN';

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');

  // Details Modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Success Feedback
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load products and categories from backend
  const loadData = useCallback(async (isPullRefresh = false) => {
    if (!isPullRefresh) setIsLoading(true);
    setFetchError(null);

    try {
      const [prodsData, catsData] = await Promise.all([
        productsApi.getAll().catch((e) => {
          console.warn('Failed to fetch products:', e?.message);
          return [] as Product[];
        }),
        categoriesApi.getAll().catch((e) => {
          console.warn('Failed to fetch categories:', e?.message);
          return [] as Category[];
        })
      ]);

      setProducts(Array.isArray(prodsData) ? prodsData : []);
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (err: any) {
      console.error('Error loading product catalog:', err);
      setFetchError(err?.message || 'Failed to connect to store server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData(true);
  };

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => {
      setSuccessBanner(null);
    }, 4000);
  };

  // Delete product action with confirmation dialog
  const handleDeleteProduct = (product: Product) => {
    if (!isOwnerOrAdmin) {
      Alert.alert('Unauthorized', 'Only store owners and administrators can deactivate products.');
      return;
    }

    Alert.alert(
      'Deactivate Product',
      `Are you sure you want to deactivate "${product.name}"?\n\nThis will remove it from the customer store catalog.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await productsApi.deleteProduct(product.id);
              setIsDeleting(false);
              setSelectedProduct(null);
              showSuccess(`"${product.name}" was deactivated successfully.`);
              await loadData(true);
            } catch (err: any) {
              setIsDeleting(false);
              Alert.alert('Deactivation Failed', err?.message || 'Could not deactivate product.');
            }
          }
        }
      ]
    );
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return filterProductsList(products, {
      statusFilter,
      categoryId: selectedCategoryId,
      searchQuery: debouncedQuery
    });
  }, [products, statusFilter, selectedCategoryId, debouncedQuery]);

  // Status Filter Pills
  const statusFilterTabs: { label: string; value: ProductStatusFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
    { label: 'Low Stock', value: 'LOW_STOCK' },
    { label: 'Out of Stock', value: 'OUT_OF_STOCK' }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Screen Header */}
      <Header
        title="Store Products"
        subtitle={`${filteredProducts.length} of ${products.length} catalog items`}
        rightAction={
          isOwnerOrAdmin ? (
            <Button
              title="+ Add Product"
              onPress={() => router.push('/(tabs)/products/add')}
              size="sm"
            />
          ) : undefined
        }
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>✓ {successBanner}</Text>
        </View>
      )}

      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <Input
          placeholder="Search products by name, SKU, or category..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.searchInputContainer}
          leftIcon={<Text style={styles.searchIcon}>🔍</Text>}
          rightIcon={
            searchQuery ? (
              <Text style={styles.clearBtnText}>✕</Text>
            ) : undefined
          }
          onRightIconPress={() => setSearchQuery('')}
        />
      </View>

      {/* Filter Horizontal Bars */}
      <View style={styles.filtersWrapper}>
        {/* 1. Status Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {statusFilterTabs.map((tab) => {
            const isSelected = statusFilter === tab.value;
            return (
              <TouchableOpacity
                key={tab.value}
                activeOpacity={0.75}
                onPress={() => setStatusFilter(tab.value)}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2. Category Filter Pills */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsRow}
          >
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setSelectedCategoryId('ALL')}
              style={[
                styles.categoryPill,
                selectedCategoryId === 'ALL' && styles.categoryPillActive
              ]}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategoryId === 'ALL' && styles.categoryPillTextActive
                ]}
              >
                All Categories
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.75}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && styles.categoryPillTextActive
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Main Content Area */}
      {isLoading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <LoadingIndicator message="Loading product catalog..." />
        </View>
      ) : fetchError && products.length === 0 ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Unable to Load Products</Text>
            <Text style={styles.errorMessage}>{fetchError}</Text>
            <Button
              title="Retry Connection"
              onPress={() => loadData()}
              size="sm"
              style={styles.retryButton}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery || statusFilter !== 'ALL' || selectedCategoryId !== 'ALL'
                  ? 'No Products Found'
                  : 'Product Catalog Empty'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== 'ALL' || selectedCategoryId !== 'ALL'
                  ? 'Try adjusting your search query or reset your filters.'
                  : 'Start adding items to your store catalog.'}
              </Text>

              {searchQuery || statusFilter !== 'ALL' || selectedCategoryId !== 'ALL' ? (
                <Button
                  title="Clear All Filters"
                  onPress={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSelectedCategoryId('ALL');
                  }}
                  variant="outline"
                  size="sm"
                  style={styles.emptyButton}
                />
              ) : isOwnerOrAdmin ? (
                <Button
                  title="+ Add First Product"
                  onPress={() => router.push('/(tabs)/products/add')}
                  size="sm"
                  style={styles.emptyButton}
                />
              ) : null}
            </Card>
          }
          renderItem={({ item }) => {
            const stockInfo = getProductStockStatus(item.stockQuantity);
            const hasDiscount = item.mrp > item.sellingPrice;
            const discountPct = hasDiscount
              ? Math.round(((item.mrp - item.sellingPrice) / item.mrp) * 100)
              : 0;

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setSelectedProduct(item)}
              >
                <Card style={styles.productCard}>
                  <View style={styles.cardMainRow}>
                    {/* Product Image Thumbnail */}
                    <View style={styles.imageWrapper}>
                      <Image
                        source={{
                          uri: item.imageUrl || APP_CONFIG.FALLBACK_PRODUCT_IMAGE
                        }}
                        style={styles.thumbnailImage}
                        contentFit="cover"
                        transition={200}
                      />
                      {!item.active && (
                        <View style={styles.inactiveBadgeOverlay}>
                          <Text style={styles.inactiveOverlayText}>Inactive</Text>
                        </View>
                      )}
                    </View>

                    {/* Product Info */}
                    <View style={styles.cardDetails}>
                      <View style={styles.titleRow}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </View>

                      <Text style={styles.categoryAndSku}>
                        {item.category?.name || 'General'} • SKU: {item.sku || 'N/A'} • {item.unit}
                      </Text>

                      {/* Pricing Row */}
                      <View style={styles.priceRow}>
                        <Text style={styles.sellingPrice}>
                          {formatCurrency(item.sellingPrice)}
                        </Text>
                        {hasDiscount && (
                          <>
                            <Text style={styles.mrpText}>{formatCurrency(item.mrp)}</Text>
                            <Badge
                              label={`${discountPct}% off`}
                              variant="success"
                              style={styles.discountBadge}
                            />
                          </>
                        )}
                      </View>

                      {/* Stock & Status Badges */}
                      <View style={styles.badgesRow}>
                        <Badge label={stockInfo.label} variant={stockInfo.variant} />
                        {item.active === false ? (
                          <Badge label="Inactive" variant="default" style={styles.statusBadge} />
                        ) : (
                          <Badge label="Active" variant="success" style={styles.statusBadge} />
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Card Action Row (Owner & Admin actions) */}
                  {isOwnerOrAdmin && (
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        onPress={() => router.push(`/(tabs)/products/edit/${item.id}` as any)}
                        style={styles.editActionBtn}
                      >
                        <Text style={styles.editActionText}>✏️ Edit Product</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteProduct(item)}
                        style={styles.deleteActionBtn}
                      >
                        <Text style={styles.deleteActionText}>🗑️ Deactivate</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Product Details Modal Sheet */}
      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product Specifications</Text>
              <TouchableOpacity
                onPress={() => setSelectedProduct(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Large Product Image */}
                <View style={styles.modalImageWrapper}>
                  <Image
                    source={{
                      uri: selectedProduct.imageUrl || APP_CONFIG.FALLBACK_PRODUCT_IMAGE
                    }}
                    style={styles.modalImage}
                    contentFit="contain"
                    transition={200}
                  />
                </View>

                {/* Status Badges */}
                <View style={styles.modalBadgesRow}>
                  <Badge
                    label={getProductStockStatus(selectedProduct.stockQuantity).label}
                    variant={getProductStockStatus(selectedProduct.stockQuantity).variant}
                  />
                  <Badge
                    label={selectedProduct.active !== false ? 'Active' : 'Inactive'}
                    variant={selectedProduct.active !== false ? 'success' : 'default'}
                    style={{ marginLeft: 8 }}
                  />
                </View>

                {/* Name & Category */}
                <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                <Text style={styles.modalCategoryText}>
                  📁 {selectedProduct.category?.name || 'General Category'}
                </Text>

                {/* Financial Summary */}
                <Card style={styles.financialCard}>
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>Selling Price:</Text>
                    <Text style={styles.finValuePrimary}>
                      {formatCurrency(selectedProduct.sellingPrice)}
                    </Text>
                  </View>
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>Maximum Retail Price (MRP):</Text>
                    <Text style={styles.finValue}>{formatCurrency(selectedProduct.mrp)}</Text>
                  </View>
                  {selectedProduct.mrp > selectedProduct.sellingPrice && (
                    <View style={styles.finRow}>
                      <Text style={styles.finLabel}>Customer Savings:</Text>
                      <Text style={styles.finSavings}>
                        {formatCurrency(selectedProduct.mrp - selectedProduct.sellingPrice)} (
                        {Math.round(
                          ((selectedProduct.mrp - selectedProduct.sellingPrice) /
                            selectedProduct.mrp) *
                            100
                        )}
                        % off)
                      </Text>
                    </View>
                  )}
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>Inventory On Hand:</Text>
                    <Text style={styles.finValue}>
                      {selectedProduct.stockQuantity} {selectedProduct.unit.toLowerCase()}
                    </Text>
                  </View>
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>Catalog SKU:</Text>
                    <Text style={styles.finValue}>{selectedProduct.sku || 'N/A'}</Text>
                  </View>
                  <View style={styles.finRow}>
                    <Text style={styles.finLabel}>Unit of Sale:</Text>
                    <Text style={styles.finValue}>{selectedProduct.unit}</Text>
                  </View>
                  {selectedProduct.updatedAt && (
                    <View style={styles.finRow}>
                      <Text style={styles.finLabel}>Last Updated:</Text>
                      <Text style={styles.finValue}>{formatDateTime(selectedProduct.updatedAt)}</Text>
                    </View>
                  )}
                </Card>

                {/* Description */}
                <Text style={styles.descTitle}>Description</Text>
                <Text style={styles.descBody}>
                  {selectedProduct.description || 'No detailed product description provided.'}
                </Text>

                {/* Action Buttons for Authorized Roles */}
                {isOwnerOrAdmin && (
                  <View style={styles.modalActionButtons}>
                    <Button
                      title="Edit Product Details"
                      onPress={() => {
                        const targetId = selectedProduct.id;
                        setSelectedProduct(null);
                        router.push(`/(tabs)/products/edit/${targetId}` as any);
                      }}
                      style={styles.modalEditBtn}
                    />

                    <Button
                      title="Deactivate Product"
                      onPress={() => handleDeleteProduct(selectedProduct)}
                      variant="outline"
                      textStyle={{ color: colors.dangerText }}
                      style={styles.modalDeleteBtn}
                    />
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  successBanner: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.successBorder
  },
  successBannerText: {
    color: colors.successText,
    fontSize: 13,
    fontWeight: '700'
  },
  searchBarContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background
  },
  searchInputContainer: {
    marginBottom: 0
  },
  searchIcon: {
    fontSize: 16
  },
  clearBtn: {
    padding: 4
  },
  clearBtnText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700'
  },
  filtersWrapper: {
    paddingVertical: spacing.xs
  },
  filterPillsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    gap: spacing.xs
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    marginRight: 6
  },
  filterPillActive: {
    backgroundColor: colors.primary
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary
  },
  filterPillTextActive: {
    color: colors.textInverse,
    fontWeight: '800'
  },
  categoryPillsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    gap: spacing.xs
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6
  },
  categoryPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary
  },
  categoryPillTextActive: {
    color: colors.primaryDark,
    fontWeight: '800'
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  productCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12
  },
  cardMainRow: {
    flexDirection: 'row'
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    marginRight: spacing.md,
    position: 'relative'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  },
  inactiveBadgeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 2,
    alignItems: 'center'
  },
  inactiveOverlayText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800'
  },
  cardDetails: {
    flex: 1,
    justifyContent: 'space-between'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 18,
    flex: 1
  },
  categoryAndSku: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4
  },
  sellingPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 6
  },
  mrpText: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginRight: 6
  },
  discountBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  statusBadge: {
    marginLeft: 6
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm
  },
  editActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 6
  },
  editActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark
  },
  deleteActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.dangerLight,
    borderRadius: 6
  },
  deleteActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    padding: spacing.lg
  },
  errorCard: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: spacing.xs
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4
  },
  errorMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md
  },
  retryButton: {
    minWidth: 140
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: spacing.xs
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md
  },
  emptyButton: {
    marginTop: spacing.xs
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: spacing.xxl
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary
  },
  modalCloseBtn: {
    padding: 6
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700'
  },
  modalScroll: {
    padding: spacing.lg
  },
  modalImageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  modalImage: {
    width: '100%',
    height: '100%'
  },
  modalBadgesRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.xs
  },
  modalProductName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4
  },
  modalCategoryText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md
  },
  financialCard: {
    padding: spacing.md,
    marginBottom: spacing.md
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  finLabel: {
    fontSize: 13,
    color: colors.textSecondary
  },
  finValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  finValuePrimary: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary
  },
  finSavings: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.successText
  },
  descTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4
  },
  descBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.lg
  },
  modalActionButtons: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  modalEditBtn: {
    marginBottom: 4
  },
  modalDeleteBtn: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerLight
  }
});
