import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7',
    mainTitle: '#1A365D',
    description: '#4A5568',
    white: '#FFFFFF',
    lightBlueText: '#4dabf7',
    errorText: '#ff4d6d',
    btnGradient: ['#A2D2FF', '#6FB1FC'] as const,
};

export default function IdentityFormScreen() {
    const router = useRouter();
    const { swapId } = useLocalSearchParams<{ swapId: string }>();
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState('');
    const [cnp, setCnp] = useState('');
    const [documentSeries, setDocumentSeries] = useState('');
    const [address, setAddress] = useState('');
    
    let [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold });

    if (!fontsLoaded) return <View style={styles.loading}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

    const sendNotificationToPartner = async (targetUserId: string, title: string, message: string, idSwap: string) => {
        try {
            await addDoc(collection(db, "notifications"), {
                userId: targetUserId,
                title,
                message,
                resourceId: idSwap,
                type: "payment_update",
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Error sending notification:", e);
        }
    };

    const executePaymentAndActivation = async () => {
        if (!auth.currentUser || !swapId) return;

        try {
            const currentUserId = auth.currentUser.uid;
            const swapRef = doc(db, "swap_requests", swapId);
            
            // Preluăm starea la zi a documentului pentru a ști cine a plătit deja
            const swapSnap = await getDoc(swapRef);
            if (!swapSnap.exists()) {
                Alert.alert("Eroare", "Cererea de schimb nu a fost găsită.");
                return;
            }

            const selectedOffer = { id: swapSnap.id, ...swapSnap.data() } as any;
            const isOwner = currentUserId === selectedOffer.ownerId;
            const partnerId = isOwner ? selectedOffer.senderId : selectedOffer.ownerId;
            
            const currentApartmentImage = selectedOffer.apartmentImage || "";
            const currentSenderImg = selectedOffer.senderApartmentImage || "";
            const currentOwnerImg = selectedOffer.ownerApartmentImage || "";

            // Pregătim actualizarea plății
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

            // Dacă și partenerul a plătit deja, securizăm tranzacția în receipt-details
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

            // Trimitem notificarea
            const myName = isOwner ? selectedOffer.ownerName : selectedOffer.senderName;
            await sendNotificationToPartner(
                partnerId,
                partnerAlreadyPaid ? "Schimb Securizat! 🏠" : "Plată Garanție 💳",
                partnerAlreadyPaid 
                    ? `Ambii ați plătit. Schimbul este acum activ!`
                    : `${myName || 'Cineva'} a plătit garanția. Plătește și tu pentru a activa schimbul!`,
                selectedOffer.id
            );

            Alert.alert(
                "Succes deplin", 
                partnerAlreadyPaid ? "Identitate înregistrată și Schimb Activat!" : "Date salvate și plată confirmată!",
                [{ text: "Ok", onPress: () => router.dismissAll() }] // Se întoarce la panoul central curat
            );

        } catch (err) {
            console.error(err);
            Alert.alert("Eroare plată", "Datele de identitate s-au salvat, dar a apărut o eroare la procesarea plății.");
        }
    };

    const handleSubmit = async () => {
        // 1. Validare câmpuri goale
        if (!fullName || !cnp || !documentSeries || !address) {
            Alert.alert("Atenție", "Te rugăm să completezi toate câmpurile pentru a putea securiza schimbul.");
            return;
        }

        // 2. Validare Nume Complet 
        const nameRegex = /^[a-zA-ZĂÂÎȘȚăâîșț]+([\s-][a-zA-ZĂÂÎȘȚăâîșț]+)+$/;
        if (!nameRegex.test(fullName.trim())) {
            Alert.alert("Nume Invalid", "Te rugăm să introduci numele și prenumele complete (ex: Popescu Ioan), fără cifre sau simboluri.");
            return;
        }

        // 3. Validare CNP Românesc
        const validateCNP = (cnpStr: string) => {
            if (!/^\d{13}$/.test(cnpStr)) return false;
            const key = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseInt(cnpStr.charAt(i)) * key[i];
            }
            let remainder = sum % 11;
            let controlDigit = remainder === 10 ? 1 : remainder;
            return controlDigit === parseInt(cnpStr.charAt(12));
        };
        if (!validateCNP(cnp.trim())) {
            Alert.alert("CNP Invalid", "Codul Numeric Personal introdus nu este valid legal. Te rugăm să îl verifici.");
            return;
        }

        // 4. Validare Serie și Număr Buletin (Exact 2 litere mari și 6 cifre)
        const ciRegex = /^[A-Z]{2}\s?\d{6}$/;
        if (!ciRegex.test(documentSeries.toUpperCase().trim())) {
            Alert.alert("Serie C.I. Invalidă", "Seria și numărul de buletin trebuie să fie în formatul oficial (ex: RX 123456).");
            return;
        }

        Alert.alert(
            "Confirmare Date",
            "Ești sigur că datele introduse sunt corecte conform actului de identitate?",
            [
                { text: "Anulează", style: "cancel" },
                {
                    text: "Da, sunt corecte",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            if (!auth.currentUser || !swapId) return;
                            const currentUserId = auth.currentUser.uid;
                            const swapRef = doc(db, "swap_requests", swapId);
                            
                            // Salvăm datele de identitate structurate sub ID-ul userului curent
                            await updateDoc(swapRef, {
                                [`identity_${currentUserId}`]: {
                                    fullName: fullName.trim(),
                                    cnp: cnp.trim(),
                                    documentSeries: documentSeries.toUpperCase().trim(),
                                    address: address.trim()
                                }
                            });

                            // După salvarea identității, executăm automat și logica plăților
                            await executePaymentAndActivation();
                        } catch (error) {
                            Alert.alert("Eroare", "A apărut o problemă la salvarea datelor în baza de date.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
            
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={UI_COLORS.lightBlueText} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Verificare Identitate</Text>
                    <View style={{ width: 44 }} />
                </View>
                
                {/* Casetă Info */}
                <View style={styles.infoBox}>
                    <Ionicons name="shield-checkmark" size={24} color={UI_COLORS.lightBlueText} />
                    <Text style={styles.infoText}>
                        Informațiile introduse sunt complet criptate și vor fi folosite exclusiv pentru generarea facturii oficiale și securizarea juridică a acestui schimb.
                    </Text>
                </View>
                
                {/* Card Formular */}
                <View style={styles.formCard}>
                    <Text style={styles.label}>Nume complet (ca în C.I.)</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="person-outline" size={18} color={UI_COLORS.lightBlueText} />
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Popescu Ioan"
                            placeholderTextColor="rgba(0, 0, 0, 0.3)"
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>
                    
                    <Text style={styles.label}>Cod Numeric Personal (CNP)</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="finger-print-outline" size={18} color={UI_COLORS.lightBlueText} />
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: 1950101XXXXXX"
                            placeholderTextColor="rgba(0, 0, 0, 0.3)"
                            keyboardType="numeric"
                            maxLength={13}
                            value={cnp}
                            onChangeText={setCnp}
                        />
                    </View>
                    
                    <Text style={styles.label}>Serie și Număr Buletin</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="card-outline" size={18} color={UI_COLORS.lightBlueText} />
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: RX 123456"
                            placeholderTextColor="rgba(0, 0, 0, 0.3)"
                            autoCapitalize="characters"
                            value={documentSeries}
                            onChangeText={setDocumentSeries}
                        />
                    </View>
                    
                    <Text style={styles.label}>Domiciliu (Adresă completă buletin)</Text>
                    <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                        <Ionicons name="home-outline" size={18} color={UI_COLORS.lightBlueText} style={{ marginTop: 2 }} />
                        <TextInput
                            style={styles.inputTextArea}
                            placeholder="Oraș, Stradă, Număr, Bloc, Apartament..."
                            placeholderTextColor="rgba(0, 0, 0, 0.3)"
                            multiline={true}
                            numberOfLines={3}
                            textAlignVertical="top"
                            value={address}
                            onChangeText={setAddress}
                        />
                    </View>
                </View>
                
                {/* Buton Salvare & Plată */}
                <TouchableOpacity style={styles.submitBtnWrapper} onPress={handleSubmit} disabled={loading}>
                    <LinearGradient colors={UI_COLORS.btnGradient} style={styles.submitBtn}>
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.submitBtnText}>Salvează și Finalizează Plata</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContainer: { padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 35, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.5)', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.lightBlueText },
    infoBox: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(255,255,255,0.7)', padding: 15, borderRadius: 22, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(77, 171, 247, 0.15)', alignItems: 'center' },
    infoText: { flex: 1, fontSize: 11.5, fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, lineHeight: 17 },
    formCard: { backgroundColor: 'rgba(255,255,255,0.85)', padding: 20, borderRadius: 28, gap: 14, elevation: 2 },
    label: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.mainTitle, marginLeft: 2 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: 'rgba(77, 171, 247, 0.15)' },
    textAreaWrapper: { alignItems: 'flex-start', paddingTop: 14, height: 90 },
    input: { flex: 1, marginLeft: 10, fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#333' },
    inputTextArea: { flex: 1, marginLeft: 10, fontFamily: 'Poppins_400Regular', fontSize: 13, color: '#333', minHeight: 65 },
    submitBtnWrapper: { marginTop: 25, height: 54, borderRadius: 18, overflow: 'hidden', elevation: 3 },
    submitBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    submitBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' }
});