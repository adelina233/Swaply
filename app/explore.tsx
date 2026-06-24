import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Firebase imports
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

const UI_COLORS = {
  brandSky: '#4dabf7',
  brandPink: '#FF4D6D',
  description: '#4A5568',
  inputText: '#334155',
  white: '#FFFFFF',
  softBlue: '#A2D2FF',
  mainTitle: '#1A365D',
  starGold: '#FFD700',
  palePink: '#FADCE4',
  pinkIcon: '#ff85a1',
  softGradient: ['rgba(255, 222, 233, 0.4)', 'rgba(181, 255, 252, 0.4)', 'rgba(224, 195, 252, 0.4)'] as const,
  aiGradient: ['#4dabf7', '#E0C3FC'] as const,
};

export default function ExploreScreen() {
  const router = useRouter();
  const navigation = useNavigation(); 
  const [apartments, setApartments] = useState<any[]>([]);
  const [filteredApartments, setFilteredApartments] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myApartment, setMyApartment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedMapApartment, setSelectedMapApartment] = useState<any>(null);

  // filtrele
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [minRating, setMinRating] = useState<number | null>(null);
  const [perfectMatchOnly, setPerfectMatchOnly] = useState(false);

  // ── Modal autentificare necesară ──
  const [loginAlertModal, setLoginAlertModal] = useState(false);
  const [loginAlertFeature, setLoginAlertFeature] = useState('');

  const requireLogin = (featureName: string, action: () => void) => {
    if (!auth.currentUser) {
      setLoginAlertFeature(featureName);
      setLoginAlertModal(true);
    } else {
      action();
    }
  };

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
    let unsubscribeAps: () => void;
    let unsubscribeFavs: () => void = () => { };
    let unsubscribeReviews: () => void = () => { };
    let unsubscribeMyAd: () => void = () => { };

    unsubscribeReviews = onSnapshot(collection(db, "reviews"), (reviewsSnapshot) => {
      const ratingsMap: { [key: string]: { sum: number, count: number } } = {};

      reviewsSnapshot.forEach(d => {
        const rev = d.data();
        const targetUid = rev.toUserId; 
        const rComm = Number(rev.ratingCommunication) || 0;
        const rHome = Number(rev.ratingHome) || 0;

        if (targetUid && (rComm > 0 || rHome > 0)) {
          const mediaCurenta = (rComm + rHome) / 2;

          if (!ratingsMap[targetUid]) {
            ratingsMap[targetUid] = { sum: 0, count: 0 };
          }
          ratingsMap[targetUid].sum += mediaCurenta;
          ratingsMap[targetUid].count += 1;
        }
      });

      const q = query(collection(db, "apartments"), orderBy("createdAt", "desc"));
      unsubscribeAps = onSnapshot(q, (snapshot) => {
        const adsData = snapshot.docs.map(doc => {
          const data = doc.data();
          const userStats = ratingsMap[data.userId];
          const avg = userStats ? userStats.sum / userStats.count : 0;

          return {
            id: doc.id,
            ...data,
            calculatedRating: avg
          };
        });

        setApartments(adsData);
        setFilteredApartments(adsData);
        setLoading(false);
      });
    });

    if (auth.currentUser) {
      const favQuery = query(collection(db, "favorites"), where("userId", "==", auth.currentUser.uid));
      unsubscribeFavs = onSnapshot(favQuery, (snapshot) => {
        const favIds = snapshot.docs.map(doc => doc.data().apartmentId);
        setFavorites(favIds);
      });

      const myAdQuery = query(collection(db, "apartments"), where("userId", "==", auth.currentUser.uid));
      unsubscribeMyAd = onSnapshot(myAdQuery, (snap) => {
        if (!snap.empty) {
          setMyApartment(snap.docs[0].data());
        }
      });
    }

    return () => {
      if (unsubscribeAps) unsubscribeAps();
      unsubscribeReviews();
      unsubscribeFavs();
      unsubscribeMyAd();
    };
  }, []);

  const applyFilters = () => {
    Keyboard.dismiss();
    let temp = [...apartments];

    if (filterCity) {
      temp = temp.filter(ap => ap.addressInput?.toLowerCase().includes(filterCity.toLowerCase()));
    }

    if (minRating) {
      temp = temp.filter(ap => ap.calculatedRating >= minRating);
    }

    if (perfectMatchOnly) {
      if (myApartment) {
        const myCity = myApartment.addressInput?.split(',').pop()?.trim().toLowerCase();
        temp = temp.filter(ap => {
          const apTarget = ap.targetCity?.toLowerCase();
          return apTarget === myCity;
        });
      } else {
        Alert.alert("Info", "Trebuie să ai o locuință postată pentru a găsi un Perfect Match! ✨");
        setPerfectMatchOnly(false);
      }
    }

    setFilteredApartments(temp);
    setIsFilterVisible(false);
  };

  const resetFilters = () => {
    Keyboard.dismiss();
    setFilterCity('');
    setMinRating(null);
    setPerfectMatchOnly(false);
    setFilteredApartments(apartments);
    setIsFilterVisible(false);
  };

  const toggleFavorite = async (apartment: any) => {
    if (!auth.currentUser) {
      setLoginAlertFeature('salva favorite');
      setLoginAlertModal(true);
      return;
    }

    const userId = auth.currentUser.uid;
    const apartmentId = apartment.id;
    const favDocId = `${userId}_${apartmentId}`;
    const favRef = doc(db, "favorites", favDocId);

    try {
      if (favorites.includes(apartmentId)) {
        await deleteDoc(favRef);
      } else {
        await setDoc(favRef, {
          userId,
          apartmentId,
          addedAt: new Date().toISOString()
        });

        if (apartment.userId !== userId) {
          await addDoc(collection(db, "notifications"), {
            userId: apartment.userId,
            title: "Locuință apreciată! ❤️",
            message: `${auth.currentUser.displayName || "Cineva"} ți-a adăugat locuința la favorite.`,
            type: "favorite",
            resourceId: apartment.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Error toggle favorite:", error);
    }
  };

  // ── Navigare spre detalii, doar dacă userul e logat ──
  const handleOpenDetails = (apartmentId: string) => {
    requireLogin('vedea detaliile unei locuințe', () => {
      router.push({ pathname: '/details', params: { id: apartmentId } } as any);
    });
  };

  const getInitialRegion = () => {
    if (filteredApartments.length > 0) {
      const firstAp = filteredApartments[0];
      const lat = Number(firstAp.location?.latitude);
      const lng = Number(firstAp.location?.longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.15, 
          longitudeDelta: 0.15,
        };
      }
    }
    
    return {
      latitude: 45.9432,
      longitude: 24.9668,
      latitudeDelta: 6.0,
      longitudeDelta: 6.0,
    };
  };

  const renderHouse = ({ item }: { item: any }) => {
    const isFav = favorites.includes(item.id);
    const currentCity = item.addressInput?.split(',').pop()?.trim() || 'Locație...';
    const ratingDisplay = item.calculatedRating > 0 ? item.calculatedRating.toFixed(1) : "Nou";

    return (
      <TouchableOpacity
        style={styles.houseCard}
        activeOpacity={0.9}
        onPress={() => handleOpenDetails(item.id)}
      >
        <Image
          source={item.images && item.images[0] ? item.images[0] : 'https://via.placeholder.com/400'}
          style={styles.houseImage}
          contentFit="cover"
        />

        <View style={styles.topBadgesRow}>
          <BlurView intensity={40} tint="dark" style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color={UI_COLORS.starGold} />
            <Text style={styles.ratingText}>{ratingDisplay}</Text>
          </BlurView>
          {auth.currentUser?.uid !== item.userId && (
            <TouchableOpacity style={styles.favBadge} onPress={() => toggleFavorite(item)}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? "#FF4D6D" : "#FFF"} />
            </TouchableOpacity>
          )}
        </View>

        <BlurView intensity={60} tint="light" style={styles.houseDetails}>
          <View style={{ flex: 1 }}>
            <Text style={styles.houseTitle} numberOfLines={1}>{item.title || 'Locuință'}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color={UI_COLORS.brandSky} />
              <Text style={styles.houseCity}>{currentCity}</Text>
            </View>
            <Text style={styles.swapTargetText}>
              ✈️ Schimb cu <Text style={styles.boldCityBlue}>{item.targetCity || "Oriunde"}</Text>
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.size} m²</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  if (!fontsLoaded || loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={UI_COLORS.brandSky} />
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFDEE9', '#B5FFFC', '#E0C3FC']} style={styles.background} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={UI_COLORS.brandSky} style={{ marginRight: 2 }} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Explorează</Text>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} 
              style={styles.iconBtn}
            >
              <Ionicons name={viewMode === 'list' ? "map-outline" : "list-outline"} size={24} color={UI_COLORS.brandSky} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsFilterVisible(true)} style={styles.iconBtn}>
              <Ionicons name="options-outline" size={24} color={UI_COLORS.brandSky} />
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'list' ? (
          <FlatList
            data={filteredApartments}
            keyExtractor={(item) => item.id}
            renderItem={renderHouse}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Niciun rezultat găsit. ✨</Text>
            }
          />
        ) : (
          <View style={styles.mapContainer}>
            <MapView
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={StyleSheet.absoluteFillObject}
              initialRegion={getInitialRegion()}
              onPress={() => setSelectedMapApartment(null)}
            >
              {filteredApartments.map((ap) => {
                const lat = Number(ap.location?.latitude);
                const lng = Number(ap.location?.longitude);
                
                if (isNaN(lat) || isNaN(lng)) return null;

                const isSelected = selectedMapApartment?.id === ap.id;

                return (
                  <Marker
                    key={ap.id}
                    coordinate={{ latitude: lat, longitude: lng }}
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedMapApartment(ap);
                    }}
                  >
                    <View style={[
                      styles.minimalMarker,
                      isSelected && styles.minimalMarkerSelected
                    ]}>
                      <Ionicons name="business" size={16} color="#FFF" />
                    </View>
                  </Marker>
                );
              })}
            </MapView>

            {selectedMapApartment && (
              <View style={styles.previewContainer}>
                <BlurView intensity={90} tint="light" style={styles.previewBlur}>
                  <TouchableOpacity 
                    style={styles.previewCard}
                    onPress={() => handleOpenDetails(selectedMapApartment.id)}
                  >
                    <Image
                      source={selectedMapApartment.images && selectedMapApartment.images[0] ? selectedMapApartment.images[0] : 'https://via.placeholder.com/400'}
                      style={styles.previewImage}
                      contentFit="cover"
                    />
                    <View style={styles.previewDetails}>
                      <Text style={styles.previewTitle} numberOfLines={1}>{selectedMapApartment.title || 'Locuință'}</Text>
                      <Text style={styles.previewCity} numberOfLines={1}>
                        📍 {selectedMapApartment.addressInput?.split(',').pop()?.trim() || 'Locație'}
                      </Text>
                      <Text style={styles.previewTarget} numberOfLines={1}>
                        ✈️ Schimb cu: <Text style={{fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky}}>{selectedMapApartment.targetCity || 'Oriunde'}</Text>
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={UI_COLORS.brandSky} style={{marginLeft: 5}} />
                  </TouchableOpacity>
                </BlurView>
              </View>
            )}
          </View>
        )}

        <Modal
          animationType="slide"
          transparent={true}
          visible={isFilterVisible}
          onRequestClose={() => setIsFilterVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={20} tint="dark" style={styles.modalBlurOverlay}>
              {}
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
              >
                <LinearGradient
                  colors={['rgba(255, 222, 233, 0.95)', 'rgba(181, 255, 252, 0.95)', 'rgba(224, 195, 252, 0.95)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalContent}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Filtre Inteligente</Text>
                    <TouchableOpacity onPress={() => setIsFilterVisible(false)} style={styles.closeBtn}>
                      <Ionicons name="close-outline" size={30} color={UI_COLORS.brandSky} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Text style={styles.label}>Unde cauți?</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Orașul locuinței..."
                      placeholderTextColor="rgba(77, 171, 247, 0.5)"
                      value={filterCity}
                      onChangeText={setFilterCity}
                    />

                    <Text style={styles.label}>Calitate minimă (Rating)</Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          style={[styles.ratingStarBtn, minRating === star && styles.activeStarBtn]}
                          onPress={() => setMinRating(star === minRating ? null : star)}
                        >
                          <Text style={[styles.starBtnText, minRating === star && styles.activeStarText]}>{star}+ ⭐</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.perfectMatchCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.perfectMatchTitle}>Perfect Match ✨</Text>
                        <Text style={styles.perfectMatchSub}>Doar gazde care vor să vină în orașul tău.</Text>
                      </View>
                      <Switch
                        value={perfectMatchOnly}
                        onValueChange={setPerfectMatchOnly}
                        trackColor={{ false: "rgba(0,0,0,0.1)", true: UI_COLORS.brandSky }}
                        thumbColor={perfectMatchOnly ? "#FFF" : "#f4f3f4"}
                      />
                    </View>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                        <Text style={styles.resetBtnText}>Resetează</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                        <LinearGradient colors={[UI_COLORS.softBlue, UI_COLORS.brandSky]} style={styles.applyGradient}>
                          <Text style={styles.applyBtnText}>Aplică Filtre</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </LinearGradient>
              </KeyboardAvoidingView>
            </BlurView>
          </View>
        </Modal>

        {/* ── Modal autentificare necesară ── */}
        <Modal visible={loginAlertModal} transparent animationType="fade">
          <Pressable style={styles.loginAlertOverlay} onPress={() => setLoginAlertModal(false)}>
            <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.loginAlertContainer}>
              <LinearGradient colors={UI_COLORS.softGradient} style={StyleSheet.absoluteFill} />
              <BlurView intensity={25} tint="light" style={styles.loginAlertGlass}>
                <View style={styles.loginAlertContent}>
                  <View style={styles.loginAlertIconWrap}>
                    <Ionicons name="lock-closed" size={30} color={UI_COLORS.pinkIcon} />
                  </View>
                  <Text style={styles.loginAlertTitle}>Cont necesar</Text>
                  <Text style={styles.loginAlertSub}>
                    Trebuie să fii autentificat pentru a putea {loginAlertFeature}.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.loginAlertBtn}
                  onPress={() => { setLoginAlertModal(false); router.push('/auth'); }}
                >
                  <LinearGradient colors={UI_COLORS.aiGradient} style={styles.loginAlertBtnGradient}>
                    <Text style={styles.loginAlertBtnText}>Autentifică-te</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.loginAlertCancel}
                  onPress={() => setLoginAlertModal(false)}
                >
                  <Text style={styles.loginAlertCancelText}>Înapoi</Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { ...StyleSheet.absoluteFillObject },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  safeArea: { flex: 1 },
  
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 15,
    zIndex: 10
  },
  headerTitle: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: UI_COLORS.brandSky },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContent: { padding: 20, paddingBottom: 100 },
  houseCard: {
    height: 320,
    borderRadius: 30,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  houseImage: { width: '100%', height: '100%', position: 'absolute' },
  topBadgesRow: { position: 'absolute', top: 15, left: 15, right: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, overflow: 'hidden' },
  ratingText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 13 },
  favBadge: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 20 },
  houseDetails: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    padding: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden'
  },
  houseTitle: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: UI_COLORS.brandSky },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  houseCity: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky, marginLeft: 4 },
  swapTargetText: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.description, marginTop: 4 },
  boldCityBlue: { fontFamily: 'Poppins_600SemiBold', color: UI_COLORS.brandSky },
  badge: { backgroundColor: 'rgba(77, 171, 247, 0.85)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15 },
  badgeText: { color: '#FFF', fontFamily: 'Poppins_700Bold', fontSize: 11 },
  emptyText: { textAlign: 'center', fontFamily: 'Poppins_600SemiBold', marginTop: 50, color: UI_COLORS.brandSky, fontSize: 16 },
  
  mapContainer: { flex: 1, overflow: 'hidden' },
  minimalMarker: {
    backgroundColor: '#4dabf7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 }
  },
  minimalMarkerSelected: {
    backgroundColor: '#FF4D6D',
  },
  previewContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  previewBlur: {
    padding: 12,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f0f0f0'
  },
  previewDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center'
  },
  previewTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#1A365D'
  },
  previewCity: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#4A5568',
    marginTop: 2
  },
  previewTarget: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#718096',
    marginTop: 4
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBlurOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.2)' },
  keyboardView: { width: '100%' },
  
  modalContent: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 25,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    overflow: 'hidden'
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'Poppins_700Bold', fontSize: 22, color: UI_COLORS.brandSky },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: UI_COLORS.brandSky, marginTop: 15, marginBottom: 12 },
  
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    padding: 16,
    borderRadius: 20,
    fontFamily: 'Poppins_400Regular',
    color: UI_COLORS.mainTitle
  },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  
  ratingStarBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.5)'
  },
  activeStarBtn: { backgroundColor: UI_COLORS.brandSky },
  starBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: UI_COLORS.brandSky },
  activeStarText: { color: '#FFF' },
  
  perfectMatchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.4)'
  },
  perfectMatchTitle: { fontFamily: 'Poppins_700Bold', fontSize: 16, color: UI_COLORS.brandSky },
  perfectMatchSub: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: UI_COLORS.description, marginTop: 2 },
  modalButtons: { flexDirection: 'row', gap: 15, marginTop: 35 },
  
  resetBtn: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(77, 171, 247, 0.35)'
  },
  resetBtnText: { 
    fontFamily: 'Poppins_700Bold', 
    color: UI_COLORS.brandSky
  },
  
  applyBtn: { flex: 2, borderRadius: 20, overflow: 'hidden' },
  applyGradient: { padding: 18, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { fontFamily: 'Poppins_700Bold', color: '#FFF', fontSize: 15 },

  
  loginAlertOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  loginAlertContainer: { width: '100%', borderRadius: 30, overflow: 'hidden', backgroundColor: 'transparent', elevation: 10 },
  loginAlertGlass: { borderRadius: 30, padding: 25 },
  loginAlertContent: { alignItems: 'center', marginBottom: 24 },
  loginAlertIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: UI_COLORS.palePink, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  loginAlertTitle: { fontFamily: 'Poppins_700Bold', fontSize: 20, color: UI_COLORS.brandSky, marginBottom: 8, textAlign: 'center' },
  loginAlertSub: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: UI_COLORS.description, textAlign: 'center', lineHeight: 22 },
  loginAlertBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 10 },
  loginAlertBtnGradient: { paddingVertical: 15, alignItems: 'center', borderRadius: 18 },
  loginAlertBtnText: { color: '#FFF', fontFamily: 'Poppins_600SemiBold', fontSize: 16 },
  loginAlertCancel: { paddingVertical: 12, alignItems: 'center' },
  loginAlertCancelText: { color: UI_COLORS.description, fontFamily: 'Poppins_400Regular', fontSize: 14 },
});