import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// --- CONFIGURARE OPENAI ---
const OPENAI_API_KEY = "***";
const API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `
Ești asistentul oficial Swaply, o aplicație modernă de schimb de locuințe. Iată regulile tale actualizate:

1. Condiție obligatorie: Pentru a face un schimb, utilizatorul TREBUIE să aibă un anunț activ cu propria locuință.
2. Destinații: Schimbul se poate face cu orice locație disponibilă în aplicație.
3. Sistemul de Match: Există "Match Perfect" atunci când locația dorită de tine corespunde cu apartamentul altcuiva, iar el, la rândul lui, caută locația unde se află apartamentul tău.
4. Interacțiune: Utilizatorii pot adăuga anunțuri la "Favorite" și pot vorbi pe chat pentru a pune întrebări înainte de a propune un schimb.
5. Procesul de Schimb: Când propui un schimb, trebuie să alegi perioada (datele) și să stabilești o sumă ca GARANȚIE.
6. Siguranță și Garanție: NU există taxă de mentenanță. Totuși, dacă ceva este distrus în locuință, suma stabilită ca garanție se reține.
7. Recenzii: După finalizarea schimbului, utilizatorii pot lăsa recenzii unul altuia.
8. Funcție Specială: Utilizatorii pot vedea cum a fost vremea anul trecut în perioada aleasă pentru schimb, ca să știe la ce să se aștepte.

Răspunde mereu în limba română, fii scurt, prietenos și folosește emoji-uri ✨
`;

const UI_COLORS = {
    mainTitle: '#1A365D',
    description: '#4A5568',
    brandSky: '#4dabf7',
    appGradient: ['#FFDEE9', '#B5FFFC', '#E0C3FC'] as const,
};

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
};

export default function AiAssistantScreen() {
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [messages, setMessages] = useState<Message[]>([
        { id: '0', role: 'assistant', text: 'Salut! Sunt asistentul Swaply 👋 Cu ce te pot ajuta astăzi? ✨' }
    ]);
    const [userQuestion, setUserQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    let [fontsLoaded] = useFonts({
        Poppins_400Regular,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const handleSend = async () => {
        const question = userQuestion.trim();
        if (!question || isThinking) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: question };
        setMessages(prev => [...prev, userMsg]);
        setUserQuestion('');
        setIsThinking(true);

        // Scroll automant la trimitere
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: question },
                    ],
                    temperature: 0.7,
                }),
            });

            const data = await response.json();

            let replyText = 'Nu am putut formula un răspuns acum. ✨';

            if (data.error) {
                console.error('OpenAI API Error:', data.error.message);
                replyText = 'Momentan serviciul AI este indisponibil. ✨';
            } else if (data?.choices?.[0]?.message?.content) {
                replyText = data.choices[0].message.content.trim();
            }

            const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: replyText };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('Fetch Error:', error);
            const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Eroare de rețea. Verifică conexiunea! ✨' };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsThinking(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            <LinearGradient colors={UI_COLORS.appGradient} style={StyleSheet.absoluteFillObject} />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <LinearGradient
                            colors={['#4dabf7', '#E0C3FC']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.headerBadge}
                        >
                            <Ionicons name="sparkles" size={16} color="#FFF" />
                            <Text style={styles.headerTitle}>Asistent Swaply</Text>
                        </LinearGradient>
                        <Text style={styles.headerSub}>Bazat pe OpenAI ✨</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.messagesList}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((msg) => (
                        <View
                            key={msg.id}
                            style={[
                                styles.bubbleRow,
                                msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAi
                            ]}
                        >
                            {msg.role === 'assistant' && (
                                <LinearGradient colors={['#4dabf7', '#E0C3FC']} style={styles.aiAvatar}>
                                    <Ionicons name="sparkles" size={14} color="#FFF" />
                                </LinearGradient>
                            )}
                            <View style={[
                                styles.bubble,
                                msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi
                            ]}>
                                <Text style={[
                                    styles.bubbleText,
                                    msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAi
                                ]}>
                                    {msg.text}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {isThinking && (
                        <View style={[styles.bubbleRow, styles.bubbleRowAi]}>
                            <LinearGradient colors={['#4dabf7', '#E0C3FC']} style={styles.aiAvatar}>
                                <Ionicons name="sparkles" size={14} color="#FFF" />
                            </LinearGradient>
                            <View style={[styles.bubble, styles.bubbleAi, styles.thinkingBubble]}>
                                <ActivityIndicator size="small" color={UI_COLORS.brandSky} />
                                <Text style={styles.thinkingText}>Swaply gândește...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.inputArea}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="Întreabă-mă ceva..."
                                value={userQuestion}
                                onChangeText={setUserQuestion}
                                placeholderTextColor="#A0AEC0"
                                multiline
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!userQuestion.trim() || isThinking) && styles.sendBtnDisabled]}
                                onPress={handleSend}
                                disabled={!userQuestion.trim() || isThinking}
                            >
                                <LinearGradient colors={['#4dabf7', '#E0C3FC']} style={styles.sendGradient}>
                                    <Ionicons name="arrow-up" size={20} color="#FFF" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.4)',
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    headerTitle: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#FFF' },
    headerSub: { fontFamily: 'Poppins_400Regular', fontSize: 10, color: UI_COLORS.description },
    messagesList: { flex: 1 },
    messagesContent: { padding: 20, gap: 12 },
    bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    bubbleRowUser: { justifyContent: 'flex-end' },
    bubbleRowAi: { justifyContent: 'flex-start' },
    aiAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    bubble: {
        maxWidth: '78%',
        padding: 14,
        borderRadius: 20,
    },
    bubbleUser: {
        backgroundColor: UI_COLORS.brandSky,
        borderBottomRightRadius: 4,
    },
    bubbleAi: {
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderBottomLeftRadius: 4,
    },
    bubbleText: { fontFamily: 'Poppins_400Regular', fontSize: 14, lineHeight: 22 },
    bubbleTextUser: { color: '#FFF' },
    bubbleTextAi: { color: UI_COLORS.mainTitle },
    thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    thinkingText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: UI_COLORS.description },
    inputArea: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.4)',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: 25,
        paddingLeft: 18,
        paddingRight: 6,
        paddingVertical: 6,
    },
    input: {
        flex: 1,
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        color: UI_COLORS.mainTitle,
        maxHeight: 100,
        paddingVertical: 8,
    },
    sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    sendBtnDisabled: { opacity: 0.5 },
    sendGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});