import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
 
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAppLoading, setIsAppLoading] = useState(true);

  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  
  if (isAppLoading) {
    return (
      <View style={styles.splashContainer}>
        <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.logoWrapper}>
          <View style={styles.customLogoContainer}>
            <Ionicons name="home" size={60} color="#FFFFFF" style={styles.houseIcon} />
            <View style={styles.swapBadge}>
              <Ionicons name="sync" size={28} color="#4dabf7" />
            </View>
          </View>
          <Text style={styles.splashText}>Swaply</Text>
        </View>

        <ActivityIndicator size="small" color="#4dabf7" style={styles.loader} />
      </View>
    );
  }

  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        
        <Stack.Screen 
          name="active-swaps" 
          options={{ 
            headerShown: false 
          }} 
        />
        
        <Stack.Screen 
          name="receipt-details" 
          options={{ 
            presentation: 'modal', 
            title: 'Confirmare Plată',
            headerShown: false 
          }} 
        />
        
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoWrapper: { alignItems: 'center', gap: 20 },
  customLogoContainer: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: '#4dabf7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#4dabf7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  houseIcon: { marginBottom: 5 },
  swapBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  splashText: { fontSize: 34, fontWeight: '700', color: '#1A365D', letterSpacing: 1.5, marginTop: 5 },
  loader: { position: 'absolute', bottom: 60 },
});