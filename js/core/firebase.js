import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAC8wwZfufTvwW8e3kh1T_Zsdt0MhMzhiM",
  authDomain: "butulka-baku.firebaseapp.com",
  databaseURL: "https://butulka-baku-default-rtdb.firebaseio.com",
  projectId: "butulka-baku",
  storageBucket: "butulka-baku.firebasestorage.app",
  messagingSenderId: "798290035471",
  appId: "1:798290035471:web:62348a3b2e8e5cfeb6347a"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
