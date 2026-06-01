import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Firebase imports
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const UI_COLORS = {
    brandSky: '#4dabf7', 
    description: '#4A5568',
    white: '#FFFFFF',
};

export default function FavoritesScreen() {
  const router = useRouter();
  const [favApartments, setFavApartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    // Ascultăm în timp real colecția de favorite
    const favQuery = query(collection(db, "favorites"), where("userId", "==", auth.currentUser.uid));
    
    const unsubscribe = onSnapshot(favQuery, async (snapshot) => {
      const apartmentIds = snapshot.docs.map(doc => doc.data().apartmentId);
      
      if (apartmentIds.length === 0) {
        setFavApartments([]);
        setLoading(false);
        return;
      }

      try {
        // Luăm detaliile apartamentelor
        const apQuery = query(collection(db, "apartments"));
        const apSnapshot = await getDocs(apQuery);
        const allAps = apSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtrăm doar cele care sunt la favorite
        const filtered = allAps.filter(ap => apartmentIds.includes(ap.id));
        setFavApartments(filtered);
      } catch (error) {
        console.error("Error fetching apartment details:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const removeFavorite = async (apartmentId: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      // Căutăm documentul de favorit care face legătura între user și acest apartament
      const favQuery = query(
        collection(db, "favorites"), 
        where("userId", "==", userId),
        where("apartmentId", "==", apartmentId)
      );
      
      const snapshot = await getDocs(favQuery);
      
      // Ștergem documentele găsite (ar trebui să fie doar unul)
      const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, "favorites", document.id)));
      await Promise.all(deletePromises);
      
    } catch (error) {
        console.error("Error removing favorite:", error);
        Alert.alert("Eroare", "Nu s-a putut elimina de la favorite.");
    }
  };

  if (!fontsLoaded || loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={UI_COLORS.brandSky} /></View>;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favorite</Text>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          data={favApartments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="heart-dislike-outline" size={60} color={UI_COLORS.brandSky} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>Nu ai nicio casă salvată la favorite.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.houseCard} 
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/details', params: { id: item.id } } as any)}
            >
              <Image source={{ uri: item.images?.[0] }} style={styles.houseImage} />
              
              <TouchableOpacity 
                style={styles.favBadge} 
                onPress={() => removeFavorite(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="heart" size={22} color="#FF4D6D" />
              </TouchableOpacity>

              <BlurView intensity={90} tint="light" style={styles.houseDetails}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.houseTitle} numberOfLines={1}>
                    {item.title || 'Apartament'}
                  </Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-sharp" size={14} color={UI_COLORS.brandSky} />
                    <Text style={styles.houseCity} numberOfLines={1}>
                        {item.addressInput || 'Locație'}
                    </Text>
                  </View>
                </View>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.size} m²</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { ...StyleSheet.absoluteFillObject },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginVertical: 10 },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
  backButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20 },
  houseCard: { height: 280, borderRadius: 30, marginBottom: 20, overflow: 'hidden', backgroundColor: '#FFF', elevation: 5 },
  houseImage: { width: '100%', height: '100%', position: 'absolute' },
  favBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 20, zIndex: 10 },
  houseDetails: { position: 'absolute', bottom: 12, left: 12, right: 12, padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  houseTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: UI_COLORS.brandSky }, 
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  houseCity: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: UI_COLORS.brandSky, marginLeft: 4, opacity: 0.8, flex: 1 },
  badge: { backgroundColor: UI_COLORS.brandSky, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14 },
  badgeText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 150 },
  emptyText: { fontFamily: 'Poppins_400Regular', color: UI_COLORS.description, marginTop: 15, fontSize: 15 },
});