import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC_5bGL8rkJ75EqAM0-K4yj2wt4rrQE_N8", 
  authDomain: "swaplyapp-593bf.firebaseapp.com",
  projectId: "swaplyapp-593bf",
  storageBucket: "swaplyapp-593bf.firebasestorage.app",
  messagingSenderId: "511911975399",
  appId: "1:511911975399:web:1be0b883c93e4ce9c00542",
  measurementId: "G-Z4VG5GEEKG"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const storage = getStorage(app);

let db: Firestore; 

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        // Folosim cache simplu, fără TabManager (care e pt browser)
    }),
    // experimentalForceLongPolling rezolvă eroarea de WebChannel pe simulatoare/rețele instabile
    experimentalForceLongPolling: true, 
  });
} catch (error) {
  db = getFirestore(app);
}

export { db };

