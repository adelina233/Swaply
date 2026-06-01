import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    or,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D', 
    lightBlueText: '#4dabf7', 
    description: '#4A5568',
    success: '#2D6A4F',
    errorText: '#ff4d6d',
    white: '#FFFFFF',
    btnGradient: ['#A2D2FF', '#6FB1FC'] as const,
    cardGradient: ['rgba(255, 222, 233, 0.85)', 'rgba(181, 255, 252, 0.85)', 'rgba(224, 195, 252, 0.85)'] as const 
};

interface SwapOffer {
    id: string;
    ownerId: string;
    ownerName: string;
    ownerPhoto: string;
    senderId: string;
    senderName: string;
    senderPhoto: string;
    status: string;
    swapPeriod: string;
    proposedGuarantee: number;
    currency?: string;
    ownerPaid?: boolean;
    senderPaid?: boolean;
    apartmentImage?: string; 
    senderApartmentImage?: string; 
    ownerApartmentImage?: string;  
}

export default function OffersScreen() {
    const router = useRouter();
    const [offers, setOffers] = useState<SwapOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<SwapOffer | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    let [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

    useEffect(() => {
        if (!auth.currentUser) return;
        const currentUserId = auth.currentUser.uid;

        const q = query(
            collection(db, "swap_requests"),
            or(
                where("ownerId", "==", currentUserId),
                where("senderId", "==", currentUserId)
            )
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SwapOffer));
            const relevantOffers = allDocs.filter(o => {
                const isRejected = o.status === 'rejected';
                const isFullySettled = o.ownerPaid === true && o.senderPaid === true;
                return !isRejected && !isFullySettled;
            });
            setOffers(relevantOffers);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, []);

    const sendNotificationToPartner = async (targetUserId: string, title: string, message: string, swapId: string) => {
        try {
            await addDoc(collection(db, "notifications"), {
                userId: targetUserId,
                title,
                message,
                resourceId: swapId,
                type: "payment_update",
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Error sending notification:", e);
        }
    };

    const handlePaymentAction = async () => {
        if (!selectedOffer || !auth.currentUser) return;
        setIsProcessing(true);

        try {
            const isOwner = auth.currentUser.uid === selectedOffer.ownerId;
            const partnerId = isOwner ? selectedOffer.senderId : selectedOffer.ownerId;
            const swapRef = doc(db, "swap_requests", selectedOffer.id);
            
            const currentApartmentImage = selectedOffer.apartmentImage || "";
            const currentSenderImg = selectedOffer.senderApartmentImage || "";
            const currentOwnerImg = selectedOffer.ownerApartmentImage || "";

            // Actualizăm starea plății asigurându-ne că nicio imagine nu se pierde la rescriere
            const updateData: any = isOwner 
                ? { 
                    ownerPaid: true, 
                    status: 'accepted', 
                    acceptedAt: serverTimestamp(),
                    ownerApartmentImage: currentOwnerImg || currentApartmentImage 
                  } 
                : { 
                    senderPaid: true,
                    senderApartmentImage: currentSenderImg || currentApartmentImage 
                  };

            await updateDoc(swapRef, updateData);

            const partnerAlreadyPaid = isOwner ? selectedOffer.senderPaid : selectedOffer.ownerPaid;

            if (partnerAlreadyPaid) {
                await setDoc(doc(db, "receipt-details", selectedOffer.id), {
                    swapId: selectedOffer.id,
                    amount: selectedOffer.proposedGuarantee,
                    currency: selectedOffer.currency || 'RON',
                    ownerId: selectedOffer.ownerId,
                    senderId: selectedOffer.senderId,
                    participants: [selectedOffer.ownerId, selectedOffer.senderId],
                    ownerName: selectedOffer.ownerName,
                    senderName: selectedOffer.senderName,
                    swapPeriod: selectedOffer.swapPeriod,
                    apartmentImage: currentApartmentImage,
                    ownerApartmentImage: currentOwnerImg || (isOwner ? currentApartmentImage : ""),
                    senderApartmentImage: currentSenderImg || (!isOwner ? currentApartmentImage : ""),
                    ownerPhoto: selectedOffer.ownerPhoto || "",
                    senderPhoto: selectedOffer.senderPhoto || "",
                    createdAt: serverTimestamp(),
                    status: 'secured'
                });
            }

            const myName = isOwner ? selectedOffer.ownerName : selectedOffer.senderName;
            await sendNotificationToPartner(
                partnerId,
                partnerAlreadyPaid ? "Schimb Securizat! 🏠" : "Plată Garanție 💳",
                partnerAlreadyPaid 
                    ? `Ambii ați plătit. Schimbul este acum activ!`
                    : `${myName || 'Cineva'} a plătit garanția. Plătește și tu pentru a activa schimbul!`,
                selectedOffer.id
            );
            
            setIsProcessing(false);
            setModalVisible(false);
            Alert.alert("Succes", partnerAlreadyPaid ? "Schimbul a fost activat!" : "Plata ta a fost confirmată!");
        } catch (error) {
            setIsProcessing(false);
            Alert.alert("Eroare", "Nu s-a putut procesa plata.");
        }
    };

    const renderOffer = ({ item }: { item: SwapOffer }) => {
        const isOwner = auth.currentUser?.uid === item.ownerId;
        const partnerName = isOwner ? item.senderName : item.ownerName;
        const partnerPhoto = isOwner ? item.senderPhoto : item.ownerPhoto;
        const partnerPaid = isOwner ? item.senderPaid : item.ownerPaid;
        const myPaid = isOwner ? item.ownerPaid : item.senderPaid;

        // Afișează pe card imaginea apartamentului celuilalt utilizator pentru claritate vizuală
        const displayApartmentImage = isOwner 
            ? (item.senderApartmentImage || item.apartmentImage || 'https://via.placeholder.com/400x200?text=Apartament+Partener') 
            : (item.apartmentImage || 'https://via.placeholder.com/400x200?text=Locuinta+Proprietar');

        return (
            <LinearGradient colors={UI_COLORS.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientCard}>
                <Image 
                    source={{ uri: displayApartmentImage }} 
                    style={styles.apartmentHero} 
                />

                <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: UI_COLORS.lightBlueText }]} />
                    <Text style={[styles.statusText, { color: UI_COLORS.lightBlueText }]}>
                        {partnerPaid ? "Partenerul a plătit" : (isOwner ? "Ofertă nouă primită" : "În așteptarea proprietarului")}
                    </Text>
                </View>

                <View style={styles.profileRow}>
                    <Image source={{ uri: partnerPhoto || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                    <View style={styles.profileInfo}>
                        <Text style={styles.partnerName}>{partnerName || "Utilizator Swaply"}</Text>
                        <Text style={styles.subLabel}>
                            {isOwner ? "Ți-a trimis o ofertă de schimb" : "Oferta ta trimisă către proprietar"}
                        </Text>
                    </View>
                </View>

                <View style={styles.detailsContainer}>
                    <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color={UI_COLORS.lightBlueText} />
                        <Text style={styles.detailText}>{item.swapPeriod || "Nespecificat"}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={UI_COLORS.lightBlueText} />
                        <Text style={styles.detailText}>{item.proposedGuarantee} {item.currency || 'RON'}</Text>
                    </View>
                </View>

                <View>
                    {!myPaid ? (
                        <View style={styles.actionRow}>
                            {isOwner && (
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => updateDoc(doc(db, "swap_requests", item.id), { status: 'rejected' })}>
                                    <Text style={styles.rejectBtnText}>Refuză</Text>
                                </TouchableOpacity>
                            )}
                            {(isOwner || (!isOwner && partnerPaid)) ? (
                                <TouchableOpacity 
                                    style={styles.confirmBtnWrapper} 
                                    onPress={() => { setSelectedOffer(item); setModalVisible(true); }}
                                >
                                    <LinearGradient colors={UI_COLORS.btnGradient} style={styles.confirmBtn}>
                                        <Text style={styles.confirmText}>
                                            {isOwner ? "Acceptă & Plătește" : "Plătește Garanția"}
                                        </Text>
                                        <Ionicons name="card-outline" size={18} color="#FFF" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.waitingBadgeSimple}>
                                    <Text style={styles.waitingTextSimple}>Așteptăm acceptul proprietarului...</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.waitingBadge}>
                            <ActivityIndicator size="small" color={UI_COLORS.lightBlueText} />
                            <Text style={styles.waitingText}>
                                Plata ta e confirmată. Așteptăm ca {partnerName || 'partenerul'} să finaleze.
                            </Text>
                        </View>
                    )}
                </View>
            </LinearGradient>
        );
    };

    if (loading || !fontsLoaded) return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.lightBlueText} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Oferte de Schimb</Text>
                    <View style={{ width: 44 }} />
                </View>
                
                <FlatList
                    data={offers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderOffer}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="mail-unread-outline" size={60} color={UI_COLORS.lightBlueText} style={{opacity: 0.5}} />
                            <Text style={styles.emptyText}>Momentan nu ai nicio ofertă activă.</Text>
                        </View>
                    }
                />
            </SafeAreaView>

            <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalContent}>
                        <View style={styles.lockCircle}>
                            <Ionicons name="lock-closed" size={30} color={UI_COLORS.lightBlueText} />
                        </View>
                        <Text style={styles.modalTitle}>Securizare Fonduri</Text>
                        <Text style={styles.modalBody}>
                            Garanția va fi păstrată în siguranță de Swaply până la finalizarea schimbului.
                        </Text>
                        
                        <TouchableOpacity style={styles.modalPayBtnWrapper} onPress={handlePaymentAction} disabled={isProcessing}>
                            <LinearGradient colors={UI_COLORS.btnGradient} style={styles.modalPayBtn}>
                                {isProcessing ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.modalPayBtnText}>Confirmă Plata</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 20 }}>
                            <Text style={styles.cancelText}>Anulează</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
    headerBack: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.4)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.lightBlueText },
    gradientCard: { padding: 18, borderRadius: 28, marginBottom: 20, overflow: 'hidden' },
    apartmentHero: { width: '100%', height: 160, borderRadius: 22, marginBottom: 15 }, 
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { fontSize: 11, fontFamily: 'Poppins_700Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
    profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
    profileInfo: { flex: 1, marginLeft: 12 },
    partnerName: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: UI_COLORS.lightBlueText },
    subLabel: { fontSize: 12, color: UI_COLORS.description, fontFamily: 'Poppins_400Regular', opacity: 0.85 },
    detailsContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255, 255, 255, 0.25)', borderRadius: 16, padding: 14, marginBottom: 18 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.lightBlueText },
    actionRow: { flexDirection: 'row', gap: 10 },
    rejectBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: 'rgba(255, 77, 109, 0.15)', justifyContent: 'center', alignItems: 'center' }, 
    rejectBtnText: { color: UI_COLORS.errorText, fontFamily: 'Poppins_700Bold', fontSize: 13 },
    confirmBtnWrapper: { flex: 2, height: 50, borderRadius: 15, overflow: 'hidden' },
    confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    confirmText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 13 },
    waitingBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 15, borderWidth: 1, borderColor: 'rgba(77, 171, 247, 0.25)' },
    waitingText: { flex: 1, fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.lightBlueText, lineHeight: 16 }, 
    waitingBadgeSimple: { flex: 1, padding: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    waitingTextSimple: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.lightBlueText, textAlign: 'center' }, 
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '90%', padding: 30, borderRadius: 35, backgroundColor: '#FFF', alignItems: 'center', elevation: 20 },
    lockCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(77, 171, 247, 0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.lightBlueText, marginBottom: 10 }, 
    modalBody: { textAlign: 'center', color: UI_COLORS.description, marginBottom: 25, fontSize: 14, lineHeight: 22 },
    modalPayBtnWrapper: { width: '100%', height: 60, borderRadius: 20, overflow: 'hidden', elevation: 5 },
    modalPayBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalPayBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Poppins_700Bold' },
    cancelText: { color: UI_COLORS.description, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { textAlign: 'center', color: UI_COLORS.description, marginTop: 15, paddingHorizontal: 40, fontFamily: 'Poppins_400Regular' },
});