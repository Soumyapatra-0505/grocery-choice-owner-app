/**
 * Grocery Choice Owner App - Reusable Badge Component
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '@/theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'info' | 'danger' | 'default';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  style,
  textStyle
}) => {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  default: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1
  },
  success: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
    borderWidth: 1
  },
  warning: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
    borderWidth: 1
  },
  info: {
    backgroundColor: colors.infoLight,
    borderColor: colors.infoBorder,
    borderWidth: 1
  },
  danger: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder,
    borderWidth: 1
  },
  text: {
    fontSize: 11,
    fontWeight: '700'
  },
  text_default: {
    color: '#475569'
  },
  text_success: {
    color: colors.successText
  },
  text_warning: {
    color: colors.warningText
  },
  text_info: {
    color: colors.infoText
  },
  text_danger: {
    color: colors.dangerText
  }
});

export default Badge;
