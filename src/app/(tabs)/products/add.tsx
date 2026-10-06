/**
 * Grocery Choice Owner App - Add Product Screen
 * Validates and submits new products to POST /api/products.
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
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/common/Badge';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { categoriesApi } from '@/api/categoriesApi';
import { productsApi } from '@/api/productsApi';
import { Category, ProductUnit } from '@/types';
import {
  validateProductForm,
  ProductFormErrors,
  VALID_PRODUCT_UNITS
} from '@/utils/productValidation';
import { APP_CONFIG, PRODUCT_UNITS } from '@/constants/config';

export default function AddProductScreen() {
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // Role check: Only OWNER & ADMIN allowed
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

  // Categories list from backend
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

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

  // UI state
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setCategoriesError(null);
      try {
        const data = await categoriesApi.getAll();
        setCategories(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0 && !categoryId) {
          setCategoryId(data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load categories for selector:', err);
        setCategoriesError('Failed to load categories. Please check your connection.');
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedUnitObj = PRODUCT_UNITS.find((u) => u.value === unit);

  // Form submission
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
        'Please check the highlighted fields and correct the errors before submitting.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await productsApi.createProduct(validation.sanitizedPayload);
      setIsSubmitting(false);

      Alert.alert('Product Created', `"${validation.sanitizedPayload.name}" was added to the store catalog.`, [
        {
          text: 'OK',
          onPress: handleBack
        }
      ]);
    } catch (err: any) {
      setIsSubmitting(false);
      console.error('Product creation failed:', err);
      const msg = err?.message || 'Failed to create product. Please verify fields and unique SKU.';
      setSubmitError(msg);
      Alert.alert('Creation Failed', msg);
    }
  };

  // Render Access Denied for Staff
  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Add Product"
          leftAction={{ icon: '←', onPress: handleBack }}
        />
        <View style={styles.unauthorizedContainer}>
          <Card style={styles.unauthorizedCard}>
            <Text style={styles.unauthorizedIcon}>🔒</Text>
            <Text style={styles.unauthorizedTitle}>Access Restricted</Text>
            <Text style={styles.unauthorizedDesc}>
              Store staff accounts have read-only catalog access. Only Store Owners and Administrators can create new products.
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Add Product"
        subtitle="Create catalog entry"
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
            <Text style={styles.sectionHeader}>Product Information</Text>

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
              hint="Unique stock keeping unit identifier"
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
              label="Initial Stock Quantity *"
              placeholder="e.g. 50"
              value={stockQuantity}
              keyboardType="number-pad"
              onChangeText={(text) => {
                setStockQuantity(text);
                if (errors.stockQuantity)
                  setErrors((prev) => ({ ...prev, stockQuantity: undefined }));
              }}
              error={errors.stockQuantity}
              hint="Units available immediately for order fulfillment"
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
                    ? 'Visible to customers and ready for purchasing'
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

            {/* Submit Button */}
            <Button
              title="Save Product to Catalog"
              onPress={handleSubmit}
              loading={isSubmitting}
              style={styles.submitBtn}
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

            {loadingCategories ? (
              <LoadingIndicator message="Loading categories..." />
            ) : categoriesError ? (
              <View style={styles.pickerErrorBox}>
                <Text style={styles.pickerErrorText}>{categoriesError}</Text>
              </View>
            ) : (
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
            )}
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
  },
  pickerErrorBox: {
    padding: spacing.lg,
    alignItems: 'center'
  },
  pickerErrorText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '600'
  }
});
