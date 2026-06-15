import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    softBlue: '#A2D2FF',
    buttonBlue: '#6FB1FC',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    redDestructive: '#FF4D4D'
};

export default function ChatScreen() {
    const params = useLocalSearchParams();
    const { id } = params;
    const router = useRouter();
    const navigation = useNavigation(); 

    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [isChatEnded, setIsChatEnded] = useState(false);
    const [partnerData, setPartnerData] = useState({ name: '', photo: '' });
    const [myLanguage, setMyLanguage] = useState('ro'); 
    const [imageError, setImageError] = useState(false); 
    const [translatedMessages, setTranslatedMessages] = useState<{ [key: string]: string }>({});
    const [translatingId, setTranslatingId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    
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
        if (!id || !auth.currentUser) return;
        const markAsRead = async () => {
            const chatRef = doc(db, "chats", id as string);
            await updateDoc(chatRef, {
                readBy: arrayUnion(auth.currentUser?.uid)
            });
        };
        markAsRead();
    }, [id]);

    useEffect(() => {
        const fetchMyProfileLanguage = async () => {
            if (!auth.currentUser) return;
            try {
                const myDocRef = doc(db, "users", auth.currentUser.uid);
                const myDocSnap = await getDoc(myDocRef);
                if (myDocSnap.exists() && myDocSnap.data().language) {
                    setMyLanguage(myDocSnap.data().language);
                }
            } catch (err) {
                console.error("Eroare la preluarea limbii tale preferate:", err);
            }
        };
        fetchMyProfileLanguage();
    }, []);

    useEffect(() => {
        if (!id || !auth.currentUser) return;
        const chatRef = doc(db, "chats", id as string);
        
        const unsub = onSnapshot(chatRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const otherId = data.participants.find((p: string) => p !== auth.currentUser?.uid);
                
                setIsChatEnded(data.isEnded || false);
                
                const fullStringName = data.participantNames?.[otherId] || 'Utilizator';
                const firstNameOnly = fullStringName.trim().split(' ')[0];

                setPartnerData({
                    name: firstNameOnly,
                    photo: data.participantPhotos?.[otherId] || ''
                });
            }
        });
        return () => unsub();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        const messagesQuery = query(
            collection(db, "chats", id as string, "messages"),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [id]);

    const handleTranslate = async (messageId: string, text: string) => {
        if (translatedMessages[messageId]) {
            setTranslatedMessages(prev => {
                const copy = { ...prev };
                delete copy[messageId];
                return copy;
            });
            return;
        }

        setTranslatingId(messageId);

        try {
            const sourceLang = 'auto'; 
            const targetLang = myLanguage || 'ro'; 

            const response = await fetch(
                `https://lingva.ml/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`
            );
            const json = await response.json();
            
            if (json && json.translation) {
                setTranslatedMessages(prev => ({
                    ...prev,
                    [messageId]: json.translation
                }));
            } else {
                throw new Error("Traducere esuata");
            }
        } catch (error) {
            console.error("Eroare la traducere:", error);
            Alert.alert("Traducere indisponibilă", "Nu s-a putut traduce mesajul în limba salvată pe profilul tău.");
        } finally {
            setTranslatingId(null);
        }
    };

    const handleEndConversation = () => {
        Alert.alert(
            "Închide conversația",
            "Ești sigur că vrei să închei acest chat? Niciunul dintre voi nu va mai putea trimite mesaje.",
            [
                { text: "Anulează", style: "cancel" },
                { 
                    text: "Încheie", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const chatRef = doc(db, "chats", id as string);
                            await updateDoc(chatRef, {
                                isEnded: true,
                                lastMessage: "Conversație încheiată.",
                                lastMessageTimestamp: serverTimestamp()
                            });
                            await addDoc(collection(db, "chats", id as string, "messages"), {
                                text: "🔒 Această conversație a fost încheiată.",
                                senderId: "system",
                                createdAt: serverTimestamp(),
                            });
                        } catch (error) {
                            console.error("Eroare la închidere:", error);
                        }
                    }
                }
            ]
        );
    };

    const sendMessage = async () => {
        if (inputText.trim().length === 0 || isChatEnded) return;
        const textToSend = inputText;
        const myUid = auth.currentUser?.uid;
        if (!myUid || !id) return;

        setInputText('');
        try {
            await addDoc(collection(db, "chats", id as string, "messages"), {
                text: textToSend,
                senderId: myUid,
                createdAt: serverTimestamp(),
            });

            const chatRef = doc(db, "chats", id as string);
            await updateDoc(chatRef, {
                lastMessage: textToSend,
                lastMessageTimestamp: serverTimestamp(),
                lastSenderId: myUid,
                readBy: [myUid]
            });
        } catch (error) {
            console.error("Eroare la trimitere:", error);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isSystem = item.senderId === "system";
        const isMine = item.senderId === auth.currentUser?.uid;
        const messageTime = item.createdAt ? 
            new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "...";
        
        const isTradus = !!translatedMessages[item.id];
        const textAfisat = isTradus ? translatedMessages[item.id] : item.text;

        if (isSystem) {
            return (
                <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessageText}>{item.text}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.messageWrapper, isMine ? styles.myMessageWrapper : styles.partnerMessageWrapper]}>
                {isMine ? (
                    <LinearGradient
                        colors={[UI_COLORS.buttonBlue, UI_COLORS.brandSky]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.messageBubble, styles.myBubble]}
                    >
                        <Text style={[styles.messageText, { color: '#FFF' }]}>{textAfisat}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.messageBubble, styles.partnerBubble]}>
                        <Text style={[styles.messageText, { color: UI_COLORS.mainTitle }]}>{textAfisat}</Text>
                    </View>
                )}
                
                <View style={styles.messageFooterRow}>
                    <Text style={styles.timeText}>{messageTime}</Text>
                    
                    {!isMine && (
                        <TouchableOpacity 
                            onPress={() => handleTranslate(item.id, item.text)}
                            style={styles.translateBtn}
                            disabled={translatingId === item.id}
                        >
                            {translatingId === item.id ? (
                                <ActivityIndicator size="small" color={UI_COLORS.brandSky} style={{ transform: [{ scale: 0.6 }] }} />
                            ) : (
                                <Text style={[styles.translateBtnText, isTradus && { color: '#e63946' }]}>
                                    {isTradus ? "• Vezi originalul" : "• Tradu"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    if (!fontsLoaded || loading) return (
        <View style={styles.loading}><ActivityIndicator color={UI_COLORS.brandSky} size="large" /></View>
    );

    const partnerInitial = partnerData.name.charAt(0).toUpperCase() || "U";

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={{ flex: 1 }}>
                
                {/* HEADER */}
                <BlurView intensity={30} tint="light" style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={26} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                    
                    <View style={styles.headerAvatarContainer}>
                        {partnerData.photo && !imageError ? (
                            <Image 
                                source={{ uri: partnerData.photo }} 
                                style={styles.headerAvatar}
                                contentFit="cover"
                                transition={200}
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <View style={styles.fallbackAvatar}>
                                <Text style={styles.fallbackText}>{partnerInitial}</Text>
                            </View>
                        )}
                    </View>
                    
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{partnerData.name}</Text>
                        
                        <View style={styles.statusRow}>
                            <View style={[styles.onlineDot, isChatEnded && { backgroundColor: '#718096' }]} />
                            <Text style={styles.headerStatus}>{isChatEnded ? "Conversație încheiată" : "Activ acum"}</Text>
                        </View>
                    </View>

                    {!isChatEnded && (
                        <TouchableOpacity onPress={handleEndConversation} style={styles.endBtn}>
                            <Ionicons name="close" size={28} color={UI_COLORS.redDestructive} />
                        </TouchableOpacity>
                    )}
                </BlurView>

                {}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    inverted 
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                />

                {}
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : undefined} 
                    keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
                    style={styles.keyboardContainer}
                >
                    {isChatEnded ? (
                        <BlurView intensity={40} tint="light" style={styles.endedInfoContainer}>
                            <Ionicons name="lock-closed" size={18} color={UI_COLORS.mainTitle} />
                            <Text style={styles.endedInfoText}>Nu mai poți trimite mesaje în acest chat.</Text>
                        </BlurView>
                    ) : (
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Scrie un mesaj..."
                                placeholderTextColor="rgba(26, 54, 93, 0.4)"
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                            />
                            <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                                <LinearGradient 
                                    colors={[UI_COLORS.softBlue, UI_COLORS.brandSky]}
                                    style={styles.sendIconCircle}
                                >
                                    <Ionicons name="arrow-up" size={20} color="#FFF" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 14, 
        borderBottomWidth: 1, 
        borderColor: 'rgba(255,255,255,0.15)',
        paddingTop: Platform.OS === 'android' ? 40 : 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerAvatarContainer: { width: 44, height: 44, marginLeft: 6 },
    headerAvatar: { width: 44, height: 44, borderRadius: 22 }, 
    fallbackAvatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: UI_COLORS.brandSky, justifyContent: 'center', alignItems: 'center',
    },
    fallbackText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 18 },
    headerInfo: { flex: 1, marginLeft: 12 },
    headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: UI_COLORS.brandSky }, 
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
    onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2D6A4F', marginRight: 5 },
    headerStatus: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: '#4A5568' },
    endBtn: { 
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center'
    },
    messagesList: { paddingHorizontal: 16, paddingVertical: 16 },
    systemMessageContainer: { alignSelf: 'center', marginVertical: 15, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    systemMessageText: { fontFamily: 'Poppins_600SemiBold', fontSize: 11, color: '#718096' },
    messageWrapper: { marginVertical: 4, maxWidth: '78%' },
    myMessageWrapper: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    partnerMessageWrapper: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    messageBubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, overflow: 'hidden' },
    myBubble: { 
        borderBottomRightRadius: 4,
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 1, height: 2 }
    },
    partnerBubble: { 
        borderBottomLeftRadius: 4, 
        backgroundColor: 'rgba(26, 54, 93, 0.07)', 
        borderWidth: 1,
        borderColor: 'rgba(26, 54, 93, 0.05)'
    },
    messageText: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 21 },
    messageFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 6 },
    timeText: { fontSize: 9, fontFamily: 'Poppins_400Regular', color: '#718096' },
    translateBtn: { marginLeft: 8 },
    translateBtnText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky },
    keyboardContainer: { backgroundColor: 'transparent' }, 
    inputContainer: { 
        flexDirection: 'row', alignItems: 'center', padding: 6, marginHorizontal: 16, marginBottom: 16,
        borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.45)',
        borderWidth: 0, borderColor: 'transparent'
    },
    endedInfoContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 15, marginHorizontal: 16, marginBottom: 16, borderRadius: 20, gap: 10, backgroundColor: 'rgba(0,0,0,0.03)'
    },
    endedInfoText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: '#718096' },
    textInput: { 
        flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.mainTitle, 
        paddingHorizontal: 12, maxHeight: 90, paddingVertical: 6
    },
    sendBtn: { marginRight: 2 },
    sendIconCircle: {
        width: 38, height: 38, borderRadius: 19,
        justifyContent: 'center', alignItems: 'center',
    }
});