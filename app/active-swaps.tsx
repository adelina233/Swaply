import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { auth, db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

const UI_COLORS = {
    brandSky: '#4dabf7',
    lightBlueText: '#6FB1FC',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    successPastel: '#F0F9F1',
    successText: '#4CAF50',
    star: '#FFD700',
    starEmpty: '#E2E8F0',
    errorRed: '#ff4d6d',
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const,
    btnGradient: ['#A2D2FF', '#6FB1FC'] as const
};

const WEATHER_API_KEY = 'aee7f8717bac2df01d27bf32bb04be81';


const extractCityFromAddress = (address: string): string => {
    if (!address) return "";
    const parts = address.split(',');
    return parts[parts.length - 1].trim();
};

const getSwapProgress = (swapPeriod: string): { daysTotal: number; daysPassed: number; pct: number; dayLabel: string } => {
    const [startStr, endStr] = (swapPeriod || "").split(" -> ").map(s => s.trim());
    if (!startStr || !endStr) return { daysTotal: 0, daysPassed: 0, pct: 0, dayLabel: "" };
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const now = Date.now();
    const daysTotal = Math.round((end - start) / 86400000) + 1;
    const daysPassed = Math.max(0, Math.min(daysTotal, Math.ceil((now - start) / 86400000)));
    const pct = daysTotal > 0 ? Math.min(1, daysPassed / daysTotal) : 0;
    const notStarted = now < start;
    const ended = now > end;
    const dayLabel = notStarted ? "Neînceput" : ended ? "Finalizat" : `Ziua ${daysPassed} din ${daysTotal}`;
    return { daysTotal, daysPassed, pct, dayLabel };
};


const hasSwapStarted = (swapPeriod: string): boolean => {
    const startStr = swapPeriod?.split(' -> ')?.[0]?.trim();
    if (!startStr) return false;
    return Date.now() >= new Date(startStr).getTime();
};


const WeatherWidget = ({ city }: { city: string }) => {
    const [weather, setWeather] = useState<{ temp: number; icon: string; desc: string; humidity: number; wind: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!city) { setLoading(false); return; }
        const fetchWeather = async () => {
            try {
                const res = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&lang=ro&appid=${WEATHER_API_KEY}`
                );
                const data = await res.json();
                if (data.cod === 200) {
                    setWeather({
                        temp: Math.round(data.main.temp),
                        icon: data.weather[0].icon,
                        desc: data.weather[0].description,
                        humidity: data.main.humidity,
                        wind: Math.round(data.wind.speed),
                    });
                }
            } catch (e) {
                console.error("Weather error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, [city]);

    if (!city) return null;

    if (loading) return (
        <View style={wStyles.skeleton}>
            <ActivityIndicator size="small" color={UI_COLORS.brandSky} />
            <Text style={wStyles.skeletonText}>Se încarcă vremea...</Text>
        </View>
    );

    if (!weather) return null;

    return (
        <View style={wStyles.card}>
            <View style={wStyles.left}>
                <Image
                    source={{ uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png` }}
                    style={wStyles.icon}
                />
                <View>
                    <Text style={wStyles.temp}>{weather.temp}°C</Text>
                    <Text style={wStyles.desc}>{weather.desc}</Text>
                </View>
            </View>
            <View style={wStyles.divider} />
            <View style={wStyles.right}>
                <View style={wStyles.metaRow}>
                    <Ionicons name="water-outline" size={13} color={UI_COLORS.brandSky} />
                    <Text style={wStyles.metaText}>{weather.humidity}% umiditate</Text>
                </View>
                <View style={wStyles.metaRow}>
                    <Ionicons name="speedometer-outline" size={13} color={UI_COLORS.brandSky} />
                    <Text style={wStyles.metaText}>{weather.wind} m/s vânt</Text>
                </View>
                <Text style={wStyles.cityLabel}>{city}</Text>
            </View>
        </View>
    );
};

const wStyles = StyleSheet.create({
    skeleton: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 10 },
    skeletonText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: UI_COLORS.brandSky },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
        gap: 12,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    icon: { width: 44, height: 44 },
    temp: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: UI_COLORS.mainTitle },
    desc: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.description, textTransform: 'capitalize' },
    divider: { width: 1, height: 36, backgroundColor: 'rgba(0,0,0,0.08)' },
    right: { flex: 1, gap: 3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.description },
    cityLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: UI_COLORS.brandSky, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
});


const SwapProgressBar = ({ swapPeriod }: { swapPeriod: string }) => {
    const { pct, dayLabel, daysTotal, daysPassed } = getSwapProgress(swapPeriod);
    const animWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animWidth, {
            toValue: pct,
            duration: 900,
            useNativeDriver: false,
        }).start();
    }, [pct]);

   
    if (!hasSwapStarted(swapPeriod)) return null;

    const isNotStarted = pct === 0 && dayLabel === "Neînceput";
    const isDone = dayLabel === "Finalizat";

    const barColor = isDone
        ? ['#63e6be', '#51cf66'] as const
        : isNotStarted
        ? ['#CBD5E1', '#E2E8F0'] as const
        : ['#A2D2FF', '#6FB1FC'] as const;

    return (
        <View style={pStyles.container}>
            <View style={pStyles.headerRow}>
                <View style={pStyles.labelRow}>
                    <Ionicons
                        name={isDone ? "checkmark-circle" : isNotStarted ? "time-outline" : "hourglass-outline"}
                        size={14}
                        color={isDone ? UI_COLORS.successText : UI_COLORS.brandSky}
                    />
                    <Text style={[pStyles.dayLabel, isDone && { color: UI_COLORS.successText }]}>
                        {dayLabel}
                    </Text>
                </View>
                {!isNotStarted && !isDone && (
                    <Text style={pStyles.pctText}>{Math.round(pct * 100)}%</Text>
                )}
            </View>
            <View style={pStyles.track}>
                <Animated.View style={[pStyles.fill, {
                    width: animWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]}>
                    <LinearGradient colors={barColor} style={pStyles.fillGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                </Animated.View>
                {daysTotal > 0 && [0.25, 0.5, 0.75].map((milestone) => (
                    <View
                        key={milestone}
                        style={[pStyles.milestone, {
                            left: `${milestone * 100}%` as any,
                            backgroundColor: pct >= milestone ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                        }]}
                    />
                ))}
            </View>
            <View style={pStyles.datesRow}>
                <Text style={pStyles.dateText}>{swapPeriod?.split(' -> ')?.[0]}</Text>
                <Text style={pStyles.dateText}>{swapPeriod?.split(' -> ')?.[1]}</Text>
            </View>
        </View>
    );
};

const pStyles = StyleSheet.create({
    container: { marginBottom: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dayLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky },
    pctText: { fontFamily: 'Poppins_700Bold', fontSize: 12, color: UI_COLORS.brandSky },
    track: {
        height: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.5)',
        overflow: 'visible',
        position: 'relative',
    },
    fill: { height: 10, borderRadius: 10, overflow: 'hidden', position: 'absolute', left: 0, top: 0 },
    fillGradient: { flex: 1 },
    milestone: {
        position: 'absolute',
        top: 2,
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: -3,
    },
    datesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
    dateText: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: UI_COLORS.description },
});


const PartnerProfileModal = ({ visible, onClose, partner }: {
    visible: boolean;
    onClose: () => void;
    partner: {
        name: string;
        photo: string | null;
        swapCount?: number;
        avgRating?: number;
        memberSince?: string;
        isFirstSwap?: boolean;
    } | null;
}) => {
    if (!partner) return null;

    const stars = Math.round(partner.avgRating || 0);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity style={ppStyles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={ppStyles.card}>
                    <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={ppStyles.gradient}>

                        <TouchableOpacity style={ppStyles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={18} color={UI_COLORS.brandSky} />
                        </TouchableOpacity>

                        <View style={ppStyles.avatarWrapper}>
                            {partner.photo
                                ? <Image source={{ uri: partner.photo }} style={ppStyles.avatar} />
                                : <View style={ppStyles.avatarFallback}>
                                    <Text style={ppStyles.avatarInitial}>
                                        {partner.name?.[0]?.toUpperCase() || "?"}
                                    </Text>
                                  </View>
                            }
                        </View>

                        <Text style={ppStyles.name}>{partner.name}</Text>

                        <View style={ppStyles.starsRow}>
                            {[1,2,3,4,5].map(s => (
                                <Ionicons
                                    key={s}
                                    name={stars >= s ? "star" : "star-outline"}
                                    size={20}
                                    color={stars >= s ? UI_COLORS.star : UI_COLORS.starEmpty}
                                />
                            ))}
                            {(partner.avgRating || 0) > 0 && (
                                <Text style={ppStyles.ratingNum}>
                                    {(partner.avgRating || 0).toFixed(1)}
                                </Text>
                            )}
                        </View>

                        <View style={ppStyles.statsRow}>
                            <View style={ppStyles.statBox}>
                                <Text style={ppStyles.statValue}>{partner.swapCount ?? 0}</Text>
                                <Text style={ppStyles.statLabel}>Schimburi</Text>
                            </View>
                            <View style={ppStyles.statDivider} />
                            <View style={ppStyles.statBox}>
                                <Text style={ppStyles.statValue}>
                                    {partner.avgRating ? partner.avgRating.toFixed(1) : "—"}
                                </Text>
                                <Text style={ppStyles.statLabel}>Rating mediu</Text>
                            </View>
                            <View style={ppStyles.statDivider} />
                            <View style={ppStyles.statBox}>
                                <Text style={ppStyles.statValue}>{partner.memberSince || "—"}</Text>
                                <Text style={ppStyles.statLabel}>Membru din</Text>
                            </View>
                        </View>

                        <View style={ppStyles.trustBadge}>
                            <Ionicons name="shield-checkmark" size={14} color="#51cf66" />
                            <Text style={ppStyles.trustText}>Utilizator verificat SwapHome</Text>
                        </View>

                    </LinearGradient>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const ppStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    card: { width: width * 0.85, borderRadius: 32, overflow: 'hidden' },
    gradient: { padding: 28, alignItems: 'center' },
    closeBtn: { position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
    avatarWrapper: { alignItems: 'center', marginBottom: 12 },
    avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#FFF' },
    avatarFallback: { width: 90, height: 90, borderRadius: 45, backgroundColor: UI_COLORS.brandSky, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: { fontFamily: 'Poppins_700Bold', fontSize: 36, color: '#FFF' },
    firstBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    firstBadgeText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: UI_COLORS.brandSky },
    name: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: UI_COLORS.mainTitle, marginBottom: 8 },
    starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 20 },
    ratingNum: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: UI_COLORS.mainTitle, marginLeft: 4 },
    statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 20, padding: 16, marginBottom: 16, width: '100%' },
    statBox: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
    statValue: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: UI_COLORS.mainTitle },
    statLabel: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: UI_COLORS.description, marginTop: 2 },
    trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(81,207,102,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    trustText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#51cf66' },
});


const StarRating = ({ value, onChange, size = 36 }: { value: number; onChange: (v: number) => void; size?: number }) => {
    const scales = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
    const handlePress = (star: number) => {
        onChange(star);
        Animated.sequence([
            Animated.spring(scales[star - 1], { toValue: 1.4, useNativeDriver: true, speed: 40 }),
            Animated.spring(scales[star - 1], { toValue: 1, useNativeDriver: true, speed: 20 }),
        ]).start();
    };
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {[1,2,3,4,5].map((star) => (
                <Animated.View key={star} style={{ transform: [{ scale: scales[star - 1] }] }}>
                    <TouchableOpacity onPress={() => handlePress(star)} activeOpacity={0.7}>
                        <Ionicons name={value >= star ? "star" : "star-outline"} size={size} color={value >= star ? UI_COLORS.star : UI_COLORS.starEmpty} />
                    </TouchableOpacity>
                </Animated.View>
            ))}
        </View>
    );
};


const ScoreBadge = ({ score }: { score: number }) => {
    const labels = ['', 'Dezamăgitor', 'Acceptabil', 'Bun', 'Foarte Bun', 'Excelent!'];
    const colors = ['', '#ff6b6b', '#ffa94d', '#74c0fc', '#63e6be', '#51cf66'];
    if (score === 0) return null;
    return (
        <View style={[scoreStyles.badge, { backgroundColor: colors[score] + '22', borderColor: colors[score] + '55' }]}>
            <Text style={[scoreStyles.label, { color: colors[score] }]}>{labels[score]}</Text>
        </View>
    );
};
const scoreStyles = StyleSheet.create({
    badge: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20, borderWidth: 1, marginTop: 6 },
    label: { fontFamily: 'Poppins_600SemiBold', fontSize: 12 },
});


const CountdownTimer = ({ swapPeriod, partnerCity }: { swapPeriod: string; partnerCity: string }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, started: false, ended: false });

    useEffect(() => {
        const startDateStr = swapPeriod?.split(' -> ')?.[0]?.trim();
        const endDateStr = swapPeriod?.split(' -> ')?.[1]?.trim();
        if (!startDateStr) return;

        const tick = () => {
            const now = new Date().getTime();
            const start = new Date(startDateStr).getTime();
            const end = endDateStr ? new Date(endDateStr).getTime() : 0;
            if (now >= start && (!end || now <= end)) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true, ended: false });
                return;
            }
            if (end && now > end) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, started: false, ended: true });
                return;
            }
            const diff = start - now;
            setTimeLeft({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000),
                started: false,
                ended: false,
            });
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [swapPeriod]);

    if (timeLeft.ended) return null;

    if (timeLeft.started) {
        return (
            <View style={{ alignItems: 'center', width: '100%', marginBottom: 14 }}>
                <LinearGradient colors={['#63e6be', '#51cf66']} style={cdStyles.activeBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={cdStyles.activeText}>Schimb în desfășurare! 🏠</Text>
                </LinearGradient>
            </View>
        );
    }

    const units = [
        { label: 'Zile', value: timeLeft.days },
        { label: 'Ore', value: timeLeft.hours },
        { label: 'Min', value: timeLeft.minutes },
        { label: 'Sec', value: timeLeft.seconds },
    ];

    return (
        <View style={cdStyles.container}>
            <Text style={cdStyles.label}>Începe în</Text>
            <View style={cdStyles.unitsRow}>
                {units.map((u, i) => (
                    <React.Fragment key={u.label}>
                        <View style={cdStyles.unitBox}>
                            <LinearGradient colors={UI_COLORS.btnGradient} style={cdStyles.unitBg}>
                                <Text style={cdStyles.unitValue}>{String(u.value).padStart(2, '0')}</Text>
                            </LinearGradient>
                            <Text style={cdStyles.unitLabel}>{u.label}</Text>
                        </View>
                        {i < 3 && <Text style={cdStyles.colon}>:</Text>}
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
};

const cdStyles = StyleSheet.create({
    container: { alignItems: 'center', marginBottom: 14 },
    label: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: UI_COLORS.brandSky, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    unitsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    unitBox: { alignItems: 'center', gap: 4 },
    unitBg: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    unitValue: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: '#FFF' },
    unitLabel: { fontFamily: 'Poppins_400Regular', fontSize: 9, color: UI_COLORS.brandSky, textTransform: 'uppercase' },
    colon: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: UI_COLORS.brandSky, marginBottom: 14 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
    activeText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: '#FFF' },
});


export default function ActiveSwapsScreen() {
    const router = useRouter();
    const [activeSwaps, setActiveSwaps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [feedbackModal, setFeedbackModal] = useState(false);
    const [selectedSwap, setSelectedSwap] = useState<any>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [ratingHome, setRatingHome] = useState(0);
    const [ratingComm, setRatingComm] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [feedbackStep, setFeedbackStep] = useState(1);
    const stepAnim = useRef(new Animated.Value(0)).current;

    // Partner profil
    const [partnerProfileModal, setPartnerProfileModal] = useState(false);
    const [partnerProfileData, setPartnerProfileData] = useState<any>(null);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold
    });

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(
            collection(db, "swap_requests"),
            where("status", "==", "accepted"),
            where("ownerPaid", "==", true),
            where("senderPaid", "==", true)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const myActive = data.filter((s: any) => {
                const isPart = s.ownerId === auth.currentUser?.uid || s.senderId === auth.currentUser?.uid;
                const feedbackDone = s[`feedback_from_${auth.currentUser?.uid}`] === true;
                return isPart && !feedbackDone;
            });
            setActiveSwaps(myActive);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Snapshot Error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const animateStep = () => {
        stepAnim.setValue(40);
        Animated.spring(stepAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    };

    const goToStep = (step: number) => { setFeedbackStep(step); animateStep(); };

    const sendSwapNotification = async (targetUserId: string, title: string, message: string, type: string, swapId: string) => {
        try {
            await addDoc(collection(db, "notifications"), {
                userId: targetUserId, title, message, type, resourceId: swapId, read: false, createdAt: serverTimestamp()
            });
        } catch (e) { console.error("Eroare notificare:", e); }
    };

    const openPartnerProfile = async (swap: any) => {
        const isOwner = auth.currentUser?.uid === swap.ownerId;
        const partnerId = isOwner ? swap.senderId : swap.ownerId;
        const partnerName = isOwner ? (swap.senderName || "Partener") : (swap.ownerName || "Proprietar");
        const partnerPhoto = isOwner ? (swap.senderPhoto || null) : (swap.ownerPhoto || null);

        try {
            const reviewsQuery = query(
                collection(db, "reviews"),
                where("toUserId", "==", partnerId)
            );
            const { getDocs } = await import('firebase/firestore');
            const reviewsSnap = await getDocs(reviewsQuery);
            const reviews = reviewsSnap.docs.map(d => d.data());
            const avgRating = reviews.length > 0
                ? reviews.reduce((sum, r) => sum + ((r.ratingHome + r.ratingCommunication) / 2), 0) / reviews.length
                : 0;

            const swapsQuery = query(
                collection(db, "swap_requests"),
                where("status", "==", "completed"),
                where("senderId", "==", partnerId)
            );
            const swapsSnap = await getDocs(swapsQuery);

            const { getDoc, doc: fsDoc } = await import('firebase/firestore');
            const userSnap = await getDoc(fsDoc(db, "users", partnerId));
            const userData = userSnap.data();
            const createdAt = userData?.createdAt?.seconds
                ? new Date(userData.createdAt.seconds * 1000).getFullYear().toString()
                : null;

            setPartnerProfileData({
                name: partnerName,
                photo: partnerPhoto,
                avgRating: Math.round(avgRating * 10) / 10,
                swapCount: swapsSnap.size,
                memberSince: createdAt,
                isFirstSwap: swapsSnap.size === 0,
            });
            setPartnerProfileModal(true);
        } catch (e) {
            setPartnerProfileData({
                name: partnerName,
                photo: partnerPhoto,
                avgRating: 0,
                swapCount: 0,
                memberSince: null,
                isFirstSwap: true,
            });
            setPartnerProfileModal(true);
        }
    };

    const handleAction = async (swap: any, actionType: 'check-in' | 'check-out') => {
        const isOwner = auth.currentUser?.uid === swap.ownerId;
        const userKey = isOwner ? 'owner' : 'sender';
        const partnerId = isOwner ? swap.senderId : swap.ownerId;
        const myName = isOwner ? (swap.ownerName || "Partenerul") : (swap.senderName || "Partenerul");

        const updateStatusInFirestore = async () => {
            try {
                const fieldName = `${userKey}_${actionType.replace('-', '')}`;
                const updatePayload: any = { [fieldName]: true };
                if (actionType === 'check-out') updatePayload[`${userKey}_checkout_at`] = serverTimestamp();
                await updateDoc(doc(db, "swap_requests", swap.id), updatePayload);
                const notifTitle = actionType === 'check-in' ? "Check-in Nou! 🏠" : "Check-out Nou! ✨";
                const notifMsg = `${myName} a confirmat ${actionType}-ul pentru schimbul tău.`;
                await sendSwapNotification(partnerId, notifTitle, notifMsg, actionType.replace('-', '_'), swap.id);
            } catch (e) {
                Alert.alert("Eroare", "Eșec la actualizarea statusului.");
            }
        };

        Alert.alert("Confirmare", `Ești sigur că vrei să confirmi ${actionType}?`, [
            { text: "Anulează", style: "cancel" },
            { text: "Confirmă", onPress: updateStatusInFirestore }
        ]);
    };

    const submitFeedback = async () => {
        if (!selectedSwap?.id) return;
        if (ratingHome === 0 || ratingComm === 0) { Alert.alert("Eroare", "Te rugăm să acorzi ambele note."); return; }
        setSubmitting(true);
        try {
            const isOwner = auth.currentUser?.uid === selectedSwap.ownerId;
            const targetUserId = isOwner ? selectedSwap.senderId : selectedSwap.ownerId;
            const apartmentIdToReview = isOwner
                ? (selectedSwap.targetApartmentId || selectedSwap.apartmentId || "N/A")
                : (selectedSwap.senderApartmentId || "N/A");
            const myName = isOwner ? (selectedSwap.ownerName || "Eu") : (selectedSwap.senderName || "Eu");

            await addDoc(collection(db, "reviews"), {
                swapId: selectedSwap.id,
                apartmentId: apartmentIdToReview,
                fromUserId: auth.currentUser?.uid,
                fromUserName: myName,
                toUserId: targetUserId || "unknown",
                ratingHome,
                ratingCommunication: ratingComm,
                comment: comment.trim(),
                createdAt: serverTimestamp()
            });

            const feedbackField = `feedback_from_${auth.currentUser?.uid}`;
            const updateData: any = { [feedbackField]: true };
            const partnerFeedbackField = `feedback_from_${targetUserId}`;
            if (selectedSwap[partnerFeedbackField] === true) {
                updateData.status = 'completed';
                updateData.completedAt = serverTimestamp();
            }
            await updateDoc(doc(db, "swap_requests", selectedSwap.id), updateData);

            setFeedbackModal(false);
            setRatingHome(0); setRatingComm(0); setComment(''); setFeedbackStep(1);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
        } catch (e: any) {
            Alert.alert("Eroare", "Nu s-a putut salva recenzia. " + (e.message || ""));
        } finally {
            setSubmitting(false);
        }
    };

    const StatusIndicator = ({ label, done }: { label: string; done: boolean }) => (
        <View style={[styles.statusRow, done && styles.statusRowDone]}>
            <View style={[styles.dot, { backgroundColor: done ? UI_COLORS.successText : '#CBD5E1' }]} />
            <Text style={[styles.statusText, done && styles.statusTextDone]}>{label}</Text>
        </View>
    );

    const renderSwapCard = ({ item }: { item: any }) => {
        const isOwner = auth.currentUser?.uid === item.ownerId;
        const myPrefix = isOwner ? 'owner' : 'sender';
        const partnerPrefix = isOwner ? 'sender' : 'owner';
        const partnerId = isOwner ? item.senderId : item.ownerId;

        const myAptImg = isOwner ? item.apartmentImage : item.senderApartmentImage;
        const partnerAptImg = isOwner ? item.senderApartmentImage : item.apartmentImage;
        const partnerName = isOwner ? (item.senderName || "Partener") : (item.ownerName || "Proprietar");
        const partnerPhoto = isOwner ? (item.senderPhoto || null) : (item.ownerPhoto || null);

        const myDestinationCity = isOwner
            ? (item.senderCity || extractCityFromAddress(item.senderAddressInput || ""))
            : (item.targetCity || extractCityFromAddress(item.addressInput || ""));

        const myCheckin = item[`${myPrefix}_checkin`] === true;
        const myCheckout = item[`${myPrefix}_checkout`] === true;
        const partnerCheckin = item[`${partnerPrefix}_checkin`] === true;
        const partnerCheckout = item[`${partnerPrefix}_checkout`] === true;
        const partnerFeedbackDone = item[`feedback_from_${partnerId}`] === true;

        const myCheckoutTime = item[`${myPrefix}_checkout_at`]?.seconds || 0;
        const partnerCheckoutTime = item[`${partnerPrefix}_checkout_at`]?.seconds || 0;
        const iAmLastCheckout = myCheckoutTime >= partnerCheckoutTime;

       
        const swapStarted = hasSwapStarted(item.swapPeriod);

        let canFeedback = false;
        let waitingMessage = "Așteaptă Finalizare";
        if (myCheckout && partnerCheckout) {
            if (iAmLastCheckout) { canFeedback = true; }
            else if (partnerFeedbackDone) { canFeedback = true; }
            else { waitingMessage = "Așteaptă Feedback Partener"; }
        }

        return (
            <BlurView intensity={80} tint="light" style={styles.focusCard}>

                <View style={styles.topCardActions}>
                    <TouchableOpacity
                        style={styles.receiptAction}
                        onPress={() => router.push({ pathname: "/receipt-details", params: { swapId: item.id } } as any)}
                    >
                        <Ionicons name="document-text" size={18} color={UI_COLORS.brandSky} />
                        <Text style={styles.receiptActionText}>Chitanță PDF</Text>
                    </TouchableOpacity>
                </View>

                {/* Hero images — partenerul e tap-abil */}
                <View style={styles.heroSection}>
                    <View style={styles.aptBlock}>
                        <Image source={{ uri: myAptImg || 'https://via.placeholder.com/150' }} style={styles.heroImg} />
                        <Text style={styles.aptLabel}>Casa Ta</Text>
                    </View>
                    <Ionicons name="swap-horizontal" size={24} color={UI_COLORS.brandSky} />
                    <TouchableOpacity style={styles.aptBlock} onPress={() => openPartnerProfile(item)} activeOpacity={0.8}>
                        <Image source={{ uri: partnerAptImg || 'https://via.placeholder.com/150' }} style={styles.heroImg} />
                        {partnerPhoto && (
                            <View style={styles.partnerAvatarOverlay}>
                                <Image source={{ uri: partnerPhoto }} style={styles.partnerAvatarSmall} />
                            </View>
                        )}
                        <View style={styles.partnerNameRow}>
                            <Text style={styles.aptLabel}>{partnerName}</Text>
                            <Ionicons name="chevron-forward" size={12} color={UI_COLORS.brandSky} />
                        </View>
                    </TouchableOpacity>
                </View>

                {}
                <SwapProgressBar swapPeriod={item.swapPeriod} />

                {}
                <CountdownTimer swapPeriod={item.swapPeriod} partnerCity={myDestinationCity} />

                {}
                {myDestinationCity ? (
                    <WeatherWidget city={myDestinationCity} />
                ) : null}

                {}
                {swapStarted && (
                    <>
                        <View style={styles.checklistContainer}>
                            <View style={styles.checkColumn}>
                                <Text style={styles.checkTitle}>Tu</Text>
                                <StatusIndicator label="Check-in" done={myCheckin} />
                                <StatusIndicator label="Check-out" done={myCheckout} />
                            </View>
                            <View style={styles.verticalDivider} />
                            <View style={styles.checkColumn}>
                                <Text style={styles.checkTitle}>Partener</Text>
                                <StatusIndicator label="Check-in" done={partnerCheckin} />
                                <StatusIndicator label="Check-out" done={partnerCheckout} />
                            </View>
                        </View>

                        <View style={styles.footerActions}>
                            {!myCheckin ? (
                                <TouchableOpacity style={styles.mainBtnWrapper} onPress={() => handleAction(item, 'check-in')}>
                                    <LinearGradient colors={UI_COLORS.btnGradient} style={styles.mainBtnGradient}>
                                        <Text style={styles.mainBtnText}>Confirmă Check-in</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : !myCheckout ? (
                                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: UI_COLORS.successPastel }]} onPress={() => handleAction(item, 'check-out')}>
                                    <Text style={[styles.mainBtnText, { color: UI_COLORS.successText }]}>Confirmă Check-out</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.mainBtnWrapper}
                                    disabled={!canFeedback}
                                    onPress={() => { setSelectedSwap(item); setFeedbackStep(1); setFeedbackModal(true); }}
                                >
                                    <LinearGradient
                                        colors={canFeedback ? UI_COLORS.btnGradient : ['#E2E8F0', '#CBD5E1']}
                                        style={styles.mainBtnGradient}
                                    >
                                        <Text style={[styles.mainBtnText, !canFeedback && { color: '#94A3B8' }]}>
                                            {canFeedback ? "⭐ Lasă Feedback" : waitingMessage}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}

                {}
                {!swapStarted && (
                    <View style={styles.notStartedNotice}>
                        <Ionicons name="time-outline" size={16} color={UI_COLORS.brandSky} />
                        <Text style={styles.notStartedText}>
                            Check-in disponibil din {item.swapPeriod?.split(' -> ')?.[0]}
                        </Text>
                    </View>
                )}

            </BlurView>
        );
    };

    if (loading || !fontsLoaded) return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

    return (
        <View style={styles.container}>
            <LinearGradient colors={UI_COLORS.appGradient} style={styles.background} />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.circleBack}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                    <Text style={styles.titleText}>Schimburi Active</Text>
                    <View style={{ width: 44 }} />
                </View>
                <FlatList
                    data={activeSwaps}
                    renderItem={renderSwapCard}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>Nu ai niciun schimb activ.</Text>}
                />
            </SafeAreaView>

            {showConfetti && <ConfettiCannon count={200} origin={{ x: width / 2, y: -20 }} fadeOut />}

            <PartnerProfileModal
                visible={partnerProfileModal}
                onClose={() => setPartnerProfileModal(false)}
                partner={partnerProfileData}
            />

            {}
            <Modal visible={feedbackModal} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.overlay}>
                            <View style={styles.feedbackSheet}>
                                <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.feedbackSheetInner}>
                                    <View style={styles.fbHeader}>
                                        <View>
                                            <Text style={styles.fbTitle}>Evaluează Schimbul</Text>
                                            <Text style={styles.fbSubtitle}>
                                                {feedbackStep === 1 ? "Cum a fost locuința?" : feedbackStep === 2 ? "Cum a fost comunicarea?" : "Lasă un mesaj (opțional)"}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setFeedbackModal(false); setFeedbackStep(1); }} style={styles.fbCloseBtn}>
                                            <Ionicons name="close" size={20} color={UI_COLORS.brandSky} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.stepRow}>
                                        {[1,2,3].map((s) => (
                                            <View key={s} style={[styles.stepDot, feedbackStep >= s && styles.stepDotActive]} />
                                        ))}
                                    </View>
                                    {selectedSwap && (
                                        <View style={styles.partnerPreview}>
                                            <Image
                                                source={{ uri: auth.currentUser?.uid === selectedSwap.ownerId ? (selectedSwap.senderPhoto || 'https://via.placeholder.com/50') : (selectedSwap.ownerPhoto || 'https://via.placeholder.com/50') }}
                                                style={styles.partnerAvatar}
                                            />
                                            <View>
                                                <Text style={styles.partnerName}>
                                                    {auth.currentUser?.uid === selectedSwap.ownerId ? (selectedSwap.senderName || "Partener") : (selectedSwap.ownerName || "Proprietar")}
                                                </Text>
                                                <Text style={styles.partnerPeriod}>{selectedSwap.swapPeriod}</Text>
                                            </View>
                                        </View>
                                    )}
                                    <Animated.View style={{ transform: [{ translateY: stepAnim }] }}>
                                        {feedbackStep === 1 && (
                                            <View style={styles.stepContent}>
                                                <View style={styles.ratingIconWrap}>
                                                    <LinearGradient colors={['#A2D2FF', '#6FB1FC']} style={styles.ratingIconBg}>
                                                        <Ionicons name="home" size={32} color="#FFF" />
                                                    </LinearGradient>
                                                </View>
                                                <Text style={styles.ratingQuestion}>Cum a fost locuința?</Text>
                                                <StarRating value={ratingHome} onChange={setRatingHome} size={42} />
                                                <ScoreBadge score={ratingHome} />
                                                <TouchableOpacity style={[styles.nextBtn, ratingHome === 0 && styles.nextBtnDisabled]} disabled={ratingHome === 0} onPress={() => goToStep(2)}>
                                                    <LinearGradient colors={ratingHome > 0 ? UI_COLORS.btnGradient : ['#E2E8F0', '#CBD5E1']} style={styles.nextBtnGradient}>
                                                        <Text style={[styles.nextBtnText, ratingHome === 0 && { color: '#94A3B8' }]}>Continuă</Text>
                                                        <Ionicons name="arrow-forward" size={18} color={ratingHome > 0 ? "#FFF" : "#94A3B8"} />
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {feedbackStep === 2 && (
                                            <View style={styles.stepContent}>
                                                <View style={styles.ratingIconWrap}>
                                                    <LinearGradient colors={['#B5FFFC', '#4dabf7']} style={styles.ratingIconBg}>
                                                        <Ionicons name="chatbubbles" size={32} color="#FFF" />
                                                    </LinearGradient>
                                                </View>
                                                <Text style={styles.ratingQuestion}>Cum a fost comunicarea?</Text>
                                                <StarRating value={ratingComm} onChange={setRatingComm} size={42} />
                                                <ScoreBadge score={ratingComm} />
                                                <View style={styles.twoButtons}>
                                                    <TouchableOpacity style={styles.backBtn} onPress={() => goToStep(1)}>
                                                        <Ionicons name="arrow-back" size={18} color={UI_COLORS.brandSky} />
                                                        <Text style={styles.backBtnText}>Înapoi</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={[styles.nextBtnSmall, ratingComm === 0 && styles.nextBtnDisabled]} disabled={ratingComm === 0} onPress={() => goToStep(3)}>
                                                        <LinearGradient colors={ratingComm > 0 ? UI_COLORS.btnGradient : ['#E2E8F0', '#CBD5E1']} style={styles.nextBtnGradient}>
                                                            <Text style={[styles.nextBtnText, ratingComm === 0 && { color: '#94A3B8' }]}>Continuă</Text>
                                                            <Ionicons name="arrow-forward" size={18} color={ratingComm > 0 ? "#FFF" : "#94A3B8"} />
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                        {feedbackStep === 3 && (
                                            <View style={styles.stepContent}>
                                                <View style={styles.summaryRow}>
                                                    <View style={styles.summaryItem}>
                                                        <Ionicons name="home" size={16} color={UI_COLORS.brandSky} />
                                                        <Text style={styles.summaryLabel}>Locuință</Text>
                                                        <View style={styles.summaryStars}>
                                                            {[1,2,3,4,5].map(s => <Ionicons key={s} name={ratingHome >= s ? "star" : "star-outline"} size={13} color={UI_COLORS.star} />)}
                                                        </View>
                                                    </View>
                                                    <View style={styles.summaryDivider} />
                                                    <View style={styles.summaryItem}>
                                                        <Ionicons name="chatbubbles" size={16} color={UI_COLORS.brandSky} />
                                                        <Text style={styles.summaryLabel}>Comunicare</Text>
                                                        <View style={styles.summaryStars}>
                                                            {[1,2,3,4,5].map(s => <Ionicons key={s} name={ratingComm >= s ? "star" : "star-outline"} size={13} color={UI_COLORS.star} />)}
                                                        </View>
                                                    </View>
                                                </View>
                                                <TextInput
                                                    style={styles.mInput}
                                                    placeholder="Spune-ne mai multe despre experiența ta..."
                                                    placeholderTextColor="#A0AEC0"
                                                    multiline
                                                    value={comment}
                                                    onChangeText={setComment}
                                                />
                                                <View style={styles.twoButtons}>
                                                    <TouchableOpacity style={styles.backBtn} onPress={() => goToStep(2)}>
                                                        <Ionicons name="arrow-back" size={18} color={UI_COLORS.brandSky} />
                                                        <Text style={styles.backBtnText}>Înapoi</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.nextBtnSmall} onPress={submitFeedback} disabled={submitting}>
                                                        <LinearGradient colors={UI_COLORS.btnGradient} style={styles.nextBtnGradient}>
                                                            {submitting ? <ActivityIndicator color="#FFF" size="small" /> : <>
                                                                <Text style={styles.nextBtnText}>Trimite</Text>
                                                                <Ionicons name="checkmark" size={18} color="#FFF" />
                                                            </>}
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </Animated.View>
                                </LinearGradient>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    circleBack: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' },
    titleText: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    focusCard: { borderRadius: 30, padding: 20, marginBottom: 20, overflow: 'hidden' },
    topCardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
    receiptAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, gap: 8 },
    receiptActionText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    heroSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    aptBlock: { alignItems: 'center', width: width * 0.35 },
    heroImg: { width: 90, height: 90, borderRadius: 20, marginBottom: 8, backgroundColor: '#EEE' },
    partnerAvatarOverlay: { position: 'absolute', bottom: 22, right: 0, borderRadius: 14, borderWidth: 2, borderColor: '#FFF', overflow: 'hidden' },
    partnerAvatarSmall: { width: 28, height: 28 },
    partnerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    aptLabel: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.lightBlueText, textAlign: 'center' },
    checklistContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 18, padding: 15, marginBottom: 15 },
    checkColumn: { flex: 1, alignItems: 'center' },
    verticalDivider: { width: 1, backgroundColor: '#CBD5E1', marginHorizontal: 10 },
    checkTitle: { fontFamily: 'Poppins_700Bold', fontSize: 11, color: UI_COLORS.brandSky, marginBottom: 10, textTransform: 'uppercase' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    statusRowDone: { opacity: 0.6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: UI_COLORS.description },
    statusTextDone: { color: UI_COLORS.successText, textDecorationLine: 'line-through' },
    footerActions: { flexDirection: 'row', gap: 10 },
    mainBtn: { flex: 1, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    mainBtnWrapper: { flex: 1, height: 55, borderRadius: 18, overflow: 'hidden' },
    mainBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
    mainBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 14 },
    notStartedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(77,171,247,0.1)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 4,
    },
    notStartedText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky, flex: 1 },
    emptyText: { textAlign: 'center', marginTop: 50, color: UI_COLORS.description, fontFamily: 'Poppins_400Regular' },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
    feedbackSheet: { width: '92%', borderRadius: 35, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
    feedbackSheetInner: { padding: 28, paddingBottom: 32 },
    fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    fbTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    fbSubtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: UI_COLORS.brandSky, marginTop: 2 },
    fbCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
    stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
    stepDotActive: { backgroundColor: UI_COLORS.brandSky, width: 24 },
    partnerPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 20, padding: 12, marginBottom: 22 },
    partnerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEE' },
    partnerName: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.brandSky },
    partnerPeriod: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.brandSky },
    stepContent: { alignItems: 'stretch' },
    ratingIconWrap: { alignItems: 'center', marginBottom: 12 },
    ratingIconBg: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    ratingQuestion: { textAlign: 'center', fontFamily: 'Poppins_700Bold', fontSize: 17, color: UI_COLORS.brandSky, marginBottom: 16 },
    nextBtn: { marginTop: 24, height: 54, borderRadius: 18, overflow: 'hidden' },
    nextBtnSmall: { flex: 1, height: 50, borderRadius: 16, overflow: 'hidden' },
    nextBtnDisabled: { opacity: 0.6 },
    nextBtnGradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    nextBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 15 },
    twoButtons: { flexDirection: 'row', gap: 10, marginTop: 22 },
    backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 18, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.5)' },
    backBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.brandSky },
    summaryRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 18, padding: 14, marginBottom: 16 },
    summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
    summaryDivider: { width: 1, backgroundColor: '#CBD5E1' },
    summaryLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: UI_COLORS.brandSky },
    summaryStars: { flexDirection: 'row', gap: 2 },
    mInput: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 18, height: 90, textAlignVertical: 'top', fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.brandSky },
});