import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Grupul principal de tab-uri */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        
        {/* --- MODIFICARE AICI: Înregistrăm pagina de PDF --- */}
        <Stack.Screen 
          name="receipt-details" 
          options={{ 
            presentation: 'modal', // Se va deschide ca un pop-up frumos de jos în sus
            title: 'Confirmare Plată',
            headerShown: false // O lăsăm false pentru că avem design-ul nostru în pagină
          }} 
        />
        
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}