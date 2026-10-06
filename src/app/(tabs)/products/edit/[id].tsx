/**
 * Grocery Choice Owner App - Edit Product Screen
 * Loads existing product details via GET /api/products/{id}
 * Saves modifications via PUT /api/products/{id}
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
  BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { categoriesApi } from '@/api/categoriesApi';
import { productsApi } from '@/api/productsApi';
import { Category, Product, ProductUnit } from '@/types';
import {
  validateProductForm,
  ProductFormErrors
} from '@/utils/productValidation';
import { APP_CONFIG, PRODUCT_UNITS } from '@/constants/config';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // Role authorization
  const isAuthorized = owner?.role === 'OWNER' || owner?.role === 'ADMIN';

  // Robust back navigation to Products list
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/products');
    }
  }, [router]);

  // Hardware/system back press handler
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleBack]);

  // Loading & Error states
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Categories list
  const [categories, setCategories] = useState<Category[]>([]);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [unit, setUnit] = useState<ProductUnit>('PIECE');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [active, setActive] = useState(true);

  // Modal pickers
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);

  // Form submission state
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load product and categories
  const loadProductData = useCallback(async () => {
    if (!id) return;
    setInitialLoading(true);
    setLoadError(null);

    try {
      const numId = Number(id);
      const [prod, cats] = await Promise.all([
        productsApi.getProductById(numId),
        categoriesApi.getAll().catch(() => [] as Category[])
      ]);

      if (!prod) {
        setLoadError(`Product #${id} could not be found.`);
        return;
      }

      setCategories(Array.isArray(cats) ? cats : []);

      // Populate form fields
      setName(prod.name || '');
      setDescription(prod.description || '');
      setSku(prod.sku || '');
      setCategoryId(prod.categoryId || prod.category?.id || (cats[0]?.id ?? null));
      setUnit(prod.unit || 'PIECE');
      setMrp(prod.mrp != null ? String(prod.mrp) : '');
      setSellingPrice(prod.sellingPrice != null ? String(prod.sellingPrice) : '');
      setStockQuantity(prod.stockQuantity != null ? String(prod.stockQuantity) : '0');
      setImageUrl(prod.imageUrl || '');
      setActive(prod.active !== false);
    } catch (err: any) {
      console.error(`Failed to load product #${id}:`, err);
      setLoadError(err?.message || `Unable to load product #${id} from store server.`);
    } finally {
      setInitialLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedUnitObj = PRODUCT_UNITS.find((u) => u.value === unit);

  // Save changes
  const handleSubmit = async () => {
    setErrors({});
    setSubmitError(null);

    const validation = validateProductForm({
      name,
      description,
      sku,
      categoryId,
      unit,
      mrp,
      sellingPrice,
      stockQuantity,
      imageUrl,
      active
    });

    if (!validation.isValid || !validation.sanitizedPayload) {
      setErrors(validation.errors);
      Alert.alert(
        'Validation Notice',
        'Please check the highlighted fields and correct the errors before saving.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await productsApi.updateProduct(Number(id), validation.sanitizedPayload);
      setIsSubmitting(false);

      Alert.alert('Changes Saved', `"${validation.sanitizedPayload.name}" was successfully updated.`, [
        {
          text: 'OK',
          onPress: handleBack
        }
      ]);
    } catch (err: any) {
      setIsSubmitting(false);
      console.error('Product update failed:', err);
      const msg = err?.message || 'Failed to update product. Please check your network and fields.';
      setSubmitError(msg);
      Alert.alert('Update Failed', msg);
    }
  };

  // Delete / Deactivate product
  const handleDelete = () => {
    Alert.alert(
      'Deactivate Product',
      `Are you sure you want to deactivate "${name}"?\n\nIt will be removed from customer-facing storefront immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await productsApi.deleteProduct(Number(id));
              setIsDeleting(false);
              Alert.alert('Product Deactivated', `"${name}" was deactivated successfully.`, [
                {
                  text: 'OK',
                  onPress: handleBack
                }
              ]);
            } catch (err: any) {
              setIsDeleting(false);
              Alert.alert('Deactivation Failed', err?.message || 'Could not deactivate product.');
            }
          }
        }
      ]
    );
  };

  // Staff Authorization Guard
  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={`Edit Product #${id}`}
          leftAction={{ icon: '←', onPress: handleBack }}
        />
        <View style={styles.unauthorizedContainer}>
          <Card style={styles.unauthorizedCard}>
            <Text style={styles.unauthorizedIcon}>🔒</Text>
            <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
            <Text style={styles.unauthorizedDesc}>
              Store staff accounts have read-only catalog access. Only Store Owners and Administrators can modify products.
            </Text>
            <Button
              title="Return to Products"
              onPress={handleBack}
              style={styles.unauthorizedBtn}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // Loading Screen
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={`Edit Product #${id}`}
          leftAction={{ icon: '←', onPress: handleBack }}
        />
        <View style={styles.loadingContainer}>
          <LoadingIndicator message={`Loading product #${id}...`} />
        </View>
      </SafeAreaView>
    );
  }

  // Error Screen
  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={`Edit Product #${id}`}
          leftAction={{ icon: '←', onPress: handleBack }}
        />
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Product Unavailable</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <Button
              title="Try Again"
              onPress={loadProductData}
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={`Edit Product #${id}`}
        subtitle={name ? `${name.slice(0, 24)}...` : 'Catalog editor'}
        leftAction={{
          icon: '←',
          onPress: handleBack
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {submitError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          )}

          <Card style={styles.formCard}>
            <Text style={styles.sectionHeader}>Product Details</Text>

            {/* 1. Name */}
            <Input
              label="Product Name *"
              placeholder="e.g. Organic Brown Basmati Rice"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              error={errors.name}
            />

            {/* 2. SKU */}
            <Input
              label="Catalog SKU *"
              placeholder="e.g. RICE-BAS-001"
              value={sku}
              autoCapitalize="characters"
              onChangeText={(text) => {
                setSku(text.toUpperCase());
                if (errors.sku) setErrors((prev) => ({ ...prev, sku: undefined }));
              }}
              error={errors.sku}
              hint="Must be unique across all products"
            />

            {/* 3. Category Selector */}
            <View style={styles.selectorGroup}>
              <Text style={styles.selectorLabel}>Category *</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowCategoryModal(true)}
                style={[
                  styles.selectorButton,
                  !!errors.categoryId && styles.selectorButtonError
                ]}
              >
                <Text
                  style={[
                    styles.selectorButtonText,
                    !selectedCategory && styles.selectorPlaceholderText
                  ]}
                >
                  {selectedCategory ? `📁 ${selectedCategory.name}` : 'Select Category...'}
                </Text>
                <Text style={styles.selectorArrow}>▼</Text>
              </TouchableOpacity>
              {errors.categoryId && (
                <Text style={styles.fieldErrorText}>{errors.categoryId}</Text>
              )}
            </View>

            {/* 4. Unit Selector */}
            <View style={styles.selectorGroup}>
              <Text style={styles.selectorLabel}>Unit of Measurement *</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowUnitModal(true)}
                style={[
                  styles.selectorButton,
                  !!errors.unit && styles.selectorButtonError
                ]}
              >
                <Text style={styles.selectorButtonText}>
                  ⚖️ {selectedUnitObj?.label || unit}
                </Text>
                <Text style={styles.selectorArrow}>▼</Text>
              </TouchableOpacity>
              {errors.unit && <Text style={styles.fieldErrorText}>{errors.unit}</Text>}
            </View>

            {/* 5. Pricing: MRP and Selling Price */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.md }]}>
              Pricing &amp; Inventory
            </Text>

            <View style={styles.twoColumnRow}>
              <View style={styles.columnHalf}>
                <Input
                  label="MRP (₹) *"
                  placeholder="e.g. 150.00"
                  value={mrp}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    setMrp(text);
                    if (errors.mrp) setErrors((prev) => ({ ...prev, mrp: undefined }));
                  }}
                  error={errors.mrp}
                />
              </View>

              <View style={styles.columnHalf}>
                <Input
                  label="Selling Price (₹) *"
                  placeholder="e.g. 129.00"
                  value={sellingPrice}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    setSellingPrice(text);
                    if (errors.sellingPrice)
                      setErrors((prev) => ({ ...prev, sellingPrice: undefined }));
                  }}
                  error={errors.sellingPrice}
                />
              </View>
            </View>

            {/* 6. Stock Quantity */}
            <Input
              label="Stock Quantity *"
              placeholder="e.g. 50"
              value={stockQuantity}
              keyboardType="number-pad"
              onChangeText={(text) => {
                setStockQuantity(text);
                if (errors.stockQuantity)
                  setErrors((prev) => ({ ...prev, stockQuantity: undefined }));
              }}
              error={errors.stockQuantity}
              hint="Units available for order fulfillment"
            />

            {/* 7. Image URL & Live Preview */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.md }]}>
              Media &amp; Merchandising
            </Text>

            <Input
              label="Image Web URL (Optional)"
              placeholder="https://images.unsplash.com/..."
              value={imageUrl}
              onChangeText={setImageUrl}
              autoCapitalize="none"
              error={errors.imageUrl}
              hint="Direct HTTPS link to product photograph"
            />

            {/* Live Image Preview Box */}
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Image Preview</Text>
              <View style={styles.imagePreviewBox}>
                <Image
                  source={{
                    uri: imageUrl.trim() || APP_CONFIG.FALLBACK_PRODUCT_IMAGE
                  }}
                  style={styles.previewImage}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            </View>

            {/* 8. Description */}
            <Input
              label="Detailed Description (Optional)"
              placeholder="Enter comprehensive details, ingredients, brand info, etc."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={styles.multilineInput}
            />

            {/* 9. Active Status Toggle */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Product Active for Sale</Text>
                <Text style={styles.switchSubtitle}>
                  {active
                    ? 'Visible to customers and available in storefront'
                    : 'Hidden from public storefront catalog'}
                </Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: '#cbd5e1', true: colors.primaryLight }}
                thumbColor={active ? colors.primary : '#94a3b8'}
              />
            </View>

            {/* Submit Changes Button */}
            <Button
              title="Save Changes"
              onPress={handleSubmit}
              loading={isSubmitting}
              style={styles.submitBtn}
            />

            {/* Deactivate / Delete Button */}
            <Button
              title="Deactivate Product"
              onPress={handleDelete}
              variant="outline"
              loading={isDeleting}
              textStyle={{ color: colors.dangerText }}
              style={styles.deleteBtn}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.pickerModalClose}
              >
                <Text style={styles.pickerModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.pickerList}>
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCategoryId(cat.id);
                      if (errors.categoryId)
                        setErrors((prev) => ({ ...prev, categoryId: undefined }));
                      setShowCategoryModal(false);
                    }}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSelected
                      ]}
                    >
                      📁 {cat.name}
                    </Text>
                    {isSelected && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Unit Selection Modal */}
      <Modal
        visible={showUnitModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Measurement Unit</Text>
              <TouchableOpacity
                onPress={() => setShowUnitModal(false)}
                style={styles.pickerModalClose}
              >
                <Text style={styles.pickerModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.pickerList}>
              {PRODUCT_UNITS.map((u) => {
                const isSelected = unit === u.value;
                return (
                  <TouchableOpacity
                    key={u.value}
                    activeOpacity={0.7}
                    onPress={() => {
                      setUnit(u.value);
                      if (errors.unit) setErrors((prev) => ({ ...prev, unit: undefined }));
                      setShowUnitModal(false);
                    }}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSelected
                      ]}
                    >
                      ⚖️ {u.label} ({u.value})
                    </Text>
                    {isSelected && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorContainer: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center'
  },
  errorCard: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  errorIcon: {
    fontSize: 36,
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
    textAlign: 'center'
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  errorBannerText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '700'
  },
  formCard: {
    padding: spacing.lg,
    borderRadius: 14
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  selectorGroup: {
    marginBottom: spacing.md
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    minHeight: 48
  },
  selectorButtonError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight
  },
  selectorButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary
  },
  selectorPlaceholderText: {
    color: colors.textMuted
  },
  selectorArrow: {
    fontSize: 12,
    color: colors.textMuted
  },
  fieldErrorText: {
    fontSize: 12,
    color: colors.dangerText,
    marginTop: 4,
    fontWeight: '600'
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  columnHalf: {
    flex: 1
  },
  previewContainer: {
    marginBottom: spacing.md
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6
  },
  imagePreviewBox: {
    height: 140,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg
  },
  switchInfo: {
    flex: 1,
    marginRight: spacing.md
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  switchSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  submitBtn: {
    marginTop: spacing.xs
  },
  deleteBtn: {
    marginTop: spacing.md,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerLight
  },
  unauthorizedContainer: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center'
  },
  unauthorizedCard: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  unauthorizedIcon: {
    fontSize: 40,
    marginBottom: spacing.sm
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  unauthorizedDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 18
  },
  unauthorizedBtn: {
    width: '100%'
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  pickerModalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: spacing.xxl
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary
  },
  pickerModalClose: {
    padding: 6
  },
  pickerModalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700'
  },
  pickerList: {
    padding: spacing.md
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border
  },
  pickerItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  pickerItemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '800'
  },
  pickerCheck: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary
  }
});
