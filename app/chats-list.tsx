import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
// Importuri necesare pentru Swipe
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    errorRed: '#FF4D6D',
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const,
};

export default function ChatsListScreen() {
    const router = useRouter();
    const navigation = useNavigation(); // Inițializare navigație nativă
    const [chats, setChats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold
    });

    useEffect(() => {
        if (!auth.currentUser) return;

        const q = query(
            collection(db, "chats"),
            where("participants", "array-contains", auth.currentUser.uid),
            orderBy("lastMessageTimestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setChats(chatsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching chats:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleDeleteChat = (chatId: string) => {
        Alert.alert(
            "Șterge conversația",
            "Ești sigur că vrei să ștergi această conversație și toate mesajele din ea? Această acțiune este ireversibilă.",
            [
                { text: "Anulează", style: "cancel" },
                { 
                    text: "Șterge", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const messagesRef = collection(db, "chats", chatId, "messages");
                            const messagesSnapshot = await getDocs(messagesRef);

                            const batch = writeBatch(db);
                            messagesSnapshot.docs.forEach((msgDoc) => {
                                batch.delete(msgDoc.ref);
                            });

                            await batch.commit();
                            await deleteDoc(doc(db, "chats", chatId));
                        } catch (error) {
                            console.error("Eroare la ștergerea completă a chat-ului:", error);
                            Alert.alert("Eroare", "Nu s-a putut șterge conversația complet.");
                        }
                    } 
                }
            ]
        );
    };

    const renderRightActions = (chatId: string) => {
        return (
            <TouchableOpacity 
                style={styles.deleteAction} 
                onPress={() => handleDeleteChat(chatId)}
            >
                <Ionicons name="trash-outline" size={28} color={UI_COLORS.white} />
                <Text style={styles.deleteActionText}>Șterge</Text>
            </TouchableOpacity>
        );
    };

    const renderChatItem = ({ item }: { item: any }) => {
        const partnerId = item.participants.find((p: string) => p !== auth.currentUser?.uid);
        const partnerName = item.participantNames?.[partnerId] || "Utilizator";
        const partnerPhoto = item.participantPhotos?.[partnerId];
        const isUnread = item.lastSenderId !== auth.currentUser?.uid && !item.readBy?.includes(auth.currentUser?.uid);

        return (
            <Swipeable
                renderRightActions={() => renderRightActions(item.id)}
                friction={2}
                rightThreshold={40}
            >
                <TouchableOpacity 
                    onPress={() => router.push(`/${item.id}`)}
                    activeOpacity={0.7}
                >
                    <BlurView intensity={60} tint="light" style={styles.chatCard}>
                        <View style={styles.avatarContainer}>
                            {partnerPhoto ? (
                                <Image source={{ uri: partnerPhoto }} style={styles.avatar} />
                            ) : (
                                <View style={styles.placeholderAvatar}>
                                    <Ionicons name="person" size={24} color={UI_COLORS.brandSky} />
                                </View>
                            )}
                            {isUnread && <View style={styles.unreadDot} />}
                        </View>

                        <View style={styles.chatInfo}>
                            <View style={styles.chatHeader}>
                                <Text style={[styles.partnerName, isUnread && styles.unreadText]}>{partnerName}</Text>
                                <Text style={styles.timeText}>
                                    {item.lastMessageTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <Text 
                                style={[styles.lastMessage, isUnread && styles.unreadText]} 
                                numberOfLines={1}
                            >
                                {item.lastMessage || "Trimite un mesaj..."}
                            </Text>
                        </View>
                        
                        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </BlurView>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    if (!fontsLoaded) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <LinearGradient colors={UI_COLORS.appGradient} style={StyleSheet.absoluteFill} />
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={{ marginRight: 2 }} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Mesaje</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={UI_COLORS.brandSky} style={{ marginTop: 50 }} />
                    ) : (
                        <FlatList
                            data={chats}
                            renderItem={renderChatItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={60} color={UI_COLORS.description} style={{ opacity: 0.2 }} />
                                    <Text style={styles.emptyText}>Nu ai nicio conversație momentan.</Text>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginVertical: 10 },
    backBtn: { 
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: 'rgba(255, 255, 255, 0.5)', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    headerTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    listContent: { padding: 20 },
    chatCard: { 
        flex: 2, 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 15, 
        borderRadius: 25, 
        marginBottom: 12, 
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.5)' 
    },
    avatarContainer: { position: 'relative' },
    avatar: { width: 55, height: 55, borderRadius: 20 },
    placeholderAvatar: { width: 55, height: 55, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    unreadDot: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF4D6D', borderWidth: 2, borderColor: '#FFF' },
    chatInfo: { flex: 1, marginLeft: 15, marginRight: 5 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    partnerName: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky },
    timeText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description },
    lastMessage: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description },
    unreadText: { fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontFamily: 'Poppins_500Medium', color: UI_COLORS.description, marginTop: 15 },
    deleteAction: {
        backgroundColor: UI_COLORS.errorRed,
        justifyContent: 'center',
        alignItems: 'center',
        width: 90,
        height: 85, 
        borderRadius: 25,
        marginBottom: 12,
        marginLeft: 10
    },
    deleteActionText: {
        color: UI_COLORS.white,
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 12,
        marginTop: 4
    }
});