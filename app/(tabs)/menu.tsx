import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Firebase imports
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, or, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
    mainTitle: '#1A365D',
    description: '#4A5568',
    brandSky: '#4dabf7',
    white: '#FFFFFF',
    palePink: '#FADCE4',
    pinkIcon: '#ff85a1',
    errorRed: '#FF4D6D',
    warning: '#f59f00',
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const,
    softGradient: ['rgba(255, 222, 233, 0.4)', 'rgba(181, 255, 252, 0.4)', 'rgba(224, 195, 252, 0.4)'] as const,
    aiGradient: ['#4dabf7', '#E0C3FC'] as const
};

export default function MenuScreen() {
    const router = useRouter();
    const [userName, setUserName] = useState("Oaspete");
    const [userPhoto, setUserPhoto] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    const [myAds, setMyAds] = useState<any[]>([]);
    const [offersCount, setOffersCount] = useState(0);
    const [activeSwapsCount, setActiveSwapsCount] = useState(0);
    const [historyCount, setHistoryCount] = useState(0);
    const [unreadHistoryCount, setUnreadHistoryCount] = useState(0);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

    const [profileModal, setProfileModal] = useState(false);
    const [aiHubVisible, setAiHubVisible] = useState(false);
    const [loginAlertModal, setLoginAlertModal] = useState(false);
    const [loginAlertFeature, setLoginAlertFeature] = useState('');

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const requireLogin = (featureName: string, action: () => void) => {
        if (!isLoggedIn) {
            setLoginAlertFeature(featureName);
            setLoginAlertModal(true);
        } else {
            action();
        }
    };

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsLoggedIn(true);

                const userRef = doc(db, "users", user.uid);
                onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserName(data.firstName || "Utilizator");
                        setUserPhoto(data.profileImage || null);
                    }
                });

                const adsQuery = query(collection(db, "apartments"), where("userId", "==", user.uid));
                onSnapshot(adsQuery, (snapshot) => {
                    setMyAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });

                const notifQuery = query(
                    collection(db, "notifications"),
                    where("userId", "==", user.uid),
                    where("read", "==", false)
                );
                onSnapshot(notifQuery, (snapshot) => {
                    setUnreadNotifCount(snapshot.size);
                });

                const chatsQuery = query(
                    collection(db, "chats"),
                    where("participants", "array-contains", user.uid)
                );
                onSnapshot(chatsQuery, (snapshot) => {
                    let unreadTotal = 0;
                    snapshot.docs.forEach(chatDoc => {
                        const chatData = chatDoc.data();
                        if (chatData.lastSenderId && chatData.lastSenderId !== user.uid) {
                            if (!chatData.readBy?.includes(user.uid)) {
                                unreadTotal++;
                            }
                        }
                    });
                    setUnreadMessagesCount(unreadTotal);
                });

                const offersQuery = query(
                    collection(db, "swap_requests"),
                    or(where("ownerId", "==", user.uid), where("senderId", "==", user.uid))
                );
                onSnapshot(offersQuery, (snapshot) => {
                    const allReqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

                    const pending = allReqs.filter((req: any) => {
                        if (req.status === 'rejected') return false;
                        if (req.ownerId === user.uid) return !req.ownerPaid;
                        if (req.senderId === user.uid) return req.status === 'accepted' && !req.senderPaid;
                        return false;
                    });
                    setOffersCount(pending.length);

                    const finalizedUnseen = allReqs.filter((req: any) =>
                        req[`feedback_from_${req.ownerId}`] === true &&
                        req[`feedback_from_${req.senderId}`] === true &&
                        req[`history_seen_by_${user.uid}`] !== true
                    );
                    setUnreadHistoryCount(finalizedUnseen.length);
                });

                const swapsQuery = query(
                    collection(db, "swap_requests"),
                    where("status", "==", "accepted"),
                    where("ownerPaid", "==", true),
                    where("senderPaid", "==", true)
                );
                onSnapshot(swapsQuery, (snapshot) => {
                    const involved = snapshot.docs
                        .map(d => ({ id: d.id, ...d.data() } as any))
                        .filter(s => s.ownerId === user.uid || s.senderId === user.uid);

                    setActiveSwapsCount(involved.filter(s => s[`feedback_from_${user.uid}`] !== true).length);
                    setHistoryCount(involved.filter(s => s[`feedback_from_${s.ownerId}`] === true && s[`feedback_from_${s.senderId}`] === true).length);
                    setLoading(false);
                });

            } else {
                setIsLoggedIn(false);
                setUserName("Oaspete");
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const handleGoToHistory = async () => {
        if (!auth.currentUser) return;
        router.push('/swap-history');

        try {
            const historyQuery = query(
                collection(db, "swap_requests"),
                or(where("ownerId", "==", auth.currentUser.uid), where("senderId", "==", auth.currentUser.uid))
            );
            const snapshot = await getDocs(historyQuery);
            const batch = writeBatch(db);

            snapshot.docs.forEach((d) => {
                const data = d.data();
                if (data[`feedback_from_${data.ownerId}`] === true && data[`feedback_from_${data.senderId}`] === true) {
                    batch.update(d.ref, { [`history_seen_by_${auth.currentUser?.uid}`]: true });
                }
            });
            await batch.commit();
        } catch (e) {
            console.log("Error marking history as seen:", e);
        }
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            <LinearGradient colors={UI_COLORS.appGradient} style={styles.background} />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* --- HEADER --- */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.welcomeBack}>Bună,</Text>
                            <Text style={styles.nameText}>{userName}</Text>
                        </View>

                        <View style={styles.headerRight}>
                            {isLoggedIn && (
                                <TouchableOpacity style={styles.notifBtnTransparent} onPress={() => router.push('/notifications')}>
                                    <Ionicons name={unreadNotifCount > 0 ? "notifications" : "notifications-outline"} size={26} color={UI_COLORS.brandSky} />
                                    {unreadNotifCount > 0 && (
                                        <View style={styles.notifBadgeTopRight}>
                                            <Text style={styles.badgeText}>{unreadNotifCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.profileCircle}
                                onPress={() => isLoggedIn ? setProfileModal(true) : router.push('/auth')}
                            >
                                {isLoggedIn && userPhoto ? (
                                    <Image source={{ uri: userPhoto }} style={styles.avatar} />
                                ) : (
                                    // Fundal transparent, fără albul vechi
                                    <View style={styles.anonymousAvatar}>
                                        <Ionicons name="person" size={24} color={UI_COLORS.brandSky} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- MY ADS --- */}
                    {isLoggedIn && myAds.length > 0 && (
                        <View style={styles.myAdsSection}>
                            <Text style={styles.sectionTitleBrand}>Locuințele tale</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {myAds.map((ad) => (
                                    <TouchableOpacity key={ad.id} style={styles.miniCard} onPress={() => router.push({ pathname: '/edit-apartment', params: { id: ad.id } } as any)}>
                                        <Image source={{ uri: ad.images?.[0] }} style={styles.miniImage} />
                                        <View style={styles.editOverlay}>
                                            <Ionicons name="pencil" size={10} color="#FFF" />
                                            <Text style={styles.editText}>Edit</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- BENTO GRID MENU --- */}
                    <View style={styles.bentoContainer}>
                        {/* Exploreaza — vizibil pentru toti utilizatorii */}
                        <Pressable style={styles.cardLargeGlass} onPress={() => router.push('/explore')}>
                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitleBrand}>Explorează</Text>
                                <Text style={styles.cardSubBrand}>Vezi toate locuințele</Text>
                            </View>
                            <View style={styles.iconContainerLarge}><Ionicons name="home" size={100} color="rgba(77, 171, 247, 0.1)" /></View>
                        </Pressable>

                        <View style={styles.row}>
                            {/* Adauga — necesita autentificare neparat*/}
                            <TouchableOpacity
                                style={styles.cardSmallGlass}
                                onPress={() => requireLogin('adăuga o locuință', () => router.push('/add-apartment'))}
                            >
                                <View style={[styles.iconBg, { backgroundColor: 'rgba(77, 171, 247, 0.15)' }]}>
                                    <Ionicons name="add" size={28} color={UI_COLORS.brandSky} />
                                </View>
                                <Text style={styles.cardSmallTitleBrand}>Adaugă</Text>
                            </TouchableOpacity>

                            {/* Favorite — necesita autentificare */}
                            <TouchableOpacity
                                style={styles.cardSmallGlass}
                                onPress={() => requireLogin('vedea favoritele', () => router.push('/favorites'))}
                            >
                                <View style={[styles.iconBg, { backgroundColor: UI_COLORS.palePink }]}>
                                    <Ionicons name="heart" size={26} color={UI_COLORS.pinkIcon} />
                                </View>
                                <Text style={styles.cardSmallTitleBrand}>Favorite</Text>
                            </TouchableOpacity>
                        </View>

                        {isLoggedIn && (
                            <>
                                <TouchableOpacity style={styles.cardWideGlass} onPress={() => router.push('/offers')}>
                                    <View style={styles.cardWideContent}>
                                        <Text style={styles.cardWideTitleBrand}>Oferte primite</Text>
                                        <Text style={styles.cardWideSub}>{offersCount > 0 ? `Ai ${offersCount} propuneri noi` : 'Nicio ofertă nouă'}</Text>
                                    </View>
                                    <View style={styles.sideBadgeContainer}>
                                        <Ionicons name="mail-outline" size={24} color={UI_COLORS.brandSky} />
                                        {offersCount > 0 && <View style={styles.countBadge}><Text style={styles.countText}>{offersCount}</Text></View>}
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.cardWideGlass} onPress={() => router.push('/active-swaps')}>
                                    <View style={styles.cardWideContent}>
                                        <Text style={styles.cardWideTitleBrand}>Schimburi active</Text>
                                        <Text style={styles.cardWideSub}>{activeSwapsCount > 0 ? `${activeSwapsCount} în curs` : 'Nu ai schimburi active'}</Text>
                                    </View>
                                    <View style={styles.sideBadgeContainer}>
                                        <Ionicons name="sync" size={24} color={UI_COLORS.brandSky} />
                                        {activeSwapsCount > 0 && <View style={[styles.countBadge, { backgroundColor: UI_COLORS.errorRed }]}><Text style={styles.countText}>{activeSwapsCount}</Text></View>}
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.cardWideGlass} onPress={handleGoToHistory}>
                                    <View style={styles.cardWideContent}>
                                        <Text style={styles.cardWideTitleBrand}>Istoric schimburi</Text>
                                        <Text style={styles.cardWideSub}>{historyCount > 0 ? `${historyCount} finalizate` : 'Arhiva ta'}</Text>
                                    </View>
                                    <View style={styles.sideBadgeContainer}>
                                        <Ionicons name="archive-outline" size={24} color={UI_COLORS.brandSky} />
                                        {unreadHistoryCount > 0 && (
                                            <View style={[styles.countBadge, { backgroundColor: UI_COLORS.brandSky }]}>
                                                <Text style={styles.countText}>{unreadHistoryCount}</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* --- MESSAGES HUB --- */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.aiWrapper}>
                {aiHubVisible && (
                    <View style={styles.hubContainer}>
                        <LinearGradient colors={UI_COLORS.softGradient} style={StyleSheet.absoluteFill} />
                        <BlurView intensity={20} tint="light" style={styles.hubGlass}>
                            <View style={styles.hubTopRow}>
                                <Text style={styles.hubTitle}>Centru Mesaje</Text>
                                <TouchableOpacity onPress={() => setAiHubVisible(false)}>
                                    <Ionicons name="close-circle" size={28} color={UI_COLORS.brandSky} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.hubOption} onPress={() => { setAiHubVisible(false); router.push('/chats-list'); }}>
                                <LinearGradient colors={UI_COLORS.aiGradient} style={styles.hubIconBg}>
                                    <Ionicons name="people" size={20} color="#FFF" />
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.hubOptionText}>Conversațiile mele</Text>
                                    <Text style={styles.hubOptionSub}>{unreadMessagesCount} mesaje noi</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={UI_COLORS.brandSky} />
                            </TouchableOpacity>

                            <View style={styles.hubDivider} />

                            <TouchableOpacity style={styles.hubOption} onPress={() => { setAiHubVisible(false); router.push('/ai-assistant'); }}>
                                <LinearGradient colors={['#A2D2FF', '#E0C3FC']} style={styles.hubIconBg}>
                                    <Ionicons name="sparkles" size={20} color="#FFF" />
                                </LinearGradient>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.hubOptionText}>Asistent Swaply</Text>
                                    <Text style={styles.hubOptionSub}>Ajutor rapid</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={UI_COLORS.brandSky} />
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                )}

                {!aiHubVisible && (
                    <TouchableOpacity activeOpacity={0.8} style={styles.aiAvatarBtn} onPress={() => setAiHubVisible(true)}>
                        <LinearGradient colors={['#4dabf7', '#E0C3FC']} style={styles.aiAvatarGradient}>
                            <Ionicons name="chatbubbles" size={28} color="#FFF" />
                        </LinearGradient>
                        {unreadMessagesCount > 0 && (
                            <View style={styles.aiOnlineBadge}>
                                <Text style={styles.badgeTextSmall}>{unreadMessagesCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </KeyboardAvoidingView>

            {/* --- MODAL PROFIL --- */}
            <Modal visible={profileModal} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setProfileModal(false)}>
                    <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[styles.hubContainer, styles.profilePopoverPos]}>
                        <LinearGradient colors={UI_COLORS.softGradient} style={StyleSheet.absoluteFill} />
                        <BlurView intensity={25} tint="light" style={styles.hubGlass}>
                            <View style={styles.hubTopRow}>
                                <Text style={styles.hubTitle}>Contul tău</Text>
                                <TouchableOpacity onPress={() => setProfileModal(false)}>
                                    <Ionicons name="close-circle" size={28} color={UI_COLORS.brandSky} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.hubOption} onPress={() => { setProfileModal(false); router.push('/settings'); }}>
                                <View style={[styles.hubIconBg, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Ionicons name="settings-sharp" size={20} color={UI_COLORS.brandSky} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.hubOptionText}>Setări Profil</Text>
                                    <Text style={styles.hubOptionSub}>Administrează datele tale</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={UI_COLORS.brandSky} />
                            </TouchableOpacity>

                            <View style={styles.hubDivider} />

                            <TouchableOpacity style={styles.hubOption} onPress={() => { setProfileModal(false); router.push('/reviews'); }}>
                                <View style={[styles.hubIconBg, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Ionicons name="star" size={20} color={UI_COLORS.brandSky} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.hubOptionText}>Recenziile Mele</Text>
                                    <Text style={styles.hubOptionSub}>Vezi feedback-ul primit</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={UI_COLORS.brandSky} />
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                </Pressable>
            </Modal>

            {/* --- MODAL LOGIN ALERT --- */}
            <Modal visible={loginAlertModal} transparent animationType="fade">
                <Pressable style={styles.loginAlertOverlay} onPress={() => setLoginAlertModal(false)}>
                    <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.loginAlertContainer}>
                        <LinearGradient colors={UI_COLORS.softGradient} style={StyleSheet.absoluteFill} />
                        <BlurView intensity={25} tint="light" style={styles.hubGlass}>
                            <View style={styles.loginAlertContent}>
                                <View style={styles.loginAlertIconWrap}>
                                    <Ionicons name="lock-closed" size={30} color={UI_COLORS.pinkIcon} />
                                </View>
                                <Text style={styles.loginAlertTitle}>Cont necesar</Text>
                                <Text style={styles.loginAlertSub}>
                                    Trebuie să fii autentificat pentru a putea {loginAlertFeature}.
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.loginAlertBtn}
                                onPress={() => { setLoginAlertModal(false); router.push('/auth'); }}
                            >
                                <LinearGradient colors={UI_COLORS.aiGradient} style={styles.loginAlertBtnGradient}>
                                    <Text style={styles.loginAlertBtnText}>Autentifică-te</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.loginAlertCancel}
                                onPress={() => setLoginAlertModal(false)}
                            >
                                <Text style={styles.loginAlertCancelText}>Înapoi</Text>
                            </TouchableOpacity>
                        </BlurView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    safeArea: { flex: 1 },
    scrollContent: { padding: 25 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    welcomeBack: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.description },
    nameText: { fontFamily: 'Poppins_700Bold', fontSize: 26, color: UI_COLORS.brandSky },

    notifBtnTransparent: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    notifBadgeTopRight: {
        position: 'absolute',
        top: 0,
        right: -2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: UI_COLORS.errorRed,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: { color: 'white', fontSize: 8, fontFamily: 'Poppins_700Bold' },

    // Fundal transparent pentru cercul de profil
    profileCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'transparent',
        overflow: 'hidden'
    },
    avatar: { width: '100%', height: '100%' },
    // Fundal transparent pentru avatarul anonim
    anonymousAvatar: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent'
    },

    myAdsSection: { marginBottom: 25 },
    sectionTitleBrand: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: UI_COLORS.brandSky, marginBottom: 12 },
    miniCard: { width: 95, height: 95, borderRadius: 18, marginRight: 15, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.5)' },
    miniImage: { width: '100%', height: '100%' },
    editOverlay: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    editText: { color: '#FFF', fontSize: 10, fontFamily: 'Poppins_600SemiBold', marginLeft: 4 },
    bentoContainer: { gap: 15 },
    cardLargeGlass: { height: 160, borderRadius: 30, padding: 25, backgroundColor: 'rgba(255, 255, 255, 0.4)', overflow: 'hidden' },
    cardContent: { flex: 1, justifyContent: 'center' },
    cardTitleBrand: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky, fontSize: 24 },
    cardSubBrand: { fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, fontSize: 14 },
    iconContainerLarge: { position: 'absolute', right: -10, bottom: -10 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    cardSmallGlass: { width: '48%', padding: 20, borderRadius: 25, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
    iconBg: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    cardSmallTitleBrand: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: UI_COLORS.brandSky },
    cardWideGlass: { backgroundColor: 'rgba(255, 255, 255, 0.4)', padding: 22, borderRadius: 30, flexDirection: 'row', alignItems: 'center' },
    cardWideContent: { flex: 1 },
    cardWideTitleBrand: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: UI_COLORS.brandSky },
    cardWideSub: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: UI_COLORS.description, marginTop: 2 },
    sideBadgeContainer: { justifyContent: 'center', alignItems: 'center', width: 40 },
    countBadge: { position: 'absolute', top: -10, right: -5, backgroundColor: UI_COLORS.errorRed, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, borderWidth: 1.5, borderColor: '#FFF' },
    countText: { color: '#FFF', fontSize: 10, fontFamily: 'Poppins_700Bold' },

    modalOverlay: { flex: 1, alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingRight: 20 },
    profilePopoverPos: { width: width * 0.8 },

    aiWrapper: { position: 'absolute', bottom: 30, right: 20, alignItems: 'flex-end', zIndex: 2000 },
    aiAvatarBtn: { width: 60, height: 60, borderRadius: 30, elevation: 8, shadowColor: UI_COLORS.brandSky, shadowOpacity: 0.4, shadowRadius: 12 },
    aiAvatarGradient: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
    aiOnlineBadge: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: UI_COLORS.errorRed, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    badgeTextSmall: { color: '#FFF', fontSize: 9, fontFamily: 'Poppins_700Bold' },
    hubContainer: { width: width * 0.85, borderRadius: 30, overflow: 'hidden', backgroundColor: 'transparent', elevation: 10 },
    hubGlass: { borderRadius: 30, padding: 25 },
    hubTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    hubTitle: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: UI_COLORS.brandSky },
    hubOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
    hubIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    hubOptionText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: UI_COLORS.brandSky },
    hubOptionSub: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: UI_COLORS.description },
    hubDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 5 },

    // Login Alert Modal
    loginAlertOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    loginAlertContainer: {
        width: '100%',
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        elevation: 10,
    },
    loginAlertContent: {
        alignItems: 'center',
        marginBottom: 24,
    },
    loginAlertIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 22,
        backgroundColor: UI_COLORS.palePink,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    loginAlertTitle: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 20,
        color: UI_COLORS.brandSky,
        marginBottom: 8,
        textAlign: 'center',
    },
    loginAlertSub: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        color: UI_COLORS.description,
        textAlign: 'center',
        lineHeight: 22,
    },
    loginAlertBtn: {
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 10,
    },
    loginAlertBtnGradient: {
        paddingVertical: 15,
        alignItems: 'center',
        borderRadius: 18,
    },
    loginAlertBtnText: {
        color: '#FFF',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
    },
    loginAlertCancel: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    loginAlertCancelText: {
        color: UI_COLORS.description,
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
    },
});