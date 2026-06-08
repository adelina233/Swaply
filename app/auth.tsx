import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

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

const FloatingInput = ({ label, value, onChangeText, secureTextEntry = false, keyboardType = "default", showEye = false, onEyePress = null, isPasswordVisible = false }: any) => {
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
                        secureTextEntry={secureTextEntry && !isPasswordVisible}
                        keyboardType={keyboardType}
                        autoCapitalize="none"
                        selectionColor={UI_COLORS.brandSky}
                        placeholderTextColor="rgba(42, 67, 101, 0.4)"
                    />
                </View>
                {showEye && (
                    <TouchableOpacity onPress={onEyePress} style={styles.eyeBtn}>
                        <Ionicons
                            name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color={UI_COLORS.brandSky}
                        />
                    </TouchableOpacity>
                )}
            </BlurView>
        </View>
    );
};

export default function AuthScreen() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    let [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert("Eroare", "Te rugăm să completezi datele.");
            return;
        }
        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                router.replace('/(tabs)');
            } else {
                if (!firstName || !lastName) { Alert.alert("Eroare", "Completează numele."); setLoading(false); return; }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, {
                    displayName: `${firstName} ${lastName}`,
                    photoURL: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=A2D2FF&color=fff`
                });
                await setDoc(doc(db, "users", userCredential.user.uid), { firstName, lastName, email, createdAt: new Date().toISOString() });
                router.replace('/(tabs)');
            }
        } catch (e) { Alert.alert("Ups!", "Eroare la autentificare."); } finally { setLoading(false); }
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                        <View style={styles.headerSection}>
                            <View style={styles.iconCircle}>
                                <Ionicons
                                    name={isLogin ? "log-in" : "person-add"}
                                    size={40}
                                    color={UI_COLORS.brandSky}
                                />
                            </View>
                            <Text style={styles.title}>{isLogin ? 'Loghează-te' : 'Creează cont'}</Text>
                            <Text style={styles.subtitle}>Alătură-te comunității <Text style={{ color: UI_COLORS.brandSky, fontFamily: 'Poppins_700Bold' }}>SwapHome</Text></Text>
                        </View>

                        <View style={styles.formContainer}>
                            {!isLogin && (
                                <>
                                    <FloatingInput label="Prenume" value={firstName} onChangeText={setFirstName} />
                                    <FloatingInput label="Nume de familie" value={lastName} onChangeText={setLastName} />
                                </>
                            )}
                            <FloatingInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                            <FloatingInput
                                label="Parolă"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={true}
                                showEye={true}
                                isPasswordVisible={showPassword}
                                onEyePress={() => setShowPassword(!showPassword)}
                            />

                            {/* Link "Ai uitat parola?" — vizibil doar pe ecranul de login */}
                            {isLogin && (
                                <TouchableOpacity
                                    onPress={() => router.push('/forgot-password')}
                                    style={styles.forgotPasswordBtn}
                                >
                                    <Text style={styles.forgotPasswordText}>Ai uitat parola?</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.mainButton} onPress={handleAuth} disabled={loading}>
                                <LinearGradient
                                    colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.gradientBtn}
                                >
                                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{isLogin ? 'Conectare' : 'Înregistrare'}</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
                            <Text style={styles.switchText}>
                                {isLogin ? "Nu ai un cont? " : "Ai deja un cont? "}
                                <Text style={styles.switchTextBold}>{isLogin ? "Înregistrează-te" : "Conectează-te"}</Text>
                            </Text>
                        </TouchableOpacity>

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
    scrollContent: { padding: 30, flexGrow: 1, justifyContent: 'center' },
    headerSection: { alignItems: 'center', marginBottom: 30 },
    iconCircle: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    title: { fontSize: 30, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    subtitle: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: UI_COLORS.sectionLabel, marginTop: 4 },
    formContainer: { gap: 12 },
    inputContainer: { marginBottom: 5 },
    glassInput: { height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    textContainer: { flex: 1, justifyContent: 'center' },
    label: { position: 'absolute', fontFamily: 'Poppins_400Regular', color: UI_COLORS.sectionLabel },
    labelNormal: { fontSize: 15, top: 20 },
    labelFloating: { fontSize: 11, top: 8, color: UI_COLORS.brandSky, fontFamily: 'Poppins_600SemiBold' },
    textInput: { fontSize: 15, color: UI_COLORS.inputText, fontFamily: 'Poppins_400Regular', height: '100%', width: '100%' },
    eyeBtn: { padding: 8 },
    forgotPasswordBtn: {
        alignSelf: 'flex-end',
        marginTop: -4,
        marginBottom: 4,
        paddingVertical: 2,
        paddingHorizontal: 2,
    },
    forgotPasswordText: {
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
        color: UI_COLORS.brandSky,
    },
    mainButton: { marginTop: 8, borderRadius: 18, overflow: 'hidden' },
    gradientBtn: { height: 58, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    switchButton: { marginTop: 25, alignItems: 'center' },
    switchText: { color: UI_COLORS.description, fontSize: 14, fontFamily: 'Poppins_400Regular' },
    switchTextBold: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky }
});