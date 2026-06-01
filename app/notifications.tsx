import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    errorRed: '#ff4d6d',
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const
};

export default function NotificationsScreen() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(
            collection(db, "notifications"),
            where("userId", "==", auth.currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, "notifications", id), { read: true });
        } catch (e) { console.error(e); }
    };

    const deleteNotification = async (id: string) => {
        try {
            await deleteDoc(doc(db, "notifications", id));
        } catch (e) { console.error(e); }
    };

    const clearAllNotifications = () => {
        if (notifications.length === 0) return;

        Alert.alert(
            "Șterge tot",
            "Ești sigur că vrei să ștergi toate notificările?",
            [
                { text: "Anulează", style: "cancel" },
                { 
                    text: "Șterge", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const batch = writeBatch(db);
                            notifications.forEach((notif) => {
                                const docRef = doc(db, "notifications", notif.id);
                                batch.delete(docRef);
                            });
                            await batch.commit();
                        } catch (e) {
                            console.error("Eroare la ștergerea notificărilor: ", e);
                        }
                    } 
                }
            ]
        );
    };

    const handleNotifPress = async (item: any) => {
        await markAsRead(item.id);
        if (!item.resourceId) return;

        switch (item.type) {
            case 'favorite':
                router.push({ pathname: '/details', params: { id: item.resourceId } } as any);
                break;
            case 'message':
                router.push(`/${item.resourceId}` as any);
                break;
            case 'new_offer':
                router.push('/offers');
                break;
            case 'swap_active':
                router.push('/active-swaps');
                break;
            case 'review':
                router.push('/reviews');
                break;
            default:
                break;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'favorite': return { name: 'heart', color: '#ff6b6b' };
            case 'message': return { name: 'chatbubbles', color: '#4dabf7' };
            case 'new_offer': return { name: 'paper-plane', color: '#51cf66' };
            case 'swap_active': return { name: 'sync-circle', color: '#f59f00' };
            case 'review': return { name: 'star', color: '#845ef7' };
            default: return { name: 'notifications', color: '#adb5bd' };
        }
    };

    const renderRightActions = (id: string) => {
        return (
            <TouchableOpacity 
                style={styles.deleteButtonAction} 
                onPress={() => deleteNotification(id)}
                activeOpacity={0.7}
            >
                <Ionicons name="trash-outline" size={24} color={UI_COLORS.white} />
            </TouchableOpacity>
        );
    };

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <LinearGradient colors={UI_COLORS.appGradient} style={styles.background} />
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={styles.backIconFix} />
                        </TouchableOpacity>
                        
                        <Text style={styles.headerTitle}>Notificări</Text>
                        
                        {notifications.length > 0 ? (
                            <TouchableOpacity onPress={clearAllNotifications} style={styles.clearAllBtn}>
                                <Ionicons name="trash" size={22} color={UI_COLORS.errorRed} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 44 }} />
                        )}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={UI_COLORS.brandSky} style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            data={notifications}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => {
                                const icon = getIcon(item.type);
                                return (
                                    <Swipeable
                                        renderRightActions={() => renderRightActions(item.id)}
                                        friction={2}
                                        rightThreshold={40}
                                    >
                                        <TouchableOpacity 
                                            style={[styles.notifCard, !item.read && styles.unreadCard]} 
                                            onPress={() => handleNotifPress(item)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[styles.iconCircle, { backgroundColor: icon.color + '20' }]}>
                                                <Ionicons name={icon.name as any} size={22} color={icon.color} />
                                            </View>
                                            <View style={styles.textContainer}>
                                                <Text style={[styles.notifTitle, !item.read && styles.boldText]}>{item.title}</Text>
                                                <Text style={styles.notifMessage}>{item.message}</Text>
                                            </View>
                                            {!item.read && <View style={styles.unreadDot} />}
                                        </TouchableOpacity>
                                    </Swipeable>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="notifications-off-outline" size={60} color={UI_COLORS.brandSky} style={{opacity: 0.5}} />
                                    <Text style={styles.emptyText}>Momentan liniște aici...</Text>
                                </View>
                            }
                        />
                    )}
                </SafeAreaView>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center', // Centrare verticală optimă pentru toate elementele din header
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 25 : 10, // Ajustat padding-ul de sus pentru Android ca să nu fie prea aerian
        paddingBottom: 20
    },
    backBtn: { 
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.25)', 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    backIconFix: {
        marginRight: 2 // Compensează optic iconița de „back” pentru a sta perfect pe centrul cercului
    },
    clearAllBtn: {
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.25)', 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    headerTitle: { 
        fontSize: 24, 
        fontFamily: 'Poppins_700Bold', 
        color: UI_COLORS.brandSky,
        includeFontPadding: false, // Scoate padding-ul nativ ciudat pe Android
        textAlignVertical: 'center'
    },
    listContent: { padding: 20 },
    notifCard: { 
        flexDirection: 'row', 
        backgroundColor: 'rgba(255, 255, 255, 0.35)', 
        borderRadius: 25, 
        padding: 16, 
        marginBottom: 15, 
        alignItems: 'center',
    },
    unreadCard: { 
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 }
    },
    deleteButtonAction: {
        backgroundColor: UI_COLORS.errorRed,
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        height: '83%', 
        borderRadius: 25,
        marginBottom: 15,
        marginLeft: 10
    },
    boldText: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.mainTitle },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    textContainer: { flex: 1 },
    notifTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.mainTitle },
    notifMessage: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, marginTop: 2 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: UI_COLORS.brandSky, marginLeft: 10 },
    emptyContainer: { alignItems: 'center', marginTop: 150 },
    emptyText: { marginTop: 15, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky, opacity: 0.7 }
});