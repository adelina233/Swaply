import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
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
import React, { useEffect, useLayoutEffect, useState } from 'react';
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
    warningGold: '#acccff', 
    mutedGrey: '#a0aec0',   
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const
};

export default function NotificationsScreen() {
    const router = useRouter();
    const navigation = useNavigation(); 
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isRead = !!item.read;
                                const bellColor = isRead ? UI_COLORS.mutedGrey : UI_COLORS.warningGold;
                                const bellBg = isRead ? 'rgba(160, 174, 192, 0.12)' : 'rgba(245, 159, 0, 0.15)';

                                return (
                                    <Swipeable
                                        renderRightActions={() => renderRightActions(item.id)}
                                        friction={2}
                                        rightThreshold={40}
                                    >
                                        <TouchableOpacity 
                                            onPress={() => handleNotifPress(item)}
                                            activeOpacity={0.8}
                                            style={styles.cardWrapper}
                                        >
                                            <BlurView 
                                                intensity={isRead ? 45 : 85} 
                                                tint="light" 
                                                style={[styles.notifCard, !isRead && styles.unreadCard]}
                                            >
                                                <View style={[styles.iconCircle, { backgroundColor: bellBg }]}>
                                                    <Ionicons 
                                                        name={isRead ? "notifications-outline" : "notifications"} 
                                                        size={22} 
                                                        color={bellColor} 
                                                    />
                                                </View>
                                                <View style={styles.textContainer}>
                                                    <Text style={[styles.notifTitle, !isRead && styles.boldText]}>
                                                        {item.title}
                                                    </Text>
                                                    <Text style={styles.notifMessage}>{item.message}</Text>
                                                </View>
                                                {!isRead && <View style={styles.unreadDot} />}
                                            </BlurView>
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
        alignItems: 'center', 
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 25 : 10, 
        paddingBottom: 20
    },
    backBtn: { 
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.5)', 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    backIconFix: {
        marginRight: 2 
    },
    clearAllBtn: {
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.5)', 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    headerTitle: { 
        fontSize: 24, 
        fontFamily: 'Poppins_700Bold', 
        color: UI_COLORS.brandSky,
        includeFontPadding: false, 
        textAlignVertical: 'center'
    },
    listContent: { paddingHorizontal: 20, paddingVertical: 10 },
    cardWrapper: { marginBottom: 15, borderRadius: 25, overflow: 'hidden' },
    notifCard: { 
        flexDirection: 'row', 
        padding: 16, 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)'
    },
   
    unreadCard: { 
        elevation: 4,
        shadowColor: '#1A365D',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    deleteButtonAction: {
        backgroundColor: UI_COLORS.errorRed,
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        height: 82, 
        borderRadius: 25,
        marginLeft: 10
    },
    boldText: { fontFamily: 'Poppins_700Bold' },
    iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    textContainer: { flex: 1 },
    notifTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky },
    notifMessage: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, marginTop: 3, opacity: 0.9, lineHeight: 18 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: UI_COLORS.brandSky, marginLeft: 10 },
    emptyContainer: { alignItems: 'center', marginTop: 150 },
    emptyText: { marginTop: 15, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky, opacity: 0.7 }
});