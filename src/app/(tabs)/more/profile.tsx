/**
 * Grocery Choice Owner App - Personal Information Screen
 * Displays full profile details of the currently authenticated store owner/staff.
 * Allows safe editing of personal contact information (Full Name, Email, Phone,
 * and business designation/store hub where authorized).
 * Roles, security permissions, and ownership status remain protected and read-only.
 * Hidden sub-route under (tabs), preserving the 5 core bottom tabs and safe back navigation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/common/Badge';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { formatDateTime } from '@/utils/formatters';
import { staffApi } from '@/api/staffApi';

export default function PersonalInformationScreen() {
  const router = useRouter();
  const { owner, refreshProfile, updateProfile, isLoading } = useOwnerAuth();

  const isManager = owner?.role === 'OWNER' || owner?.role === 'ADMIN';

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit Modal & Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editStoreHub, setEditStoreHub] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Safe back navigation to More screen
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

  const onRefresh = async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      await refreshProfile();
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to refresh profile.');
    } finally {
      setRefreshing(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = () => {
    if (!owner) return;
    setEditName(owner.fullName || '');
    setEditEmail(owner.email || '');
    setEditPhone(owner.phone || '');
    setEditDesignation(owner.designation || '');
    setEditStoreHub(owner.storeHub || 'Flagship Hub');
    setFormError(null);
    setIsEditing(true);
  };

  // Close Edit Modal
  const handleCloseEdit = () => {
    if (saving) return;
    setIsEditing(false);
    setFormError(null);
  };

  // Submit Profile Changes
  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();
    const trimmedPhone = editPhone.trim();

    if (!trimmedName) {
      setFormError('Full name is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setFormError('A valid email address is required.');
      return;
    }

    if (trimmedPhone) {
      const digits = trimmedPhone.replace(/\D/g, '');
      if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
        setFormError('Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    setSaving(true);
    setFormError(null);

    try {
      // 1. Update personal details via auth profile endpoint
      const updateRes = await updateProfile({
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined
      });

      if (!updateRes.success) {
        throw new Error(updateRes.error || 'Failed to update personal profile.');
      }

      // 2. If manager and designation/hub changed, also sync contact details
      if (isManager && owner?.id) {
        try {
          await staffApi.updateContact(owner.id, {
            fullName: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone || undefined,
            designation: editDesignation.trim() || undefined,
            storeHub: editStoreHub.trim() || undefined
          });
        } catch (contactErr) {
          console.warn('Note: Contact sync endpoint note:', contactErr);
        }
      }

      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Profile Updated', 'Your personal information was successfully saved.');
    } catch (err: any) {
      console.error('Failed to save personal profile:', err);
      setFormError(err?.message || 'Could not save profile changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Personal Information"
        subtitle="Account & personal profile"
        leftAction={{ icon: '←', onPress: handleBack }}
        rightAction={
          owner ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenEdit}
              style={styles.headerEditBtn}
            >
              <Text style={styles.headerEditBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {isLoading && !owner ? (
        <LoadingIndicator fullscreen message="Loading profile..." />
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to Load Profile</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <Button
              title="Try Again"
              onPress={onRefresh}
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        >
          {/* 1. Profile Hero Card */}
          <Card style={styles.heroCard}>
            <View style={styles.avatarLargeCircle}>
              <Text style={styles.avatarLargeInitial}>
                {owner?.fullName ? owner.fullName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <Text style={styles.heroName}>{owner?.fullName || 'Store Team Member'}</Text>
            <Text style={styles.heroDesignation}>
              {owner?.designation || 'Store Operations'} • {owner?.storeHub || 'Flagship Hub'}
            </Text>

            <View style={styles.badgesRow}>
              <Badge
                label={owner?.role || 'STAFF'}
                variant={
                  owner?.role === 'OWNER'
                    ? 'warning'
                    : owner?.role === 'ADMIN'
                    ? 'info'
                    : 'default'
                }
              />
              <Badge
                label={owner?.status || 'ACTIVE'}
                variant={owner?.status === 'ACTIVE' ? 'success' : 'danger'}
              />
              {owner?.primaryOwner && <Badge label="Primary Owner" variant="info" />}
            </View>
          </Card>

          {/* 2. Contact Information Card */}
          <Text style={styles.sectionHeader}>Contact Information</Text>
          <Card style={styles.detailsCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoIcon}>👤</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{owner?.fullName || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoIcon}>✉️</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{owner?.email || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoIcon}>📞</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{owner?.phone || 'Not specified'}</Text>
              </View>
            </View>
          </Card>

          {/* 3. Organizational & Store Details */}
          <Text style={styles.sectionHeader}>Store &amp; Organizational Profile</Text>
          <Card style={styles.detailsCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoIcon}>💼</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Designation / Title</Text>
                <Text style={styles.infoValue}>{owner?.designation || 'Store Operations'}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoIcon}>🏬</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Assigned Store / Hub</Text>
                <Text style={styles.infoValue}>{owner?.storeHub || 'Flagship Hub'}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Text style={styles.infoIcon}>📅</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {owner?.createdAt ? formatDateTime(owner.createdAt) : 'Active Store Account'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 4. Security Governance Notice */}
          <View style={styles.securityNoticeCard}>
            <Text style={styles.securityNoticeIcon}>🛡️</Text>
            <View style={styles.securityNoticeContent}>
              <Text style={styles.securityNoticeTitle}>Role &amp; Access Governance</Text>
              <Text style={styles.securityNoticeText}>
                System roles (Owner, Admin, Staff) and security authorizations cannot be changed here. Access controls are managed by store administrators in Staff &amp; Access Controls.
              </Text>
            </View>
          </View>

          {/* 5. Edit Button */}
          <Button
            title="Edit Personal Information"
            onPress={handleOpenEdit}
            style={styles.editActionBtn}
          />
        </ScrollView>
      )}

      {/* Edit Personal Information Modal */}
      <Modal
        visible={isEditing}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleCloseEdit}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Edit Personal Information</Text>
                  <Text style={styles.modalHeaderSubtitle}>Update your store contact profile</Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseEdit}
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
                {formError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                )}

                <Input
                  label="Full Name *"
                  placeholder="e.g. Ramesh Kumar"
                  value={editName}
                  onChangeText={(text) => {
                    setEditName(text);
                    if (formError) setFormError(null);
                  }}
                />

                <Input
                  label="Email Address *"
                  placeholder="name@grocerychoice.com"
                  value={editEmail}
                  onChangeText={(text) => {
                    setEditEmail(text);
                    if (formError) setFormError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Input
                  label="Mobile Number (Optional)"
                  placeholder="9876543210"
                  value={editPhone}
                  onChangeText={(text) => {
                    setEditPhone(text);
                    if (formError) setFormError(null);
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />

                {isManager && (
                  <>
                    <Input
                      label="Designation / Title"
                      placeholder="e.g. Store Manager"
                      value={editDesignation}
                      onChangeText={setEditDesignation}
                    />

                    <Input
                      label="Store / Hub"
                      placeholder="Flagship Hub"
                      value={editStoreHub}
                      onChangeText={setEditStoreHub}
                    />
                  </>
                )}

                <View style={styles.protectedFieldBanner}>
                  <Text style={styles.protectedFieldText}>
                    🔒 Role ({owner?.role}) and Account Status ({owner?.status}) are protected system fields and cannot be modified here.
                  </Text>
                </View>

                <Button
                  title="Save Personal Information"
                  onPress={handleSaveProfile}
                  loading={saving}
                  disabled={saving}
                  style={{ marginTop: spacing.md }}
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
  headerEditBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 8
  },
  headerEditBtnText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '800'
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl
  },
  heroCard: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: 16,
    marginBottom: spacing.md
  },
  avatarLargeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border
  },
  avatarLargeInitial: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.primary
  },
  heroName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 4
  },
  heroDesignation: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  detailsCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  infoIcon: {
    fontSize: 16
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
    marginLeft: 52
  },
  securityNoticeCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  securityNoticeIcon: {
    fontSize: 20,
    marginRight: spacing.sm
  },
  securityNoticeContent: {
    flex: 1
  },
  securityNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2
  },
  securityNoticeText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16
  },
  editActionBtn: {
    marginBottom: spacing.xl
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
  protectedFieldBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warningBorder
  },
  protectedFieldText: {
    fontSize: 11,
    color: colors.warningText,
    lineHeight: 15
  }
});
