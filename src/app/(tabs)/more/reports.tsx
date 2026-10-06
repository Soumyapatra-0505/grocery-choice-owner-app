/**
 * Grocery Choice Owner App - Sales & Operational Reports Screen
 * Comprehensive store analytics: revenue, order status breakdown, payment methods,
 * top-selling merchandise, and live inventory health.
 * Calculates metrics directly from ordersApi.getAll() and productsApi.getAll().
 * Hidden sub-route under (tabs), preserving the 5 core bottom tabs and safe back navigation.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { ordersApi } from '@/api/ordersApi';
import { productsApi } from '@/api/productsApi';
import { Order, Product, OrderStatus } from '@/types';
import {
  formatCurrency,
  formatDateTime,
  formatStatusLabel,
  getStatusVariant
} from '@/utils/formatters';
import { getProductStockStatus } from '@/utils/productValidation';

export default function ReportsScreen() {
  const router = useRouter();
  const { owner } = useOwnerAuth();

  // Role authorization: OWNER, ADMIN, and authorized STORE STAFF
  const isAuthorized =
    owner?.role === 'OWNER' ||
    owner?.role === 'ADMIN' ||
    (owner?.role === 'STAFF' &&
      (!owner?.permissions ||
        owner.permissions.length === 0 ||
        owner.permissions.includes('REPORTS') ||
        owner.permissions.includes('VIEW_REPORTS')));

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Load report data from backend APIs
  const loadReportData = useCallback(async () => {
    setLoadError(null);
    try {
      const [ordersData, productsData] = await Promise.all([
        ordersApi.getAll(),
        productsApi.getAll()
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err: any) {
      console.error('Failed to load report data:', err);
      setLoadError(err?.message || 'Unable to load store reports from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
  };

  // 1. Sales & Revenue Metrics Calculation
  const salesMetrics = useMemo(() => {
    const nonCancelledOrders = orders.filter((o) => {
      const status = (o.status || (o as any).orderStatus || '').toUpperCase();
      return status !== 'CANCELLED';
    });

    const totalRevenue = nonCancelledOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0
    );

    const totalOrdersCount = orders.length;

    const completedOrdersCount = nonCancelledOrders.length;

    const averageOrderValue =
      completedOrdersCount > 0 ? totalRevenue / completedOrdersCount : 0;

    const deliveredOrders = orders.filter((o) => {
      const status = (o.status || (o as any).orderStatus || '').toUpperCase();
      return status === 'DELIVERED';
    });

    // Fulfillment Rate formula: (Delivered / (Total - Cancelled)) * 100
    const fulfillmentRate =
      completedOrdersCount > 0
        ? Math.round((deliveredOrders.length / completedOrdersCount) * 100)
        : 0;

    return {
      totalRevenue,
      totalOrdersCount,
      completedOrdersCount,
      deliveredOrdersCount: deliveredOrders.length,
      averageOrderValue,
      fulfillmentRate
    };
  }, [orders]);

  // 2. Order Status Breakdown Calculation
  const statusBreakdown = useMemo(() => {
    const STATUS_KEYS: OrderStatus[] = [
      'PLACED',
      'CONFIRMED',
      'PROCESSING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED'
    ];

    const counts: Record<OrderStatus, number> = {
      PLACED: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0
    };

    orders.forEach((o) => {
      const status = (o.status || (o as any).orderStatus || '').toUpperCase() as OrderStatus;
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });

    const total = orders.length;

    return STATUS_KEYS.map((st) => ({
      status: st,
      count: counts[st],
      percentage: total > 0 ? Math.round((counts[st] / total) * 100) : 0
    }));
  }, [orders]);

  // 3. Payment Method Breakdown Calculation
  const paymentBreakdown = useMemo(() => {
    interface PaymentGroup {
      key: string;
      label: string;
      icon: string;
      count: number;
      amount: number;
    }

    const groups: Record<string, PaymentGroup> = {
      COD: {
        key: 'COD',
        label: 'Cash on Delivery',
        icon: '💵',
        count: 0,
        amount: 0
      },
      ONLINE: {
        key: 'ONLINE',
        label: 'Online / Razorpay',
        icon: '💳',
        count: 0,
        amount: 0
      },
      OTHER: {
        key: 'OTHER',
        label: 'Other Methods',
        icon: '📱',
        count: 0,
        amount: 0
      }
    };

    orders.forEach((o) => {
      const method = (o.paymentMethod || '').trim().toUpperCase();
      const status = (o.status || (o as any).orderStatus || '').toUpperCase();
      const isCancelled = status === 'CANCELLED';
      const orderAmount = isCancelled ? 0 : Number(o.totalAmount) || 0;

      if (
        method.includes('COD') ||
        method.includes('CASH') ||
        method === 'CASH_ON_DELIVERY' ||
        method === ''
      ) {
        groups.COD.count++;
        groups.COD.amount += orderAmount;
      } else if (
        method.includes('ONLINE') ||
        method.includes('RAZORPAY') ||
        method.includes('UPI') ||
        method.includes('CARD') ||
        method.includes('NET_BANKING')
      ) {
        groups.ONLINE.count++;
        groups.ONLINE.amount += orderAmount;
      } else {
        groups.OTHER.count++;
        groups.OTHER.amount += orderAmount;
      }
    });

    const totalOrders = orders.length;

    return Object.values(groups)
      .filter((g) => g.count > 0 || g.key !== 'OTHER')
      .map((g) => ({
        ...g,
        percentage: totalOrders > 0 ? Math.round((g.count / totalOrders) * 100) : 0
      }));
  }, [orders]);

  // 4. Top-Selling Products Calculation
  const topProducts = useMemo(() => {
    const productSalesMap = new Map<
      string,
      { productName: string; quantitySold: number; totalRevenue: number }
    >();

    orders.forEach((o) => {
      const status = (o.status || (o as any).orderStatus || '').toUpperCase();
      // Exclude cancelled orders from merchandise sales
      if (status === 'CANCELLED') return;

      if (Array.isArray(o.items)) {
        o.items.forEach((item) => {
          const name = item.productName || `Product #${item.productId}`;
          const qty = Number(item.quantity) || 0;
          const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
          const lineTotal = Number(item.subtotal ?? item.totalPrice ?? (qty * unitPrice));

          const existing = productSalesMap.get(name);
          if (existing) {
            existing.quantitySold += qty;
            existing.totalRevenue += lineTotal;
          } else {
            productSalesMap.set(name, {
              productName: name,
              quantitySold: qty,
              totalRevenue: lineTotal
            });
          }
        });
      }
    });

    return Array.from(productSalesMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);
  }, [orders]);

  // 5. Inventory Health Calculation
  const inventoryHealth = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.active !== false).length;
    const lowStockProducts = products.filter(
      (p) => getProductStockStatus(p.stockQuantity).status === 'LOW_STOCK'
    ).length;
    const outOfStockProducts = products.filter(
      (p) => getProductStockStatus(p.stockQuantity).status === 'OUT_OF_STOCK'
    ).length;

    return {
      totalProducts,
      activeProducts,
      lowStockProducts,
      outOfStockProducts
    };
  }, [products]);

  // Date span note
  const dateRangeNote = useMemo(() => {
    if (orders.length === 0) return 'No order transactions recorded';
    const dates = orders
      .map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : 0))
      .filter((d) => d > 0);

    if (dates.length === 0) return `Based on ${orders.length} available orders`;

    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    return `All available data (${formatDateTime(earliest.toISOString()).split(',')[0]} – ${formatDateTime(latest.toISOString()).split(',')[0]})`;
  }, [orders]);

  if (!isAuthorized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title="Sales & Reports"
          subtitle="Access Restricted"
          leftAction={{ icon: '←', onPress: handleBack }}
        />
        <View style={styles.unauthorizedContainer}>
          <Card style={styles.unauthorizedCard}>
            <Text style={styles.unauthorizedIcon}>🔒</Text>
            <Text style={styles.unauthorizedTitle}>Access Denied</Text>
            <Text style={styles.unauthorizedMessage}>
              You do not have permission to view store sales and operational reports.
            </Text>
            <Button
              title="Return to Menu"
              onPress={handleBack}
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
        title="Sales & Operational Reports"
        subtitle="Store Performance & Analytics"
        leftAction={{ icon: '←', onPress: handleBack }}
      />

      {loading ? (
        <LoadingIndicator fullscreen message="Compiling store reports..." />
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to Load Reports</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <Button
              title="Try Again"
              onPress={loadReportData}
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
          {/* Data Scope & Range Header */}
          <View style={styles.scopeBanner}>
            <View style={styles.scopeDot} />
            <View style={styles.scopeTextContainer}>
              <Text style={styles.scopeTitle}>Store Performance</Text>
              <Text style={styles.scopeSubtitle}>
                Based on available orders • {dateRangeNote}
              </Text>
            </View>
          </View>

          {/* 1. Summary Sales KPIs */}
          <Text style={styles.sectionHeader}>Key Financial &amp; Fulfillment Metrics</Text>
          <View style={styles.kpiGrid}>
            {/* Total Revenue */}
            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>Total Revenue</Text>
                <Text style={styles.kpiIcon}>💰</Text>
              </View>
              <Text style={styles.kpiValue} numberOfLines={1}>
                {formatCurrency(salesMetrics.totalRevenue)}
              </Text>
              <Text style={styles.kpiSub}>Non-cancelled orders</Text>
            </Card>

            {/* Total Orders */}
            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>Total Orders</Text>
                <Text style={styles.kpiIcon}>📦</Text>
              </View>
              <Text style={styles.kpiValue}>{salesMetrics.totalOrdersCount}</Text>
              <Text style={styles.kpiSub}>
                {salesMetrics.completedOrdersCount} active / fulfilled
              </Text>
            </Card>

            {/* Average Order Value (AOV) */}
            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>Avg Order Value</Text>
                <Text style={styles.kpiIcon}>📊</Text>
              </View>
              <Text style={styles.kpiValue} numberOfLines={1}>
                {formatCurrency(salesMetrics.averageOrderValue)}
              </Text>
              <Text style={styles.kpiSub}>Per active order</Text>
            </Card>

            {/* Fulfillment Rate */}
            <Card style={styles.kpiCard}>
              <View style={styles.kpiHeaderRow}>
                <Text style={styles.kpiLabel}>Fulfillment Rate</Text>
                <Text style={styles.kpiIcon}>⚡</Text>
              </View>
              <Text style={styles.kpiValue}>{salesMetrics.fulfillmentRate}%</Text>
              <Text style={styles.kpiSub}>
                {salesMetrics.deliveredOrdersCount} of {salesMetrics.completedOrdersCount} delivered
              </Text>
            </Card>
          </View>

          {/* 2. Order Status Breakdown */}
          <Text style={styles.sectionHeader}>Order Status Breakdown</Text>
          <Card style={styles.breakdownCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Fulfillment Pipeline</Text>
              <Badge label={`${orders.length} Total`} variant="default" />
            </View>

            {orders.length === 0 ? (
              <Text style={styles.emptyCardText}>No orders recorded yet.</Text>
            ) : (
              statusBreakdown.map((item, idx) => (
                <View key={item.status} style={styles.statusRowContainer}>
                  <View style={styles.statusRow}>
                    <View style={styles.statusLabelContainer}>
                      <Badge
                        label={formatStatusLabel(item.status)}
                        variant={getStatusVariant(item.status)}
                      />
                    </View>
                    <Text style={styles.statusCount}>
                      {item.count} <Text style={styles.statusPercent}>({item.percentage}%)</Text>
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${item.percentage}%`,
                          backgroundColor:
                            item.status === 'DELIVERED'
                              ? colors.primary
                              : item.status === 'CANCELLED'
                              ? colors.danger
                              : item.status === 'OUT_FOR_DELIVERY'
                              ? colors.info
                              : colors.warning
                        }
                      ]}
                    />
                  </View>
                  {idx < statusBreakdown.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))
            )}
          </Card>

          {/* 3. Payment Method Breakdown */}
          <Text style={styles.sectionHeader}>Payment Method Breakdown</Text>
          <Card style={styles.breakdownCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Payment Distribution</Text>
              <Text style={styles.cardSubtitleText}>By volume &amp; share</Text>
            </View>

            {orders.length === 0 ? (
              <Text style={styles.emptyCardText}>No payment data available.</Text>
            ) : (
              paymentBreakdown.map((item, idx) => (
                <View key={item.key} style={styles.paymentRowContainer}>
                  <View style={styles.paymentRow}>
                    <View style={styles.paymentMethodInfo}>
                      <Text style={styles.paymentIcon}>{item.icon}</Text>
                      <View>
                        <Text style={styles.paymentName}>{item.label}</Text>
                        <Text style={styles.paymentRevenue}>
                          {formatCurrency(item.amount)} non-cancelled
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentNumbers}>
                      <Text style={styles.paymentCount}>{item.count} orders</Text>
                      <Text style={styles.paymentPercent}>{item.percentage}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${item.percentage}%`,
                          backgroundColor:
                            item.key === 'COD' ? '#0284c7' : colors.primary
                        }
                      ]}
                    />
                  </View>
                  {idx < paymentBreakdown.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))
            )}
          </Card>

          {/* 4. Top-Selling Products */}
          <Text style={styles.sectionHeader}>Top-Selling Merchandise</Text>
          <Card style={styles.breakdownCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Highest Volume Products</Text>
              <Text style={styles.cardSubtitleText}>Non-cancelled orders</Text>
            </View>

            {topProducts.length === 0 ? (
              <View style={styles.emptyProductsBox}>
                <Text style={styles.emptyCardText}>
                  No item sales recorded from active orders yet.
                </Text>
              </View>
            ) : (
              topProducts.map((prod, idx) => (
                <View key={prod.productName + idx} style={styles.topProductRow}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.topProductInfo}>
                    <Text style={styles.topProductName} numberOfLines={1}>
                      {prod.productName}
                    </Text>
                    <Text style={styles.topProductSales}>
                      {formatCurrency(prod.totalRevenue)} generated
                    </Text>
                  </View>
                  <View style={styles.topProductQtyBadge}>
                    <Text style={styles.topProductQtyText}>
                      {prod.quantitySold} sold
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>

          {/* 5. Inventory Health */}
          <Text style={styles.sectionHeader}>Inventory Health &amp; Stock Levels</Text>
          <Card style={styles.breakdownCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Catalog Availability</Text>
              <Badge label={`${inventoryHealth.totalProducts} Total`} variant="default" />
            </View>

            <View style={styles.inventoryGrid}>
              {/* Total Catalog */}
              <View style={styles.inventoryPill}>
                <Text style={styles.inventoryPillIcon}>🏷️</Text>
                <Text style={styles.inventoryPillValue}>
                  {inventoryHealth.totalProducts}
                </Text>
                <Text style={styles.inventoryPillLabel}>Total Items</Text>
              </View>

              {/* Active Products */}
              <View style={styles.inventoryPill}>
                <Text style={styles.inventoryPillIcon}>✅</Text>
                <Text style={[styles.inventoryPillValue, { color: colors.primary }]}>
                  {inventoryHealth.activeProducts}
                </Text>
                <Text style={styles.inventoryPillLabel}>Active Store</Text>
              </View>

              {/* Low Stock Products */}
              <View style={styles.inventoryPill}>
                <Text style={styles.inventoryPillIcon}>⚠️</Text>
                <Text style={[styles.inventoryPillValue, { color: colors.warning }]}>
                  {inventoryHealth.lowStockProducts}
                </Text>
                <Text style={styles.inventoryPillLabel}>Low Stock</Text>
              </View>

              {/* Out of Stock Products */}
              <View style={styles.inventoryPill}>
                <Text style={styles.inventoryPillIcon}>🚫</Text>
                <Text style={[styles.inventoryPillValue, { color: colors.danger }]}>
                  {inventoryHealth.outOfStockProducts}
                </Text>
                <Text style={styles.inventoryPillLabel}>Out of Stock</Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      )}
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
    paddingBottom: spacing.xxxl
  },
  scopeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  scopeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: spacing.sm
  },
  scopeTextContainer: {
    flex: 1
  },
  scopeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark
  },
  scopeSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  kpiCard: {
    width: '48.5%',
    padding: spacing.md,
    borderRadius: 12
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    flex: 1
  },
  kpiIcon: {
    fontSize: 16
  },
  kpiValue: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 2
  },
  kpiSub: {
    fontSize: 11,
    color: colors.textMuted
  },
  breakdownCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.xs
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary
  },
  cardSubtitleText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600'
  },
  emptyCardText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md
  },
  statusRowContainer: {
    marginBottom: spacing.sm
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  statusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  statusPercent: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600'
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginTop: spacing.sm
  },
  paymentRowContainer: {
    marginBottom: spacing.sm
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  paymentIcon: {
    fontSize: 22,
    marginRight: spacing.sm
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  paymentRevenue: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1
  },
  paymentNumbers: {
    alignItems: 'flex-end'
  },
  paymentCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  paymentPercent: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600'
  },
  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary
  },
  topProductInfo: {
    flex: 1,
    marginRight: spacing.sm
  },
  topProductName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  topProductSales: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  topProductQtyBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6
  },
  topProductQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark
  },
  emptyProductsBox: {
    paddingVertical: spacing.md
  },
  inventoryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs
  },
  inventoryPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  inventoryPillIcon: {
    fontSize: 18,
    marginBottom: 4
  },
  inventoryPillValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 2
  },
  inventoryPillLabel: {
    fontSize: 10,
    fontWeight: '700',
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
    fontSize: 44,
    marginBottom: spacing.sm
  },
  unauthorizedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6
  },
  unauthorizedMessage: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center'
  }
});
