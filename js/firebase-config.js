// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, orderBy, limit, onSnapshot,
  runTransaction, increment, serverTimestamp, arrayUnion, arrayRemove, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAANVVrJKhZyaCErn8YFNVTUPF70A9xlmQ",
  authDomain: "butulka-baku-istifadeci-bazasi.firebaseapp.com",
  projectId: "butulka-baku-istifadeci-bazasi",
  storageBucket: "butulka-baku-istifadeci-bazasi.firebasestorage.app",
  messagingSenderId: "52438073026",
  appId: "1:52438073026:web:1c4a0a8d1fc1ce5f78455b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, orderBy, limit, onSnapshot,
  runTransaction, increment, serverTimestamp, arrayUnion, arrayRemove, getDocs
};

// Ölkə bayraqları
export const COUNTRY_FLAGS = {
  "Azərbaycan": "🇦🇿",
  "Azerbaijan": "🇦🇿",
  "Türkiyə": "🇹🇷",
  "Turkey": "🇹🇷",
  "Rusiya": "🇷🇺",
  "Russia": "🇷🇺",
  "Gürcüstan": "🇬🇪",
  "Georgia": "🇬🇪",
  "Almaniya": "🇩🇪",
  "Ukrayna": "🇺🇦",
  "İran": "🇮🇷",
  "ABŞ": "🇺🇸",
  "İngiltərə": "🇬🇧"
};

// Giriş etmiş istifadəçinin sessiyasını oxuyur
export function getLocalSession() {
  try {
    const raw = localStorage.getItem("currentUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Mövcud istifadəçinin oyun sahələrini yoxlayır (yeni profillərdə hamısı 0 olur)
export async function ensureGameProfile(docId) {
  const userRef = doc(db, "users", docId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;

  const data = snap.data();
  const defaults = {};

  if (typeof data.hearts !== "number") defaults.hearts = 0;
  if (typeof data.jetons !== "number") defaults.jetons = 0;
  if (typeof data.smaylikBalance !== "number") defaults.smaylikBalance = 0;
  if (typeof data.kisses !== "number") defaults.kisses = 0;
  if (typeof data.musicPoints !== "number") defaults.musicPoints = 0;
  if (typeof data.smaylikPoints !== "number") defaults.smaylikPoints = 0;
  if (typeof data.singleHeartPoints !== "number") defaults.singleHeartPoints = 0;
  if (typeof data.doubleHeartPoints !== "number") defaults.doubleHeartPoints = 0;
  if (typeof data.admirerPrice !== "number") defaults.admirerPrice = 10;
  if (data.admirerDocId === undefined) defaults.admirerDocId = null;
  if (!Array.isArray(data.blockedUsers)) defaults.blockedUsers = [];
  if (!Array.isArray(data.recentTables)) defaults.recentTables = [];
  if (!Array.isArray(data.contacts)) defaults.contacts = [];
  if (typeof data.hourlyStep !== "number") defaults.hourlyStep = 0;
  if (typeof data.hourlySecondsLeft !== "number") defaults.hourlySecondsLeft = 3600;
  if (typeof data.blockedUntil !== "number") defaults.blockedUntil = 0;
  if (typeof data.mutedUntil !== "number") defaults.mutedUntil = 0;

  if (Object.keys(defaults).length > 0) {
    await updateDoc(userRef, defaults);
    return { docId, ...data, ...defaults };
  }
  return { docId, ...data };
}

// Oyunçunun VIP olub-olmadığını yoxlayır
export function isUserVip(user) {
  if (!user) return false;
  if (user.vipUntil && Number(user.vipUntil) > Date.now()) return true;
  return false;
}

// Yaşayış yeri və ölkə bayrağını göstərir
export function formatUserLocation(user) {
  if (!user) return "";
  const country = (user.country || "").trim();
  const city = String(user.city || "").trim();
  const flag = COUNTRY_FLAGS[country] || "";

  if (flag && city) return `${flag} ${city}`;
  if (flag) return `${flag} ${country}`;
  if (city) return city;
  return "";
}

