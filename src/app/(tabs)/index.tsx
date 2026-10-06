/**
 * Grocery Choice Owner App - Store Dashboard Screen
 * Connected to live backend APIs: Products, Categories, and Orders.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { colors, spacing } from '@/theme';
import { productsApi } from '@/api/productsApi';
import { categoriesApi } from '@/api/categoriesApi';
import { ordersApi } from '@/api/ordersApi';
import { Product, Category, Order } from '@/types';
import {
  formatCurrency,
  formatDateTime,
  formatStatusLabel,
  getStatusVariant
} from '@/utils/formatters';
import { getProductStockStatus, filterProductsList } from '@/utils/productValidation';
import { recentSearchStorage } from '@/storage/storage';

export default function DashboardScreen() {
  const { owner, logout } = useOwnerAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Global Product Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load persisted recent searches on mount
  useEffect(() => {
    recentSearchStorage.getRecentSearches().then(setRecentSearches);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery) return [];
    return filterProductsList(products, { searchQuery: debouncedSearchQuery });
  }, [products, debouncedSearchQuery]);

  const handleOpenSearch = async () => {
    const loaded = await recentSearchStorage.getRecentSearches();
    setRecentSearches(loaded);
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSelectRecentSearch = (term: string) => {
    setSearchQuery(term);
    recentSearchStorage.addSearchTerm(term).then(setRecentSearches);
  };

  const handleClearHistory = async () => {
    await recentSearchStorage.clearRecentSearches();
    setRecentSearches([]);
  };

  const handleCommitSearch = async (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    const updated = await recentSearchStorage.addSearchTerm(cleanTerm);
    setRecentSearches(updated);
  };

  const handleSelectProduct = async (product: Product) => {
    const termToSave = searchQuery.trim() || product.name;
    if (termToSave) {
      const updated = await recentSearchStorage.addSearchTerm(termToSave);
      setRecentSearches(updated);
    }
    setIsSearchOpen(false);
    setSearchQuery('');
    router.push(`/(tabs)/products/edit/${product.id}` as any);
  };

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    setFetchError(null);

    try {
      const [prodsRes, catsRes, ordsRes] = await Promise.all([
        productsApi.getAll().catch((e) => {
          console.warn('Products fetch note:', e?.message);
          return [] as Product[];
        }),
        categoriesApi.getAll().catch((e) => {
          console.warn('Categories fetch note:', e?.message);
          return [] as Category[];
        }),
        ordersApi.getAll().catch((e) => {
          console.warn('Orders fetch note:', e?.message);
          return [] as Order[];
        })
      ]);

      setProducts(Array.isArray(prodsRes) ? prodsRes : []);
      setCategories(Array.isArray(catsRes) ? catsRes : []);
      setOrders(Array.isArray(ordsRes) ? ordsRes : []);
    } catch (err: any) {
      console.error('Failed to sync dashboard data:', err);
      setFetchError(err?.message || 'Unable to sync data with the store server.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData(true);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of the store portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        }
      }
    ]);
  };

  // KPI Calculations
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.active !== false).length;
  const totalCategories = categories.length;
  const lowStockProducts = products.filter(
    (p) => p.stockQuantity <= 10 && p.stockQuantity > 0
  );
  const outOfStockProducts = products.filter((p) => p.stockQuantity === 0);
  const lowStockCount = lowStockProducts.length;
  const outOfStockCount = outOfStockProducts.length;

  // Stock Alerts list (out of stock first, then low stock, top 5)
  const urgentStockAlerts = [...outOfStockProducts, ...lowStockProducts].slice(0, 5);

  // Recent Orders list (sorted newest first, top 5)
  const recentOrders = [...orders]
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 5);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Store Overview"
        subtitle={`${owner?.fullName || 'Store Manager'} • ${owner?.role || 'STAFF'}`}
        rightAction={
          <Badge
            label={owner?.role || 'STAFF'}
            variant="success"
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Fetch Error Banner */}
        {fetchError && (
          <View style={styles.errorBox}>
            <View style={styles.errorHeader}>
              <Text style={styles.errorTitle}>Connection Notice</Text>
              <TouchableOpacity onPress={() => loadDashboardData()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.errorText}>{fetchError}</Text>
          </View>
        )}

        {/* Initial Loading Indicator */}
        {isLoading && products.length === 0 ? (
          <View style={styles.loadingContainer}>
            <LoadingIndicator message="Connecting to store backend..." />
          </View>
        ) : (
          <>
            {/* Compact Product Search Bar Trigger (Opens dedicated search window) */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenSearch}
              style={styles.compactSearchBar}
              accessibilityLabel="Search products"
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <Text style={styles.compactSearchPlaceholder}>Search products...</Text>
            </TouchableOpacity>

            {/* Dedicated Full-Screen Product Search Window */}
            <Modal
              visible={isSearchOpen}
              animationType="slide"
              transparent={false}
              onRequestClose={handleCloseSearch}
            >
              <SafeAreaView style={styles.searchModalSafeArea}>
                {/* Search Window Header: ← Search products... ✕ */}
                <View style={styles.searchModalHeader}>
                  <TouchableOpacity
                    onPress={handleCloseSearch}
                    style={styles.searchBackBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Close search window"
                  >
                    <Text style={styles.searchBackIcon}>←</Text>
                  </TouchableOpacity>

                  <View style={styles.searchModalInputWrapper}>
                    <Input
                      autoFocus
                      placeholder="Search products..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={() => handleCommitSearch(searchQuery)}
                      returnKeyType="search"
                      containerStyle={styles.searchModalInputContainer}
                      leftIcon={<Text style={styles.searchIcon}>🔍</Text>}
                      rightIcon={
                        searchQuery ? (
                          <Text style={styles.clearBtnText}>✕</Text>
                        ) : undefined
                      }
                      onRightIconPress={() => setSearchQuery('')}
                    />
                  </View>
                </View>

                {/* Search Window Content */}
                <ScrollView
                  style={styles.searchModalBody}
                  contentContainerStyle={styles.searchModalScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {searchQuery.trim().length === 0 ? (
                    /* When search field is empty: Recent Searches section */
                    <View style={styles.recentSectionContainer}>
                      <View style={styles.recentSectionHeader}>
                        <Text style={styles.recentSectionTitle}>Recent Searches</Text>
                        {recentSearches.length > 0 && (
                          <TouchableOpacity
                            onPress={handleClearHistory}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={styles.clearHistoryBtnText}>Clear Search History</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {recentSearches.length > 0 ? (
                        <View style={styles.recentListCard}>
                          {recentSearches.map((term, index) => (
                            <TouchableOpacity
                              key={`${term}-${index}`}
                              activeOpacity={0.7}
                              onPress={() => handleSelectRecentSearch(term)}
                              style={[
                                styles.recentItemRow,
                                index < recentSearches.length - 1 && styles.recentItemBorder
                              ]}
                            >
                              <View style={styles.recentItemLeft}>
                                <Text style={styles.recentItemIcon}>🕘</Text>
                                <Text style={styles.recentItemText}>{term}</Text>
                              </View>
                              <Text style={styles.recentItemArrow}>↗</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyHistoryCard}>
                          <Text style={styles.emptyHistoryIcon}>🕘</Text>
                          <Text style={styles.emptyHistoryTitle}>No recent searches</Text>
                          <Text style={styles.emptyHistorySubtitle}>
                            Searches for products by name, SKU, or category will appear here.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    /* When owner types: Search Results section */
                    <View style={styles.resultsSectionContainer}>
                      <View style={styles.resultsSectionHeader}>
                        <Text style={styles.resultsSectionTitle}>
                          Search Results ({searchResults.length})
                        </Text>
                      </View>

                      {searchResults.length > 0 ? (
                        <View style={styles.resultsListCard}>
                          {searchResults.map((item, idx) => {
                            const stockInfo = getProductStockStatus(item.stockQuantity);
                            return (
                              <TouchableOpacity
                                key={item.id}
                                activeOpacity={0.7}
                                onPress={() => handleSelectProduct(item)}
                                style={[
                                  styles.productResultCard,
                                  idx < searchResults.length - 1 && styles.productResultBorder
                                ]}
                              >
                                <View style={styles.productResultMain}>
                                  <Text style={styles.productResultName} numberOfLines={2}>
                                    {item.name}
                                  </Text>
                                  <Text style={styles.productResultMeta}>
                                    {item.category?.name || 'General'} • SKU: {item.sku || 'N/A'} • {item.unit}
                                  </Text>
                                </View>

                                <View style={styles.productResultRight}>
                                  <Text style={styles.productResultPrice}>
                                    {formatCurrency(item.sellingPrice)}
                                  </Text>
                                  <Badge
                                    label={stockInfo.label}
                                    variant={stockInfo.variant}
                                  />
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <Card style={styles.searchEmptyCard}>
                          <Text style={styles.searchEmptyIcon}>🔍</Text>
                          <Text style={styles.searchEmptyTitle}>No Products Found</Text>
                          <Text style={styles.searchEmptySubtitle}>
                            No catalog items match "{searchQuery}". Check the product name, SKU, or category.
                          </Text>
                        </Card>
                      )}
                    </View>
                  )}
                </ScrollView>
              </SafeAreaView>
            </Modal>

            {/* 1. Live Store KPI Metrics */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Live Store Metrics</Text>
              <Text style={styles.lastUpdatedText}>Pull down to refresh</Text>
            </View>

            <View style={styles.metricsGrid}>
              <StatCard
                title="Total Products"
                value={totalProducts}
                subtitle={`${activeProducts} active items`}
                icon="🏷️"
              />
              <StatCard
                title="Active Products"
                value={activeProducts}
                subtitle="Available for sale"
                icon="✅"
                isPositive={activeProducts > 0}
              />
              <StatCard
                title="Categories"
                value={totalCategories}
                subtitle="Product categories"
                icon="📁"
              />
              <StatCard
                title="Low Stock"
                value={lowStockCount}
                subtitle="1 to 10 units remaining"
                icon="⚠️"
                trendText={lowStockCount > 0 ? `${lowStockCount} items need restock` : 'Optimal'}
                isPositive={lowStockCount === 0}
              />
              <StatCard
                title="Out of Stock"
                value={outOfStockCount}
                subtitle="0 units in store"
                icon="🚨"
                trendText={outOfStockCount > 0 ? `${outOfStockCount} items depleted` : 'None'}
                isPositive={outOfStockCount === 0}
              />
            </View>

            {/* 2. Urgent Stock Alerts (<= 10 units) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Stock Alerts (≤ 10 Units)</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/inventory')}
                style={styles.sectionActionBtn}
              >
                <Text style={styles.sectionActionText}>Inventory →</Text>
              </TouchableOpacity>
            </View>

            {urgentStockAlerts.length > 0 ? (
              <View style={styles.alertsList}>
                {urgentStockAlerts.map((prod) => {
                  const isZero = prod.stockQuantity === 0;
                  return (
                    <Card key={prod.id} style={styles.alertCard}>
                      <View style={styles.alertCardContent}>
                        <View style={styles.alertInfo}>
                          <Text style={styles.alertProductName} numberOfLines={1}>
                            {prod.name}
                          </Text>
                          <Text style={styles.alertMeta}>
                            Category: {prod.category?.name || 'General'} • MRP: {formatCurrency(prod.mrp)}
                          </Text>
                        </View>
                        <View style={styles.alertBadgeWrap}>
                          <Badge
                            label={isZero ? 'Out of Stock' : `${prod.stockQuantity} left`}
                            variant={isZero ? 'danger' : 'warning'}
                          />
                        </View>
                      </View>
                      <View style={styles.alertFooter}>
                        <Text style={styles.stockStatusNote}>
                          {isZero
                            ? '🚨 Customer orders blocked until restocked'
                            : `⚠️ Fast depletion warning (${prod.stockQuantity} ${prod.unit?.toLowerCase() || 'units'})`}
                        </Text>
                        <TouchableOpacity
                          onPress={() => router.push('/(tabs)/inventory')}
                          style={styles.restockLink}
                        >
                          <Text style={styles.restockLinkText}>Manage Stock</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>Inventory Fully Stocked</Text>
                <Text style={styles.emptySubtitle}>
                  All catalog products currently have more than 10 units in stock.
                </Text>
              </Card>
            )}

            {/* 3. Recent Customer Orders */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Orders ({orders.length} Total)</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/orders')}
                style={styles.sectionActionBtn}
              >
                <Text style={styles.sectionActionText}>All Orders →</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.length > 0 ? (
              <View style={styles.ordersList}>
                {recentOrders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    activeOpacity={0.85}
                    onPress={() => router.push('/(tabs)/orders')}
                  >
                    <Card style={styles.orderCard}>
                      <View style={styles.orderHeaderRow}>
                        <Text style={styles.orderNumberText}>
                          #{order.orderNumber}
                        </Text>
                        <Badge
                          label={formatStatusLabel(order.status)}
                          variant={getStatusVariant(order.status)}
                        />
                      </View>

                      <View style={styles.orderCustomerRow}>
                        <Text style={styles.orderCustomerText}>
                          👤 {order.customerName || 'Customer'}
                        </Text>
                        <Text style={styles.orderPhoneText}>
                          {order.customerPhone || ''}
                        </Text>
                      </View>

                      <View style={styles.orderDetailRow}>
                        <Text style={styles.orderAmountText}>
                          {formatCurrency(order.totalAmount)}
                        </Text>
                        <Text style={styles.orderPaymentNote}>
                          {order.paymentMethod || 'COD'} • {order.paymentStatus || 'PENDING'}
                        </Text>
                      </View>

                      <View style={styles.orderFooterRow}>
                        <Text style={styles.orderDateText}>
                          🕒 {formatDateTime(order.createdAt)}
                        </Text>
                        <Text style={styles.orderItemCount}>
                          {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>No Orders Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Customer orders will automatically appear here in real-time.
                </Text>
              </Card>
            )}

            {/* 4. Quick Actions */}
            <Text style={styles.sectionTitle}>Store Operations</Text>
            <Card style={styles.actionCard}>
              <View style={styles.actionButtons}>
                <Button
                  title="📦 View Orders Pipeline"
                  onPress={() => router.push('/(tabs)/orders')}
                  variant="outline"
                  size="sm"
                />
                <Button
                  title="🏬 Replenish Stock / Inventory"
                  onPress={() => router.push('/(tabs)/inventory')}
                  variant="outline"
                  size="sm"
                />
                <Button
                  title="🏷️ Catalog & Products"
                  onPress={() => router.push('/(tabs)/products')}
                  variant="primary"
                  size="sm"
                />
              </View>
            </Card>

            {/* 5. Store Hub & Account Details */}
            <Card style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <Text style={styles.infoTitle}>Store Hub &amp; Session</Text>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                  <Text style={styles.logoutBtnText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.infoDetail}>
                <Text style={styles.infoLabel}>Facility: </Text>Grocery Choice Flagship Hub
              </Text>
              <Text style={styles.infoDetail}>
                <Text style={styles.infoLabel}>Account: </Text>{owner?.fullName} ({owner?.role})
              </Text>
              <Text style={styles.infoDetail}>
                <Text style={styles.infoLabel}>Contact: </Text>{owner?.email || owner?.phone}
              </Text>
              <Text style={styles.infoDetail}>
                <Text style={styles.infoLabel}>Designation: </Text>{owner?.designation || 'Store Administrator'}
              </Text>
              <Text style={styles.infoDetail}>
                <Text style={styles.infoLabel}>Primary Master Owner: </Text>
                {owner?.primaryOwner ? 'Yes (Full Root Privileges)' : 'No'}
              </Text>
            </Card>
          </>
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
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  loadingContainer: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.sm
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary
  },
  lastUpdatedText: {
    fontSize: 11,
    color: colors.textMuted
  },
  sectionActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md
  },
  alertsList: {
    marginBottom: spacing.md
  },
  alertCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning
  },
  alertCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  alertInfo: {
    flex: 1,
    marginRight: spacing.sm
  },
  alertProductName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  alertMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  alertBadgeWrap: {
    alignSelf: 'flex-start'
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  stockStatusNote: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1
  },
  restockLink: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 6
  },
  restockLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary
  },
  ordersList: {
    marginBottom: spacing.md
  },
  orderCard: {
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary
  },
  orderCustomerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  orderCustomerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  orderPhoneText: {
    fontSize: 12,
    color: colors.textMuted
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  orderAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary
  },
  orderPaymentNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  orderFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight
  },
  orderDateText: {
    fontSize: 11,
    color: colors.textMuted
  },
  orderItemCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: spacing.xs
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2
  },
  actionCard: {
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  actionButtons: {
    gap: spacing.sm
  },
  infoCard: {
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  infoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.dangerLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  logoutBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText
  },
  infoDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4
  },
  infoLabel: {
    fontWeight: '700',
    color: colors.textPrimary
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dangerText
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.dangerBorder
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.dangerText
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 12
  },
  compactSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  compactSearchPlaceholder: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontWeight: '500'
  },
  searchIcon: {
    fontSize: 16
  },
  clearBtnText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700'
  },
  searchModalSafeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  searchBackBtn: {
    paddingRight: spacing.sm,
    paddingVertical: 4
  },
  searchBackIcon: {
    fontSize: 22,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  searchModalInputWrapper: {
    flex: 1
  },
  searchModalInputContainer: {
    marginBottom: 0
  },
  searchModalBody: {
    flex: 1
  },
  searchModalScroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl
  },
  recentSectionContainer: {
    marginTop: spacing.xs
  },
  recentSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  recentSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  clearHistoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  recentListCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.md
  },
  recentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm
  },
  recentItemIcon: {
    fontSize: 15,
    marginRight: spacing.sm,
    opacity: 0.7
  },
  recentItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  recentItemArrow: {
    fontSize: 14,
    color: colors.textMuted
  },
  emptyHistoryCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs
  },
  emptyHistoryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
    opacity: 0.5
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4
  },
  emptyHistorySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18
  },
  resultsSectionContainer: {
    marginTop: spacing.xs
  },
  resultsSectionHeader: {
    marginBottom: spacing.sm
  },
  resultsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  resultsListCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  productResultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md
  },
  productResultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  productResultMain: {
    flex: 1,
    marginRight: spacing.md
  },
  productResultName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3
  },
  productResultMeta: {
    fontSize: 11,
    color: colors.textMuted
  },
  productResultRight: {
    alignItems: 'flex-end'
  },
  productResultPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4
  },
  searchEmptyCard: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  searchEmptyIcon: {
    fontSize: 28,
    marginBottom: spacing.xs
  },
  searchEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4
  },
  searchEmptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18
  }
});

