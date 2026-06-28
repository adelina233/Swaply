import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    SafeAreaView, ScrollView,
    StyleSheet, Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    mainTitle: '#1A365D',
    sectionLabel: '#2C5282',
    description: '#4A5568',
    brandSky: '#4dabf7',
    softBlue: '#A2D2FF',
    buttonBlue: '#6FB1FC',
    inputText: '#334155',
    verifiedGreen: '#2ECC71',     
    warningRed: '#E74C3C',         
    statusLightBlue: '#6FB1FC'     
};

const LANGUAGES_SUPPORTED = [
    { code: 'ro', label: 'Română', flag: '🇷🇴' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const FloatingInput = ({ label, value, onChangeText, placeholder, keyboardType = "default", editable = true }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    const isFloating = isFocused || (value && value.length > 0);

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
                        placeholder={isFocused ? "" : placeholder}
                        keyboardType={keyboardType}
                        editable={editable}
                        selectionColor={UI_COLORS.brandSky}
                        placeholderTextColor="rgba(74, 85, 104, 0.4)" 
                    />
                </View>
            </BlurView>
        </View>
    );
};

export default function SettingsScreen() {
    const router = useRouter();
    const navigation = useNavigation(); 
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [userData, setUserData] = useState({
        lastName: '',
        firstName: '',
        phone: '',
        birthDate: new Date().toISOString(),
        zodiac: '',
        email: '',
        profileImage: '',
        language: 'ro',
        isVerified: false 
    });

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    useEffect(() => {
        const fetchUserData = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserData({
                            lastName: data.lastName || '',
                            firstName: data.firstName || '',
                            phone: data.phone || '',
                            birthDate: data.birthDate || new Date().toISOString(),
                            zodiac: data.zodiac || '',
                            email: user.email || '',
                            profileImage: data.profileImage || '',
                            language: data.language || 'ro',
                            isVerified: data.isVerified || false 
                        });
                    }
                } catch (error) {
                    console.error(error);
                } finally { 
                    setFetching(false);
                }
            }
        };
        fetchUserData();
    }, []);

    const uploadProfileImageAsync = async (uri: string) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const storage = getStorage();
            const user = auth.currentUser;
            
            const storageRef = ref(storage, `avatars/${user?.uid}.jpg`);
            await uploadBytes(storageRef, blob);
            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Eroare la upload avatar:", error);
            return null;
        }
    };

    const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setUserData({ ...userData, birthDate: selectedDate.toISOString() });
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Eroare", "Avem nevoie de permisiuni pentru galerie.");
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled) {
            setUserData({ ...userData, profileImage: result.assets[0].uri });
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                let finalImageUrl = userData.profileImage;

                if (userData.profileImage && userData.profileImage.startsWith('file://')) {
                    const uploadedUrl = await uploadProfileImageAsync(userData.profileImage);
                    if (uploadedUrl) {
                        finalImageUrl = uploadedUrl;
                    }
                }

                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, {
                    lastName: userData.lastName,
                    firstName: userData.firstName,
                    phone: userData.phone,
                    birthDate: userData.birthDate,
                    zodiac: userData.zodiac,
                    profileImage: finalImageUrl,
                    language: userData.language
                });
                
                Alert.alert("Succes", "Profil actualizat!");
            }
        } catch (error) {
            Alert.alert("Eroare", "Salvare eșuată.");
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded || fetching) {
        return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;
    }

    const formattedDate = new Date(userData.birthDate).toLocaleDateString('ro-RO');

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={{ marginRight: 2 }} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Editează Profil</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.avatarSection}>
                        <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage}>
                            <Image 
                                source={{ uri: userData.profileImage || 'https://via.placeholder.com/150' }} 
                                style={styles.mainAvatar} 
                            />
                            <View style={styles.editBadge}><Ionicons name="camera" size={20} color="#FFF" /></View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.verificationContainer}>
                        <BlurView intensity={60} tint="light" style={styles.glassVerification}>
                            <View style={styles.verificationInfo}>
                                {}
                                <Ionicons 
                                    name={userData.isVerified ? "checkmark-circle" : "alert-circle"} 
                                    size={28} 
                                    color={userData.isVerified ? UI_COLORS.verifiedGreen : UI_COLORS.warningRed} 
                                />
                                <View style={styles.verificationTexts}>
                                    <Text style={styles.verificationTitle}>
                                        Status Identitate: {userData.isVerified ? 'Verificat' : 'Neverificat'}
                                    </Text>
                                    <Text style={styles.verificationDesc}>
                                        {userData.isVerified 
                                            ? 'Contul tău este complet securizat pentru schimb.' 
                                            : 'Verifică-ți buletinul pentru a putea face schimburi.'}
                                    </Text>
                                </View>
                            </View>
                            
                            {!userData.isVerified && (
                                <TouchableOpacity 
                                    style={styles.verifyButton} 
                                    onPress={() => router.push('/identity-form' as any)}
                                >
                                    <Text style={styles.verifyButtonText}>Verifică acum</Text>
                                    <Ionicons name="arrow-forward" size={14} color="#FFF" />
                                </TouchableOpacity>
                            )}
                        </BlurView>
                    </View>

                    <View style={styles.formContainer}>
                        
                        <Text style={styles.sectionTitle}>Limba preferată pentru chat</Text>
                        <View style={styles.languageGrid}>
                            {LANGUAGES_SUPPORTED.map((lang) => {
                                const isSelected = userData.language === lang.code;
                                return (
                                    <TouchableOpacity
                                        key={lang.code}
                                        style={[styles.languageItem, isSelected && styles.languageItemActive]}
                                        onPress={() => setUserData({ ...userData, language: lang.code })}
                                    >
                                        <Text style={styles.languageFlag}>{lang.flag}</Text>
                                        <Text style={[styles.languageLabel, isSelected && styles.languageLabelActive]}>
                                            {lang.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <FloatingInput 
                            label="Număr de Telefon" 
                            value={userData.phone} 
                            onChangeText={(text: string) => setUserData({...userData, phone: text})}
                            placeholder="07xx xxx xxx"
                            keyboardType="phone-pad"
                        />

                        <FloatingInput 
                            label="Nume" 
                            value={userData.lastName} 
                            onChangeText={(text: string) => setUserData({...userData, lastName: text})}
                        />

                        <FloatingInput 
                            label="Prenume" 
                            value={userData.firstName} 
                            onChangeText={(text: string) => setUserData({...userData, firstName: text})}
                        />

                        <FloatingInput 
                            label="Email" 
                            value={userData.email} 
                            editable={false}
                        />

                        <View style={styles.inputContainer}>
                            <BlurView intensity={50} tint="light" style={styles.glassInput}>
                                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                                    <View>
                                        <Text style={styles.labelFloating}>Data Nașterii</Text>
                                        <Text style={styles.dateValueText}>{formattedDate}</Text>
                                    </View>
                                    <Ionicons name="calendar-outline" size={20} color={UI_COLORS.brandSky} />
                                </TouchableOpacity>
                            </BlurView>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={new Date(userData.birthDate)}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={onChangeDate}
                            />
                        )}

                        <FloatingInput 
                            label="Zodie" 
                            value={userData.zodiac} 
                            onChangeText={(text: string) => setUserData({...userData, zodiac: text})}
                            placeholder="Ex: Leu, Fecioară..."
                        />

                        <TouchableOpacity style={styles.saveButtonContainer} onPress={handleSave} disabled={loading}>
                            <LinearGradient 
                                colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]} 
                                start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                                style={styles.saveButton}
                            >
                                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Salvează Profilul</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.logoutButton} onPress={() => auth.signOut().then(() => router.replace('/auth' as any))}>
                        <Text style={styles.logoutText}>
                            Ai terminat? <Text style={styles.logoutTextBold}>Deconectare</Text>
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    safeArea: { flex: 1 },
    scrollContent: { padding: 25 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    
    avatarSection: { alignItems: 'center', marginBottom: 30 },
    avatarWrapper: { position: 'relative' },
    mainAvatar: { width: 110, height: 110, borderRadius: 55 }, 
    editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: UI_COLORS.brandSky, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    
    verificationContainer: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
    glassVerification: { padding: 16, backgroundColor: 'rgba(255,255,255,0.3)', gap: 12 },
    verificationInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    verificationTexts: { flex: 1 },
    verificationTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.statusLightBlue }, 
    verificationDesc: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.description, marginTop: 2 },
    verifyButton: { backgroundColor: UI_COLORS.brandSky, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start' },
    verifyButtonText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 12 },

    formContainer: { gap: 15 },
    sectionTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.sectionLabel, marginTop: 5, marginBottom: 2 },
    
    languageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
    languageItem: { width: '31%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.4)', borderWidth: 1, borderColor: 'rgba(77, 171, 247, 0.1)', marginBottom: 10 },
    languageItemActive: { backgroundColor: UI_COLORS.brandSky, borderColor: UI_COLORS.brandSky },
    languageFlag: { fontSize: 22 }, 
    languageLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: UI_COLORS.inputText, textAlign: 'center' },
    languageLabelActive: { color: '#FFF', fontFamily: 'Poppins_600SemiBold' },
    
    inputContainer: { marginBottom: 5 },
    glassInput: { height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    textContainer: { flex: 1, justifyContent: 'center' },
    label: { position: 'absolute', fontFamily: 'Poppins_400Regular', color: UI_COLORS.sectionLabel },
    labelNormal: { fontSize: 15, top: 20 },
    labelFloating: { fontSize: 11, top: 8, color: UI_COLORS.brandSky, fontFamily: 'Poppins_600SemiBold' },
    textInput: { fontSize: 16, color: UI_COLORS.inputText, fontFamily: 'Poppins_400Regular', height: '100%', width: '100%' },
    dateValueText: { fontFamily: 'Poppins_400Regular', fontSize: 16, color: UI_COLORS.inputText, marginTop: 12 },
    dateSelector: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveButtonContainer: { marginTop: 20, borderRadius: 18, overflow: 'hidden' },
    saveButton: { height: 58, justifyContent: 'center', alignItems: 'center' },
    saveButtonText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    logoutButton: { marginTop: 30, alignItems: 'center', paddingBottom: 30 },
    logoutText: { color: UI_COLORS.description, fontSize: 14, fontFamily: 'Poppins_400Regular' },
    logoutTextBold: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky }
});