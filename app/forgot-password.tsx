import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import React, { useLayoutEffect, useState } from 'react';
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
    View,
} from 'react-native';

import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const UI_COLORS = {
    mainTitle: '#1A365D',
    sectionLabel: '#2C5282',
    description: '#4A5568',
    accentBlue: '#0077B6',
    softBlue: '#A2D2FF',
    buttonBlue: '#6FB1FC',
    brandSky: '#4dabf7',
    inputText: '#2A4365',
};

const FloatingInput = ({ label, value, onChangeText, keyboardType = "default" }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    const isFloating = isFocused || value.length > 0;

    return (
        <View style={styles.inputContainer}>
            <BlurView intensity={50} tint="light" style={styles.glassInput}>
                <View style={styles.textContainer}>
                    <Text style={[
                        styles.label,
                        isFloating ? styles.labelFloating : styles.labelNormal
                    ]}>
                        {label}
                    </Text>
                    <TextInput
                        style={[styles.textInput, isFloating && { paddingTop: 12 }]}
                        value={value}
                        onChangeText={onChangeText}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        keyboardType={keyboardType}
                        autoCapitalize="none"
                        selectionColor={UI_COLORS.brandSky}
                        placeholderTextColor="rgba(42, 67, 101, 0.4)"
                    />
                </View>
            </BlurView>
        </View>
    );
};

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const navigation = useNavigation(); // Inițializare navigație nativă
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

   
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    let [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

    const handleReset = async () => {
        if (!email.trim()) {
            Alert.alert("Eroare", "Te rugăm să introduci adresa de email.");
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setEmailSent(true);
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                Alert.alert("Email negăsit", "Nu există niciun cont asociat acestei adrese de email.");
            } else if (e.code === 'auth/invalid-email') {
                Alert.alert("Email invalid", "Te rugăm să introduci o adresă de email validă.");
            } else {
                Alert.alert("Eroare", "A apărut o problemă. Încearcă din nou.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                {/* MODIFICAT: S-a adăugat header-ul nativ cu butonul de back circular și transparent */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={{ marginRight: 2 }} />
                    </TouchableOpacity>
                    <View style={{ width: 44 }} />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                        <View style={styles.headerSection}>
                            <View style={styles.iconCircle}>
                                <Ionicons
                                    name={emailSent ? "checkmark-circle" : "lock-open"}
                                    size={40}
                                    color={UI_COLORS.brandSky}
                                />
                            </View>

                            {emailSent ? (
                                <>
                                    <Text style={styles.title}>Email trimis!</Text>
                                    <Text style={styles.subtitle}>
                                        Verifică inbox-ul pentru{'\n'}instrucțiunile de resetare.
                                    </Text>

                                    <BlurView intensity={40} tint="light" style={styles.infoCard}>
                                        <Ionicons name="mail-outline" size={20} color={UI_COLORS.brandSky} style={{ marginBottom: 6 }} />
                                        <Text style={styles.infoCardText}>
                                            Am trimis un link de resetare la{'\n'}
                                            <Text style={styles.infoCardEmail}>{email}</Text>
                                        </Text>
                                        <Text style={styles.infoCardHint}>
                                            Nu l-ai primit? Verifică folderul Spam.
                                        </Text>
                                    </BlurView>

                                    <TouchableOpacity style={styles.mainButton} onPress={() => router.back()}>
                                        <LinearGradient
                                            colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientBtn}
                                        >
                                            <Text style={styles.buttonText}>Înapoi la login</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => { setEmailSent(false); setEmail(''); }}
                                        style={styles.retryBtn}
                                    >
                                        <Text style={styles.retryText}>Trimite din nou</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.title}>Ai uitat parola?</Text>
                                    <Text style={styles.subtitle}>
                                        Introdu emailul și îți trimitem{'\n'}un link de resetare.
                                    </Text>

                                    <View style={styles.formContainer}>
                                        <FloatingInput
                                            label="Email"
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                        />

                                        <TouchableOpacity style={styles.mainButton} onPress={handleReset} disabled={loading}>
                                            <LinearGradient
                                                colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.gradientBtn}
                                            >
                                                {loading
                                                    ? <ActivityIndicator color="#FFF" />
                                                    : <Text style={styles.buttonText}>Trimite link de resetare</Text>
                                                }
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity onPress={() => router.back()} style={styles.switchButton}>
                                        <Text style={styles.switchText}>
                                            Ți-ai amintit parola?{' '}
                                            <Text style={styles.switchTextBold}>Conectează-te</Text>
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    safeArea: { flex: 1 },
    // Adăugat design-ul structurat pentru zona de top header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingHorizontal: 30, paddingBottom: 30, flexGrow: 1, justifyContent: 'center' },
    headerSection: { alignItems: 'center', width: '100%' },
    iconCircle: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: { fontSize: 30, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky, textAlign: 'center' },
    subtitle: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: UI_COLORS.sectionLabel, marginTop: 6, textAlign: 'center', lineHeight: 22 },
    formContainer: { gap: 12, width: '100%', marginTop: 24 },
    inputContainer: { marginBottom: 5 },
    glassInput: { height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    textContainer: { flex: 1, justifyContent: 'center' },
    label: { position: 'absolute', fontFamily: 'Poppins_400Regular', color: UI_COLORS.sectionLabel },
    labelNormal: { fontSize: 15, top: 20 },
    labelFloating: { fontSize: 11, top: 8, color: UI_COLORS.brandSky, fontFamily: 'Poppins_600SemiBold' },
    textInput: { fontSize: 15, color: UI_COLORS.inputText, fontFamily: 'Poppins_400Regular', height: '100%', width: '100%' },
    mainButton: { marginTop: 8, borderRadius: 18, overflow: 'hidden', width: '100%' },
    gradientBtn: { height: 58, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    switchButton: { marginTop: 25, alignItems: 'center' },
    switchText: { color: UI_COLORS.description, fontSize: 14, fontFamily: 'Poppins_400Regular' },
    switchTextBold: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    infoCard: {
        marginTop: 28,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
        padding: 20,
        alignItems: 'center',
        width: '100%',
    },
    infoCardText: {
        fontSize: 14,
        fontFamily: 'Poppins_400Regular',
        color: UI_COLORS.sectionLabel,
        textAlign: 'center',
        lineHeight: 22,
    },
    infoCardEmail: {
        fontFamily: 'Poppins_600SemiBold',
        color: UI_COLORS.brandSky,
    },
    infoCardHint: {
        marginTop: 10,
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: UI_COLORS.description,
        textAlign: 'center',
    },
    retryBtn: { marginTop: 16, alignItems: 'center' },
    retryText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky },
});