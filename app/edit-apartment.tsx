import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, SafeAreaView, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

// Firebase Imports
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    description: '#4A5568',
    inputText: '#334155',
    softBlue: '#A2D2FF',
    buttonBlue: '#6FB1FC',
};

const mapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }] }
];

const FloatingInput = ({ label, value, onChangeText, placeholder, multiline = false, keyboardType = "default" }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    const isFloating = isFocused || (value && value.length > 0);

    return (
        <View style={styles.inputWrapper}>
            <BlurView intensity={45} tint="light" style={[styles.glassContainer, multiline && { height: 120, alignItems: 'flex-start' }]}>
                <Text style={[styles.label, isFloating ? styles.labelFloating : styles.labelNormal]}>
                    {label}
                </Text>
                <TextInput
                    style={[styles.textInput, isFloating && { paddingTop: 18 }, multiline && { textAlignVertical: 'top' }]}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={isFocused ? "" : placeholder}
                    multiline={multiline}
                    keyboardType={keyboardType}
                    placeholderTextColor="rgba(74, 85, 104, 0.3)"
                    selectionColor={UI_COLORS.brandSky}
                />
            </BlurView>
        </View>
    );
};

export default function EditApartmentScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    
    const [title, setTitle] = useState(''); 
    const [description, setDescription] = useState(''); 
    const [addressInput, setAddressInput] = useState(''); 
    const [targetCity, setTargetCity] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [location, setLocation] = useState({ latitude: 44.4268, longitude: 26.1025 });

    let [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

    useEffect(() => {
        if (id) loadApartmentData();
    }, [id]);

    const uploadImageAsync = async (uri: string) => {
        if (uri.startsWith('http')) return uri;

        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const storage = getStorage();
            const filename = `apartments/${auth.currentUser?.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, filename);
            
            await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(storageRef);
            // Am eliminat blob.close() pentru a evita eroarea de tip
            return url;
        } catch (error) {
            console.error("Edit Upload Error:", error);
            return null;
        }
    };

    const loadApartmentData = async () => {
        try {
            const docRef = doc(db, "apartments", id as string);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTitle(data.title || "");
                setDescription(data.description || "");
                setAddressInput(data.addressInput || "");
                setTargetCity(data.targetCity || "");
                setImages(data.images || []);
                setLocation(data.location || { latitude: 44.4268, longitude: 26.1025 });
                
                mapRef.current?.animateToRegion({
                    ...(data.location || { latitude: 44.4268, longitude: 26.1025 }),
                    latitudeDelta: 0.005, longitudeDelta: 0.005,
                }, 1000);
            }
        } catch (error) {
            Alert.alert("Eroare", "Nu am putut încărca datele.");
        } finally {
            setFetching(false);
        }
    };

    const handleUpdate = async () => {
        if (!title || !description || images.length === 0) {
            Alert.alert("Atenție", "Titlul, descrierea și pozele sunt obligatorii.");
            return;
        }

        setLoading(true);
        try {
            const finalImageUrls = [];
            for (const imgUri of images) {
                const url = await uploadImageAsync(imgUri);
                if (url) finalImageUrls.push(url);
            }

            const docRef = doc(db, "apartments", id as string);
            await updateDoc(docRef, {
                title,
                description,
                addressInput,
                targetCity,
                location,
                images: finalImageUrls,
                updatedAt: serverTimestamp()
            });

            Alert.alert("Succes", "Anunț actualizat cu succes!");
            router.back();
        } catch (e) {
            Alert.alert("Eroare", "A apărut o problemă la salvare.");
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded || fetching) return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.inputText} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Editează Anunțul</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.sectionLabel}>Fotografii Anunț</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imageWrapper}>
                                <Image 
                                    source={uri} 
                                    style={styles.image} 
                                    contentFit="cover"
                                    transition={300}
                                />
                                <TouchableOpacity 
                                    style={styles.removeImageBadge} 
                                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                                >
                                    <Ionicons name="close" size={14} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 5 && (
                            <TouchableOpacity 
                                style={styles.addImageBox} 
                                onPress={async () => {
                                    let res = await ImagePicker.launchImageLibraryAsync({ 
                                        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
                                        allowsMultipleSelection: true, 
                                        quality: 0.6 
                                    });
                                    if (!res.canceled) setImages([...images, ...res.assets.map(a => a.uri)]);
                                }}
                            >
                                <Ionicons name="camera-outline" size={30} color={UI_COLORS.brandSky} />
                                <Text style={styles.addImageText}>Adaugă</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <FloatingInput label="Titlu Anunț" value={title} onChangeText={setTitle} />
                    <FloatingInput label="Descriere" value={description} onChangeText={setDescription} multiline />
                    <FloatingInput label="Zonă / Adresă" value={addressInput} onChangeText={setAddressInput} />

                    <View style={styles.mapContainer}>
                        <MapView 
                            ref={mapRef}
                            style={{ flex: 1 }}
                            customMapStyle={mapStyle}
                            initialRegion={{ ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                            onPress={(e) => setLocation(e.nativeEvent.coordinate)}
                        >
                            <Marker coordinate={location}>
                                <View style={styles.markerCircle}>
                                    <Ionicons name="home" size={16} color="#FFF" />
                                </View>
                            </Marker>
                        </MapView>
                    </View>

                    <BlurView intensity={40} tint="light" style={styles.swapBox}>
                        <Text style={styles.swapTitle}>Unde vrei să călătorești?</Text>
                        <TextInput 
                            style={styles.minimalInput} 
                            placeholder="Ex: Londra, Paris..." 
                            placeholderTextColor="rgba(74, 85, 104, 0.4)"
                            value={targetCity} 
                            onChangeText={setTargetCity} 
                        />
                    </BlurView>

                    <TouchableOpacity style={styles.btnWrapper} onPress={handleUpdate} disabled={loading}>
                        <LinearGradient 
                            colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]} 
                            style={styles.saveBtn}
                        >
                            {loading ? (
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <ActivityIndicator color="#FFF" />
                                    <Text style={[styles.saveBtnText, {marginLeft: 10}]}>Se salvează...</Text>
                                </View>
                            ) : (
                                <Text style={styles.saveBtnText}>Salvează Modificările</Text>
                            )}
                        </LinearGradient>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 },
    backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    scrollContent: { padding: 25 },
    sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.brandSky, marginBottom: 15, marginLeft: 5 },
    imageScroll: { marginBottom: 25 },
    imageWrapper: { marginRight: 15, position: 'relative' },
    image: { width: 110, height: 110, borderRadius: 20 },
    removeImageBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: UI_COLORS.brandSky, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    addImageBox: { width: 110, height: 110, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: UI_COLORS.brandSky },
    addImageText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky, marginTop: 5 },
    inputWrapper: { marginBottom: 15 },
    glassContainer: { height: 65, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 18, overflow: 'hidden', justifyContent: 'center' },
    label: { position: 'absolute', left: 18, fontFamily: 'Poppins_400Regular' },
    labelNormal: { fontSize: 14, color: UI_COLORS.description, top: 22 },
    labelFloating: { fontSize: 11, color: UI_COLORS.brandSky, top: 10, fontFamily: 'Poppins_600SemiBold' },
    textInput: { fontSize: 15, color: UI_COLORS.inputText, fontFamily: 'Poppins_400Regular', height: '100%', width: '100%' },
    mapContainer: { height: 200, borderRadius: 22, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    markerCircle: { backgroundColor: UI_COLORS.brandSky, padding: 8, borderRadius: 15, borderWidth: 2, borderColor: '#FFF' },
    swapBox: { padding: 20, borderRadius: 20, marginBottom: 35, overflow: 'hidden' },
    swapTitle: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: UI_COLORS.brandSky, marginBottom: 5 },
    minimalInput: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.inputText, borderBottomWidth: 1, borderBottomColor: 'rgba(77, 119, 182, 0.2)', paddingVertical: 5 },
    btnWrapper: { borderRadius: 18, overflow: 'hidden', marginBottom: 40 },
    saveBtn: { height: 60, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 }
});