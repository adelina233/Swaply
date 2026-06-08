import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    star: '#FFD700',
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const
};

export default function ReviewsScreen() {
    const router = useRouter();
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ home: 0, comm: 0, total: 0 });

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    useEffect(() => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "reviews"),
            where("toUserId", "==", auth.currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReviews(data);

                if (data.length > 0) {
                    const totalHome = data.reduce((acc, curr: any) => acc + (curr.ratingHome || 0), 0);
                    const totalComm = data.reduce((acc, curr: any) => acc + (curr.ratingCommunication || 0), 0);
                    
                    const avgHome = totalHome / data.length;
                    const avgComm = totalComm / data.length;

                    setStats({
                        home: parseFloat(avgHome.toFixed(1)),
                        comm: parseFloat(avgComm.toFixed(1)),
                        total: parseFloat(((avgHome + avgComm) / 2).toFixed(1))
                    });
                } else {
                    setStats({ home: 0, comm: 0, total: 0 });
                }
                setLoading(false);
            }, 
            (error) => {
                console.error("Eroare Firestore Reviews:", error);
                setLoading(false); 
            }
        );

        return () => unsubscribe();
    }, []);

    const renderReviewItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => {
                router.push({
                    pathname: '/swap-history',
                    params: { highlightedSwapId: item.swapId }
                } as any);
            }}
        >
            <BlurView intensity={60} tint="light" style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                    <View style={styles.authorContainer}>
                        <Text style={styles.authorName}>
                            {item.fromUserName || item.authorName || "Partener Schimb"}
                        </Text>
                        <Text style={styles.aptTitle} numberOfLines={1}>
                            Locuință: {item.apartmentTitle || "Proprietate"}
                        </Text>
                    </View>
                    <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={14} color={UI_COLORS.star} />
                        <Text style={styles.ratingText}>
                            {(((item.ratingHome || 0) + (item.ratingCommunication || 0)) / 2).toFixed(1)}
                        </Text>
                    </View>
                </View>
                
                <Text style={styles.commentText}>
                    {item.comment ? `"${item.comment}"` : "Fără comentariu text."}
                </Text>
                
                <View style={styles.footerRow}>
                    <View style={styles.tagsContainer}>
                        <View style={styles.miniTag}>
                            <Text style={styles.miniTagText}>🏠 {item.ratingHome || 0}</Text>
                        </View>
                        <View style={styles.miniTag}>
                            <Text style={styles.miniTagText}>💬 {item.ratingCommunication || 0}</Text>
                        </View>
                    </View>
                    <Text style={styles.dateText}>
                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('ro-RO') : 'Recent'}
                    </Text>
                </View>
            </BlurView>
        </TouchableOpacity>
    );

    if (!fontsLoaded) return null;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={UI_COLORS.brandSky} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={UI_COLORS.appGradient} style={styles.background} />
            <SafeAreaView style={{ flex: 1 }}>
                
                <View style={styles.header}>
                    {}
                    <TouchableOpacity onPress={() => router.back()} style={styles.circleBack}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                    <Text style={styles.titleText}>Recenziile Mele</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.summaryContainer}>
                    <BlurView intensity={80} tint="light" style={styles.summaryCard}>
                        <View style={styles.totalStatsBox}>
                            <Text style={styles.totalRatingNum}>{stats.total}</Text>
                            <Text style={styles.totalRatingLabel}>Medie Generală</Text>
                        </View>
                        
                        <View style={styles.dividerVertical} />
                        
                        <View style={styles.secondaryStatsBox}>
                            <View style={styles.miniStatItem}>
                                <Text style={styles.miniStatVal}>{stats.comm}</Text>
                                <Text style={styles.miniStatLabel}>Comunicare</Text>
                            </View>
                            <View style={[styles.miniStatItem, { marginTop: 10 }]}>
                                <Text style={styles.miniStatVal}>{stats.home}</Text>
                                <Text style={styles.miniStatLabel}>Locuință</Text>
                            </View>
                        </View>
                    </BlurView>
                </View>

                <FlatList
                    data={reviews}
                    renderItem={renderReviewItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubble-ellipses-outline" size={80} color={UI_COLORS.brandSky} style={{ opacity: 0.3 }} />
                            <Text style={styles.emptyTextTitle}>Nicio recenzie încă</Text>
                            <Text style={styles.emptyTextSub}>
                                Finalizează un schimb de locuințe pentru a primi feedback.
                            </Text>
                        </View>
                    }
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    
    
    circleBack: { 
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.4)', 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)'
    }, 
    
    titleText: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    summaryContainer: { paddingHorizontal: 20, marginBottom: 20 },
    summaryCard: { 
        flexDirection: 'row', 
        borderRadius: 25, 
        padding: 20, 
        backgroundColor: 'transparent', 
        overflow: 'hidden', 
        alignItems: 'center'
    },
    totalStatsBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    totalRatingNum: { fontSize: 38, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    totalRatingLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.mainTitle, opacity: 0.7 },
    
    dividerVertical: { 
        width: 1, 
        height: '80%', 
        backgroundColor: 'rgba(77, 171, 247, 0.2)', 
        marginHorizontal: 15 
    },
    secondaryStatsBox: { flex: 1.2, paddingLeft: 10 },
    miniStatItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    miniStatVal: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    miniStatLabel: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description },

    listContent: { padding: 20, paddingBottom: 50 },
    reviewCard: { borderRadius: 20, padding: 18, marginBottom: 15, backgroundColor: 'transparent', overflow: 'hidden' }, 
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    authorContainer: { flex: 1 },
    authorName: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: UI_COLORS.brandSky },
    aptTitle: { fontFamily: 'Poppins_500Medium', fontSize: 12, color: UI_COLORS.description, marginTop: -2 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }, 
    ratingText: { marginLeft: 4, fontFamily: 'Poppins_700Bold', fontSize: 12, color: UI_COLORS.mainTitle },
    commentText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.mainTitle, fontStyle: 'italic', marginBottom: 15 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tagsContainer: { flexDirection: 'row', gap: 6 },
    miniTag: { backgroundColor: 'transparent', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, 
    miniTagText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.mainTitle },
    dateText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description },
    emptyContainer: { marginTop: 100, alignItems: 'center', paddingHorizontal: 40 },
    emptyTextTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky, marginTop: 20 },
    emptyTextSub: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: UI_COLORS.brandSky, textAlign: 'center', opacity: 0.7, marginTop: 10 }
});