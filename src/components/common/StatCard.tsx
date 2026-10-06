/**
 * Grocery Choice Owner App - Stat Card Component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trendText?: string;
  isPositive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trendText,
  isPositive = true
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>
      <Text style={styles.value}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {trendText && (
        <View style={styles.trendRow}>
          <Text style={[styles.trendText, isPositive ? styles.trendPos : styles.trendNeg]}>
            {trendText}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flex: 1,
    minWidth: '45%'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  icon: {
    fontSize: 16
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  trendRow: {
    marginTop: 6
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700'
  },
  trendPos: {
    color: colors.successText
  },
  trendNeg: {
    color: colors.dangerText
  }
});

export default StatCard;
