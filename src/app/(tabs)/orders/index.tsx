/**
 * Grocery Choice Owner App - Orders List Screen Shell
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { colors, spacing } from '@/theme';
import { ordersApi } from '@/api/ordersApi';
import { Order } from '@/types';
import { formatCurrency, formatDateTime, formatStatusLabel, getStatusVariant } from '@/utils/formatters';

export default function OrdersListScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Customer Orders" subtitle={`${orders.length} total orders recorded`} />

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
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/(tabs)/orders/${item.id}` as any)}
          >
            <Card style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderNumber}>#{item.orderNumber || item.id}</Text>
                  <Text style={styles.orderDate}>{formatDateTime(item.createdAt)}</Text>
                </View>
                <Badge
                  label={formatStatusLabel(item.status)}
                  variant={getStatusVariant(item.status)}
                />
              </View>

              <View style={styles.customerRow}>
                <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
                <Text style={styles.orderAmount}>{formatCurrency(item.totalAmount)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
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
