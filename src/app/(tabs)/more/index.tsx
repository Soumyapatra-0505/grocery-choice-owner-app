/**
 * Grocery Choice Owner App - More Screen Shell
 * Management menu, profile details, and logout action.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOwnerAuth } from '@/context/OwnerAuthContext';
import { Header } from '@/components/common/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/theme';
import { APP_CONFIG } from '@/constants/config';

export default function MoreScreen() {
  const router = useRouter();
  const { owner, logout } = useOwnerAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from the Owner Portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Store Management" subtitle="System controls & account" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/more/profile')}
        >
          <Card style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {owner?.fullName ? owner.fullName.charAt(0).toUpperCase() : 'O'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{owner?.fullName || 'Store Manager'}</Text>
                <Text style={styles.profileContact}>{owner?.email || owner?.phone}</Text>
                <View style={styles.badgeRow}>
                  <Badge label={owner?.role || 'STAFF'} variant="success" />
                  {owner?.primaryOwner && <Badge label="Primary Owner" variant="info" />}
                </View>
              </View>
              <Text style={styles.chevronIcon}>›</Text>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Modules Section */}
        <Text style={styles.sectionHeader}>Store Administration</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/more/categories')}
          >
            <Text style={styles.menuIcon}>🏷️</Text>
            <View style={styles.menuItemText}>
              <Text style={styles.menuTitle}>Category Management</Text>
              <Text style={styles.menuDesc}>Catalog departments &amp; merchandising</Text>
            </View>
            <Text style={styles.chevronIcon}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/more/staff')}
          >
            <Text style={styles.menuIcon}>👥</Text>
            <View style={styles.menuItemText}>
              <Text style={styles.menuTitle}>Staff &amp; Access Controls</Text>
              <Text style={styles.menuDesc}>Directory, roles, designations &amp; audit</Text>
            </View>
            <Text style={styles.chevronIcon}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/more/reports')}
          >
            <Text style={styles.menuIcon}>📈</Text>
            <View style={styles.menuItemText}>
              <Text style={styles.menuTitle}>Sales &amp; Operational Reports</Text>
              <Text style={styles.menuDesc}>Performance metrics &amp; fulfillment rates</Text>
            </View>
            <Text style={styles.chevronIcon}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* Sign Out Button */}
        <Button
          title="Sign Out from Store Portal"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutButton}
        />

        <View style={styles.appVersionFooter}>
          <Text style={styles.appVersionText}>
            {APP_CONFIG.APP_NAME} v{APP_CONFIG.APP_VERSION}
          </Text>
          <Text style={styles.appVersionSub}>Dedicated Store Operations App</Text>
        </View>
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
    padding: spacing.lg
  },
  profileCard: {
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary
  },
  profileContact: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.xl
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md
  },
  menuIcon: {
    fontSize: 22,
    marginRight: spacing.md
  },
  menuItemText: {
    flex: 1
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  menuDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 54
  },
  chevronIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: spacing.xs
  },
  logoutButton: {
    marginTop: spacing.sm
  },
  appVersionFooter: {
    alignItems: 'center',
    marginTop: spacing.xl
  },
  appVersionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  appVersionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  }
});
