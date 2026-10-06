/**
 * Grocery Choice Owner App - Category Management Screen
 * Complete CRUD for store categories: list, add, edit, soft-delete.
 * Enforces role-based permissions: OWNER & ADMIN have full CRUD; STAFF is read-only.
 * Hidden sub-route under (tabs), preserving the 5 core bottom tabs and safe back navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
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
import { Category } from '@/types';
import { APP_CONFIG } from '@/constants/config';

export default function CategoryManagementScreen() {
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // Role authorization: Only OWNER and ADMIN have full CRUD access
  const isAuthorized = owner?.role === 'OWNER' || owner?.role === 'ADMIN';

  // Category data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal & form states
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Form submission feedback
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Robust back navigation to More screen
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/more');
    }
  }, [router]);

  // Hardware back press listener
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleBack]);

  // Load categories from API
  const loadCategories = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await categoriesApi.getAll();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setLoadError(err?.message || 'Unable to load categories from store server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
  };

  // Open Add Category Modal
  const handleOpenAddModal = () => {
    if (!isAuthorized) {
      Alert.alert('Permission Denied', 'Store staff accounts have read-only category access.');
      return;
    }
    setSelectedCategory(null);
    setFormName('');
    setFormDescription('');
    setFormImageUrl('');
    setFormActive(true);
    setFormError(null);
    setModalMode('ADD');
  };

  // Open Edit Category Modal
  const handleOpenEditModal = (cat: Category) => {
    if (!isAuthorized) {
      Alert.alert('Permission Denied', 'Store staff accounts have read-only category access.');
      return;
    }
    setSelectedCategory(cat);
    setFormName(cat.name || '');
    setFormDescription(cat.description || '');
    setFormImageUrl(cat.imageUrl || '');
    setFormActive(cat.active !== false);
    setFormError(null);
    setModalMode('EDIT');
  };

  // Close Modal
  const handleCloseModal = () => {
    if (formSubmitting) return;
    setModalMode(null);
    setSelectedCategory(null);
    setFormError(null);
  };

  // Submit Add or Edit Form
  const handleSubmitForm = async () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Category name is required.');
      return;
    }
    if (trimmedName.length > 100) {
      setFormError('Category name cannot exceed 100 characters.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const payload: Partial<Category> = {
      name: trimmedName,
      description: formDescription.trim() || undefined,
      imageUrl: formImageUrl.trim() || undefined,
      active: formActive
    };

    try {
      if (modalMode === 'ADD') {
        const created = await categoriesApi.create(payload);
        setModalMode(null);
        await loadCategories();
        Alert.alert('Category Created', `"${created.name}" was successfully added to departments.`);
      } else if (modalMode === 'EDIT' && selectedCategory) {
        const updated = await categoriesApi.update(selectedCategory.id, payload);
        setModalMode(null);
        await loadCategories();
        Alert.alert('Category Updated', `"${updated.name}" was successfully updated.`);
      }
    } catch (err: any) {
      console.error('Failed to save category:', err);
      const msg = err?.message || 'Failed to save category. Please check connection and fields.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete / Soft-Deactivate Category
  const handleDeleteCategory = (cat: Category) => {
    if (!isAuthorized) {
      Alert.alert('Permission Denied', 'Store staff accounts have read-only category access.');
      return;
    }

    Alert.alert(
      'Deactivate Category',
      `Are you sure you want to deactivate "${cat.name}"?\n\nThis will soft-delete and hide the department from the customer storefront without deleting any associated products.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await categoriesApi.delete(cat.id);
              await loadCategories();
              Alert.alert('Category Deactivated', `"${cat.name}" has been deactivated.`);
            } catch (err: any) {
              console.error('Failed to deactivate category:', err);
              Alert.alert('Action Failed', err?.message || 'Could not deactivate category.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Category Management"
        subtitle={`${categories.length} store departments`}
        leftAction={{
          icon: '←',
          onPress: handleBack
        }}
        rightAction={
          isAuthorized ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenAddModal}
              style={styles.headerAddBtn}
            >
              <Text style={styles.headerAddBtnText}>+ Add</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Staff read-only notice */}
      {!isAuthorized && (
        <View style={styles.readOnlyNotice}>
          <Text style={styles.readOnlyNoticeText}>
            🔒 Read-only view: Only Store Owners and Administrators can add, edit, or deactivate categories.
          </Text>
        </View>
      )}

      {loading ? (
        <LoadingIndicator fullscreen message="Loading categories..." />
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to Load</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <Button
              title="Try Again"
              onPress={loadCategories}
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={categories}
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
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={styles.emptyTitle}>No Categories</Text>
              <Text style={styles.emptySubtitle}>
                No product departments have been registered yet.
              </Text>
              {isAuthorized && (
                <Button
                  title="+ Add First Category"
                  onPress={handleOpenAddModal}
                  size="sm"
                  style={{ marginTop: spacing.md }}
                />
              )}
            </View>
          }
          renderItem={({ item }) => {
            const hasProductCount = (item as any).productCount != null;
            return (
              <Card style={styles.categoryCard}>
                <View style={styles.categoryRow}>
                  {/* Category Thumbnail / Icon */}
                  <Image
                    source={{ uri: item.imageUrl || APP_CONFIG.FALLBACK_PRODUCT_IMAGE }}
                    style={styles.categoryImage}
                    contentFit="cover"
                    transition={150}
                  />

                  {/* Details */}
                  <View style={styles.categoryDetails}>
                    <View style={styles.titleRow}>
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Badge
                        label={item.active !== false ? 'Active' : 'Inactive'}
                        variant={item.active !== false ? 'success' : 'default'}
                      />
                    </View>

                    {!!item.description && (
                      <Text style={styles.categoryDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}

                    {hasProductCount && (
                      <Text style={styles.productCountText}>
                        {(item as any).productCount} {(item as any).productCount === 1 ? 'product' : 'products'}
                      </Text>
                    )}

                    {/* Action buttons (OWNER & ADMIN only) */}
                    {isAuthorized && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleOpenEditModal(item)}
                          style={styles.actionBtnEdit}
                        >
                          <Text style={styles.actionBtnEditText}>✏️ Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleDeleteCategory(item)}
                          style={styles.actionBtnDelete}
                        >
                          <Text style={styles.actionBtnDeleteText}>🗑️ Deactivate</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        visible={modalMode !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleCloseModal}
            />
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalHeaderTitle}>
                    {modalMode === 'ADD' ? 'Add New Category' : `Edit Category #${selectedCategory?.id}`}
                  </Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    {modalMode === 'ADD'
                      ? 'Create catalog department'
                      : 'Modify department details'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseModal}
                  style={styles.modalCloseButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContentScroll}
                keyboardShouldPersistTaps="handled"
              >
                {/* Error Banner */}
                {formError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                )}

                {/* 1. Category Name */}
                <Input
                  label="Category Name *"
                  placeholder="e.g. Dairy & Breakfast"
                  value={formName}
                  onChangeText={(text) => {
                    setFormName(text);
                    if (formError) setFormError(null);
                  }}
                  maxLength={100}
                />

                {/* 2. Image URL */}
                <Input
                  label="Image Web URL (Optional)"
                  placeholder="https://images.unsplash.com/..."
                  value={formImageUrl}
                  onChangeText={setFormImageUrl}
                  autoCapitalize="none"
                  hint="Direct HTTPS link to category photograph"
                />

                {/* Live Image Preview */}
                {!!formImageUrl.trim() && (
                  <View style={styles.previewContainer}>
                    <Text style={styles.previewLabel}>Thumbnail Preview</Text>
                    <View style={styles.imagePreviewBox}>
                      <Image
                        source={{ uri: formImageUrl.trim() }}
                        style={styles.previewImage}
                        contentFit="cover"
                        transition={150}
                      />
                    </View>
                  </View>
                )}

                {/* 3. Description */}
                <Input
                  label="Description (Optional)"
                  placeholder="Department details, products included, etc."
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                  numberOfLines={3}
                  style={styles.multilineInput}
                />

                {/* 4. Active Status Switch */}
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchTitle}>Department Active</Text>
                    <Text style={styles.switchSubtitle}>
                      {formActive
                        ? 'Visible in customer catalog and product filters'
                        : 'Hidden from customer store'}
                    </Text>
                  </View>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: '#cbd5e1', true: colors.primaryLight }}
                    thumbColor={formActive ? colors.primary : '#94a3b8'}
                  />
                </View>

                {/* Submit Button */}
                <Button
                  title={modalMode === 'ADD' ? 'Create Category' : 'Save Changes'}
                  onPress={handleSubmitForm}
                  loading={formSubmitting}
                  style={styles.submitBtn}
                />
              </ScrollView>
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
  headerAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 8
  },
  headerAddBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '800'
  },
  readOnlyNotice: {
    backgroundColor: colors.warningLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.warningBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  readOnlyNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warningText,
    lineHeight: 16
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl
  },
  categoryCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 12
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  categoryImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md
  },
  categoryDetails: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.xs
  },
  categoryDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: 6
  },
  productCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4
  },
  actionBtnEdit: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionBtnEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary
  },
  actionBtnDelete: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  actionBtnDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dangerText
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 44,
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
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 240
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
    maxHeight: '90%',
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
    height: 100,
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
    minHeight: 70,
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
  }
});
