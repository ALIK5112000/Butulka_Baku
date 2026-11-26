// masafon-baglanti.js — masafon.js-i Firebase v10 (modul) ilə bağlayır.
import { rtdb, fsdb } from "../core/firebase.js";
import { cariOyuncu } from "./yardimci.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

if (!window.MasaFon) throw new Error("masafon.js tapılmadı. oyun.html-dəki yol ilə faylın yeri eyni olmalıdır");

/* ====== lazım olsa düzəlt ====== */
const GET_UID = () => (cariOyuncu() || {}).docId;                 // Firestore: users/{docId}
const GET_TABLE = () => { const n = document.getElementById("masaNo"); return n ? n.textContent.trim() : null; };
const TABLE_SELECTOR = "#taxta";                                  // taxta fonunun olduğu element
const TABLES_PATH = "masalar";                                    // RTDB-də masaların yolu
const JETON_ALANI = null;                                         // bilirsənsə yaz, yoxsa özü tapır
/* =============================== */

const ADAYLAR = ["jeton", "jetonlar", "jetons", "coins", "coin", "tokens", "token"];
const KEY = "__jeton";
let sahe = JETON_ALANI;
function tap(d) {
  if (sahe && d[sahe] !== undefined) return sahe;
  for (const k of ADAYLAR) if (d[k] !== undefined && d[k] !== null && isFinite(Number(d[k]))) { sahe = k; return k; }
  return null;
}
function norm(d) {
  d = d || {};
  const f = tap(d), o = Object.assign({}, d);
  o[KEY] = f ? Number(d[f]) || 0 : 0;
  return o;
}

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
  collection() {
    return {
      doc(id) {
        const d = doc(fsdb, "users", id);
        return { _d: d, onSnapshot(cb) { return onSnapshot(d, (s) => cb({ data: () => norm(s.data()) })); } };
      }
    };
  },
  runTransaction(fn) {
    return runTransaction(fsdb, (tx) =>
      fn({
        get: (r) => tx.get(r._d).then((s) => ({ data: () => norm(s.data()) })),
        update: (r, u) => {
          const o = Object.assign({}, u);
          if (KEY in o) {
            if (!sahe) throw new Error("Jeton sahəsi tapılmadı");
            o[sahe] = o[KEY];
            delete o[KEY];
          }
          tx.update(r._d, o);
        }
      })
    );
  }
};

MasaFon.init({
  rtdb: rtdbShim,
  fs: fsShim,
  getUid: GET_UID,
  getTableId: GET_TABLE,
  tableSelector: TABLE_SELECTOR,
  tokenField: KEY,
  tablesPath: TABLES_PATH
});

setInterval(() => MasaFon.watchTable(), 1500);
