import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Firebase imports
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
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function DetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    
    const [apartment, setApartment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [myApartmentCity, setMyApartmentCity] = useState<string | null>(null);
    const [stats, setStats] = useState({ home: 0, comm: 0, count: 0 });

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
                }
            } catch (e) { console.log(e); }
        };

        fetchDetails();
        fetchMyApt();
    }, [id]);

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
                participantNames: {
                    [currentUid]: myName,
                    [ownerUid]: apartment.userName
                },
                participantPhotos: {
                    [currentUid]: myPhoto,
                    [ownerUid]: apartment.userPhoto
                },
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

    if (!fontsLoaded || loading || !apartment) return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

    const mapCoords = {
        latitude: apartment.location?.latitude || 44.4268,
        longitude: apartment.location?.longitude || 26.1025
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.imageContainer}>
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
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

                    <Text style={styles.sectionTitle}>Destinație vizată</Text>
                    <BlurView intensity={60} tint="light" style={styles.targetCard}>
                        <LinearGradient 
                            colors={isMatch ? ['rgba(77, 171, 247, 0.15)', 'rgba(181, 255, 252, 0.15)'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} 
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
                                        🎉 Locuința ta din {myApartmentCity} este exact ce caută proprietarul!
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
                                <View style={styles.customMarker}><Ionicons name="home" size={14} color="#FFF" /></View>
                            </Marker>
                        </MapView>
                    </View>

                    <View style={{ height: isOwner ? 60 : 180 }} />
                </BlurView>
            </ScrollView>

            {!isOwner && (
                <BlurView intensity={100} tint="light" style={styles.bottomBar}>
                    <View style={styles.actionContainer}>
                        <TouchableOpacity style={styles.btnWrapper} onPress={() => handleAction('chat')} disabled={sending}>
                            <LinearGradient colors={[UI_COLORS.softBlue, UI_COLORS.buttonBlue]} style={styles.mainActionBtn}>
                                {sending ? <ActivityIndicator color="#FFF" /> : (
                                    <View style={styles.btnContent}>
                                        <Ionicons name="chatbubbles" size={20} color="#FFF" />
                                        <Text style={styles.mainActionText}>Întreabă-l pe {apartment.userName?.split(' ')[0]}</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => handleAction('swap')}>
                            <Text style={styles.secondaryBtnText}>Propune schimb direct</Text>
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
    imageContainer: { height: 380 },
    headerImage: { width: width, height: 380, resizeMode: 'cover' },
    backButtonContainer: { position: 'absolute', top: 10, left: 20 },
    roundButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
    contentCard: { marginTop: -30, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, minHeight: 800 },
    indicator: { width: 40, height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 10, alignSelf: 'center', marginBottom: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    title: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: UI_COLORS.brandSky }, 
    locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    locationText: { fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, fontSize: 13, marginLeft: 5 },
    sizeBadge: { backgroundColor: 'rgba(77, 171, 247, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15 },
    sizeText: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky, fontSize: 14 },
    ownerProfileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.3)', padding: 12, borderRadius: 20 },
    ownerAvatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, borderWidth: 1, borderColor: '#fff' },
    ownerLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description },
    ownerName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.mainTitle },
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
    matchDescription: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.mainTitle, marginTop: 6 },
    glassBoxLarge: { padding: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
    valueLargeBrand: { fontFamily: 'Poppins_700Bold', fontSize: 24, color: UI_COLORS.brandSky },
    detailsText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.description, lineHeight: 22 },
    mapWrapper: { height: 200, borderRadius: 22, overflow: 'hidden', marginTop: 5 },
    map: { ...StyleSheet.absoluteFillObject },
    customMarker: { backgroundColor: UI_COLORS.brandSky, padding: 6, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
    bottomBar: { position: 'absolute', bottom: 0, width: '100%', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    actionContainer: { gap: 10 },
    btnWrapper: { borderRadius: 18, overflow: 'hidden' },
    mainActionBtn: { height: 58, justifyContent: 'center', alignItems: 'center' },
    btnContent: { flexDirection: 'row', alignItems: 'center' },
    mainActionText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16, marginLeft: 10 },
    secondaryBtn: { paddingVertical: 10, alignItems: 'center' },
    secondaryBtnText: { fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky, fontSize: 14 },
});
