import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
    brandSky: '#4dabf7',
    description: '#4A5568',
    inputText: '#334155',
    softBlue: '#A2D2FF',
    buttonBlue: '#6FB1FC',
    white: '#FFFFFF',
    mainTitle: '#1A365D',
    lightBlue: '#74c0fc',
};

const darkMapStyle: any[] = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

interface NearbyPoi {
    type: 'supermarket' | 'cafe' | 'subway' | 'bus';
    label: string;
    distance: string;
    icon: 'cart' | 'cafe' | 'subway' | 'bus';
}

export default function DetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();

   
    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const [apartment, setApartment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [myApartmentCity, setMyApartmentCity] = useState<string | null>(null);
    const [hasMyApartment, setHasMyApartment] = useState(false);
    const [stats, setStats] = useState({ home: 0, comm: 0, count: 0 });

    const [cityHeroImage, setCityHeroImage] = useState<string | null>(null);
    const [nearbyPois, setNearbyPois] = useState<NearbyPoi[]>([]);
    const [centerRouteDuration, setCenterRouteDuration] = useState<string | null>(null);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const currentUserUid = auth.currentUser?.uid;

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const docRef = doc(db, "apartments", id as string);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    let data = docSnap.data();

                    const userRef = doc(db, "users", data.userId);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const fullName = (userData.firstName || userData.lastName)
                            ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                            : (userData.displayName || userData.fullName || "Proprietar");

                        data.userName = fullName;
                        data.userPhoto = userData.profileImage || userData.photoURL || null;
                    }

                    if (!data.userName || data.userName === "Utilizator") {
                        data.userName = "Proprietar Verificat";
                    }
                    if (!data.userPhoto) {
                        data.userPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.userName)}&background=4dabf7&color=fff`;
                    }

                    setApartment(data);
                    fetchExternalApiData(data);
                } else {
                    Alert.alert("Eroare", "Anunțul nu mai este disponibil.");
                    router.back();
                }
            } catch (error) {
                console.error("Fetch Details Error:", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchMyApt = async () => {
            if (!auth.currentUser) return;
            try {
                const q = query(collection(db, "apartments"), where("userId", "==", auth.currentUser.uid));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const myData = snap.docs[0].data();
                    setMyApartmentCity(myData.city || myData.addressInput);
                    setHasMyApartment(true);
                } else {
                    setHasMyApartment(false);
                }
            } catch (e) { console.log(e); }
        };

        fetchDetails();
        fetchMyApt();
    }, [id]);

    const fetchExternalApiData = async (aptData: any) => {
        if (!aptData) return;

        const lat = aptData.location?.latitude;
        const lon = aptData.location?.longitude;

        const physicalCity = aptData.city ||
            (aptData.addressInput ? aptData.addressInput.split(',').pop()?.trim() : null) ||
            "Budapest";

        await fetchCityImage(physicalCity);

        if (!lat || !lon) return;

        try {
            const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(node["shop"="supermarket"](around:500,${lat},${lon});node["amenity"="cafe"](around:500,${lat},${lon});node["railway"="subway_entrance"](around:500,${lat},${lon}););out body;`;
            const response = await fetch(overpassUrl);
            const json = await response.json();

            if (json?.elements) {
                const foundPois: NearbyPoi[] = [];
                let hasSupermarket = false;
                let hasCafe = false;
                let hasSubway = false;

                json.elements.forEach((el: any) => {
                    if (el.tags?.shop === 'supermarket' && !hasSupermarket) {
                        foundPois.push({ type: 'supermarket', label: el.tags.name || 'Supermarket', distance: '200m', icon: 'cart' });
                        hasSupermarket = true;
                    }
                    if (el.tags?.amenity === 'cafe' && !hasCafe) {
                        foundPois.push({ type: 'cafe', label: el.tags.name || 'Cafenea', distance: '350m', icon: 'cafe' });
                        hasCafe = true;
                    }
                    if (el.tags?.railway === 'subway_entrance' && !hasSubway) {
                        foundPois.push({ type: 'subway', label: el.tags.name || 'Stație metrou', distance: '5 min', icon: 'subway' });
                        hasSubway = true;
                    }
                });

                setNearbyPois(foundPois.length > 0 ? foundPois : [
                    { type: 'supermarket', label: 'Supermarket', distance: '300m', icon: 'cart' },
                    { type: 'cafe', label: 'Cafenea locală', distance: '400m', icon: 'cafe' },
                    { type: 'bus', label: 'Transport comun', distance: '7 min', icon: 'bus' }
                ]);
            }
        } catch (err) {
            console.log("Eroare Overpass API:", err);
            setNearbyPois([
                { type: 'supermarket', label: 'Supermarket', distance: '300m', icon: 'cart' },
                { type: 'cafe', label: 'Cafenea locală', distance: '400m', icon: 'cafe' },
                { type: 'bus', label: 'Transport comun', distance: '7 min', icon: 'bus' }
            ]);
        }

        try {
            const targetLat = lat + 0.025;
            const targetLon = lon + 0.025;
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lon},${lat};${targetLon},${targetLat}?overview=false`;
            const response = await fetch(osrmUrl);
            const json = await response.json();

            if (json?.routes?.length > 0) {
                const minutes = Math.round(json.routes[0].duration / 60);
                setCenterRouteDuration(`🚗 ${minutes} min până în Centru`);
            } else {
                setCenterRouteDuration("🚗 20 min până în Centru");
            }
        } catch (err) {
            setCenterRouteDuration("🚗 15 min până în Centru");
        }
    };

    const fetchCityImage = async (cityName: string) => {
        try {
            const slug = cityName.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "");

            const res = await fetch(`https://api.teleport.org/api/urban_areas/slug:${slug}/images/`);
            if (res.ok) {
                const json = await res.json();
                const url = json?.photos?.[0]?.image?.web;
                if (url) { setCityHeroImage(url); return; }
            }
        } catch (e) { console.log("Teleport:", e); }

        try {
            const res = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cityName)}`
            );
            if (res.ok) {
                const json = await res.json();
                const url = json?.originalimage?.source || json?.thumbnail?.source;
                if (url) { setCityHeroImage(url); return; }
            }
        } catch (e) { console.log("Wikipedia:", e); }

        setCityHeroImage(`https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&auto=format&fit=crop`);
    };

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -1, duration: 150, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        if (!apartment?.userId) return;
        const q = query(collection(db, "reviews"), where("toUserId", "==", apartment.userId));
        const unsub = onSnapshot(q, (snapshot) => {
            const reviewsData = snapshot.docs.map(doc => doc.data());
            if (reviewsData.length > 0) {
                const totalHome = reviewsData.reduce((acc, curr) => acc + (curr.ratingHome || 0), 0);
                const totalComm = reviewsData.reduce((acc, curr) => acc + (curr.ratingCommunication || 0), 0);
                setStats({
                    home: parseFloat((totalHome / reviewsData.length).toFixed(1)),
                    comm: parseFloat((totalComm / reviewsData.length).toFixed(1)),
                    count: reviewsData.length
                });
            }
        });
        return () => unsub();
    }, [apartment?.userId]);

    const isMatch = myApartmentCity && apartment?.targetCity &&
        myApartmentCity.toLowerCase().includes(apartment.targetCity.toLowerCase());

    const isOwner = currentUserUid === apartment?.userId;

    const shakeInterpolate = shakeAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-20deg', '20deg']
    });

    const handleAction = async (type: 'chat' | 'swap') => {
        if (!auth.currentUser || !apartment) return;
        if (isOwner) return;

        if (type === 'swap') {
            if (!hasMyApartment) {
                Alert.alert(
                    "Anunț necesar",
                    "Trebuie să ai un anunț postat pentru a propune un schimb. Adaugă-ți locuința mai întâi!",
                    [
                        { text: "Anulează", style: "cancel" },
                        { text: "Adaugă anunț", onPress: () => router.push('/(tabs)/create') }
                    ]
                );
                return;
            }
            router.push({ pathname: '/create-offer', params: { targetId: id } } as any);
            return;
        }

        setSending(true);
        try {
            const currentUid = auth.currentUser.uid;
            const ownerUid = apartment.userId;

            const myProfileRef = doc(db, "users", currentUid);
            const myProfileSnap = await getDoc(myProfileRef);
            const myData = myProfileSnap.data();

            const myName = (myData?.firstName || myData?.lastName)
                ? `${myData.firstName || ''} ${myData.lastName || ''}`.trim()
                : (auth.currentUser.displayName || "Utilizator");

            const myPhoto = myData?.profileImage || myData?.photoURL || auth.currentUser.photoURL || null;

            const participantIds = [currentUid, ownerUid].sort();
            const chatId = participantIds.join('_');

            await setDoc(doc(db, "chats", chatId), {
                participants: participantIds,
                participantNames: { [currentUid]: myName, [ownerUid]: apartment.userName },
                participantPhotos: { [currentUid]: myPhoto, [ownerUid]: apartment.userPhoto },
                lastMessage: "Conversație inițiată",
                lastMessageTimestamp: serverTimestamp(),
                lastSenderId: currentUid,
                readBy: [currentUid],
            }, { merge: true });

            router.push(`/${chatId}`);
        } catch (e) {
            console.error("Chat Error:", e);
            Alert.alert("Eroare", "Nu s-a putut deschide conversația.");
        } finally {
            setSending(false);
        }
    };

    if (!fontsLoaded || loading || !apartment) {
        return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;
    }

    const mapCoords = {
        latitude: apartment.location?.latitude || 44.4268,
        longitude: apartment.location?.longitude || 26.1025
    };

    const physicalCityLabel = apartment.city ||
        (apartment.addressInput ? apartment.addressInput.split(',').pop()?.trim() : null) ||
        "Locație";

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.heroContainer}>
                    {cityHeroImage && (
                        <View style={styles.cityBannerWrapper}>
                            <Image
                                source={{ uri: cityHeroImage }}
                                style={styles.cityBannerImage}
                                resizeMode="cover"
                            />
                            <LinearGradient
                                colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
                                style={StyleSheet.absoluteFillObject}
                            />
                            <View style={styles.cityBadgeLabel}>
                                <Ionicons name="location-sharp" size={14} color="#FFF" />
                                <Text style={styles.cityBadgeText}>{physicalCityLabel}</Text>
                            </View>
                        </View>
                    )}

                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.apartmentSlider}>
                        {apartment.images?.map((img: string, index: number) => (
                            <Image key={index} source={{ uri: img }} style={styles.headerImage} />
                        ))}
                    </ScrollView>

                    <SafeAreaView style={styles.backButtonContainer}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.roundButton}>
                            <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} />
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>

                <BlurView intensity={80} tint="light" style={styles.contentCard}>
                    <View style={styles.indicator} />

                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{apartment.title}</Text>
                            <View style={styles.locationRow}>
                                <Ionicons name="location-sharp" size={16} color={UI_COLORS.brandSky} />
                                <Text style={styles.locationText}>{apartment.addressInput}</Text>
                            </View>
                        </View>
                        <View style={styles.sizeBadge}>
                            <Text style={styles.sizeText}>{apartment.size} m²</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>În apropiere și conectivitate</Text>
                    <BlurView intensity={50} tint="light" style={styles.poiContainer}>
                        {centerRouteDuration && (
                            <View style={styles.routingInfoBadge}>
                                <Ionicons name="navigate-circle" size={18} color={UI_COLORS.brandSky} />
                                <Text style={styles.routingInfoText}>{centerRouteDuration}</Text>
                            </View>
                        )}
                        <View style={styles.poiGrid}>
                            {nearbyPois.map((poi, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.poiItem}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        const queries: Record<string, string> = {
                                            supermarket: 'supermarket nearby',
                                            cafe: 'cafe nearby',
                                            subway: 'subway station nearby',
                                            bus: 'bus stop nearby',
                                        };
                                        const lat = apartment?.location?.latitude;
                                        const lon = apartment?.location?.longitude;
                                        const q = encodeURIComponent(queries[poi.type] || poi.label);
                                        const url = lat && lon
                                            ? `https://www.google.com/maps/search/${q}/@${lat},${lon},15z`
                                            : `https://www.google.com/maps/search/${q}`;
                                        Linking.openURL(url);
                                    }}
                                >
                                    <Ionicons name={poi.icon} size={20} color={UI_COLORS.brandSky} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.poiLabel} numberOfLines={1}>{poi.label}</Text>
                                        <Text style={styles.poiDistance}>{poi.distance}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={14} color="rgba(77,171,247,0.5)" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </BlurView>

                    <View style={styles.ownerProfileRow}>
                        <Image source={{ uri: apartment.userPhoto }} style={styles.ownerAvatar} />
                        <View>
                            <Text style={styles.ownerLabel}>Proprietar</Text>
                            <Text style={styles.ownerName}>{apartment.userName}</Text>
                        </View>
                    </View>

                    {isOwner && (
                        <View style={styles.ownerNotice}>
                            <Ionicons name="person-circle-outline" size={22} color={UI_COLORS.brandSky} />
                            <Text style={styles.ownerNoticeText}>Anunțul tău (Previzualizare)</Text>
                        </View>
                    )}

                    {stats.count > 0 && (
                        <View style={styles.feedbackSection}>
                            <Text style={styles.sectionTitleSmall}>Reputație Proprietar</Text>
                            <View style={styles.feedbackRow}>
                                <BlurView intensity={45} tint="light" style={styles.ratingCard}>
                                    <Ionicons name="star" size={18} color="#FFD700" />
                                    <View style={{ marginLeft: 10 }}>
                                        <Text style={styles.ratingVal}>{stats.comm}</Text>
                                        <Text style={styles.ratingLabel}>Gazdă</Text>
                                    </View>
                                </BlurView>
                                <BlurView intensity={45} tint="light" style={styles.ratingCard}>
                                    <Ionicons name="home" size={18} color={UI_COLORS.brandSky} />
                                    <View style={{ marginLeft: 10 }}>
                                        <Text style={styles.ratingVal}>{stats.home}</Text>
                                        <Text style={styles.ratingLabel}>Locație</Text>
                                    </View>
                                </BlurView>
                            </View>
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>
                        Unde vrea să meargă {apartment.userName?.split(' ')[0] || 'proprietarul'}
                    </Text>
                    <BlurView intensity={60} tint="light" style={styles.targetCard}>
                        <LinearGradient
                            colors={isMatch
                                ? ['rgba(77, 171, 247, 0.15)', 'rgba(181, 255, 252, 0.15)']
                                : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                            style={styles.targetGradient}
                        >
                            <View style={styles.targetHeader}>
                                <Ionicons name="airplane" size={24} color={UI_COLORS.brandSky} />
                                {isMatch && (
                                    <Animated.View style={[styles.matchBadge, { transform: [{ scale: pulseAnim }] }]}>
                                        <Animated.View style={{ transform: [{ rotate: shakeInterpolate }] }}>
                                            <Ionicons name="sparkles" size={16} color="#FFF" />
                                        </Animated.View>
                                        <Text style={styles.matchBadgeText}>Match Perfect</Text>
                                    </Animated.View>
                                )}
                            </View>
                            <View style={styles.targetInfo}>
                                <Text style={[styles.valueLargeBrand, !isMatch && { fontSize: 18, opacity: 0.8 }]}>
                                    {apartment.targetCity || "Oriunde"}
                                </Text>
                                {isMatch && (
                                    <Text style={styles.matchDescription}>
                                        🎉 Locuința ta din {myApartmentCity} este exact ce caută {apartment.userName?.split(' ')[0]}!
                                    </Text>
                                )}
                            </View>
                        </LinearGradient>
                    </BlurView>

                    <Text style={styles.sectionTitle}>Detalii locuință</Text>
                    <BlurView intensity={40} tint="light" style={styles.glassBoxLarge}>
                        <Text style={styles.detailsText}>{apartment.description}</Text>
                    </BlurView>

                    <Text style={styles.sectionTitle}>Locație exactă</Text>
                    <View style={styles.mapWrapper}>
                        <MapView
                            provider={PROVIDER_GOOGLE}
                            style={styles.map}
                            customMapStyle={darkMapStyle}
                            initialRegion={{ ...mapCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                        >
                            <Marker coordinate={mapCoords}>
                                <View style={styles.customMarker}>
                                    <Ionicons name="home" size={14} color="#FFF" />
                                </View>
                            </Marker>
                        </MapView>
                    </View>

                    <View style={{ height: isOwner ? 60 : 200 }} />
                </BlurView>
            </ScrollView>

            {!isOwner && (
                <BlurView intensity={100} tint="light" style={styles.bottomBar}>
                    <View style={styles.actionContainer}>

                        {}
                        <TouchableOpacity
                            style={styles.btnWrapper}
                            onPress={() => handleAction('chat')}
                            disabled={sending}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.mainActionBtn}
                            >
                                {sending ? <ActivityIndicator color="#FFF" /> : (
                                    <View style={styles.btnContent}>
                                        <Ionicons name="chatbubbles" size={20} color="#FFF" />
                                        <Text style={styles.mainActionText}>
                                            Întreabă-l pe {apartment.userName?.split(' ')[0]}
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {}
                        <TouchableOpacity
                            style={[styles.secondaryBtn, !hasMyApartment && styles.secondaryBtnDisabled]}
                            onPress={() => handleAction('swap')}
                            activeOpacity={0.75}
                        >
                            <View style={styles.secondaryBtnContent}>
                                {!hasMyApartment && (
                                    <Ionicons name="lock-closed" size={14} color={UI_COLORS.brandSky} style={{ marginRight: 6, opacity: 0.6 }} />
                                )}
                                <Text style={[styles.secondaryBtnText, !hasMyApartment && styles.secondaryBtnTextDisabled]}>
                                    {hasMyApartment ? 'Propune schimb direct' : 'Adaugă un anunț pentru a propune schimb'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                    </View>
                </BlurView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroContainer: { height: 440 },
    cityBannerWrapper: { height: 160, width: '100%', position: 'relative', overflow: 'hidden' },
    cityBannerImage: { width: '100%', height: 160 },
    cityBadgeLabel: { position: 'absolute', bottom: 15, left: 20, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
    cityBadgeText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
    apartmentSlider: { marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    headerImage: { width: width, height: 280, resizeMode: 'cover' },
    backButtonContainer: { position: 'absolute', top: 20, left: 20 },
    roundButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' },
    contentCard: { marginTop: -40, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, minHeight: 800 },
    indicator: { width: 40, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 10, alignSelf: 'center', marginBottom: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    title: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: UI_COLORS.brandSky },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    locationText: { fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, fontSize: 13, marginLeft: 5 },
    sizeBadge: { backgroundColor: 'rgba(77, 171, 247, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, height: 38 },
    sizeText: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky, fontSize: 14 },
    poiContainer: { padding: 15, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    routingInfoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', padding: 10, borderRadius: 12, marginBottom: 12 },
    routingInfoText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: UI_COLORS.brandSky, marginLeft: 8 },
    poiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
    poiItem: { width: '48%', backgroundColor: 'rgba(255,255,255,0.5)', padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
    poiLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky },
    poiDistance: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.description },
    ownerProfileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.3)', padding: 12, borderRadius: 20 },
    ownerAvatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, borderWidth: 1, borderColor: '#fff' },
    ownerLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description },
    ownerName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky },
    ownerNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(77, 171, 247, 0.1)', padding: 12, borderRadius: 15, marginBottom: 20 },
    ownerNoticeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky, marginLeft: 10 },
    feedbackSection: { marginBottom: 20 },
    feedbackRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    ratingCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
    ratingVal: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: UI_COLORS.brandSky },
    ratingLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: UI_COLORS.description },
    sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: UI_COLORS.brandSky, marginTop: 15, marginBottom: 12 },
    sectionTitleSmall: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: UI_COLORS.brandSky, marginBottom: 10 },
    targetCard: { borderRadius: 22, overflow: 'hidden' },
    targetGradient: { padding: 18 },
    targetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    targetInfo: { marginTop: 0 },
    matchBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4dabf7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    matchBadgeText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 10, marginLeft: 6 },
    matchDescription: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky, marginTop: 6 },
    glassBoxLarge: { padding: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
    valueLargeBrand: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: UI_COLORS.brandSky },
    detailsText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.description, lineHeight: 22 },
    mapWrapper: { height: 200, borderRadius: 22, overflow: 'hidden', marginTop: 5 },
    map: { ...StyleSheet.absoluteFillObject },
    customMarker: { backgroundColor: UI_COLORS.brandSky, padding: 6, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
    bottomBar: { position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    actionContainer: { gap: 10 },
    btnWrapper: { borderRadius: 18, overflow: 'hidden' },
    mainActionBtn: { height: 58, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mainActionText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    secondaryBtn: { paddingVertical: 10, alignItems: 'center' },
    secondaryBtnDisabled: { opacity: 0.6 },
    secondaryBtnContent: { flexDirection: 'row', alignItems: 'center' },
    secondaryBtnText: { fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky, fontSize: 14 },
    secondaryBtnTextDisabled: { fontSize: 12, color: UI_COLORS.description },
});