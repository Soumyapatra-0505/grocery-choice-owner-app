/**
 * Grocery Choice Owner App - Loading Indicator Component
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

interface LoadingIndicatorProps {
  message?: string;
  fullscreen?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  fullscreen = false
}) => {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.background
  },
  message: {
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary
  }
});

export default LoadingIndicator;
