import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Firebase
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    softBlue: '#F0F9FF',
    white: '#FFFFFF',
    pdfGradient: ['#A2D2FF', '#6FB1FC'] as const,
};

export default function ReceiptDetailsScreen() {
    const { swapId } = useLocalSearchParams();
    const router = useRouter();
    const [receipt, setReceipt] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const fetchReceipt = async () => {
            setLoading(true);
            try {
                const cleanId = String(swapId).trim();
                const q = query(
                    collection(db, "receipt-details"),
                    where("swapId", "==", cleanId),
                    limit(1)
                );

                const snap = await getDocs(q);

                if (!snap.empty) {
                    setReceipt(snap.docs[0].data());
                } else {
                    setReceipt(null);
                }
            } catch (e: any) {
                console.error("Eroare preluare date:", e);
            } finally {
                setLoading(false);
            }
        };

        if (swapId) fetchReceipt();
    }, [swapId, retry]);

    const formatFullDate = (timestamp: any) => {
        if (!timestamp) return { date: '-', time: '-' };
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
        return {
            date: d.toLocaleDateString('ro-RO'),
            time: d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const createAndSharePDF = async () => {
        if (!receipt) return;
        const { date, time } = formatFullDate(receipt.createdAt);
        
        const htmlContent = `
            <html>
            <body style="font-family: Helvetica; padding: 50px; color: #1A365D;">
                <h1 style="color: #4dabf7;">Chitanță Swaply</h1>
                <p><strong>ID Tranzacție:</strong> #${swapId}</p>
                <p><strong>Data:</strong> ${date} | <strong>Ora:</strong> ${time}</p>
                <p><strong>Suma Securizată:</strong> ${receipt.amount} ${receipt.currency}</p>
                <hr/>
                <p style="font-size: 12px; color: #718096;">Document generat automat de platforma Swaply.</p>
            </body>
            </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri);
        } catch (error) {
            Alert.alert("Eroare", "Nu s-a putut genera PDF-ul.");
        }
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={UI_COLORS.brandSky} />
        </View>
    );

    const { date, time } = formatFullDate(receipt?.createdAt);

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            <SafeAreaView style={{ flex: 1 }}>
                {}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: UI_COLORS.brandSky }]}>Status Tranzacție</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.cardWrapper}>
                    <BlurView intensity={90} tint="light" style={styles.card}>
                        {}
                        <View style={styles.iconCircle}>
                            <Ionicons name="shield-checkmark" size={50} color={UI_COLORS.brandSky} />
                        </View>
                        
                        <Text style={styles.successTitle}>Plată Reușită</Text>
                        <Text style={styles.swapIdText}>REF: #{swapId?.toString().slice(0, 14).toUpperCase()}</Text>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.infoBox}>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Suma Securizată</Text>
                                <Text style={styles.amountValue}>{receipt?.amount} {receipt?.currency}</Text>
                            </View>
                            
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Data</Text>
                                <Text style={styles.blueValue}>{date}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Ora tranzacției</Text>
                                <Text style={styles.blueValue}>{time}</Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Metodă</Text>
                                <Text style={styles.blueValue}>Card Bancar</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.proPdfBtn} onPress={createAndSharePDF}>
                            <LinearGradient 
                                colors={UI_COLORS.pdfGradient} 
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                                style={styles.pdfGradient}
                            >
                                <Ionicons name="cloud-download" size={20} color="#FFF" />
                                <Text style={styles.pdfBtnText}>DESCARCĂ PDF</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        
                        <Text style={styles.footerNote}>Securizat prin sistem Escrow</Text>
                    </BlurView>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    
    backBtn: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    cardWrapper: { padding: 25, flex: 1, justifyContent: 'center' },
    card: { 
        padding: 30, 
        borderRadius: 50, 
        alignItems: 'center', 
        borderWidth: 0, 
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
        overflow: 'hidden'
    },
    
    iconCircle: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    successTitle: { fontSize: 24, fontWeight: '900', color: UI_COLORS.brandSky, marginBottom: 5 },
    swapIdText: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' },
    divider: { width: '100%', height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
    infoBox: { width: '100%', gap: 15 },
    infoRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: '#64748B', fontSize: 13, fontWeight: '500' },
   
    blueValue: { color: '#4dabf7', fontWeight: '700', fontSize: 14 },
    amountValue: { color: UI_COLORS.brandSky, fontWeight: '900', fontSize: 17 },
    proPdfBtn: { width: '100%', height: 55, borderRadius: 20, overflow: 'hidden', marginTop: 30 },
    pdfGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    pdfBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
    footerNote: { marginTop: 20, fontSize: 10, color: '#CBD5E1', fontWeight: 'bold', textTransform: 'uppercase' }
});