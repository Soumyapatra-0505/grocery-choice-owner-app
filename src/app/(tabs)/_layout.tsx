/**
 * Grocery Choice Owner App - Tabs Layout
 * 5 Core Tabs: Dashboard, Orders, Products, Inventory, and More.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/theme';

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ icon, label, focused }) => {
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.iconText, focused && styles.iconTextFocused]}>{icon}</Text>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
};

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📊" label="Overview" focused={focused} />
          )
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📦" label="Orders" focused={focused} />
          )
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏷️" label="Products" focused={focused} />
          )
        }}
      />

      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏬" label="Stock" focused={focused} />
          )
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="⚙️" label="More" focused={focused} />
          )
        }}
      />

      {/* Hidden Sub-Routes (accessible via in-app navigation, omitted from bottom tab bar) */}
      <Tabs.Screen
        name="products/add"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />

      <Tabs.Screen
        name="products/edit/[id]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />

      <Tabs.Screen
        name="orders/[id]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />

      <Tabs.Screen
        name="more/categories"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />

      <Tabs.Screen
        name="more/reports"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />

      <Tabs.Screen
        name="more/staff"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />

      <Tabs.Screen
        name="more/profile"
        options={{
          href: null,
          tabBarStyle: { display: 'none' }
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 6,
    paddingTop: 6
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54
  },
  iconText: {
    fontSize: 20,
    opacity: 0.7
  },
  iconTextFocused: {
    opacity: 1
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2
  },
  labelFocused: {
    color: colors.primary,
    fontWeight: '800'
  }
});
