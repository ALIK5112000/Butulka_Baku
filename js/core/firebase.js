import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Real vaxt layihəsi (masa, chat, şüşə)
const realVaxtConfig = {
  apiKey: "AIzaSyAC8wwZfufTvwW8e3kh1T_Zsdt0MhMzhiM",
  authDomain: "butulka-baku.firebaseapp.com",
  databaseURL: "https://butulka-baku-default-rtdb.firebaseio.com",
  projectId: "butulka-baku",
  storageBucket: "butulka-baku.firebasestorage.app",
  messagingSenderId: "798290035471",
  appId: "1:798290035471:web:62348a3b2e8e5cfeb6347a"
};

// İstifadəçi bazası layihəsi (qeydiyyat, jeton, profil)
const istifadeciConfig = {
  apiKey: "AIzaSyAANVVrJKhZyaCErn8YFNVTUPF70A9xlmQ",
  authDomain: "butulka-baku-istifadeci-bazasi.firebaseapp.com",
  projectId: "butulka-baku-istifadeci-bazasi",
  storageBucket: "butulka-baku-istifadeci-bazasi.firebasestorage.app",
  messagingSenderId: "52438073026",
  appId: "1:52438073026:web:1c4a0a8d1fc1ce5f78455b"
};

const rtApp = initializeApp(realVaxtConfig, "realvaxt");
const userApp = initializeApp(istifadeciConfig, "istifadeci");

export const rtdb = getDatabase(rtApp);
export const fsdb = getFirestore(userApp);
