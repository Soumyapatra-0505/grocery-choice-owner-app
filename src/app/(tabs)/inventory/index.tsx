/**
 * Grocery Choice Owner App - Stock & Inventory Management
 * Provides live catalog stock overview, status filtering (All, Low Stock,
 * Out of Stock, In Stock), interactive stock cards, quick stock update modal
 * with steppers & numeric input, and seamless full product editing navigation.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/theme';
import { productsApi } from '@/api/productsApi';
import { Product } from '@/types';
import { getProductStockStatus } from '@/utils/productValidation';

export type StockFilterType = 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK';

export default function InventoryScreen() {
  const router = useRouter();

  // Catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StockFilterType>('ALL');

  // Quick Stock Update Modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [draftQuantity, setDraftQuantity] = useState<string>('0');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchStock = useCallback(async () => {
    try {
      const data = await productsApi.getAll();
      setProducts(data || []);
    } catch (e) {
      console.warn('Failed to load inventory', e);
    }
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStock();
    setRefreshing(false);
  };

  // Stock status counts
  const { lowStockCount, outOfStockCount, inStockCount, attentionCount } = useMemo(() => {
    let low = 0;
    let out = 0;
    let inStock = 0;

    for (const p of products) {
      const qty = p.stockQuantity ?? 0;
      if (qty === 0) {
        out++;
      } else if (qty <= 10) {
        low++;
      } else {
        inStock++;
      }
    }

    return {
      lowStockCount: low,
      outOfStockCount: out,
      inStockCount: inStock,
      attentionCount: low + out
    };
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    switch (activeFilter) {
      case 'LOW_STOCK':
        return products.filter((p) => (p.stockQuantity ?? 0) <= 10 && (p.stockQuantity ?? 0) > 0);
      case 'OUT_OF_STOCK':
        return products.filter((p) => (p.stockQuantity ?? 0) === 0);
      case 'IN_STOCK':
        return products.filter((p) => (p.stockQuantity ?? 0) > 10);
      case 'ALL':
      default:
        return products;
    }
  }, [products, activeFilter]);

  // Open Quick Stock Modal
  const handleOpenStockModal = (product: Product) => {
    setSelectedProduct(product);
    setDraftQuantity(String(product.stockQuantity ?? 0));
    setUpdateError(null);
  };

  // Close Quick Stock Modal
  const handleCloseStockModal = () => {
    if (isUpdating) return;
    setSelectedProduct(null);
    setUpdateError(null);
  };

  // Stepper quantity adjustment (-10, -1, +1, +10)
  const handleAdjustQuantity = (delta: number) => {
    const parsed = parseInt(draftQuantity, 10);
    const base = isNaN(parsed) ? (selectedProduct?.stockQuantity ?? 0) : parsed;
    const next = Math.max(0, base + delta);
    setDraftQuantity(String(next));
    if (updateError) setUpdateError(null);
  };

  // Handle direct text input
  const handleQuantityTextChange = (text: string) => {
    const cleanDigits = text.replace(/[^0-9]/g, '');
    setDraftQuantity(cleanDigits);
    if (updateError) setUpdateError(null);
  };

  // Live stock preview
  const liveQuantityNumber = useMemo(() => {
    const trimmed = draftQuantity.trim();
    if (!trimmed) return 0;
    const parsed = parseInt(trimmed, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [draftQuantity]);

  const liveStockStatus = useMemo(() => {
    return getProductStockStatus(liveQuantityNumber);
  }, [liveQuantityNumber]);

  // Submit stock update via productsApi.updateStock()
  const handleSaveStock = async () => {
    if (!selectedProduct) return;

    const trimmed = draftQuantity.trim();
    if (trimmed === '') {
      setUpdateError('Stock quantity is required');
      return;
    }

    const qty = parseInt(trimmed, 10);
    if (isNaN(qty) || qty < 0) {
      setUpdateError('Stock quantity must be a non-negative integer (0 or greater)');
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const updatedProduct = await productsApi.updateStock(selectedProduct.id, qty);

      // 1. Immediately update local state with response
      setProducts((prev) =>
        prev.map((p) =>
          p.id === updatedProduct.id ? { ...p, stockQuantity: updatedProduct.stockQuantity } : p
        )
      );

      // 2. Close modal
      setSelectedProduct(null);

      // 3. Success confirmation
      Alert.alert(
        'Stock Updated',
        `"${updatedProduct.name}" stock updated to ${updatedProduct.stockQuantity} ${updatedProduct.unit || ''}.`
      );
    } catch (err: any) {
      console.error('Failed to update stock:', err);
      const msg = err?.message || 'Failed to update stock on store server. Please try again.';
      setUpdateError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // Navigate to full product editor
  const handleNavigateToEdit = () => {
    if (!selectedProduct) return;
    const prodId = selectedProduct.id;
    setSelectedProduct(null);
    router.push(`/(tabs)/products/edit/${prodId}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Stock & Inventory"
        subtitle={`${attentionCount} ${attentionCount === 1 ? 'item' : 'items'} needing attention`}
      />

      {/* Stock Status Filter Bar */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveFilter('ALL')}
            style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
          >
            <Text
              style={[styles.filterPillText, activeFilter === 'ALL' && styles.filterPillTextActive]}
            >
              All ({products.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveFilter('LOW_STOCK')}
            style={[styles.filterPill, activeFilter === 'LOW_STOCK' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'LOW_STOCK' && styles.filterPillTextActive
              ]}
            >
              Low Stock ({lowStockCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveFilter('OUT_OF_STOCK')}
            style={[styles.filterPill, activeFilter === 'OUT_OF_STOCK' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'OUT_OF_STOCK' && styles.filterPillTextActive
              ]}
            >
              Out of Stock ({outOfStockCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveFilter('IN_STOCK')}
            style={[styles.filterPill, activeFilter === 'IN_STOCK' && styles.filterPillActive]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'IN_STOCK' && styles.filterPillTextActive
              ]}
            >
              In Stock ({inStockCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Products Stock List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏬</Text>
            <Text style={styles.emptyTitle}>No Products Found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'ALL'
                ? 'No catalog items found.'
                : `No items matching "${activeFilter.replace('_', ' ')}"`}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const stockStatus = getProductStockStatus(item.stockQuantity);
          return (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => handleOpenStockModal(item)}
              style={styles.cardTouchWrapper}
            >
              <Card style={styles.stockCard}>
                <View style={styles.stockRow}>
                  <View style={styles.stockInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.skuText}>SKU: {item.sku || 'N/A'}</Text>
                    <Text style={styles.tapHint}>Tap to update stock</Text>
                  </View>

                  <View style={styles.stockBadgeWrapper}>
                    <Text
                      style={[
                        styles.stockCount,
                        item.stockQuantity === 0 && styles.outOfStockText
                      ]}
                    >
                      {item.stockQuantity} {item.unit}
                    </Text>
                    <Badge label={stockStatus.label} variant={stockStatus.variant} />
                    <View style={styles.editActionBadge}>
                      <Text style={styles.editActionText}>✏️ Edit</Text>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      {/* Quick Update Stock Modal */}
      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="slide"
        onRequestClose={handleCloseStockModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleCloseStockModal}
            />
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalHeaderTitle}>Update Stock</Text>
                  <Text style={styles.modalHeaderSubtitle}>Quick inventory adjustment</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseStockModal}
                  style={styles.modalCloseButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <ScrollView contentContainerStyle={styles.modalContentScroll}>
                  {/* Product Overview Card */}
                  <View style={styles.productMetaCard}>
                    <Text style={styles.modalProductName} numberOfLines={2}>
                      {selectedProduct.name}
                    </Text>
                    <View style={styles.productMetaRow}>
                      <Text style={styles.productMetaTag}>
                        SKU: <Text style={styles.productMetaVal}>{selectedProduct.sku || 'N/A'}</Text>
                      </Text>
                      <Text style={styles.productMetaTag}>
                        Unit: <Text style={styles.productMetaVal}>{selectedProduct.unit}</Text>
                      </Text>
                    </View>
                    <View style={styles.currentStockRow}>
                      <Text style={styles.currentStockLabel}>Current Stock:</Text>
                      <Text style={styles.currentStockValue}>
                        {selectedProduct.stockQuantity} {selectedProduct.unit}
                      </Text>
                    </View>
                  </View>

                  {/* Error Banner */}
                  {updateError && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{updateError}</Text>
                    </View>
                  )}

                  {/* Quantity Control Section */}
                  <View style={styles.quantitySection}>
                    <View style={styles.quantityHeaderRow}>
                      <Text style={styles.sectionLabel}>New Quantity ({selectedProduct.unit})</Text>
                      <Badge label={liveStockStatus.label} variant={liveStockStatus.variant} />
                    </View>

                    {/* Numeric Input */}
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.quantityInput}
                        value={draftQuantity}
                        onChangeText={handleQuantityTextChange}
                        keyboardType="number-pad"
                        placeholder="0"
                        maxLength={7}
                        selectTextOnFocus
                      />
                      <Text style={styles.unitSuffixText}>{selectedProduct.unit}</Text>
                    </View>

                    {/* Stepper Buttons: -10, -1, +1, +10 */}
                    <View style={styles.steppersGrid}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleAdjustQuantity(-10)}
                        style={styles.stepperButton}
                      >
                        <Text style={styles.stepperButtonText}>-10</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleAdjustQuantity(-1)}
                        style={styles.stepperButton}
                      >
                        <Text style={styles.stepperButtonText}>-1</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleAdjustQuantity(1)}
                        style={[styles.stepperButton, styles.stepperButtonPlus]}
                      >
                        <Text style={[styles.stepperButtonText, styles.stepperButtonPlusText]}>
                          +1
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleAdjustQuantity(10)}
                        style={[styles.stepperButton, styles.stepperButtonPlus]}
                      >
                        <Text style={[styles.stepperButtonText, styles.stepperButtonPlusText]}>
                          +10
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.modalActions}>
                    <Button
                      title="Update Stock"
                      onPress={handleSaveStock}
                      loading={isUpdating}
                      style={styles.saveStockBtn}
                    />

                    <Button
                      title="Edit Full Product Details →"
                      variant="outline"
                      onPress={handleNavigateToEdit}
                      disabled={isUpdating}
                      style={styles.editProductBtn}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  filterContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.sm
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  filterPillTextActive: {
    color: colors.surface,
    fontWeight: '800'
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl
  },
  cardTouchWrapper: {
    marginBottom: spacing.sm
  },
  stockCard: {
    padding: spacing.md,
    borderRadius: 12
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  stockInfo: {
    flex: 1,
    marginRight: spacing.md
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2
  },
  skuText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4
  },
  tapHint: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600'
  },
  stockBadgeWrapper: {
    alignItems: 'flex-end',
    gap: 4
  },
  stockCount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary
  },
  outOfStockText: {
    color: colors.danger
  },
  editActionBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceSecondary
  },
  editActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.xs
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted
  },
  // Modal styles
  modalOverlay: {
    flex: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: spacing.xl
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  modalTitleContainer: {
    flex: 1
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1
  },
  modalCloseButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm
  },
  modalCloseButtonText: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '700'
  },
  modalContentScroll: {
    padding: spacing.lg
  },
  productMetaCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6
  },
  productMetaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: 6
  },
  productMetaTag: {
    fontSize: 12,
    color: colors.textMuted
  },
  productMetaVal: {
    fontWeight: '700',
    color: colors.textSecondary
  },
  currentStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 6,
    marginTop: 2
  },
  currentStockLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 6
  },
  currentStockValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dangerText
  },
  quantitySection: {
    marginBottom: spacing.lg
  },
  quantityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md
  },
  quantityInput: {
    flex: 1,
    height: 52,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary
  },
  unitSuffixText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: spacing.sm
  },
  steppersGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  stepperButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  stepperButtonPlus: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  stepperButtonPlusText: {
    color: colors.primaryDark
  },
  modalActions: {
    gap: spacing.sm
  },
  saveStockBtn: {
    height: 48
  },
  editProductBtn: {
    height: 44
  }
});
