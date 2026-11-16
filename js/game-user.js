// İstifadəçi sessiyası və profil məlumatı (profile.html ilə eyni sistem)
import { db } from "./firebase-init.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function getSession() {
  try { return JSON.parse(localStorage.getItem("currentUser")); } catch (e) { return null; }
}

export function isVip(u) {
  return !!(u && u.vip && (!u.vipUntil || Number(u.vipUntil) > Date.now()));
}

export function isBlocked(u) {
  return !!(u && u.blockedUntil && Number(u.blockedUntil) > Date.now());
}

export function watchMe(docId, callback) {
  return onSnapshot(doc(db, "users", docId), s => callback(s.exists() ? s.data() : null));
}
