// Firebase qoşulması. Bütün səhifələr bura baxa bilər.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAANVVrJKhZyaCErn8YFNVTUPF70A9xlmQ",
  authDomain: "butulka-baku-istifadeci-bazasi.firebaseapp.com",
  projectId: "butulka-baku-istifadeci-bazasi",
  storageBucket: "butulka-baku-istifadeci-bazasi.firebasestorage.app",
  messagingSenderId: "52438073026",
  appId: "1:52438073026:web:1c4a0a8d1fc1ce5f78455b"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
