/**
 * Grocery Choice Owner App - Staff & Access Controls Screen
 * Complete staff directory, role management, contact editing, and access governance.
 * Enforces strict security rules:
 * - OWNER & ADMIN can manage staff accounts according to backend permissions.
 * - STAFF accounts are restricted to read-only directory viewing.
 * - Self-role-change, self-deactivation, and self-revocation are strictly blocked.
 * - Primary Owner account is fully protected.
 * - Primary Ownership Transfer is kept guarded as a multi-step protected operation.
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
  Alert,
  ScrollView,
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
import { staffApi } from '@/api/staffApi';
import { OwnerUser, Designation, AuditLog, Role } from '@/types';
import { formatDateTime } from '@/utils/formatters';

export default function StaffManagementScreen() {
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // Role permissions
  const isManager = owner?.role === 'OWNER' || owner?.role === 'ADMIN';
  const isPrimaryOwner = owner?.primaryOwner === true;

  // Data states
  const [staffList, setStaffList] = useState<OwnerUser[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active view tab: Directory vs Audit Trail
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'AUDIT'>('DIRECTORY');

  // Modals & Action States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalUser, setEditModalUser] = useState<OwnerUser | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<OwnerUser | null>(null);

  // Add Staff Form fields
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRole, setAddRole] = useState<Role>('STAFF');
  const [addDesignation, setAddDesignation] = useState('');
  const [addStoreHub, setAddStoreHub] = useState('Flagship Hub');
  const [addPassword, setAddPassword] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Staff Form fields
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editStoreHub, setEditStoreHub] = useState('');

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

  // Load all staff, designations, and audit logs
  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [staffData, designationsData] = await Promise.all([
        staffApi.getAll(),
        staffApi.getDesignations().catch(() => [])
      ]);
      setStaffList(Array.isArray(staffData) ? staffData : []);
      setDesignations(Array.isArray(designationsData) ? designationsData : []);

      // If manager, load audit logs
      if (isManager) {
        try {
          const logs = await staffApi.getAuditLogs();
          setAuditLogs(Array.isArray(logs) ? logs : []);
        } catch (e) {
          console.warn('Failed to fetch audit logs:', e);
        }
      }
    } catch (err: any) {
      console.error('Failed to load staff management data:', err);
      setLoadError(err?.message || 'Unable to load staff directory from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    if (!isManager) {
      Alert.alert('Permission Denied', 'Only Owners and Admins can create staff accounts.');
      return;
    }
    setAddName('');
    setAddEmail('');
    setAddPhone('');
    setAddRole('STAFF');
    setAddDesignation(designations.length > 0 ? designations[0].title : '');
    setAddStoreHub('Flagship Hub');
    setAddPassword('');
    setFormError(null);
    setAddModalVisible(true);
  };

  // Submit Add Staff Form
  const handleSubmitAdd = async () => {
    const trimmedName = addName.trim();
    const trimmedEmail = addEmail.trim().toLowerCase();
    const trimmedPhone = addPhone.trim();

    if (!trimmedName) {
      setFormError('Full name is required.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('A valid email address is required.');
      return;
    }
    if (trimmedPhone && !/^[6-9]\d{9}$/.test(trimmedPhone.replace(/\D/g, ''))) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      fullName: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || undefined,
      role: addRole,
      designation: addDesignation.trim() || undefined,
      storeHub: addStoreHub.trim() || 'Flagship Hub',
      password: addPassword.trim() || undefined,
      status: 'ACTIVE'
    };

    try {
      const created = await staffApi.create(payload);
      setAddModalVisible(false);
      await loadData();
      Alert.alert(
        'Staff Account Created',
        `Successfully added ${created.fullName} (${created.role}) to store staff.`
      );
    } catch (err: any) {
      console.error('Failed to create staff:', err);
      setFormError(err?.message || 'Failed to create staff account. Check details.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: OwnerUser) => {
    if (!isManager) {
      Alert.alert('Permission Denied', 'Staff directory is read-only for your role.');
      return;
    }
    if (user.primaryOwner && !isPrimaryOwner) {
      Alert.alert('Protected Account', "Only the Primary Owner can edit the Primary Owner's profile.");
      return;
    }

    setEditModalUser(user);
    setEditName(user.fullName || '');
    setEditEmail(user.email || '');
    setEditPhone(user.phone || '');
    setEditDesignation(user.designation || '');
    setEditStoreHub(user.storeHub || 'Flagship Hub');
    setFormError(null);
  };

  // Submit Edit Staff Form
  const handleSubmitEdit = async () => {
    if (!editModalUser) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setFormError('Full name is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      fullName: trimmedName,
      email: editEmail.trim() || undefined,
      phone: editPhone.trim() || undefined,
      designation: editDesignation.trim() || undefined,
      storeHub: editStoreHub.trim() || undefined
    };

    try {
      await staffApi.updateContact(editModalUser.id, payload);
      setEditModalUser(null);
      await loadData();
      Alert.alert('Staff Updated', `Information for ${trimmedName} was updated.`);
    } catch (err: any) {
      console.error('Failed to update staff:', err);
      setFormError(err?.message || 'Failed to update contact details.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Role Change Modal
  const handleOpenRoleChange = (user: OwnerUser) => {
    if (!isManager) {
      Alert.alert('Permission Denied', 'Role changes require Owner or Admin permissions.');
      return;
    }
    if (user.id === owner?.id) {
      Alert.alert('Action Restricted', 'You cannot change your own role.');
      return;
    }
    if (user.primaryOwner) {
      Alert.alert('Protected Account', 'The Primary Owner role cannot be modified here.');
      return;
    }
    setRoleModalUser(user);
  };

  // Execute Role Change
  const handleConfirmRoleChange = async (targetRole: Role) => {
    if (!roleModalUser) return;

    if (targetRole === 'OWNER' && !isPrimaryOwner) {
      Alert.alert('Permission Denied', 'Only the Primary Owner can promote accounts to OWNER.');
      return;
    }

    try {
      await staffApi.changeRole(roleModalUser.id, targetRole);
      setRoleModalUser(null);
      await loadData();
      Alert.alert(
        'Role Updated',
        `${roleModalUser.fullName}'s role was changed to ${targetRole}.`
      );
    } catch (err: any) {
      console.error('Failed to change role:', err);
      Alert.alert('Update Failed', err?.message || 'Could not change system role.');
    }
  };

  // Toggle Account Status (ACTIVE / INACTIVE)
  const handleToggleStatus = (user: OwnerUser) => {
    if (!isManager) {
      Alert.alert('Permission Denied', 'Changing account status requires Owner or Admin role.');
      return;
    }
    if (user.id === owner?.id) {
      Alert.alert('Action Restricted', 'You cannot deactivate your own account.');
      return;
    }
    if (user.primaryOwner) {
      Alert.alert('Protected Account', 'The Primary Owner account cannot be disabled.');
      return;
    }

    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionText = newStatus === 'ACTIVE' ? 'Activate' : 'Deactivate';

    Alert.alert(
      `${actionText} Account`,
      `Are you sure you want to ${actionText.toLowerCase()} the account for ${user.fullName}?${
        newStatus === 'INACTIVE'
          ? '\n\nThe user will not be able to log in to the Store Portal.'
          : '\n\nThe user will regain access to log in.'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: newStatus === 'INACTIVE' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await staffApi.changeStatus(user.id, newStatus);
              await loadData();
              Alert.alert(
                'Status Changed',
                `${user.fullName} is now ${newStatus}.`
              );
            } catch (err: any) {
              console.error('Failed to change status:', err);
              Alert.alert('Action Failed', err?.message || 'Could not change account status.');
            }
          }
        }
      ]
    );
  };

  // Revoke Staff Access
  const handleRevokeAccess = (user: OwnerUser) => {
    if (!isManager) {
      Alert.alert('Permission Denied', 'Revoking access requires Owner or Admin permissions.');
      return;
    }
    if (user.id === owner?.id) {
      Alert.alert('Action Restricted', 'You cannot revoke your own staff access.');
      return;
    }
    if (user.primaryOwner) {
      Alert.alert('Protected Account', 'Cannot revoke staff access from the Primary Owner.');
      return;
    }

    Alert.alert(
      'Revoke Staff Access',
      `Are you sure you want to revoke staff privileges for ${user.fullName}?\n\nThis will safely remove staff access and demote the account to a standard customer profile. All historic orders, activities, and audit logs remain preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Access',
          style: 'destructive',
          onPress: async () => {
            try {
              await staffApi.removeAccess(user.id);
              await loadData();
              Alert.alert('Access Revoked', `${user.fullName} has been removed from staff.`);
            } catch (err: any) {
              console.error('Failed to revoke access:', err);
              Alert.alert('Revocation Failed', err?.message || 'Could not revoke staff access.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Staff & Access Controls"
        subtitle={`${staffList.length} store team members`}
        leftAction={{ icon: '←', onPress: handleBack }}
        rightAction={
          isManager ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenAdd}
              style={styles.headerAddBtn}
            >
              <Text style={styles.headerAddBtnText}>+ Add Staff</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Read-only notice for staff */}
      {!isManager && (
        <View style={styles.readOnlyNotice}>
          <Text style={styles.readOnlyNoticeText}>
            🔒 Read-Only Directory: Store staff can view team contacts. Only Owners and Administrators can manage members, roles, or access.
          </Text>
        </View>
      )}

      {/* Primary Ownership Notice */}
      <View style={styles.ownershipNotice}>
        <Text style={styles.ownershipNoticeIcon}>🛡️</Text>
        <View style={styles.ownershipNoticeTextContainer}>
          <Text style={styles.ownershipNoticeTitle}>Primary Ownership Guard</Text>
          <Text style={styles.ownershipNoticeSub}>
            Primary Ownership Transfer is protected by dual-key authorization and credential re-verification.
          </Text>
        </View>
      </View>

      {/* View Switcher: Directory vs Audit Trail */}
      {isManager && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'DIRECTORY' && styles.tabItemActive]}
            onPress={() => setActiveTab('DIRECTORY')}
          >
            <Text style={[styles.tabText, activeTab === 'DIRECTORY' && styles.tabTextActive]}>
              👥 Staff Directory ({staffList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'AUDIT' && styles.tabItemActive]}
            onPress={() => setActiveTab('AUDIT')}
          >
            <Text style={[styles.tabText, activeTab === 'AUDIT' && styles.tabTextActive]}>
              📜 Audit Trail ({auditLogs.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <LoadingIndicator fullscreen message="Loading store staff directory..." />
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to Load Staff</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <Button
              title="Try Again"
              onPress={loadData}
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      ) : activeTab === 'DIRECTORY' ? (
        <FlatList
          data={staffList}
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
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Staff Registered</Text>
              <Text style={styles.emptySubtitle}>No team members found in store directory.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelf = item.id === owner?.id;
            return (
              <Card style={styles.staffCard}>
                <View style={styles.staffCardHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {item.fullName ? item.fullName.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>

                  <View style={styles.staffMainInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.staffName} numberOfLines={1}>
                        {item.fullName}
                      </Text>
                      {item.primaryOwner && (
                        <Badge label="Primary Owner" variant="info" />
                      )}
                    </View>

                    <Text style={styles.staffDesignation}>
                      {item.designation || 'Store Operations'}
                      {item.storeHub ? ` • ${item.storeHub}` : ''}
                    </Text>

                    <View style={styles.badgesRow}>
                      <Badge
                        label={item.role}
                        variant={
                          item.role === 'OWNER'
                            ? 'warning'
                            : item.role === 'ADMIN'
                            ? 'info'
                            : 'default'
                        }
                      />
                      <Badge
                        label={item.status || 'ACTIVE'}
                        variant={item.status === 'ACTIVE' ? 'success' : 'danger'}
                      />
                      {isSelf && <Badge label="You" variant="success" />}
                    </View>
                  </View>
                </View>

                {/* Contact information */}
                <View style={styles.contactSection}>
                  {!!item.email && (
                    <Text style={styles.contactItemText} numberOfLines={1}>
                      ✉️ {item.email}
                    </Text>
                  )}
                  {!!item.phone && (
                    <Text style={styles.contactItemText} numberOfLines={1}>
                      📞 {item.phone}
                    </Text>
                  )}
                </View>

                {/* Management Action Buttons for OWNER/ADMIN */}
                {isManager && (
                  <View style={styles.actionsBar}>
                    {/* Edit Info */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleOpenEdit(item)}
                      style={styles.actionPill}
                    >
                      <Text style={styles.actionPillText}>✏️ Edit</Text>
                    </TouchableOpacity>

                    {/* Change Role */}
                    {!item.primaryOwner && !isSelf && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleOpenRoleChange(item)}
                        style={styles.actionPill}
                      >
                        <Text style={styles.actionPillText}>🔄 Role</Text>
                      </TouchableOpacity>
                    )}

                    {/* Activate / Deactivate */}
                    {!item.primaryOwner && !isSelf && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleToggleStatus(item)}
                        style={styles.actionPill}
                      >
                        <Text style={styles.actionPillText}>
                          {item.status === 'ACTIVE' ? '⏸️ Disable' : '▶️ Enable'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Revoke Access */}
                    {!item.primaryOwner && !isSelf && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleRevokeAccess(item)}
                        style={[styles.actionPill, styles.actionPillDanger]}
                      >
                        <Text style={styles.actionPillDangerText}>🚫 Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Card>
            );
          }}
        />
      ) : (
        /* Audit Trail View */
        <FlatList
          data={auditLogs}
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
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyTitle}>No Audit Logs</Text>
              <Text style={styles.emptySubtitle}>No governance events recorded yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.auditCard}>
              <View style={styles.auditHeaderRow}>
                <Badge label={item.action} variant="info" />
                <Text style={styles.auditDateText}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
              <Text style={styles.auditActorText}>
                By: <Text style={styles.boldText}>{(item as any).actorName || item.performedBy || 'System'}</Text>
                {(item as any).targetName ? ` → Target: ${(item as any).targetName}` : ''}
              </Text>
              {!!item.details && (
                <Text style={styles.auditDetailsText}>{item.details}</Text>
              )}
            </Card>
          )}
        />
      )}

      {/* Modal 1: Add Staff Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setAddModalVisible(false)}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Add Staff Member</Text>
                  <Text style={styles.modalHeaderSubtitle}>Register new store team account</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAddModalVisible(false)}
                  style={styles.modalCloseButton}
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
                  value={addName}
                  onChangeText={setAddName}
                />

                <Input
                  label="Email Address *"
                  placeholder="staff@grocerychoice.com"
                  value={addEmail}
                  onChangeText={setAddEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Input
                  label="Mobile Number (Optional)"
                  placeholder="9876543210"
                  value={addPhone}
                  onChangeText={setAddPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />

                {/* Role Selector */}
                <Text style={styles.inputGroupLabel}>System Role *</Text>
                <View style={styles.selectorRow}>
                  <TouchableOpacity
                    style={[
                      styles.selectorPill,
                      addRole === 'STAFF' && styles.selectorPillActive
                    ]}
                    onPress={() => setAddRole('STAFF')}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        addRole === 'STAFF' && styles.selectorPillTextActive
                      ]}
                    >
                      STAFF
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.selectorPill,
                      addRole === 'ADMIN' && styles.selectorPillActive
                    ]}
                    onPress={() => setAddRole('ADMIN')}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        addRole === 'ADMIN' && styles.selectorPillTextActive
                      ]}
                    >
                      ADMIN
                    </Text>
                  </TouchableOpacity>

                  {isPrimaryOwner && (
                    <TouchableOpacity
                      style={[
                        styles.selectorPill,
                        addRole === 'OWNER' && styles.selectorPillActive
                      ]}
                      onPress={() => setAddRole('OWNER')}
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          addRole === 'OWNER' && styles.selectorPillTextActive
                        ]}
                      >
                        OWNER
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Designation Picker from backend catalog */}
                {designations.length > 0 && (
                  <>
                    <Text style={styles.inputGroupLabel}>Designation</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizScroll}>
                      {designations.map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            styles.designationPill,
                            addDesignation === d.title && styles.designationPillActive
                          ]}
                          onPress={() => setAddDesignation(d.title)}
                        >
                          <Text
                            style={[
                              styles.designationPillText,
                              addDesignation === d.title && styles.designationPillTextActive
                            ]}
                          >
                            {d.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                <Input
                  label="Store Hub / Location"
                  placeholder="Flagship Hub"
                  value={addStoreHub}
                  onChangeText={setAddStoreHub}
                />

                <Input
                  label="Initial Password (Optional)"
                  placeholder="Leave empty for auto/default password"
                  value={addPassword}
                  onChangeText={setAddPassword}
                  secureTextEntry
                />

                <Button
                  title="Create Staff Account"
                  onPress={handleSubmitAdd}
                  loading={formSubmitting}
                  style={{ marginTop: spacing.md }}
                />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal 2: Edit Staff Contact Info Modal */}
      <Modal
        visible={editModalUser !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalUser(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setEditModalUser(null)}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalHeaderTitle}>Edit Staff Details</Text>
                  <Text style={styles.modalHeaderSubtitle}>
                    Modify profile for #{editModalUser?.id}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditModalUser(null)}
                  style={styles.modalCloseButton}
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
                  value={editName}
                  onChangeText={setEditName}
                />

                <Input
                  label="Email Address"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Input
                  label="Phone Number"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />

                {/* Designation Picker */}
                {designations.length > 0 && (
                  <>
                    <Text style={styles.inputGroupLabel}>Designation</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizScroll}>
                      {designations.map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            styles.designationPill,
                            editDesignation === d.title && styles.designationPillActive
                          ]}
                          onPress={() => setEditDesignation(d.title)}
                        >
                          <Text
                            style={[
                              styles.designationPillText,
                              editDesignation === d.title && styles.designationPillTextActive
                            ]}
                          >
                            {d.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                <Input
                  label="Store Hub"
                  value={editStoreHub}
                  onChangeText={setEditStoreHub}
                />

                <Button
                  title="Save Changes"
                  onPress={handleSubmitEdit}
                  loading={formSubmitting}
                  style={{ marginTop: spacing.md }}
                />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal 3: Change Role Modal */}
      <Modal
        visible={roleModalUser !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roleModalBackdrop}>
            <View style={styles.roleModalCard}>
              <Text style={styles.roleModalTitle}>Change Role</Text>
              <Text style={styles.roleModalSubtitle}>
                Select system role for {roleModalUser?.fullName} (Current: {roleModalUser?.role})
              </Text>

              <View style={styles.roleButtonsList}>
                <TouchableOpacity
                  style={[
                    styles.roleChoiceBtn,
                    roleModalUser?.role === 'STAFF' && styles.roleChoiceActive
                  ]}
                  onPress={() => handleConfirmRoleChange('STAFF')}
                >
                  <Text style={styles.roleChoiceTitle}>STAFF</Text>
                  <Text style={styles.roleChoiceDesc}>Store operations, order handling &amp; read-only directory</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleChoiceBtn,
                    roleModalUser?.role === 'ADMIN' && styles.roleChoiceActive
                  ]}
                  onPress={() => handleConfirmRoleChange('ADMIN')}
                >
                  <Text style={styles.roleChoiceTitle}>ADMIN</Text>
                  <Text style={styles.roleChoiceDesc}>Management controls, catalog CRUD &amp; staff supervision</Text>
                </TouchableOpacity>

                {isPrimaryOwner && (
                  <TouchableOpacity
                    style={[
                      styles.roleChoiceBtn,
                      roleModalUser?.role === 'OWNER' && styles.roleChoiceActive
                    ]}
                    onPress={() => handleConfirmRoleChange('OWNER')}
                  >
                    <Text style={styles.roleChoiceTitle}>OWNER</Text>
                    <Text style={styles.roleChoiceDesc}>Full operational authority &amp; store administration</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setRoleModalUser(null)}
                style={{ marginTop: spacing.md }}
              />
            </View>
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
  ownershipNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  ownershipNoticeIcon: {
    fontSize: 18,
    marginRight: spacing.sm
  },
  ownershipNoticeTextContainer: {
    flex: 1
  },
  ownershipNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary
  },
  ownershipNoticeSub: {
    fontSize: 11,
    color: colors.textMuted
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabItemActive: {
    borderBottomColor: colors.primary
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '800'
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl
  },
  staffCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 12
  },
  staffCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark
  },
  staffMainInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2
  },
  staffName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1
  },
  staffDesignation: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6
  },
  contactSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  contactItemText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  actionsBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  actionPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary
  },
  actionPillDanger: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder
  },
  actionPillDangerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText
  },
  auditCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 10
  },
  auditHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  auditDateText: {
    fontSize: 11,
    color: colors.textMuted
  },
  auditActorText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2
  },
  boldText: {
    fontWeight: '700',
    color: colors.textPrimary
  },
  auditDetailsText: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16
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
    textAlign: 'center'
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
  inputGroupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 4
  },
  selectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  selectorPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  selectorPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  selectorPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary
  },
  selectorPillTextActive: {
    color: colors.primaryDark,
    fontWeight: '900'
  },
  horizScroll: {
    marginBottom: spacing.md
  },
  designationPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs
  },
  designationPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  designationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary
  },
  designationPillTextActive: {
    color: colors.surface,
    fontWeight: '800'
  },
  roleModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  roleModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg
  },
  roleModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4
  },
  roleModalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.lg
  },
  roleButtonsList: {
    gap: spacing.sm
  },
  roleChoiceBtn: {
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  roleChoiceActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  roleChoiceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2
  },
  roleChoiceDesc: {
    fontSize: 11,
    color: colors.textMuted
  }
});
