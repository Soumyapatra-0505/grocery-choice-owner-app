/**
 * Grocery Choice Owner App - Order Details Screen
 * Complete implementation: Customer Details, Ordered Items list,
 * Payment Mode & Status, Financial Summary, and robust Back navigation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { ordersApi } from '@/api/ordersApi';
import { Order, OrderItem } from '@/types';
import {
  formatCurrency,
  formatDateTime,
  formatStatusLabel,
  getStatusVariant
} from '@/utils/formatters';
import { APP_CONFIG } from '@/constants/config';

const getPaymentStatusVariant = (
  status?: string
): 'success' | 'warning' | 'info' | 'danger' | 'default' => {
  switch (status?.toUpperCase()) {
    case 'PAID':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'FAILED':
      return 'danger';
    case 'REFUNDED':
      return 'info';
    default:
      return 'default';
  }
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Robust back navigation to Orders list
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/orders');
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

  useEffect(() => {
    if (!id) return;
    ordersApi.getById(Number(id))
      .then((data) => setOrder(data))
      .catch((e) => console.warn('Error fetching order', e))
      .finally(() => setLoading(false));
  }, [id]);

  const totalUnits = useMemo(() => {
    if (!order?.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [order?.items]);

  if (loading) {
    return <LoadingIndicator fullscreen message="Loading order details..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={`Order #${order?.orderNumber || id}`}
        subtitle={formatDateTime(order?.createdAt)}
        leftAction={{
          icon: '←',
          onPress: handleBack
        }}
        rightAction={
          order?.status ? (
            <Badge
              label={formatStatusLabel(order.status)}
              variant={getStatusVariant(order.status)}
            />
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {order ? (
          <>
            {/* 1. Customer Details Card */}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Customer Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{order.customerName || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{order.customerPhone || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{order.customerEmail || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={[styles.detailValue, styles.addressText]}>
                  {order.deliveryAddressText || 'Standard Delivery Address'}
                </Text>
              </View>
              {!!order.deliverySlot && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivery Slot</Text>
                  <Text style={styles.detailValue}>{order.deliverySlot}</Text>
                </View>
              )}
            </Card>

            {/* 2. Ordered Items Card */}
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>
                  Ordered Items ({order.items?.length || 0})
                </Text>
                <Badge
                  label={`${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`}
                  variant="default"
                />
              </View>

              {order.items && order.items.length > 0 ? (
                order.items.map((item: OrderItem, idx: number) => {
                  const unitPrice = item.price ?? item.unitPrice ?? 0;
                  const lineTotal =
                    item.subtotal ??
                    item.totalPrice ??
                    unitPrice * (item.quantity || 1);

                  return (
                    <View
                      key={item.id ? `item-${item.id}` : `idx-${idx}`}
                      style={[
                        styles.itemRow,
                        idx < order.items.length - 1 && styles.itemRowBorder
                      ]}
                    >
                      <Image
                        source={{ uri: item.imageUrl || APP_CONFIG.FALLBACK_PRODUCT_IMAGE }}
                        style={styles.itemImage}
                        contentFit="cover"
                        transition={150}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.productName}
                        </Text>
                        <Text style={styles.itemMeta}>
                          {item.unit ? `${item.unit} • ` : ''}Qty: {item.quantity} × {formatCurrency(unitPrice)}
                        </Text>
                      </View>
                      <Text style={styles.itemLineTotal}>
                        {formatCurrency(lineTotal)}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyItemsText}>No items recorded for this order.</Text>
              )}
            </Card>

            {/* 3. Payment Information Card */}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Payment Information</Text>
              <View style={styles.detailRowBetween}>
                <Text style={styles.detailLabel}>Payment Mode</Text>
                <Text style={styles.paymentMethodText}>
                  {order.paymentMethod || 'Cash on Delivery'}
                </Text>
              </View>
              <View style={styles.detailRowBetween}>
                <Text style={styles.detailLabel}>Payment Status</Text>
                <Badge
                  label={order.paymentStatus || 'PENDING'}
                  variant={getPaymentStatusVariant(order.paymentStatus)}
                />
              </View>
              {!!order.razorpayPaymentId && (
                <View style={styles.detailRowBetween}>
                  <Text style={styles.detailLabel}>Payment ID</Text>
                  <Text style={styles.monoIdText}>{order.razorpayPaymentId}</Text>
                </View>
              )}
              {!!order.razorpayOrderId && (
                <View style={styles.detailRowBetween}>
                  <Text style={styles.detailLabel}>Razorpay Order ID</Text>
                  <Text style={styles.monoIdText}>{order.razorpayOrderId}</Text>
                </View>
              )}
            </Card>

            {/* 4. Financial Summary Card */}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Financial Summary</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Subtotal</Text>
                <Text style={styles.priceValue}>{formatCurrency(order.subtotal)}</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Charge</Text>
                <Text style={styles.priceValue}>
                  {order.deliveryCharge === 0 ? 'FREE' : formatCurrency(order.deliveryCharge)}
                </Text>
              </View>
              {order.discount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.discountLabel}>Discount</Text>
                  <Text style={styles.discountValue}>-{formatCurrency(order.discount)}</Text>
                </View>
              )}
              {!!order.deliverySlot && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery Slot</Text>
                  <Text style={styles.priceValue}>{order.deliverySlot}</Text>
                </View>
              )}
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
              </View>
            </Card>
          </>
        ) : (
          <View style={styles.notFoundContainer}>
            <Text style={styles.notFoundIcon}>📦</Text>
            <Text style={styles.notFoundText}>Order not found.</Text>
            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
              <Text style={styles.backBtnText}>Return to Orders List</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  detailRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500'
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    maxWidth: '65%',
    textAlign: 'right'
  },
  addressText: {
    lineHeight: 18
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  monoIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: 'monospace'
  },
  // Items section styles
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
    marginRight: spacing.sm
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textMuted
  },
  itemLineTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary
  },
  emptyItemsText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    fontStyle: 'italic'
  },
  // Financial summary styles
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5
  },
  priceLabel: {
    fontSize: 13,
    color: colors.textSecondary
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  discountLabel: {
    fontSize: 13,
    color: colors.successText,
    fontWeight: '600'
  },
  discountValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.successText
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    alignItems: 'center'
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary
  },
  notFoundContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  notFoundIcon: {
    fontSize: 44,
    marginBottom: spacing.xs
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8
  },
  backBtnText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 13
  }
});
