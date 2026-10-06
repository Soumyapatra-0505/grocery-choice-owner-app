/**
 * Grocery Choice Owner App - Reusable Button Component
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle
} from 'react-native';
import { colors, spacing } from '@/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? colors.primary : colors.textInverse}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.textBase,
              styles[`text_${variant}`],
              styles[`textSize_${size}`],
              textStyle
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: spacing.sm
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.secondary
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border
  },
  danger: {
    backgroundColor: colors.danger
  },
  size_sm: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  size_md: {
    paddingVertical: 13,
    paddingHorizontal: 16
  },
  size_lg: {
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  disabled: {
    opacity: 0.55
  },
  textBase: {
    fontWeight: '700'
  },
  text_primary: {
    color: colors.textInverse
  },
  text_secondary: {
    color: colors.textInverse
  },
  text_outline: {
    color: colors.textPrimary
  },
  text_danger: {
    color: colors.textInverse
  },
  textSize_sm: {
    fontSize: 13
  },
  textSize_md: {
    fontSize: 15
  },
  textSize_lg: {
    fontSize: 16
  }
});

export default Button;
