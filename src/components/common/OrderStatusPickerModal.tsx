/**
 * Grocery Choice Owner App - Order Status Picker Modal
 * Touch-friendly bottom-sheet modal for updating order statuses.
 * Matches Owner Website status lifecycle and enforces terminal-state protections.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { colors, spacing } from '@/theme';
import { OrderStatus } from '@/types';
import { Badge } from '@/components/common/Badge';
import { formatStatusLabel, getStatusVariant } from '@/utils/formatters';

export interface OrderStatusOption {
  status: OrderStatus;
  label: string;
  description: string;
  variant: 'default' | 'success' | 'warning' | 'info' | 'danger';
}

export const ORDER_STATUS_OPTIONS: OrderStatusOption[] = [
  {
    status: 'PLACED',
    label: 'Placed',
    description: 'Order received from customer',
    variant: 'default'
  },
  {
    status: 'CONFIRMED',
    label: 'Confirmed',
    description: 'Order confirmed and acknowledged',
    variant: 'success'
  },
  {
    status: 'PROCESSING',
    label: 'Processing',
    description: 'Order being packed & prepared for dispatch',
    variant: 'warning'
  },
  {
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    description: 'Order in transit with delivery partner',
    variant: 'info'
  },
  {
    status: 'DELIVERED',
    label: 'Delivered',
    description: 'Order successfully completed & fulfilled',
    variant: 'success'
  },
  {
    status: 'CANCELLED',
    label: 'Cancelled',
    description: 'Order cancelled and voided',
    variant: 'danger'
  }
];

export function isTerminalOrderStatus(status?: OrderStatus | string | null): boolean {
  if (!status) return false;
  const upper = status.toUpperCase();
  return upper === 'DELIVERED' || upper === 'CANCELLED';
}

interface OrderStatusPickerModalProps {
  visible: boolean;
  currentStatus: OrderStatus;
  orderNumber?: string;
  onSelectStatus: (newStatus: OrderStatus) => void;
  onClose: () => void;
  loading?: boolean;
}

export const OrderStatusPickerModal: React.FC<OrderStatusPickerModalProps> = ({
  visible,
  currentStatus,
  orderNumber,
  onSelectStatus,
  onClose,
  loading = false
}) => {
  const isTerminal = isTerminalOrderStatus(currentStatus);

  const handleSelect = (status: OrderStatus) => {
    if (loading || isTerminal) return;
    onSelectStatus(status);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        {/* Backdrop touchable area */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={!loading ? onClose : undefined}
        />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalHeaderTitle}>Update Order Status</Text>
              <Text style={styles.modalHeaderSubtitle}>
                {orderNumber ? `Order #${orderNumber}` : 'Select fulfillment status'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={styles.modalCloseButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Terminal state warning banner */}
          {isTerminal && (
            <View style={styles.terminalBanner}>
              <Text style={styles.terminalBannerIcon}>🔒</Text>
              <View style={styles.terminalBannerTextWrapper}>
                <Text style={styles.terminalBannerTitle}>
                  Status Locked: {formatStatusLabel(currentStatus)}
                </Text>
                <Text style={styles.terminalBannerSubtitle}>
                  Delivered and Cancelled orders are in terminal states and cannot be modified.
                </Text>
              </View>
            </View>
          )}

          {/* Status Options List */}
          <ScrollView contentContainerStyle={styles.statusListContent}>
            {ORDER_STATUS_OPTIONS.map((option) => {
              const isCurrent = option.status === currentStatus;
              const isDisabled = loading || isTerminal;

              return (
                <TouchableOpacity
                  key={option.status}
                  activeOpacity={isDisabled ? 1 : 0.7}
                  disabled={isDisabled}
                  onPress={() => handleSelect(option.status)}
                  style={[
                    styles.statusOptionRow,
                    isCurrent && styles.statusOptionRowSelected,
                    isDisabled && !isCurrent && styles.statusOptionRowDisabled
                  ]}
                >
                  <View style={styles.statusOptionLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        isCurrent && styles.radioCircleSelected
                      ]}
                    >
                      {isCurrent && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.statusOptionInfo}>
                      <View style={styles.statusOptionLabelRow}>
                        <Text
                          style={[
                            styles.statusOptionLabel,
                            isCurrent && styles.statusOptionLabelSelected
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Badge
                          label={option.label}
                          variant={option.variant}
                          style={styles.badgeCompact}
                        />
                      </View>
                      <Text style={styles.statusOptionDescription}>
                        {option.description}
                      </Text>
                    </View>
                  </View>

                  {isCurrent && (
                    <View style={styles.currentIndicator}>
                      <Text style={styles.currentIndicatorText}>Current</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Loading Indicator Overlay or Footer */}
          {loading && (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingFooterText}>Updating order status...</Text>
            </View>
          )}

          {/* Cancel Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              disabled={loading}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: spacing.lg
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
    color: colors.textPrimary,
    letterSpacing: -0.3
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  modalCloseButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700'
  },
  terminalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.sm
  },
  terminalBannerIcon: {
    fontSize: 20
  },
  terminalBannerTextWrapper: {
    flex: 1
  },
  terminalBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e'
  },
  terminalBannerSubtitle: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
    lineHeight: 15
  },
  statusListContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm
  },
  statusOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  statusOptionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  statusOptionRowDisabled: {
    opacity: 0.55,
    backgroundColor: colors.surfaceSecondary
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  radioCircleSelected: {
    borderColor: colors.primary
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  statusOptionInfo: {
    flex: 1
  },
  statusOptionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  statusOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  statusOptionLabelSelected: {
    color: colors.primaryDark
  },
  badgeCompact: {
    paddingVertical: 1,
    paddingHorizontal: 6
  },
  statusOptionDescription: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  currentIndicator: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: spacing.sm
  },
  currentIndicatorText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700'
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm
  },
  loadingFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs
  },
  cancelButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary
  }
});

export default OrderStatusPickerModal;
