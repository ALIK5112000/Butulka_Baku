// masafon-baglanti.js — masafon.js-i Firebase v10 (modul) ilə bağlayır.
import { rtdb, fsdb } from "../core/firebase.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ====== BU 4 YERİ SƏNİN KODUNA UYĞUN DÜZƏLT ====== */
const GET_UID = () => window.menimUid;      // oyunçunun uid-i (tepik-baglanti.js-dəki kimi)
const GET_TABLE = () => window.masaId;      // hazırkı masanın id-si
const TABLE_SELECTOR = "#masa";             // fonun görünəcəyi element
const JETON_ALANI = "coins";                // Firestore-da jeton sahəsinin adı
/* ================================================= */

// masafon.js compat üslubunda yazılıb, ona görə kiçik adapter:
const rtdbShim = {
  ref(path) {
    const r = ref(rtdb, path);
    let un = null;
    return {
      on(_, cb) { un = onValue(r, (s) => cb({ val: () => s.val() })); },
      off() { if (un) { un(); un = null; } },
      set(v) { return set(r, v); }
    };
  }
};

const fsShim = {
  collection(c) {
    return {
      doc(id) {
        const d = doc(fsdb, c, id);
        return { _d: d, onSnapshot(cb) { return onSnapshot(d, cb); } };
      }
    };
  },
  runTransaction(fn) {
    return runTransaction(fsdb, (tx) =>
      fn({ get: (r) => tx.get(r._d), update: (r, u) => tx.update(r._d, u) })
    );
  }
};

MasaFon.init({
  rtdb: rtdbShim,
  fs: fsShim,
  getUid: GET_UID,
  getTableId: GET_TABLE,
  tableSelector: TABLE_SELECTOR,
  tokenField: JETON_ALANI,
  tablesPath: "masalar"      // RTDB-də masaların yolu; səndə fərqlidirsə dəyiş
});

// Oyunçu masa dəyişəndə fon dinləyicisi yenilənsin
setInterval(() => MasaFon.watchTable(), 1500);
