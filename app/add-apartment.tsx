import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation, useRouter } from 'expo-router';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

// Firebase Imports
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

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

export default function AddApartmentScreen() {
    const router = useRouter();
    const navigation = useNavigation(); 
    const mapRef = useRef<MapView>(null);
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    
    const [title, setTitle] = useState(''); 
    const [details, setDetails] = useState(''); 
    const [addressInput, setAddressInput] = useState('');
    const [size, setSize] = useState('');
    const [targetCity, setTargetCity] = useState('');
    const [location, setLocation] = useState({
        latitude: 44.4268,
        longitude: 26.1025,
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

    const uploadImageAsync = async (uri: string) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const storage = getStorage();
            const filename = `apartments/${auth.currentUser?.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const storageRef = ref(storage, filename);
            
            await uploadBytes(storageRef, blob);
            return await getDownloadURL(storageRef);
        } catch (error) {
            console.error("Upload Error:", error);
            return null;
        }
    };

    const updateAddressFromCoords = async (coords: { latitude: number, longitude: number }) => {
        try {
            const reverseResults = await Location.reverseGeocodeAsync(coords);
            if (reverseResults.length > 0) {
                const address = reverseResults[0];
                const street = address.street || "";
                const number = address.streetNumber || "";
                const city = address.city || "";
                const formattedAddress = `${street} ${number}${street || number ? ',' : ''} ${city}`;
                setAddressInput(formattedAddress.trim());
            }
        } catch (error) {
            console.error(error);
        }
    };

    const geocodeAddress = async () => {
        if (!addressInput) {
            Alert.alert("Atenție", "Te rugăm să introduci o adresă.");
            return;
        }
        try {
            const results = await Location.geocodeAsync(addressInput);
            if (results.length > 0) {
                const { latitude, longitude } = results[0];
                const newCoords = { latitude, longitude };
                setLocation(newCoords);
                mapRef.current?.animateToRegion({
                    ...newCoords,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }, 1000);
            }
        } catch (error) {
            Alert.alert("Eroare", "Adresa nu a putut fi găsită.");
        }
    };

    const pickImages = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5,
            quality: 0.7,
        });
        if (!result.canceled) {
            setImages([...images, ...result.assets.map(a => a.uri)]);
        }
    };

    const handlePublish = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Eroare", "Trebuie să fii logat.");
            return;
        }

        if (!title || !details || !size || !targetCity || images.length === 0) {
            Alert.alert("Eroare", "Te rugăm să completezi câmpurile obligatorii.");
            return;
        }

        setLoading(true);
        try {
            const uploadedUrls = [];
            for (const imgUri of images) {
                const url = await uploadImageAsync(imgUri);
                if (url) uploadedUrls.push(url);
            }

            if (uploadedUrls.length === 0) {
                throw new Error("Nu s-au putut încărca pozele.");
            }

            await addDoc(collection(db, "apartments"), {
                userId: user.uid,
                userName: user.displayName || "Utilizator",
                userPhoto: user.photoURL || "https://via.placeholder.com/150",
                title: title, 
                description: details,   
                size: parseInt(size),
                targetCity: targetCity,
                addressInput: addressInput,
                location: location,
                images: uploadedUrls,
                createdAt: serverTimestamp(),
            });

            Alert.alert("Succes", "Anunțul a fost publicat!");
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert("Eroare", "Nu s-a putut salva anunțul sau încărca pozele.");
        } finally {
            setLoading(false);
        }
    };

    if (!fontsLoaded) return <ActivityIndicator size="large" color={UI_COLORS.brandSky} style={{ flex: 1 }} />;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.roundButton}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={styles.iconOffset} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Adaugă proprietate</Text>
                    <View style={{ width: 45 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.photoHeaderRow}>
                        <Text style={styles.sectionLabel}>Fotografii apartament</Text>
                        <Text style={styles.photoCountText}>{images.length} / 5</Text>
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imageWrapper}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity 
                                    style={styles.deleteBadge} 
                                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                                >
                                    <Ionicons name="close" size={14} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 5 && (
                            <TouchableOpacity style={styles.addImageBox} onPress={pickImages}>
                                <Ionicons name="camera-outline" size={30} color={UI_COLORS.brandSky} />
                                <Text style={styles.addImageText}>Adaugă</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <FloatingInput label="Titlu Anunț" value={title} onChangeText={setTitle} />
                    <FloatingInput label="Detalii Locuință (Descriere)" value={details} onChangeText={setDetails} multiline />
                    <FloatingInput label="Suprafață utilă (m²)" value={size} onChangeText={setSize} keyboardType="numeric" />

                    <Text style={styles.sectionLabel}>Localizare</Text>
                    <View style={styles.searchRow}>
                        <BlurView intensity={45} tint="light" style={styles.searchBarGlass}>
                            <Ionicons name="location-outline" size={20} color={UI_COLORS.brandSky} style={{marginLeft: 15}} />
                            <TextInput 
                                style={styles.searchInput}
                                placeholder="Caută adresa sau apasă pe hartă..."
                                placeholderTextColor="rgba(74, 85, 104, 0.3)"
                                value={addressInput}
                                onChangeText={setAddressInput}
                                onSubmitEditing={geocodeAddress}
                            />
                        </BlurView>
                        <TouchableOpacity style={styles.searchIconBtn} onPress={geocodeAddress}>
                            <Ionicons name="search" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.mapFrame}>
                        <MapView 
                            ref={mapRef}
                            style={styles.map}
                            customMapStyle={mapStyle}
                            initialRegion={{ ...location, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                            onPress={(e) => {
                                setLocation(e.nativeEvent.coordinate);
                                updateAddressFromCoords(e.nativeEvent.coordinate);
                            }}
                        >
                            <Marker coordinate={location}>
                                <View style={styles.markerCircle}>
                                    <Ionicons name="home" size={16} color="#FFF" />
                                </View>
                            </Marker>
                        </MapView>
                    </View>

                    <FloatingInput label="Destinația vizată (Ex: Paris)" value={targetCity} onChangeText={setTargetCity} />

                    <TouchableOpacity style={styles.btnWrapper} onPress={handlePublish} disabled={loading}>
                        <LinearGradient 
                            colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]} 
                            style={styles.saveBtn}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Publică anunțul</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 },
    roundButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
    iconOffset: { marginRight: 2 }, // Potrivire optică pentru centrare
    headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    scrollContent: { padding: 25 },
    photoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginRight: 5 },
    sectionLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.brandSky, marginLeft: 5 },
    photoCountText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.brandSky },
    imageScroll: { marginBottom: 25 },
    imageWrapper: { marginRight: 15, position: 'relative' },
    previewImage: { width: 110, height: 110, borderRadius: 20 },
    deleteBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: UI_COLORS.brandSky, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    addImageBox: { width: 110, height: 110, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: UI_COLORS.brandSky },
    addImageText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky, marginTop: 5 },
    inputWrapper: { marginBottom: 15 },
    glassContainer: { height: 65, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 18, overflow: 'hidden', justifyContent: 'center' },
    label: { position: 'absolute', left: 18, fontFamily: 'Poppins_400Regular' },
    labelNormal: { fontSize: 14, color: UI_COLORS.description, top: 22 },
    labelFloating: { fontSize: 11, color: UI_COLORS.brandSky, top: 10, fontFamily: 'Poppins_600SemiBold' },
    textInput: { fontSize: 15, color: UI_COLORS.inputText, fontFamily: 'Poppins_400Regular', height: '100%', width: '100%' },
    searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
    searchBarGlass: { flex: 1, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, paddingHorizontal: 12, color: UI_COLORS.inputText },
    searchIconBtn: { width: 60, height: 60, borderRadius: 18, backgroundColor: UI_COLORS.softBlue, justifyContent: 'center', alignItems: 'center' },
    mapFrame: { height: 200, borderRadius: 22, overflow: 'hidden', marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    map: { flex: 1 },
    markerCircle: { backgroundColor: UI_COLORS.brandSky, padding: 8, borderRadius: 15, borderWidth: 2, borderColor: '#FFF' },
    btnWrapper: { borderRadius: 18, overflow: 'hidden', elevation: 4 },
    saveBtn: { height: 60, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 }
});