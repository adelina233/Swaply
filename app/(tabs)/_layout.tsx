import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      initialRouteName="menu" 
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarStyle: {
          display: 'none', 
        },
      }}>
      
      <Tabs.Screen 
        name="menu" 
        options={{ 
          title: 'Menu' 
        }} 
      />

      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home' 
        }} 
      />
    </Tabs>
  );
}
