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
};

const CURRENCIES = ['RON', 'EUR', 'USD'];

// Randare custom pentru ziua de calendar
const renderBookedDay = (date: any, state: string, isBooked: boolean, isSelected: boolean) => {
    if (isBooked) {
        return (
            <View style={customDayStyles.bookedContainer}>
                <Text style={customDayStyles.bookedText}>{date.day}</Text>
                <View style={customDayStyles.bookedDot} />
            </View>
        );
    }
    return null; // folosim renderul default
};

export default function CreateOfferScreen() {
    const { targetId } = useLocalSearchParams();
    const router = useRouter();
    
    const [targetApartment, setTargetApartment] = useState<any>(null);
    const [myApartment, setMyApartment] = useState<any>(null);
    const [myApartments, setMyApartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    
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

                    const swapQueryNew = query(
                        collection(db, "swap_requests"),
                        where("targetApartmentId", "==", targetId as string),
                        where("status", "in", ["pending", "accepted"])
                    );
                    const swapSnapNew = await getDocs(swapQueryNew);

                    const swapQueryOld = query(
                        collection(db, "swap_requests"),
                        where("ownerId", "==", aptData.userId),
                        where("status", "in", ["pending", "accepted"])
                    );
                    const swapSnapOld = await getDocs(swapQueryOld);

                    const allDocs = new Map<string, any>();
                    swapSnapNew.docs.forEach(d => allDocs.set(d.id, d.data()));
                    swapSnapOld.docs.forEach(d => allDocs.set(d.id, d.data()));

                    allDocs.forEach((data) => {
                        const periodStr: string = data.swapPeriod || "";
                        const [startStr, endStr] = periodStr.split(" -> ");
                        if (!startStr || !endStr) return;

                        const start = new Date(startStr);
                        const end = new Date(endStr);
                        const current = new Date(start);

                        while (current <= end) {
                            const dateStr = current.toISOString().split('T')[0];
                            // ✅ customStyles pentru aspect estetic
                            blocked[dateStr] = {
                                disabled: true,
                                disableTouchEvent: true,
                                customStyles: {
                                    container: {
                                        backgroundColor: 'transparent',
                                        borderRadius: 8,
                                    },
                                    text: {
                                        color: '#e57373',
                                        fontFamily: 'Poppins_400Regular',
                                        textDecorationLine: 'line-through',
                                        opacity: 0.7,
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

    // ✅ markingType='custom' pentru zilele bookuite, 'period' pentru selecție
    // Le combinăm: zilele bookuite au customStyles, zilele selectate au period marking
    const buildMarkedDates = () => {
        // Pornim de la bookedDates (care au customStyles + disabled)
        const marked: {[key: string]: any} = {};

        // Adăugăm zilele bookuite
        Object.keys(bookedDates).forEach(dateStr => {
            marked[dateStr] = { ...bookedDates[dateStr] };
        });

        // Suprapunem selectia curenta (override peste booked daca e cazul)
        if (range.start) {
            if (range.end) {
                const start = new Date(range.start);
                const end = new Date(range.end);
                const current = new Date(start);

                while (current <= end) {
                    const dateStr = current.toISOString().split('T')[0];
                    if (!bookedDates[dateStr]) {
                        if (dateStr === range.start) {
                            marked[dateStr] = { startingDay: true, color: UI_COLORS.brandSky, textColor: '#FFF' };
                        } else if (dateStr === range.end) {
                            marked[dateStr] = { endingDay: true, color: UI_COLORS.brandSky, textColor: '#FFF' };
                        } else {
                            marked[dateStr] = { color: 'rgba(77, 171, 247, 0.25)', textColor: UI_COLORS.brandSky };
                        }
                    }
                    current.setDate(current.getDate() + 1);
                }
            } else {
                if (!bookedDates[range.start]) {
                    marked[range.start] = { startingDay: true, endingDay: true, color: UI_COLORS.brandSky, textColor: '#FFF' };
                }
            }
        }

        return marked;
    };

    
    const buildMarkedDatesPeriod = () => {
        const marked: {[key: string]: any} = {};

        // Zilele bookuite 
        Object.keys(bookedDates).forEach(dateStr => {
            marked[dateStr] = {
                disabled: true,
                disableTouchEvent: true,
                startingDay: true,
                endingDay: true,
                color: 'rgba(229, 115, 115, 0.15)',   // roz pal, aproape invizibil
                textColor: '#e57373',                   // roșu pastelat
            };
        });

        // Selecția curentă — albastru viu
        if (range.start) {
            if (range.end) {
                const start = new Date(range.start);
                const end = new Date(range.end);
                const current = new Date(start);

                while (current <= end) {
                    const dateStr = current.toISOString().split('T')[0];
                    if (!bookedDates[dateStr]) {
                        if (dateStr === range.start) {
                            marked[dateStr] = { startingDay: true, color: UI_COLORS.brandSky, textColor: '#FFF' };
                        } else if (dateStr === range.end) {
                            marked[dateStr] = { endingDay: true, color: UI_COLORS.brandSky, textColor: '#FFF' };
                        } else {
                            marked[dateStr] = { color: 'rgba(77, 171, 247, 0.22)', textColor: UI_COLORS.brandSky };
                        }
                    }
                    current.setDate(current.getDate() + 1);
                }
            } else {
                if (!bookedDates[range.start]) {
                    marked[range.start] = { startingDay: true, endingDay: true, color: UI_COLORS.brandSky, textColor: '#FFF' };
                }
            }
        }

        return marked;
    };

    const handleConfirmOffer = async () => {
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

            await addDoc(collection(db, "swap_requests"), {
                ownerId: targetApartment.userId,
                ownerName: targetApartment.ownerName,
                ownerPhoto: targetApartment.ownerPhoto, 
                targetApartmentTitle: targetApartment.title || "Apartament",
                targetApartmentId: targetId,

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
                            markingType={'period'}
                            theme={{
                                calendarBackground: 'transparent',
                                textSectionTitleColor: UI_COLORS.brandSky,
                                todayTextColor: UI_COLORS.brandSky,
                                selectedDayBackgroundColor: UI_COLORS.brandSky,
                                selectedDayTextColor: '#ffffff',
                                textDayFontFamily: 'Poppins_400Regular',
                                textMonthFontFamily: 'Poppins_700Bold',
                                arrowColor: UI_COLORS.brandSky,
                                // ✅ zilele disabled au text mai pal implicit
                                textDisabledColor: '#e57373',
                            }}
                            markedDates={buildMarkedDatesPeriod()}
                        />
                    </BlurView>

                    {/* ✅ Legendă — apare doar dacă există zile bookuite */}
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

                    <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmOffer} disabled={sending}>
                        <LinearGradient colors={['#A2D2FF', '#6FB1FC']} style={styles.gradientBtn}>
                            {sending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Trimite Propunerea</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

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
        </View>
    );
}

const customDayStyles = StyleSheet.create({
    bookedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
    },
    bookedText: {
        fontSize: 13,
        color: '#e57373',
        opacity: 0.6,
        textDecorationLine: 'line-through',
        fontFamily: 'Poppins_400Regular',
    },
    bookedDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#e57373',
        opacity: 0.5,
        marginTop: 1,
    },
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center' },
    headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: UI_COLORS.brandSky },
    backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 25 },
    comparisonCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, backgroundColor: 'rgba(255,255,255,0.3)', padding: 15, borderRadius: 25 },
    homeBox: { alignItems: 'center', flex: 1 },
    miniImg: { width: '90%', height: 80, borderRadius: 15, marginBottom: 8 },
    homeLabel: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.description },
    sectionTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: UI_COLORS.brandSky, marginBottom: 15 },
    calendarWrapper: { borderRadius: 25, overflow: 'hidden', padding: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
    // ✅ Legendă nouă
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
    legendDotFree: {
        width: 10,
        height: 10,
        borderRadius: 3,
        backgroundColor: 'rgba(77, 171, 247, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(77, 171, 247, 0.4)',
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
    gradientBtn: { paddingVertical: 18, alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 16 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    modalContent: { width: 200, borderRadius: 25, overflow: 'hidden', padding: 10 },
    currencyOption: { paddingVertical: 15, alignItems: 'center' },
    optionText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 18 },
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