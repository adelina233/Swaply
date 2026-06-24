import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    successText: '#10b981', 
    successPastel: 'rgba(16, 185, 129, 0.15)', 
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const
};

export default function SwapHistoryScreen() {
    const router = useRouter();
    const navigation = useNavigation(); 
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasSeenHistory, setHasSeenHistory] = useState(false);

   
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
        if (!auth.currentUser) return;

        const q = query(
            collection(db, "swap_requests"), 
            where("status", "==", "completed")
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            
            const myHistory = allDocs.filter((s: any) => 
                s.ownerId === auth.currentUser?.uid || s.senderId === auth.currentUser?.uid
            );
            
            setHistory(myHistory);
            setLoading(false);

            if (myHistory.length > 0) {
                setHasSeenHistory(true);
            }
        }, (error) => {
            console.error("Firestore Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const renderHistoryItem = ({ item }: { item: any }) => {
        const isOwner = auth.currentUser?.uid === item.ownerId;
        
        const myAptImg = isOwner 
            ? (item.targetApartmentImage || item.apartmentImage) 
            : (item.senderApartmentImage || item.apartmentImage);
            
        const partnerAptImg = isOwner 
            ? (item.senderApartmentImage || item.apartmentImage) 
            : (item.targetApartmentImage || item.apartmentImage);

        const partnerName = isOwner ? (item.senderName || "Partener") : (item.ownerName || "Proprietar");

        return (
            <BlurView intensity={80} tint="light" style={styles.historyCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.dateBadge}>
                        <Ionicons name="calendar" size={14} color={UI_COLORS.brandSky} />
                        <Text style={styles.dateText}>{item.swapPeriod}</Text>
                    </View>
                    <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>FINALIZAT</Text>
                    </View>
                </View>
                
                <View style={styles.comparisonContainer}>
                    <View style={styles.aptBlock}>
                        <Image 
                            source={{ uri: myAptImg || 'https://via.placeholder.com/150' }} 
                            style={styles.aptImg} 
                        />
                        <Text style={styles.aptLabel}>Casa Ta</Text>
                    </View>

                    <Ionicons name="sync" size={22} color={UI_COLORS.brandSky} style={styles.swapIconFree} />

                    <View style={styles.aptBlock}>
                        <Image 
                            source={{ uri: partnerAptImg || 'https://via.placeholder.com/150' }} 
                            style={styles.aptImg} 
                        />
                        <Text style={styles.aptLabel}>{partnerName}</Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                        <Ionicons name="shield-checkmark" size={16} color={UI_COLORS.brandSky} />
                        <Text style={styles.infoLabel}>Garanție returnată: </Text>
                        <Text style={styles.infoValue}>{item.proposedGuarantee} {item.currency || 'RON'}</Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <Ionicons name="checkmark-circle" size={18} color={UI_COLORS.successText} />
                    <Text style={styles.footerInfo}>Schimb încheiat cu succes</Text>
                </View>
            </BlurView>
        );
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            <LinearGradient colors={UI_COLORS.appGradient} style={StyleSheet.absoluteFill} />
            
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={{ marginRight: 2 }} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Arhivă Schimburi</Text>
                    <View style={styles.archiveIconRight}>
                        <Ionicons 
                            name="archive" 
                            size={22} 
                            color={(history.length > 0 && !hasSeenHistory) ? UI_COLORS.brandSky : 'rgba(26, 54, 93, 0.3)'} 
                        />
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={UI_COLORS.brandSky} style={{ marginTop: 50 }} />
                ) : (
                    <FlatList 
                        data={history} 
                        renderItem={renderHistoryItem} 
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="archive-outline" size={60} color={UI_COLORS.brandSky} style={{ opacity: 0.4 }} />
                                <Text style={styles.emptyText}>Nu ai încă niciun schimb finalizat în arhivă.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        marginVertical: 10
    },
    
    backBtn: { 
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.5)', 
        justifyContent: 'center', 
        alignItems: 'center'
    },
    archiveIconRight: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: { 
        fontSize: 20, 
        fontFamily: 'Poppins_700Bold', 
        color: UI_COLORS.brandSky 
    },
    listContent: { padding: 20 },
    historyCard: { 
        borderRadius: 30, 
        padding: 20, 
        marginBottom: 20, 
        backgroundColor: 'transparent', 
        overflow: 'hidden'
    },
    cardHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20 
    },
    dateBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        backgroundColor: 'rgba(77, 171, 247, 0.12)', 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 12 
    },
    dateText: { 
        fontSize: 11, 
        fontFamily: 'Poppins_600SemiBold', 
        color: UI_COLORS.brandSky 
    },
    completedBadge: { 
        backgroundColor: UI_COLORS.successPastel, 
        paddingHorizontal: 10, 
        paddingVertical: 4, 
        borderRadius: 10 
    },
    completedText: { 
        fontSize: 10, 
        fontFamily: 'Poppins_700Bold', 
        color: UI_COLORS.successText 
    },
    comparisonContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        marginBottom: 20 
    },
    aptBlock: { alignItems: 'center', flex: 1 },
    aptImg: { 
        width: width * 0.22, 
        height: width * 0.22, 
        borderRadius: 20, 
        backgroundColor: 'rgba(255, 255, 255, 0.1)'
    },
    aptLabel: { 
        marginTop: 8, 
        fontSize: 12, 
        fontFamily: 'Poppins_700Bold', 
        color: UI_COLORS.brandSky, 
        textAlign: 'center'
    },
    swapIconFree: {
        marginHorizontal: 10
    },
    infoRow: {
        backgroundColor: 'transparent', 
        borderRadius: 15,
        padding: 12,
        marginBottom: 15
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    infoLabel: {
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        color: UI_COLORS.description
    },
    infoValue: {
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
        color: UI_COLORS.brandSky 
    },
    cardFooter: { 
        borderTopWidth: 1, 
        borderTopColor: 'rgba(255,255,255,0.15)', 
        paddingTop: 15, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center',
        gap: 6
    },
    footerInfo: { 
        fontSize: 13, 
        fontFamily: 'Poppins_600SemiBold', 
        color: UI_COLORS.successText 
    },
    emptyState: { 
        alignItems: 'center', 
        marginTop: 100, 
        paddingHorizontal: 40 
    },
    emptyText: { 
        textAlign: 'center', 
        marginTop: 20, 
        fontFamily: 'Poppins_500Medium', 
        color: UI_COLORS.brandSky, 
        lineHeight: 22 
    }
});