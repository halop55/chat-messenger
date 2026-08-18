import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8CfIX8gG8sgtTtDofeBjaC2zDBSXT3dY",
  authDomain: "chat-messenger-71c1e.firebaseapp.com",
  projectId: "chat-messenger-71c1e",
  storageBucket: "chat-messenger-71c1e.firebasestorage.app",
  messagingSenderId: "435775571671",
  appId: "1:435775571671:web:2409feb60354a4ab90d292",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance;

try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (_error) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
