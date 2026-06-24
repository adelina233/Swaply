import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    subText: '#718096',
    white: '#FFFFFF',
    bookedText: '#c0392b',
    bookedDot: '#e74c3c',
    warning: '#f59f00',
    warningBg: 'rgba(245, 159, 0, 0.1)',
};

const CURRENCIES = ['RON', 'EUR', 'USD'];

export default function CreateOfferScreen() {
    const { targetId } = useLocalSearchParams();
    const router = useRouter();
    
    const [targetApartment, setTargetApartment] = useState<any>(null);
    const [myApartment, setMyApartment] = useState<any>(null);
    const [myApartments, setMyApartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // ── VERIFICARE IDENTITATE ──
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    
    const [range, setRange] = useState({ start: '', end: '' });
    const [guarantee, setGuarantee] = useState('500');
    const [currency, setCurrency] = useState('RON');
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);

    const [bookedDates, setBookedDates] = useState<{[key: string]: any}>({});

    const [weatherInsight, setWeatherInsight] = useState<string | null>(null);
    const [displayText, setDisplayText] = useState(""); 
    const [loadingAI, setLoadingAI] = useState(false);
    
    const streamingIntervalRef = useRef<any>(null);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const startStreaming = (fullText: string) => {
        if (!fullText) return;
        setDisplayText(""); 
        let index = 0;
        const words = fullText.split(" ");
        
        if (streamingIntervalRef.current) clearInterval(streamingIntervalRef.current);

        streamingIntervalRef.current = setInterval(() => {
            if (index < words.length) {
                const wordToAdd = words[index];
                if (wordToAdd !== undefined) {
                    setDisplayText((prev) => prev + (index === 0 ? "" : " ") + wordToAdd);
                }
                index++;
            } else {
                if (streamingIntervalRef.current) clearInterval(streamingIntervalRef.current);
            }
        }, 65);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
            
                const user = auth.currentUser;
                if (user) {
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        setIsVerified(userData?.isVerified === true);
                    } else {
                        setIsVerified(false);
                    }
                }

                const targetRef = doc(db, "apartments", targetId as string);
                const targetSnap = await getDoc(targetRef);
                if (targetSnap.exists()) {
                    const aptData = targetSnap.data();
                    const ownerProfileRef = doc(db, "users", aptData.userId);
                    const ownerProfileSnap = await getDoc(ownerProfileRef);
                    const ownerData = ownerProfileSnap.data();

                    setTargetApartment({
                        ...aptData,
                        ownerName: ownerData?.firstName || "Proprietar",
                        ownerPhoto: ownerData?.profileImage || null
                    });

                    const blocked: {[key: string]: any} = {};

                    const swapQuery = query(
                        collection(db, "swap_requests"),
                        where("targetApartmentId", "==", targetId as string),
                        where("status", "in", ["pending", "accepted"])
                    );
                    const swapSnap = await getDocs(swapQuery);

                    swapSnap.docs.forEach((docSnap) => {
                        const data = docSnap.data();
                        const periodStr: string = data.swapPeriod || "";
                        const [startStr, endStr] = periodStr.split(" -> ");
                        if (!startStr || !endStr) return;

                        const start = new Date(startStr);
                        const end = new Date(endStr);
                        const current = new Date(start);

                        while (current <= end) {
                            const dateStr = current.toISOString().split('T')[0];
                            blocked[dateStr] = {
                                disabled: true,
                                disableTouchEvent: true,
                                marked: true,
                                dotColor: '#e57373',
                                customStyles: {
                                    container: {
                                        backgroundColor: 'rgba(229,115,115,0.12)',
                                        borderRadius: 18,
                                    },
                                    text: {
                                        color: '#e57373',
                                        textDecorationLine: 'line-through',
                                        opacity: 0.75,
                                    },
                                },
                            };
                            current.setDate(current.getDate() + 1);
                        }
                    });

                    setBookedDates(blocked);
                }

                const myAdsQuery = query(collection(db, "apartments"), where("userId", "==", auth.currentUser?.uid));
                const myAdsSnap = await getDocs(myAdsQuery);
                if (!myAdsSnap.empty) {
                    const allMyApts = myAdsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setMyApartments(allMyApts);
                    setMyApartment(allMyApts[0]);
                }

            } catch (error) {
                console.error("Eroare fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        return () => { if (streamingIntervalRef.current) clearInterval(streamingIntervalRef.current); };
    }, [targetId]);

    const fetchPredictiveWeather = async (lat: number, lon: number, cityName: string, startDateStr: string, endDateStr: string) => {
        setLoadingAI(true);
        setWeatherInsight(null);
        setDisplayText("");
        try {
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);
            const startLast = new Date(start.setFullYear(start.getFullYear() - 1)).toISOString().split('T')[0];
            const endLast = new Date(end.setFullYear(end.getFullYear() - 1)).toISOString().split('T')[0];

            const response = await fetch(
                `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startLast}&end_date=${endLast}&daily=temperature_2m_max&timezone=auto`
            );
            const data = await response.json();
            
            if (data.daily && data.daily.temperature_2m_max) {
                const temps = data.daily.temperature_2m_max;
                const avgTemp = Math.round(temps.reduce((a: number, b: number) => a + b, 0) / temps.length);
                
                let recommendation = "";
                if (avgTemp > 26) recommendation = "Media istorică indică o perioadă caniculară. AC-ul va fi esențial.";
                else if (avgTemp > 16) recommendation = "Temperaturi medii ideale pentru explorat orașul la pas.";
                else if (avgTemp > 5) recommendation = "Se anunță o perioadă răcoroasă în medie. Hainele de vânt sunt recomandate.";
                else recommendation = "Trendul istoric arată frig intens. Verifică confortul termic al locuinței.";

                const fullResult = `Predictive AI: Pentru cele ${temps.length} zile selectate, media temperaturilor înregistrată anul trecut în ${cityName} a fost de ${avgTemp}°C. ${recommendation}`;
                
                setLoadingAI(false);
                setWeatherInsight(fullResult);
                startStreaming(fullResult);
            }
        } catch (e) {
            setWeatherInsight("Analiza predictivă este momentan indisponibilă.");
            setLoadingAI(false);
        }
    };

    const onDayPress = (day: any) => {
        if (bookedDates[day.dateString]) {
            Alert.alert("Zi indisponibilă", "Această zi este deja rezervată de altcineva.");
            return;
        }

        if (!range.start || (range.start && range.end)) {
            setRange({ start: day.dateString, end: '' });
            setWeatherInsight(null);
            setDisplayText("");
        } else {
            const start = new Date(range.start);
            const end = new Date(day.dateString);

            if (end < start) {
                setRange({ start: day.dateString, end: '' });
                return;
            }

            let hasConflict = false;
            const check = new Date(start);
            while (check <= end) {
                if (bookedDates[check.toISOString().split('T')[0]]) {
                    hasConflict = true;
                    break;
                }
                check.setDate(check.getDate() + 1);
            }

            if (hasConflict) {
                Alert.alert(
                    "Perioadă indisponibilă",
                    "Intervalul selectat include zile deja rezervate. Te rugăm să alegi altă perioadă."
                );
                return;
            }

            const newRange = { start: range.start, end: day.dateString };
            setRange(newRange);
            
            const address = targetApartment?.addressInput || "";
            const cityToSearch = address.split(',').pop()?.trim() || "destinație";
            const lat = targetApartment?.location?.latitude;
            const lon = targetApartment?.location?.longitude;

            if (lat && lon) {
                fetchPredictiveWeather(lat, lon, cityToSearch, range.start, day.dateString);
            }
        }
    };

    const buildMarkedDatesCustom = () => {
        const marked: {[key: string]: any} = {};

        Object.keys(bookedDates).forEach(dateStr => {
            marked[dateStr] = { ...bookedDates[dateStr] };
        });

        if (range.start) {
            if (range.end) {
                const start = new Date(range.start);
                const end = new Date(range.end);
                const current = new Date(start);

                while (current <= end) {
                    const dateStr = current.toISOString().split('T')[0];
                    if (!bookedDates[dateStr]) {
                        const isStart = dateStr === range.start;
                        const isEnd = dateStr === range.end;
                        marked[dateStr] = {
                            customStyles: {
                                container: {
                                    backgroundColor: (isStart || isEnd) ? UI_COLORS.brandSky : 'rgba(77,171,247,0.25)',
                                    borderTopLeftRadius: isStart ? 18 : 0,
                                    borderBottomLeftRadius: isStart ? 18 : 0,
                                    borderTopRightRadius: isEnd ? 18 : 0,
                                    borderBottomRightRadius: isEnd ? 18 : 0,
                                    borderRadius: (isStart && isEnd) ? 18 : undefined,
                                },
                                text: {
                                    color: (isStart || isEnd) ? '#FFF' : UI_COLORS.brandSky,
                                    fontFamily: 'Poppins_600SemiBold',
                                },
                            },
                        };
                    }
                    current.setDate(current.getDate() + 1);
                }
            } else {
                if (!bookedDates[range.start]) {
                    marked[range.start] = {
                        customStyles: {
                            container: { backgroundColor: UI_COLORS.brandSky, borderRadius: 18 },
                            text: { color: '#FFF', fontFamily: 'Poppins_600SemiBold' },
                        },
                    };
                }
            }
        }

        return marked;
    };

   
    const handleConfirmOffer = async () => {
        
        if (!isVerified) {
            setShowVerifyModal(true);
            return;
        }

        if (!range.start || !range.end) {
            Alert.alert("Eroare", "Selectează perioada schimbului.");
            return;
        }
        setSending(true);
        try {
            const user = auth.currentUser;

            const myProfileRef = doc(db, "users", user?.uid as string);
            const myProfileSnap = await getDoc(myProfileRef);
            const myData = myProfileSnap.data();

            const myApartmentImage = myApartment?.images?.[0] || null;
            const targetApartmentImage = targetApartment?.images?.[0] || null;

            const extractCity = (address: string) => {
                if (!address) return "";
                const parts = address.split(',');
                return parts[parts.length - 1].trim();
            };
            const targetCity = extractCity(targetApartment?.addressInput || "") || targetApartment?.city || "";
            const senderCity = extractCity(myApartment?.addressInput || "") || myApartment?.city || "";

            await addDoc(collection(db, "swap_requests"), {
                ownerId: targetApartment.userId,
                ownerName: targetApartment.ownerName,
                ownerPhoto: targetApartment.ownerPhoto,
                targetApartmentTitle: targetApartment.title || "Apartament",
                targetApartmentId: targetId,

                targetCity,
                senderCity,

                apartmentImage: targetApartmentImage,
                ownerApartmentImage: myApartmentImage,
                senderApartmentImage: myApartmentImage,

                senderId: user?.uid,
                senderName: myData?.firstName || "Utilizator",
                senderPhoto: myData?.profileImage || null,
                senderApartmentId: myApartment.id,
                senderApartmentTitle: myApartment?.title || "Apartamentul meu",

                status: 'pending',
                swapPeriod: `${range.start} -> ${range.end}`,
                proposedGuarantee: parseInt(guarantee),
                currency: currency,
                createdAt: serverTimestamp(),
            });

            Alert.alert("Succes", "Propunerea a fost trimisă!", [{ text: "OK", onPress: () => router.replace('/') }]);
        } catch (e) {
            console.error(e);
            Alert.alert("Eroare", "Eroare la trimitere.");
        } finally {
            setSending(false);
        }
    };

    if (loading || !fontsLoaded) return <View style={styles.loading}><ActivityIndicator color={UI_COLORS.brandSky} size="large" /></View>;

    const hasBookedDates = Object.keys(bookedDates).length > 0;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={{ flex: 1 }}>
                
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="close" size={24} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Configurează Schimbul</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* ── Banner avertizare cont neverificat ── */}
                    {isVerified === false && (
                        <TouchableOpacity
                            style={styles.verifyBanner}
                            onPress={() => router.push('/identity-form')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="warning-outline" size={18} color={UI_COLORS.warning} />
                            <Text style={styles.verifyBannerText}>
                                Identitatea ta nu este verificată. Apasă pentru a o verifica.
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={UI_COLORS.warning} />
                        </TouchableOpacity>
                    )}
                    
                    <View style={styles.comparisonCard}>
                        <View style={styles.homeBox}>
                            <Image source={{ uri: myApartment?.images?.[0] }} style={styles.miniImg} />
                            <Text style={styles.homeLabel}>Tu oferi</Text>

                            {myApartments.length > 1 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.aptSelectorScroll}
                                    contentContainerStyle={styles.aptSelectorContent}
                                >
                                    {myApartments.map((apt) => (
                                        <TouchableOpacity
                                            key={apt.id}
                                            onPress={() => setMyApartment(apt)}
                                            style={[
                                                styles.aptThumb,
                                                myApartment?.id === apt.id && styles.aptThumbSelected
                                            ]}
                                        >
                                            <Image
                                                source={{ uri: apt.images?.[0] }}
                                                style={styles.aptThumbImg}
                                            />
                                            {myApartment?.id === apt.id && (
                                                <View style={styles.aptThumbCheck}>
                                                    <Ionicons name="checkmark-circle" size={16} color={UI_COLORS.brandSky} />
                                                </View>
                                            )}
                                            <Text style={styles.aptThumbLabel} numberOfLines={1}>
                                                {apt.city || apt.title || "Apt"}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                        
                        <Ionicons name="swap-horizontal" size={26} color={UI_COLORS.brandSky} />
                        
                        <View style={styles.homeBox}>
                            <Image source={{ uri: targetApartment?.images?.[0] }} style={styles.miniImg} />
                            <Text style={styles.homeLabel}>{targetApartment?.city || "Destinație"}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Perioada dorită</Text>
                    <BlurView intensity={40} tint="light" style={styles.calendarWrapper}>
                        <Calendar
                            onDayPress={onDayPress}
                            markingType={'custom'}
                            theme={{
                                calendarBackground: 'transparent',
                                textSectionTitleColor: UI_COLORS.brandSky,
                                todayTextColor: UI_COLORS.brandSky,
                                textDayFontFamily: 'Poppins_400Regular',
                                textMonthFontFamily: 'Poppins_700Bold',
                                arrowColor: UI_COLORS.brandSky,
                            }}
                            markedDates={buildMarkedDatesCustom()}
                        />
                    </BlurView>

                    {hasBookedDates && (
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}>
                                <View style={styles.legendDotBooked} />
                                <Text style={styles.legendText}>Rezervat</Text>
                            </View>
                            <View style={styles.legendDivider} />
                            <View style={styles.legendItem}>
                                <View style={styles.legendDotSelected} />
                                <Text style={styles.legendText}>Selecția ta</Text>
                            </View>
                        </View>
                    )}

                    {loadingAI && (
                        <View style={styles.aiLoading}>
                            <ActivityIndicator size="small" color={UI_COLORS.brandSky} />
                            <Text style={styles.aiText}>Analizăm datele istorice...</Text>
                        </View>
                    )}

                    {displayText !== "" && (
                        <BlurView intensity={60} tint="light" style={styles.aiInsightCard}>
                            <LinearGradient colors={['#4dabf7', '#B5FFFC']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.aiBadge}>
                                <Ionicons name="sparkles" size={14} color="#FFF" />
                                <Text style={styles.aiBadgeText}>PREDICTIVE INSIGHT</Text>
                            </LinearGradient>
                            <Text style={styles.weatherText}>{displayText}</Text>
                        </BlurView>
                    )}

                    <Text style={[styles.sectionTitle, { marginTop: 25 }]}>Garanție propusă</Text>
                    <View style={styles.inputRow}>
                        <BlurView intensity={50} tint="light" style={styles.inputWrapper}>
                            <Ionicons name="cash-outline" size={22} color={UI_COLORS.brandSky} style={{ marginLeft: 15 }} />
                            <TextInput
                                style={styles.textInput}
                                keyboardType="numeric"
                                value={guarantee}
                                onChangeText={setGuarantee}
                                placeholder="0"
                                placeholderTextColor={UI_COLORS.subText}
                            />
                        </BlurView>

                        <TouchableOpacity style={styles.currencyBtn} onPress={() => setShowCurrencyModal(true)}>
                            <BlurView intensity={60} tint="light" style={styles.currencyGlass}>
                                <Text style={styles.currencyText}>{currency}</Text>
                                <Ionicons name="chevron-down" size={16} color={UI_COLORS.brandSky} />
                            </BlurView>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.confirmBtn, isVerified === false && styles.confirmBtnDisabled]}
                        onPress={handleConfirmOffer}
                        disabled={sending}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={isVerified === false ? ['#ccc', '#bbb'] : ['#A2D2FF', '#6FB1FC']}
                            style={styles.gradientBtn}
                        >
                            {sending ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {isVerified === false && (
                                        <Ionicons name="lock-closed" size={16} color="#FFF" />
                                    )}
                                    <Text style={styles.confirmBtnText}>
                                        {isVerified === false ? 'Verificare necesară' : 'Trimite Propunerea'}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

            {}
            <Modal transparent visible={showCurrencyModal} animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCurrencyModal(false)}>
                    <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                        {CURRENCIES.map((item) => (
                            <TouchableOpacity key={item} style={styles.currencyOption} onPress={() => { setCurrency(item); setShowCurrencyModal(false); }}>
                                <Text style={styles.optionText}>{item}</Text>
                            </TouchableOpacity>
                        ))}
                    </BlurView>
                </TouchableOpacity>
            </Modal>

            {/* ── Modal verificare identitate ── */}
            <Modal transparent visible={showVerifyModal} animationType="fade">
                <View style={styles.modalOverlay}>
                    <BlurView intensity={80} tint="light" style={styles.verifyModalContent}>
                        <View style={styles.verifyIconCircle}>
                            <Ionicons name="shield-outline" size={36} color={UI_COLORS.warning} />
                        </View>
                        <Text style={styles.verifyModalTitle}>Cont neverificat</Text>
                        <Text style={styles.verifyModalDesc}>
                            Pentru a trimite o propunere de schimb, trebuie să îți verifici identitatea cu datele din buletin.
                        </Text>
                        <TouchableOpacity
                            style={styles.verifyModalBtn}
                            onPress={() => {
                                setShowVerifyModal(false);
                                router.push('/identity-form');
                            }}
                        >
                            <LinearGradient colors={['#f59f00', '#f08c00']} style={styles.verifyModalBtnGradient}>
                                <Ionicons name="card-outline" size={18} color="#FFF" />
                                <Text style={styles.verifyModalBtnText}>Verifică identitatea</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.verifyModalCancel}
                            onPress={() => setShowVerifyModal(false)}
                        >
                            <Text style={styles.verifyModalCancelText}>Anulează</Text>
                        </TouchableOpacity>
                    </BlurView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
    headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: UI_COLORS.brandSky },
    backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 25 },

    
    verifyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(245, 159, 0, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 159, 0, 0.3)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 15,
        marginBottom: 20,
    },
    verifyBannerText: {
        flex: 1,
        fontFamily: 'Poppins_400Regular',
        fontSize: 12,
        color: UI_COLORS.warning,
        lineHeight: 18,
    },

    comparisonCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.3)', padding: 15, borderRadius: 25 },
    homeBox: { alignItems: 'center', flex: 1 },
    miniImg: { width: '90%', height: 80, borderRadius: 15, marginBottom: 8 },
    homeLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.description },
    sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: UI_COLORS.brandSky, marginBottom: 15 },
    calendarWrapper: { borderRadius: 25, overflow: 'hidden', padding: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 14,
        marginBottom: 4,
        backgroundColor: 'rgba(255,255,255,0.35)',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 20,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDivider: { width: 1, height: 14, backgroundColor: 'rgba(0,0,0,0.1)' },
    legendDotBooked: {
        width: 10,
        height: 10,
        borderRadius: 3,
        backgroundColor: 'rgba(229, 115, 115, 0.5)',
        borderWidth: 1,
        borderColor: '#e57373',
    },
    legendDotSelected: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: UI_COLORS.brandSky,
    },
    legendText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.subText },
    aiLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, justifyContent: 'center' },
    aiText: { fontFamily: 'Poppins_400Regular', fontSize: 12, color: UI_COLORS.brandSky },
    aiInsightCard: { marginTop: 20, padding: 18, borderRadius: 25, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.5)' },
    aiBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, gap: 5, marginBottom: 10 },
    aiBadgeText: { color: '#FFF', fontSize: 11, fontFamily: 'Poppins_700Bold' },
    weatherText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: UI_COLORS.mainTitle, lineHeight: 20 },
    inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
    textInput: { flex: 1, fontFamily: 'Poppins_700Bold', fontSize: 18, color: UI_COLORS.brandSky, paddingHorizontal: 15 },
    currencyBtn: { width: 100, height: 60, borderRadius: 18, overflow: 'hidden' },
    currencyGlass: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.4)' },
    currencyText: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: UI_COLORS.brandSky },
    confirmBtn: { marginTop: 30, borderRadius: 20, overflow: 'hidden', elevation: 5 },
    confirmBtnDisabled: { opacity: 0.7, elevation: 0 },
    gradientBtn: { paddingVertical: 18, alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    modalContent: { width: 200, borderRadius: 25, overflow: 'hidden', padding: 10 },
    currencyOption: { paddingVertical: 15, alignItems: 'center' },
    optionText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 18 },

    // ── Modal verificare identitate ──
    verifyModalContent: {
        width: width * 0.85,
        borderRadius: 30,
        overflow: 'hidden',
        padding: 30,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.85)',
    },
    verifyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(245, 159, 0, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: 'rgba(245, 159, 0, 0.25)',
    },
    verifyModalTitle: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 18,
        color: UI_COLORS.mainTitle,
        marginBottom: 10,
        textAlign: 'center',
    },
    verifyModalDesc: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
        color: UI_COLORS.subText,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    verifyModalBtn: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
    },
    verifyModalBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
    },
    verifyModalBtnText: {
        color: '#FFF',
        fontFamily: 'Poppins_700Bold',
        fontSize: 15,
    },
    verifyModalCancel: {
        paddingVertical: 10,
    },
    verifyModalCancelText: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 13,
        color: UI_COLORS.subText,
    },

    aptSelectorScroll: { marginTop: 10, width: '100%' },
    aptSelectorContent: { gap: 8, paddingHorizontal: 4 },
    aptThumb: {
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 3,
        width: 65,
    },
    aptThumbSelected: {
        borderColor: UI_COLORS.brandSky,
        backgroundColor: 'rgba(77, 171, 247, 0.1)',
    },
    aptThumbImg: {
        width: 55,
        height: 45,
        borderRadius: 10,
    },
    aptThumbCheck: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#FFF',
        borderRadius: 8,
    },
    aptThumbLabel: {
        fontFamily: 'Poppins_400Regular',
        fontSize: 9,
        color: UI_COLORS.subText,
        marginTop: 3,
        width: 55,
        textAlign: 'center',
    },
});