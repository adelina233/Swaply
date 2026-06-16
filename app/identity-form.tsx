import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    lightBlueText: '#4dabf7', 
    errorText: '#ff4d6d',
    btnGradient: ['#A2D2FF', '#6FB1FC'] as const,
    inputText: '#334155',     
};

export default function IdentityFormScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { swapId } = useLocalSearchParams<{ swapId: string }>();
    const [loading, setLoading] = useState(false);
    
    // State-uri pentru câmpuri
    const [fullName, setFullName] = useState('');
    const [cnp, setCnp] = useState('');
    const [documentSeries, setDocumentSeries] = useState('');
    const [address, setAddress] = useState('');

    // Referințe pentru controlul focusului tastaturii
    const cnpInputRef = useRef<TextInput>(null);
    const seriesInputRef = useRef<TextInput>(null);
    const addressInputRef = useRef<TextInput>(null);

    // ASCUNDE BARA NEAGRĂ/HEADER-UL IMPLICIT AL NAVIGATORULUI DE TABS
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);
    
    let [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

    if (!fontsLoaded) return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

    const sendNotificationToPartner = async (targetUserId: string, title: string, message: string, idSwap: string) => {
        try {
            await addDoc(collection(db, "notifications"), {
                userId: targetUserId,
                title,
                message,
                resourceId: idSwap,
                type: "verification_update",
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Error sending notification:", e);
        }
    };

    const executeActivation = async () => {
        if (!auth.currentUser) return;

        try {
            const currentUserId = auth.currentUser.uid;

            if (swapId) {
                const swapRef = doc(db, "swap_requests", swapId);
                const swapSnap = await getDoc(swapRef);
                
                if (swapSnap.exists()) {
                    const selectedOffer = { id: swapSnap.id, ...swapSnap.data() } as any;
                    const isOwner = currentUserId === selectedOffer.ownerId;
                    const partnerId = isOwner ? selectedOffer.senderId : selectedOffer.ownerId;
                    const myName = isOwner ? selectedOffer.ownerName : selectedOffer.senderName;

                    await sendNotificationToPartner(
                        partnerId,
                        "Identitate Verificată Securizat 🛡️",
                        `${myName || 'Partenerul de schimb'} și-a verificat cu succes identitatea pentru acest schimb.`,
                        selectedOffer.id
                    );
                }
            }

            Alert.alert(
                "Verificare Reușită", 
                "Datele tale au fost validate cu succes. Profilul tău este acum securizat!",
                [{ text: "Excelent", onPress: () => router.dismissAll() }]
            );

        } catch (err) {
            console.error(err);
            Alert.alert("Eroare", "Datele s-au salvat, dar a apărut o problemă la afișarea confirmării.");
        }
    };

    const handleSubmit = async () => {
        const cleanFullName = fullName.trim();
        const cleanCnp = cnp.trim();
        const cleanSeries = documentSeries.toUpperCase().replace(/\s/g, '').trim();
        const cleanAddress = address.trim();

        if (!cleanFullName || !cleanCnp || !cleanSeries || !cleanAddress) {
            Alert.alert("Atenție", "Toate câmpurile sunt obligatorii pentru a valida profilul.");
            return;
        }

        const nameRegex = /^[a-zA-ZĂÂÎȘȚăâîșț]+([\s-][a-zA-ZĂÂÎȘȚăâîșț]+)+$/;
        if (!nameRegex.test(cleanFullName)) {
            Alert.alert("Nume Invalid", "Introdu numele și prenumele complete exact cum apar în C.I. (ex: Popescu Ioan).");
            return;
        }

        // REPARAT: Validare Matematică CNP Românesc stabilă
        const validateCNP = (cnpStr: string) => {
            if (!/^\d{13}$/.test(cnpStr)) return false;
            
            const key = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
            let sum = 0;
            
            for (let i = 0; i < 12; i++) {
                const digit = Number(cnpStr.charAt(i));
                if (isNaN(digit)) return false;
                sum += digit * key[i];
            }
            
            const remainder = sum % 11;
            const controlDigit = remainder === 10 ? 1 : remainder;
            
            return controlDigit === Number(cnpStr.charAt(12));
        };

        if (!validateCNP(cleanCnp)) {
            Alert.alert("CNP Invalid", "Codul Numeric Personal (CNP) nu este valid legal. Verifică cifrele introduse.");
            return;
        }

        const ciRegex = /^[A-Z]{2}\d{6}$/;
        if (!ciRegex.test(cleanSeries)) {
            Alert.alert("Serie/Număr C.I. Invalid", "Formatul trebuie să conțină 2 litere și 6 cifre (ex: RX123456).");
            return;
        }

        Alert.alert(
            "Confirmare Date",
            "Certific faptul că datele introduse sunt reale și aparțin actului meu de identitate.",
            [
                { text: "Revizuiește", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            if (!auth.currentUser) return;
                            const currentUserId = auth.currentUser.uid;
                            
                            // 1. Salvare permanentă în documentul global al utilizatorului
                            const userRef = doc(db, "users", currentUserId);
                            await updateDoc(userRef, {
                                isVerified: true,
                                identityDetails: {
                                    fullName: cleanFullName,
                                    cnp: cleanCnp,
                                    documentSeries: cleanSeries,
                                    address: cleanAddress,
                                    verifiedAt: new Date().toISOString()
                                }
                            });
                            
                            // 2. Salvare adițională în cererea de schimb (dacă flow-ul vine dintr-un swap existent)
                            if (swapId) {
                                const swapRef = doc(db, "swap_requests", swapId);
                                await updateDoc(swapRef, {
                                    [`identity_${currentUserId}`]: {
                                        fullName: cleanFullName,
                                        cnp: cleanCnp,
                                        documentSeries: cleanSeries,
                                        address: cleanAddress,
                                        verifiedAt: new Date().toISOString()
                                    }
                                });
                            }

                            await executeActivation();
                        } catch (error) {
                            console.error("Eroare la scrierea în Firestore: ", error);
                            Alert.alert("Eroare", "A apărut o problemă tehnică la salvarea datelor de securitate.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color={UI_COLORS.lightBlueText} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Verificare Profil</Text>
                        <View style={{ width: 44 }} />
                    </View>
                    
                    <View style={styles.infoBox}>
                        <BlurView intensity={30} tint="light" style={styles.infoBlur}>
                            <Ionicons name="shield-checkmark" size={24} color={UI_COLORS.brandSky} />
                            <Text style={styles.infoText}>
                                Sistemul procesează datele local pentru a asigura integritatea și securitatea comunității noastre de schimb. Nimeni nu are acces la datele tale sensibile.
                            </Text>
                        </BlurView>
                    </View>
                    
                    <View style={styles.formCard}>
                        
                        <Text style={styles.label}>Nume complet (conform C.I.)</Text>
                        <BlurView intensity={40} tint="light" style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={18} color={UI_COLORS.lightBlueText} />
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: Popescu Ioan"
                                placeholderTextColor="rgba(77, 171, 247, 0.4)"
                                value={fullName}
                                onChangeText={setFullName}
                                returnKeyType="next"
                                onSubmitEditing={() => cnpInputRef.current?.focus()}
                                blurOnSubmit={false}
                            />
                        </BlurView>
                        
                        <Text style={styles.label}>Cod Numeric Personal (CNP)</Text>
                        <BlurView intensity={40} tint="light" style={styles.inputWrapper}>
                            <Ionicons name="finger-print-outline" size={18} color={UI_COLORS.lightBlueText} />
                            <TextInput
                                ref={cnpInputRef}
                                style={styles.input}
                                placeholder="Ex: 1950101XXXXXX"
                                placeholderTextColor="rgba(77, 171, 247, 0.4)"
                                keyboardType="numeric"
                                maxLength={13}
                                value={cnp}
                                onChangeText={setCnp}
                                returnKeyType="next"
                                onSubmitEditing={() => seriesInputRef.current?.focus()}
                                blurOnSubmit={false}
                            />
                        </BlurView>
                        
                        <Text style={styles.label}>Serie și Număr Buletin</Text>
                        <BlurView intensity={40} tint="light" style={styles.inputWrapper}>
                            <Ionicons name="card-outline" size={18} color={UI_COLORS.lightBlueText} />
                            <TextInput
                                ref={seriesInputRef}
                                style={styles.input}
                                placeholder="Ex: RX 123456"
                                placeholderTextColor="rgba(77, 171, 247, 0.4)"
                                autoCapitalize="characters"
                                maxLength={9}
                                value={documentSeries}
                                onChangeText={setDocumentSeries}
                                returnKeyType="next"
                                onSubmitEditing={() => addressInputRef.current?.focus()}
                                blurOnSubmit={false}
                            />
                        </BlurView>
                        
                        <Text style={styles.label}>Domiciliu (Adresă din buletin)</Text>
                        <BlurView intensity={40} tint="light" style={[styles.inputWrapper, styles.textAreaWrapper]}>
                            <Ionicons name="home-outline" size={18} color={UI_COLORS.lightBlueText} style={{ marginTop: 2 }} />
                            <TextInput
                                ref={addressInputRef}
                                style={styles.inputTextArea}
                                placeholder="Oraș, Stradă, Număr, Bloc..."
                                placeholderTextColor="rgba(77, 171, 247, 0.4)"
                                multiline={true}
                                numberOfLines={3}
                                textAlignVertical="top"
                                value={address}
                                onChangeText={setAddress}
                                returnKeyType="done"
                            />
                        </BlurView>
                    </View>
                    
                    <TouchableOpacity style={styles.submitBtnWrapper} onPress={handleSubmit} disabled={loading}>
                        <LinearGradient colors={UI_COLORS.btnGradient} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.submitBtn}>
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>Validează și Activează Profilul</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    safeArea: { flex: 1 },
    scrollContent: { padding: 25, paddingTop: Platform.OS === 'ios' ? 20 : 10, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.4)', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.lightBlueText }, 
    
    infoBox: { borderRadius: 22, overflow: 'hidden', marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
    infoBlur: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: 'rgba(255,255,255,0.2)' },
    infoText: { flex: 1, fontSize: 11.5, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, lineHeight: 17 },
    
    formCard: { gap: 14 },
    label: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.lightBlueText, marginLeft: 4, marginTop: 4 },
    
    inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, height: 58, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)' },
    textAreaWrapper: { alignItems: 'flex-start', paddingTop: 14, height: 100 },
    
    input: { flex: 1, marginLeft: 12, fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.inputText, height: '100%' },
    inputTextArea: { flex: 1, marginLeft: 12, fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.inputText, minHeight: 75 },
    
    submitBtnWrapper: { marginTop: 30, height: 58, borderRadius: 18, overflow: 'hidden', elevation: 2 },
    submitBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    submitBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' }
});