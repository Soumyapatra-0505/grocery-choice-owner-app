/**
 * Grocery Choice Owner App - Orders List Screen Shell
 * Displays orders with status dropdown/picker control matching Owner Website lifecycle.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { OrderStatusPickerModal, isTerminalOrderStatus } from '@/components/common/OrderStatusPickerModal';
import { colors, spacing } from '@/theme';
import { ordersApi } from '@/api/ordersApi';
import { Order, OrderStatus } from '@/types';
import { formatCurrency, formatDateTime, formatStatusLabel, getStatusVariant } from '@/utils/formatters';

export default function OrdersListScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status picker state
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.getAll();
      setOrders(data || []);
    } catch (e) {
      console.warn('Failed to load orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Auto-clear feedback banner
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3500);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const handleOpenStatusPicker = (order: Order) => {
    if (updatingOrderId !== null) return;
    if (isTerminalOrderStatus(order.status)) {
      Alert.alert(
        'Order Status Locked',
        `This order is already marked as ${formatStatusLabel(order.status)}. Delivered and Cancelled orders cannot be modified.`
      );
      return;
    }
    setSelectedOrderForStatus(order);
  };

  const handleSelectStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrderForStatus || updatingOrderId !== null) return;

    const targetOrder = selectedOrderForStatus;
    const orderId = targetOrder.id;

    // No-op if unchanged
    if (targetOrder.status === newStatus) {
      setSelectedOrderForStatus(null);
      return;
    }

    // Safeguard: terminal states cannot be changed
    if (isTerminalOrderStatus(targetOrder.status)) {
      setSelectedOrderForStatus(null);
      Alert.alert(
        'Order Status Locked',
        'Delivered and Cancelled orders are in terminal states and cannot be modified.'
      );
      return;
    }

    setSelectedOrderForStatus(null);
    setUpdatingOrderId(orderId);
    setFeedback(null);

    try {
      const updated = await ordersApi.updateStatus(orderId, newStatus);

      // Immediately update local order state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, ...(updated || {}), status: updated?.status || newStatus }
            : o
        )
      );

      setFeedback({
        type: 'success',
        message: `Order #${targetOrder.orderNumber || orderId} status updated to ${formatStatusLabel(newStatus)}!`
      });
    } catch (err: any) {
      console.error('Failed to update order status:', err);
      const errMsg = err?.data?.message || err?.message || 'Failed to update order status.';
      setFeedback({
        type: 'error',
        message: errMsg
      });
      Alert.alert('Status Update Failed', errMsg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Customer Orders" subtitle={`${orders.length} total orders recorded`} />

      {/* Feedback Banner */}
      {feedback && (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError
            ]}
          >
            {feedback.message}
          </Text>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptySubtitle}>Customer orders will appear here in real-time.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isItemTerminal = isTerminalOrderStatus(item.status);
          const isItemUpdating = updatingOrderId === item.id;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/(tabs)/orders/${item.id}` as any)}
            >
              <Card style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderNumberBlock}>
                    <Text style={styles.orderNumber}>#{item.orderNumber || item.id}</Text>
                    <Text style={styles.orderDate}>{formatDateTime(item.createdAt)}</Text>
                  </View>

                  {/* Status Dropdown / Trigger */}
                  <TouchableOpacity
                    activeOpacity={isItemTerminal ? 1 : 0.7}
                    disabled={isItemUpdating}
                    onPress={() => handleOpenStatusPicker(item)}
                    style={[
                      styles.statusTriggerBtn,
                      isItemTerminal && styles.statusTriggerBtnLocked,
                      isItemUpdating && styles.statusTriggerBtnUpdating
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isItemUpdating ? (
                      <View style={styles.statusUpdatingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.updatingText}>Saving...</Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadgeRow}>
                        <Badge
                          label={formatStatusLabel(item.status)}
                          variant={getStatusVariant(item.status)}
                        />
                        {!isItemTerminal && (
                          <Text style={styles.statusChevron}>▾</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.customerRow}>
                  <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
                  <Text style={styles.orderAmount}>{formatCurrency(item.totalAmount)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      {/* Reusable Status Picker Modal */}
      {selectedOrderForStatus && (
        <OrderStatusPickerModal
          visible={!!selectedOrderForStatus}
          currentStatus={selectedOrderForStatus.status}
          orderNumber={selectedOrderForStatus.orderNumber || String(selectedOrderForStatus.id)}
          onSelectStatus={handleSelectStatus}
          onClose={() => setSelectedOrderForStatus(null)}
          loading={updatingOrderId === selectedOrderForStatus.id}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  feedbackBanner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1
  },
  feedbackSuccess: {
    backgroundColor: '#ecfdf5',
    borderBottomColor: '#a7f3d0'
  },
  feedbackError: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca'
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center'
  },
  feedbackTextSuccess: {
    color: '#065f46'
  },
  feedbackTextError: {
    color: '#b91c1c'
  },
  listContent: {
    padding: spacing.lg
  },
  orderCard: {
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  orderNumberBlock: {
    flex: 1,
    marginRight: spacing.sm
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'monospace'
  },
  orderDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  statusTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 8
  },
  statusTriggerBtnLocked: {
    opacity: 0.95
  },
  statusTriggerBtnUpdating: {
    opacity: 0.8
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  statusChevron: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    marginLeft: 2
  },
  statusUpdatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  updatingText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700'
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4
  }
});
