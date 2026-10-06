/**
 * Grocery Choice Owner App - Screen Header Component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '@/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: {
    icon: string;
    onPress: () => void;
  };
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  leftAction,
  rightAction
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {leftAction && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={leftAction.onPress}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>{leftAction.icon}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleWrapper}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs
  },
  backIcon: {
    fontSize: 20,
    color: colors.primary
  },
  titleWrapper: {
    flex: 1
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  rightAction: {
    marginLeft: spacing.sm
  }
});

export default Header;
