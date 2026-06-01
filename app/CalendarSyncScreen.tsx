import { Poppins_400Regular, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

export default function CalendarSyncScreen() {
    const [icalUrl, setIcalUrl] = useState('');
    const [loading, setLoading] = useState(false);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_700Bold,
    });

    const handleSync = async () => {
        // Curățăm URL-ul și forțăm HTTPS (pentru link-urile webcal de Apple/Google)
        let trimmedUrl = icalUrl.trim().replace('webcal://', 'https://');
        
        if (!trimmedUrl.includes('http')) {
            Alert.alert("Eroare", "Te rugăm să introduci un link valid de la Google Calendar.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(trimmedUrl);
            const text = await response.text();

            const blockedDates: any[] = [];
            const veventBlocks = text.split('BEGIN:VEVENT');
            veventBlocks.shift(); 

            veventBlocks.forEach(block => {
                // Regex îmbunătățit pentru Google: extrage primele 8 cifre (YYYYMMDD)
                // Chiar dacă Google trimite și ora (ex: 20260510T100000Z), noi luăm doar data
                const startMatch = block.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
                const endMatch = block.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/);

                if (startMatch && endMatch) {
                    const s = startMatch[1];
                    const e = endMatch[1];

                    // Formatăm pentru baza de date: YYYY-MM-DD
                    const startDate = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00.000Z`;
                    const endDate = `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)}T00:00:00.000Z`;

                    blockedDates.push({
                        start: startDate,
                        end: endDate,
                        summary: 'Ocupat (Google Calendar)',
                        source: 'Google Sync'
                    });
                }
            });

            if (blockedDates.length === 0) {
                Alert.alert("Info", "Nu am găsit evenimente. Asigură-te că ai adăugat un eveniment în Google Calendar înainte de sync.");
                setLoading(false);
                return;
            }

            const userAptRef = doc(db, "apartments", auth.currentUser?.uid!);
            await updateDoc(userAptRef, {
                externalSyncUrl: trimmedUrl,
                blockedDates: blockedDates,
                lastSyncAt: serverTimestamp()
            });

            Alert.alert("Succes", `Sincronizare reușită! Am importat ${blockedDates.length} zile ocupate din Google Calendar.`);
            setIcalUrl('');
        } catch (error) {
            Alert.alert("Eroare", "Nu s-a putut accesa Google Calendar. Verifică dacă link-ul 'Secret Address' este corect.");
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return <View style={styles.loading}><ActivityIndicator color="#4dabf7" /></View>;

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={StyleSheet.absoluteFill} />
            <View style={styles.content}>
                <View style={styles.card}>
                    <Ionicons name="logo-google" size={60} color="#4dabf7" style={styles.icon} />
                    <Text style={styles.title}>Google Calendar Sync</Text>
                    <Text style={styles.description}>
                        Lipește link-ul tău "Secret address in iCal format" pentru a bloca datele automat.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="https://calendar.google.com/calendar/ical/..."
                        placeholderTextColor="#94A3B8"
                        value={icalUrl}
                        onChangeText={setIcalUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity 
                        style={styles.syncBtn} 
                        onPress={handleSync} 
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : (
                            <>
                                <Text style={styles.syncBtnText}>Sincronizează acum</Text>
                                <Ionicons name="sync-outline" size={22} color="#FFF" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 25 },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 30,
        padding: 30,
        elevation: 10,
    },
    icon: { alignSelf: 'center', marginBottom: 10 },
    title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#1A365D', textAlign: 'center', marginBottom: 10 },
    description: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#4A5568', textAlign: 'center', marginBottom: 20 },
    input: {
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 12,
        marginBottom: 10,
    },
    syncBtn: {
        backgroundColor: '#4dabf7',
        flexDirection: 'row',
        height: 55,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    syncBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 }
});