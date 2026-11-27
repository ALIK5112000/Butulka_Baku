import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, getDoc, onSnapshot, updateDoc, increment, runTransaction as fsRunTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue, set, update, remove, onDisconnect, runTransaction as rtTx } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { PREMIUM_HEDIYYELER, PREMIUM_AYAR, seviyye } from "./premium-hediyye.js";

/* ADDIM 3: Hədiyyə paneli. Başqa oyunçunun şəklinə toxunanda açılır.
   - Yalnız şəklə düşən hədiyyələrdən (g1 öpüş, g3 pomidor, g15 tac) biri profil şəklinə DÜŞƏNDƏ
     əvvəlki şəklə düşmüş hədiyyə tədricən (3 san) solub silinir.
   - Hər hansı pəncərə açılanda (Masanı dəyiş, Profil, Musiqi, Mağaza və s.) həm uçan, həm də
     şəklin üstündəki hədiyyələr pəncərənin üstündən görünmür.
   - Panelin iki bölməsi var: "Premium" (premium-hediyye.js faylından) və "Sadə" (musiqi + sadə hədiyyələr).
   - Sadə hədiyyənin üzərinə basıb saxlayanda hədiyyə davamlı göndərilir, əli çəkəndə dayanır.
     Bir-bir basanda neçə dəfə basılıbsa o qədər hədiyyə göndərilir.
   - TOPAZ (g22): uçuş və düşmə ölçüsü videodan ölçülərək bir-bir quraşdırılıb.
   - Topaz, öpüş və pomidor çoxlu atılanda hamısı şəkildə qalır, ən köhnədən başlayaraq sıra ilə tədricən solur,
     SON atılan qalır. Başqa növ hədiyyə düşəndə köhnə növ bir-bir solur, yeni növ qalır. */

/* ---------- AYARLAR ---------- */
const SEKIL_PAPKA = "images/hediyye/";
const SES_PAPKA = "sesler/";

/* Topaz (videodan ölçülüb): uçuş boyu ölçü sabit (1), son 30%-də yavaş-yavaş 0.8-ə qədər kiçilir və
   şəkildə o ölçüdə qalır. Ox: [uçuşun payı 0..1, ölçü əmsalı]. */
const TOPAZ_OLCU_EYRISI = [[0, .85], [.03, .97], [.05, 1], [.70, 1], [.735, .95], [.765, .93], [.80, .89],
                           [.83, .85], [.86, .84], [.89, .82], [.92, .815], [.95, .8], [1, .8]];
/* Topazın yerdəyişmə əyrisi (cubic-bezier): əvvəl sürətli, sonra yavaşlayır (videodakı kimi) */
const TOPAZ_EASE = [0.3, 0.5, 0.6, 1];
/* YIĞIM QAYDASI (topaz, öpüş, pomidor): atılan hədiyyələrin hamısı şəkildə qalır. Hər hədiyyə düşəndən
   QAL_OMUR ms sonra, ən köhnədən başlayaraq SIRAYLA (solmaların başlanğıcı arası ən azı QAL_ADDIM ms)
   QAL_SOLMA ms ərzində tədricən solur. SON atılan hədiyyə heç vaxt solmur (başqa növ hədiyyə düşənə qədər). */
const QAL_OMUR = 15000, QAL_SOLMA = 2500, QAL_ADDIM = 400;
/* Başqa növ hədiyyə düşəndə şəkildəki köhnə növün hədiyyələri (məs. topaz atılanda pomidor) ən köhnədən başlayaraq
   bir-bir solur, YENİ atılan növ qalır. Solmaların başlanğıcı arasında CAPRAZ_ADDIM ms (çox olsa CAPRAZ_PENCERE-yə sıxılır). */
const CAPRAZ_ADDIM = 600, CAPRAZ_PENCERE = 20000;

const SADE_HEDIYYELER = [
  { id: "g1",  e: "💋", img: SEKIL_PAPKA + "opus.png",    q: 1, opus: true, k: "ozel", s: SES_PAPKA + "kiss.mp3",   sl: SES_PAPKA + "kiss_dusme.mp3", ucusMs: 4900, yigim: true, qrup: "yuz", qal: true },
  { id: "g3",  e: "🍅", img: SEKIL_PAPKA + "pomidor.png", q: 1, k: "yeni",            s: SES_PAPKA + "tomato.mp3", sl: SES_PAPKA + "tomato_dusme.mp3", ucusMs: 5000, yapis: true, ucusAdi: true, qrup: "yuz", qal: true },
  { id: "g7",  e: "🐸", img: SEKIL_PAPKA + "qurbaga.png", q: 2 },
  { id: "g2",  e: "🍓", img: SEKIL_PAPKA + "cilek.png",   q: 1, k: "yeni" },
  { id: "g4",  e: "🪨", img: SEKIL_PAPKA + "dash.png",    q: 1 },
  { id: "g5",  e: "🌹", img: SEKIL_PAPKA + "gul.png",     q: 1, k: "ozel" },
  { id: "g6",  e: "🍬", img: SEKIL_PAPKA + "konfet.png",  q: 1 },
  { id: "g8",  e: "🐧", img: SEKIL_PAPKA + "pinqvin.png", q: 1 },
  { id: "g9",  e: "🐥", img: SEKIL_PAPKA + "cuce.png",    q: 1, k: "yeni" },
  { id: "g10", e: "🌷", img: SEKIL_PAPKA + "lale.png",    q: 1 },
  { id: "g11", e: "💐", img: SEKIL_PAPKA + "buket.png",   q: 2, k: "ozel" },
  { id: "g12", e: "🍫", img: SEKIL_PAPKA + "sokolad.png", q: 2 },
  { id: "g13", e: "🍷", img: SEKIL_PAPKA + "sarab.png",   q: 2 },
  { id: "g14", e: "💍", img: SEKIL_PAPKA + "uzuk.png",    q: 3, k: "ozel" },
  { id: "g15", e: "👑", img: SEKIL_PAPKA + "tac.png",     q: 3, k: "ozel",            s: SES_PAPKA + "crown.mp3",  sl: SES_PAPKA + "crown_dusme.mp3", ucusMs: 5000, tacUcus: true, yapis: true },
  { id: "g16", e: "🎩", img: SEKIL_PAPKA + "sapka.png",   q: 2 },
  { id: "g17", e: "🧸", img: SEKIL_PAPKA + "ayicik.png",  q: 3, k: "yeni" },
  { id: "g18", e: "🚗", img: SEKIL_PAPKA + "masin.png",   q: 5, k: "yeni" },
  { id: "g19", e: "💎", img: SEKIL_PAPKA + "almaz.png",   q: 5, k: "ozel" },
  { id: "g20", e: "🏰", img: SEKIL_PAPKA + "qala.png",    q: 9, k: "ozel" },
  { id: "g21", e: "🍸", img: SEKIL_PAPKA + "koktel.png",  q: 1, k: "yeni", s: SES_PAPKA + "cocktail.mp3", sl: SES_PAPKA + "cocktail_dusme.mp3", ucusMs: 5000, koktel: true, bonus: 1, solMs: 1950 },
  /* g22 topaz: paneldə 1 topaz görünür, hər toxunuşda fərqli forma + rəng göndərilir (variantlar).
     Videodakı kimi uçur/düşür (olcu, olcuEgri, ucusEase) və çoxlu göndəriləndə şəkildə qalıb sonra bir-bir yox olur (qal).
     Səs faylları: sesler/topaz.mp3 (göndərmə) və sesler/topaz_dusme.mp3 (düşmə) — adları sənin fayllarına görə dəyiş. */
  { id: "g22", e: "💎", img: SEKIL_PAPKA + "topaz_romb_firuze.png", q: 1, k: "yeni", ucusMs: 4900, yigim: true, qrup: "topaz",
    s: SES_PAPKA + "topaz.mp3", sl: SES_PAPKA + "topaz_dusme.mp3",
    olcu: 0.36, olcuEgri: TOPAZ_OLCU_EYRISI, ucusEase: TOPAZ_EASE, qal: true,
    variantlar: ["romb", "urek", "dair"].flatMap(f =>
      ["firuze", "pembe", "benovse", "yasil", "qirmizi", "mavi"].map(r => "topaz_" + f + "_" + r + ".png")) }
];

/* animasiya və göndərmə kodu hədiyyəni id ilə axtarır: sadə + premium hamısı bir siyahıda */
const HEDIYYELER = [...SADE_HEDIYYELER, ...PREMIUM_HEDIYYELER];

/* basıb saxlama: bu müddətdən uzun saxlasa davamlı göndərməyə başlayır, sonra hər ARALIQ ms-dən bir göndərir */
const BASMA_GECIKME = 300;
const BASMA_ARALIQ = 320;

const OTURAN_SEKIL = {
  g15: SEKIL_PAPKA + "tac2.png",
  g3: SEKIL_PAPKA + "pomidor_ezik.png"
};

const OPUS = { OLCU: 0.34, MAX: 1, SOLMA_MS: 3000 };
/* yığılan hədiyyənin uçuşdakı baza ölçüsü (şəkil enində pay) və düşəndən sonrakı son ölçü əmsalı */
const yigBaza = g => g.olcu || OPUS.OLCU;
const yigSon = g => g.olcuEgri ? g.olcuEgri[g.olcuEgri.length - 1][1] : 1;

const TAC_OLCU_EYRISI = [[0, 0.81], [0.014, 0.85], [0.024, 0.92], [0.044, 1], [1, 1]];
const TAC_ADDIM = 60;
function tacOlcu(u) {
  const e = TAC_OLCU_EYRISI;
  for (let i = 1; i < e.length; i++) {
    if (u <= e[i][0]) {
      const a = e[i - 1], b = e[i];
      return a[1] + (b[1] - a[1]) * ((u - a[0]) / ((b[0] - a[0]) || 1));
    }
  }
  return e[e.length - 1][1];
}
const KLIP_QIYMETI = 9, MAHNI_QIYMETI = 5;

const CSS = `
.hd-root{display:none}
.hd-root.open{display:block}
.hd-top{position:fixed;left:0;right:0;z-index:9990;background:#fff;display:flex;align-items:center;padding:0 3.9vw;box-sizing:border-box;font-family:Roboto,Arial,sans-serif}
.hd-av{width:7.4vw;height:7.4vw;border-radius:50%;background:#3b8fe0;border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.hd-av svg{width:4.4vw;height:4.4vw}
.hd-ttl{flex:1;margin-left:3.2vw;min-width:0}
.hd-ttl b{display:block;font:700 4.2vw/1.15 Roboto,Arial,sans-serif;color:#8a8a8a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hd-ttl span{display:block;font:400 3.5vw/1.15 Roboto,Arial,sans-serif;color:#b5b5b5}
.hd-plus{width:7.3vw;height:7.3vw;border-radius:50%;background:#7cc92f;border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.hd-plus svg{width:4.2vw;height:4.2vw}
.hd-main{position:fixed;left:0;right:0;bottom:0;z-index:9990;background:#fff;display:flex;flex-direction:column;font-family:Roboto,Arial,sans-serif}
.hd-ctl{background:#f3f0fa;padding:1.8vw 2.4vw 1.6vw;border-bottom:.3vw solid #e1dbf0}
.hd-r1{display:flex;justify-content:space-between;align-items:center}
.hd-seg{display:flex;border:.3vw solid #c9bfe6;border-radius:5vw;overflow:hidden;background:#fff}
.hd-seg button{border:0;background:none;padding:0 3.4vw;height:6.6vw;font:600 3.7vw/1 Roboto,Arial,sans-serif;color:#6c4fd6;border-left:.3vw solid #e1dbf0}
.hd-seg button:first-child{border-left:0}
.hd-seg button.on{background:#6c4fd6;color:#fff}
.hd-tabs{width:100%}
.hd-tabs button{flex:1}
.hd-pm-info{display:none;margin-top:1.8vw}
.hd-root.hd-prem .hd-pm-info{display:block}
.hd-root.hd-prem .hd-ctl{background:#fdf3dc;border-bottom-color:#f0dfb3}
.hd-pm-r1{display:flex;align-items:center;justify-content:flex-end;gap:1.4vw;font:600 3.8vw/1.2 Roboto,Arial,sans-serif;color:#6c4fd6}
.hd-pm-r1 svg{width:6vw;height:5.4vw;flex:none}
.hd-pm-r1 b{font-weight:700}
.hd-pm-r2{display:flex;align-items:center;gap:3vw;margin-top:1.6vw}
.hd-lv{flex:none;display:flex;align-items:center;gap:1.2vw;height:8vw;padding:0 3.4vw 0 2vw;border-radius:4vw;background:#7a5a3a;color:#fff;font:700 4vw/1 Roboto,Arial,sans-serif}
.hd-lv svg{width:4.4vw;height:4.4vw}
.hd-pm-nx{flex:1;min-width:0}
.hd-pm-nx div{display:flex;align-items:center;gap:1.2vw;font:700 4vw/1.2 Roboto,Arial,sans-serif;color:#5a3d1a}
.hd-pm-nx svg{width:5vw;height:4.6vw}
.hd-bar{height:2.4vw;border-radius:1.2vw;background:#e7dcc3;margin-top:1.2vw;overflow:hidden}
.hd-bar i{display:block;height:100%;width:0;border-radius:1.2vw;background:linear-gradient(90deg,#ff9a3d,#ff4f8b,#8b5cf6);transition:width .4s}
.hd-pv{position:fixed;left:0;right:0;bottom:0;z-index:9995;pointer-events:none;background:#000;overflow:hidden;opacity:0;transition:opacity .25s}
.hd-pv.on{opacity:1}
.hd-pv video{width:100%;height:100%;object-fit:cover;object-position:45% 50%;display:block}
.hd-pv-b{position:absolute;left:4vw;right:4vw;top:3vw;padding:2.2vw 3vw;border-radius:4vw;background:linear-gradient(#ffe29a,#f5b94c);color:#4a2b00;text-align:center;font:700 3.7vw/1.3 Roboto,Arial,sans-serif;box-shadow:0 .6vw 2vw rgba(0,0,0,.35)}
.hd-pv-b small{display:block;font:600 3.1vw/1.25 Roboto,Arial,sans-serif}
.hd-pv-b svg{width:3.8vw;height:3.5vw;vertical-align:-.5vw}
.hd-list{flex:1;overflow-y:auto;padding:1vw 0 22vw}
.hd-grid{display:grid;grid-template-columns:repeat(5,1fr)}
.hd-bos{grid-column:1/-1;text-align:center;padding:10vw 4vw;color:#9a9a9a;font:500 4vw/1.3 Roboto,Arial,sans-serif}
.hd-cell{display:flex;flex-direction:column;align-items:center;padding:2.4vw 0 2.4vw;border-radius:2vw;margin:.4vw;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.hd-cell:active{background:#efe9ff}
.hd-e{width:15vw;height:14vw;display:flex;align-items:center;justify-content:center;font-size:11.5vw;line-height:1}
.hd-e img{max-width:14vw;max-height:13vw;width:auto;height:auto;object-fit:contain;display:block;pointer-events:none;-webkit-user-drag:none}
.hd-pr{display:flex;align-items:center;gap:1.2vw;margin-top:1.4vw;font:700 4.4vw/1 Roboto,Arial,sans-serif;color:#333}
.hd-pr svg{width:5.2vw;height:5vw}
.hd-x{position:fixed;right:2vw;bottom:2.1vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#7cc92f;border:0;padding:0;z-index:9991;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3)}
.hd-x svg{width:4.4vw;height:4.4vw}
.hd-tray{position:fixed;right:3.9vw;z-index:9992;display:none;gap:2.4vw;padding:1.6vw 2vw;background:#fff;border-radius:6vw;box-shadow:0 .6vw 2.4vw rgba(0,0,0,.3)}
.hd-tray.open{display:flex}
.hd-tray button{width:10vw;height:10vw;border-radius:50%;border:0;padding:0;display:flex;align-items:center;justify-content:center;font-size:6vw;line-height:1;color:#fff}
.hd-tb{background:#3b8fe0}.hd-tg{background:#f26aa6}.hd-tx{background:#e03d1c;font:700 5vw/1 Roboto,Arial,sans-serif}
.yer.hd-mk .foto{outline:.9vw solid #7cc92f;outline-offset:.2vw;box-shadow:0 0 3vw #7cc92f}
.hd-t{position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);max-width:80vw;text-align:center;z-index:20000;background:rgba(35,35,35,.92);color:#fff;font:500 3.5vw/1.3 Roboto,Arial,sans-serif;padding:2.6vw 4.6vw;border-radius:3vw}
.hd-fxLayer{position:fixed;left:0;top:0;width:0;height:0;z-index:120;pointer-events:none}
.hd-fly{position:fixed;pointer-events:none;line-height:1;will-change:transform,opacity;font-size:11vw}
.hd-fly img{height:1em;width:auto;display:block}
.hd-fly i{position:absolute;right:-3vw;bottom:-2vw;font:700 4vw/1 Roboto,Arial,sans-serif;font-style:normal;color:#fff;background:#6c4fd6;border-radius:3vw;padding:.8vw 1.8vw}
.hd-stkLayer{position:fixed;left:0;top:0;width:0;height:0;z-index:110;pointer-events:none}
.hd-stk{position:fixed;pointer-events:none;line-height:1;will-change:transform;filter:drop-shadow(0 .5vw 1vw rgba(0,0,0,.35))}
.hd-stk img{height:1em;width:auto;display:block}
.hd-stk.hd-nosh{filter:none}
.hd-spark{position:fixed;pointer-events:none;font-size:3.8vw;line-height:1;margin:-1.9vw 0 0 -1.9vw}
.hd-yf{position:fixed;pointer-events:none;will-change:transform}
.hd-yf-r,.hd-yf-s{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;line-height:1;will-change:transform}
.hd-yf img,.hd-yig img{width:100%;height:100%;object-fit:contain;display:block}
.hd-yf i{position:absolute;right:-3vw;bottom:-2vw;font:700 4vw/1 Roboto,Arial,sans-serif;font-style:normal;color:#fff;background:#6c4fd6;border-radius:3vw;padding:.8vw 1.8vw}
.hd-yigQat{position:fixed;left:0;top:0;width:0;height:0;z-index:110;pointer-events:none}
.hd-yig{position:fixed;pointer-events:none;display:flex;align-items:center;justify-content:center;line-height:1;will-change:transform,opacity}
/* "Musiqi qoy" rejimi: yalnız klip və mahnı stikerləri, sadə başlıq (profil kartındakı musiqi düyməsindən açılır) */
.hd-root.hd-musiqi .hd-av,.hd-root.hd-musiqi .hd-plus,.hd-root.hd-musiqi .hd-ctl,.hd-root.hd-musiqi .hd-tray{display:none!important}
.hd-root.hd-musiqi .hd-ttl{margin-left:0}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const UREK = '<svg viewBox="0 0 24 22"><path d="M12 21C5 16 1 12 1 7.2A5.2 5.2 0 0 1 12 4.5 5.2 5.2 0 0 1 23 7.2C23 12 19 16 12 21z" fill="#dc5a22"/></svg>';

const GEM = '<svg viewBox="0 0 24 22"><path d="M6 1h12l5 6-11 14L1 7z" fill="#3aa0ff"/><path d="M1 7h22M6 1l3 6 3 14M18 1l-3 6-3 14M9 7h6" fill="none" stroke="#bfe3ff" stroke-width="1"/></svg>';
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#ffd54a"/></svg>';
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const gorsel = g => g.img
  ? '<img src="' + g.img + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + g.e + '\'))">'
  : g.e;

function gorselStk(g) {
  const src = OTURAN_SEKIL[g.id];
  if (!src) return gorsel(g);
  return '<img src="' + src + '" alt="" onerror="this.onerror=function(){this.replaceWith(document.createTextNode(\'' + g.e + '\'))};this.src=\'' + g.img + '\'">';
}

/* variantlı hədiyyə (topaz): v = variantlar siyahısındakı sıra nömrəsi; yoxdursa adi şəkil */
const gorselV = (g, v) => (g.variantlar && v != null && g.variantlar[v])
  ? gorsel({ img: SEKIL_PAPKA + g.variantlar[v], e: g.e })
  : gorsel(g);

const num = v => Number(v) || 0;
const MEN = (cariOyuncu() || {}).docId || null;

/* ---------- 30 günlük reytinq dondurma qoruyucusu ("kiss" | "music") ---------- */
const FREEZE_MAP = {
  kiss: { freeze: "freeze_kisses", saved: "saved_kisses", stat: "kisses" },
  music: { freeze: "freeze_music", saved: "saved_music", stat: "music" }
};

async function reytinqArtir(uid, tip, delta) {
  if (!uid || !delta || delta <= 0) return;
  const cfg = FREEZE_MAP[tip];
  if (!cfg) return;
  const uRef = doc(fsdb, "users", uid);
  try {
    await fsRunTransaction(fsdb, async (tx) => {
      const snap = await tx.get(uRef);
      if (!snap.exists()) return;
      const d = snap.data() || {};
      const now = Date.now() + offset;
      const fUntil = num(d[cfg.freeze]);
      const curStat = num(d[cfg.stat]);
      const savedStat = num(d[cfg.saved]);

      if (fUntil > now) {
        /* 30 günlük dondurma aktivdir: reytinq xalı artmasın və 0 qalsın */
        if (curStat !== 0) tx.update(uRef, { [cfg.stat]: 0 });
        return;
      }

      if (fUntil > 0 && fUntil <= now) {
        /* 30 gün bitibsə köhnə xalı bərpa et və yeni artımı əlavə et */
        tx.update(uRef, {
          [cfg.stat]: savedStat + delta,
          [cfg.freeze]: 0,
          [cfg.saved]: 0
        });
        return;
      }

      tx.update(uRef, { [cfg.stat]: curStat + delta });
    });
  } catch (e) {
    console.error("Reytinq artım xətası:", e);
  }
}

/* Əgər kənar kod window.Xallar.musiqiHediyye çağırırsa, dondurulmuş oyunçunun music xalını blokla */
(function qoruMusiqiHediyye() {
  const bagla = () => {
    if (!window.Xallar || typeof window.Xallar.musiqiHediyye !== "function" || window.Xallar.musiqiHediyye.__qorunub) return;
    const evvel = window.Xallar.musiqiHediyye;
    const yeni = async function(uid, say) {
      if (!uid) return;
      const snap = await getDoc(doc(fsdb, "users", uid)).catch(() => null);
      const d = snap && snap.exists() ? (snap.data() || {}) : {};
      const fUntil = num(d.freeze_music);
      const now = Date.now() + offset;
      if (fUntil > now) {
        if (num(d.music) !== 0) updateDoc(doc(fsdb, "users", uid), { music: 0 }).catch(() => {});
        return;
      }
      return evvel.apply(this, arguments);
    };
    yeni.__qorunub = true;
    window.Xallar.musiqiHediyye = yeni;
  };
  bagla();
  setInterval(bagla, 1000);
})();

let fxQat = null;
function fxLayer() {
  if (!fxQat) {
    fxQat = document.createElement("div");
    fxQat.className = "hd-fxLayer";
    (document.getElementById("masa") || document.body).appendChild(fxQat);
    qatTransformUygula();
  }
  return fxQat;
}

let kalProbe = null, kalIter = 0, kalAx = 0, kalAy = 0, kalKx = 1, kalKy = 1, kalT = "";
function qatTransformUygula() {
  for (const L of [fxQat, yigQat]) {
    if (!L) continue;
    L.style.transformOrigin = "0 0";
    L.style.transform = kalT;
  }
}
function qatKalibrle() {
  const L = yigQat || fxQat;
  if (!L) return;
  if (!kalProbe || kalProbe.parentNode !== L) {
    if (kalProbe) kalProbe.remove();
    kalProbe = document.createElement("div");
    kalProbe.style.cssText = "position:fixed;left:0;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none";
    L.appendChild(kalProbe);
  }
  const q = kalProbe.getBoundingClientRect();
  const sx = q.width / 100, sy = q.height / 100;
  if (!(sx > 0.2 && sy > 0.2) || !isFinite(sx + sy + q.left + q.top)) return;
  if (Math.abs(q.left) < 0.5 && Math.abs(q.top) < 0.5 && Math.abs(sx - 1) < 0.003 && Math.abs(sy - 1) < 0.003) { kalIter = 0; return; }
  if (++kalIter > 40) return;
  kalAx -= q.left * kalKx / sx; kalAy -= q.top * kalKy / sy;
  kalKx /= sx; kalKy /= sy;
  kalT = "translate(" + kalAx + "px," + kalAy + "px) scale(" + kalKx + "," + kalKy + ")";
  qatTransformUygula();
  dbg("qat kalibri: sol=" + q.left.toFixed(1) + " yuxarı=" + q.top.toFixed(1) + " miqyas=" + sx.toFixed(3) + "/" + sy.toFixed(3));
}
window.addEventListener("resize", () => { kalIter = 0; });

let kalPanelEl = null, kalPanelN = 0;
function kalPanel() {
  if (!HD_DEBUG || ++kalPanelN % 15) return;
  if (!kalPanelEl) {
    kalPanelEl = document.createElement("div");
    kalPanelEl.style.cssText = "position:fixed;left:1vw;bottom:1vw;z-index:20001;max-width:96vw;pointer-events:none;font:600 2.6vw/1.25 monospace;color:#fff;background:rgba(0,0,0,.75);padding:.8vw 1.4vw;border-radius:1.2vw";
    document.body.appendChild(kalPanelEl);
  }
  const f = document.querySelector("#masa .yer .foto");
  const r = f && f.getBoundingClientRect();
  kalPanelEl.textContent = "kal a=" + kalAx.toFixed(1) + "," + kalAy.toFixed(1) + " k=" + kalKx.toFixed(3) + "," + kalKy.toFixed(3) +
    " it=" + kalIter + (r ? " | foto " + [r.left, r.top, r.width].map(v => Math.round(v)).join(",") : "") + " | vw=" + innerWidth + "x" + innerHeight +
    " vv=" + (window.visualViewport ? window.visualViewport.scale.toFixed(2) : "-");
}

function pencereAciqdir() {
  const my = document.getElementById("modalYer");
  if (my && getComputedStyle(my).display !== "none" && my.offsetWidth > 0) return true;
  const kp = document.getElementById("klipPenceresi");
  if (kp && !kp.hidden && getComputedStyle(kp).display !== "none") return true;
  const diger = document.querySelectorAll(".modal, .pencere, .overlay, [role='dialog'], [id$='Penceresi'], [id$='Modal'], [id*='modal'], [id*='Modal']");
  for (const el of diger) {
    if (el.id === "hdToast" || el.id === "hdDbg") continue;
    const cs = getComputedStyle(el);
    if (!el.hidden && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && el.offsetWidth > 0 && el.offsetHeight > 0) return true;
  }
  return false;
}

let gizliKes = false;
function qatGorunurlukYenile() {
  const gizli = pencereAciqdir();
  gizliKes = gizli;
  const d = gizli ? "none" : "block";
  if (fxQat) fxQat.style.display = d;
  if (yigQat) yigQat.style.display = d;
  return gizli;
}
setInterval(qatGorunurlukYenile, 80);

let tT = null;
function toast(msg) {
  let t = document.getElementById("hdToast");
  if (!t) { t = document.createElement("div"); t.id = "hdToast"; t.className = "hd-t"; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(tT); tT = setTimeout(() => { t.style.display = "none"; }, 2600);
}

const HD_DEBUG = false;
function dbg(m) {
  if (!HD_DEBUG) return;
  console.log("[hediyye]", m);
  let b = document.getElementById("hdDbg");
  if (!b) {
    b = document.createElement("div"); b.id = "hdDbg";
    b.style.cssText = "position:fixed;left:1vw;top:13vw;z-index:20001;max-width:74vw;pointer-events:none;font:600 2.9vw/1.25 monospace;color:#fff;background:rgba(0,0,0,.75);padding:1vw 1.6vw;border-radius:1.4vw;display:none";
    document.body.appendChild(b);
  }
  const l = document.createElement("div"); l.textContent = m; b.appendChild(l); b.style.display = "block";
  while (b.childNodes.length > 8) b.removeChild(b.firstChild);
  setTimeout(() => { l.remove(); if (!b.childNodes.length) b.style.display = "none"; }, 9000);
}

/* ---------- Səs ---------- */
const sesKes = {};
function sesCal(url) {
  if (!url) return;
  try {
    const a = sesKes[url] || (sesKes[url] = new Audio(url));
    const c = a.cloneNode();
    const pr = c.play();
    if (pr && pr.then) pr.then(() => dbg("səs çalır: " + url)).catch(e => dbg("SƏS XƏTASI: " + url + " → " + e.name));
  } catch (e) { dbg("SƏS XƏTASI: " + url + " → " + e.name); }
}

/* ---------- Panel ---------- */
const root = document.createElement("div");
root.className = "hd-root";
root.innerHTML =
  '<div class="hd-top"><button class="hd-av" aria-label="Profil"><svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c0-4.6 3.8-7 8.5-7s8.5 2.4 8.5 7z"/></svg></button>' +
    '<div class="hd-ttl"><b id="hdAd">...</b><span id="hdSub">üçün hədiyyə göndər</span></div>' +
    '<button class="hd-plus" aria-label="Bonus ürək al"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg></button></div>' +
  '<div class="hd-main"><div class="hd-ctl">' +
    '<div class="hd-r1"><div class="hd-seg hd-tabs"><button data-k="premium">Premium</button><button data-k="sade" class="on">Sadə</button></div></div>' +
    '<div class="hd-pm-info">' +
      '<div class="hd-pm-r1">' + GEM + '<b id="hdJeton">…</b><span>· alıcı qiymətin yarısını jeton kimi alır</span></div>' +
      '<div class="hd-pm-r2"><div class="hd-lv">' + STAR + '<span id="hdLv">1</span></div>' +
        '<div class="hd-pm-nx"><div><span id="hdNx"></span><span id="hdNxG">' + GEM + '</span></div><div class="hd-bar"><i id="hdBarI"></i></div></div></div>' +
    '</div>' +
  '</div><div class="hd-list"><div class="hd-grid"></div></div></div>' +
  '<div class="hd-tray"><button class="hd-tb" aria-label="Oğlanlar">👦</button><button class="hd-tg" aria-label="Qızlar">👧</button><button class="hd-tx" aria-label="Seçimi dayandır">✕</button></div>' +
  '<button class="hd-x" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg></button>';
document.body.appendChild(root);

const $ = s => root.querySelector(s);
const grid = $(".hd-grid");
let hedef = null, hedefAd = "...", tab = "sade", uUnsub = null, musiqiModu = false;
const isaret = new Set();
const tray = $(".hd-tray");

/* hədiyyənin göndəriləcəyi oyunçular: seçilmişlər varsa onlar, yoxsa paneli açdığım oyunçu */
function alicilar() {
  return isaret.size ? [...isaret].filter(u => u !== MEN) : (hedef ? [hedef] : []);
}

/* ---------- Basıb saxlama (sadə hədiyyələr) ----------
   Bir-bir basanda: hər basış 1 hədiyyə göndərir (neçə dəfə basılıbsa o qədər).
   Basıb saxlayanda: BASMA_GECIKME-dən sonra davamlı göndərir, əl çəkiləndə dayanır.
   Barmaq sürüşdürüb siyahını fırladanda (pointercancel) heç nə göndərilmir. */
let basma = null;
function basmaBitir(tekGonder) {
  const b = basma;
  if (!b) return;
  basma = null;
  clearTimeout(b.t);
  clearInterval(b.iv);
  window.removeEventListener("pointerup", b.up);
  window.removeEventListener("pointercancel", b.cancel);
  if (tekGonder && !b.davam) gonder(b.g, 1, b.alanlar);
}
function basmaBasla(e, g) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  basmaBitir(false);
  const alanlar = alicilar();
  const b = { g, alanlar, davam: false, t: 0, iv: 0, up: null, cancel: null };
  b.up = () => basmaBitir(true);
  b.cancel = () => basmaBitir(false);
  b.t = setTimeout(() => {
    b.davam = true;
    if (!gonder(g, 1, alanlar)) { basmaBitir(false); return; }
    b.iv = setInterval(() => { if (!gonder(g, 1, alanlar)) basmaBitir(false); }, BASMA_ARALIQ);
  }, BASMA_GECIKME);
  window.addEventListener("pointerup", b.up);
  window.addEventListener("pointercancel", b.cancel);
  basma = b;
}

function ciz() {
  basmaBitir(false);
  root.classList.toggle("hd-prem", tab === "premium" && !musiqiModu);
  premiumInfoYenile();
  grid.innerHTML = "";
  if (tab === "sade" || musiqiModu) {
    const musiqiKafel = (img, emoji, qiymet, ac) => {
      const m = document.createElement("div");
      m.className = "hd-cell";
      m.innerHTML = '<div class="hd-e">' + gorsel({ img, e: emoji }) + '</div><div class="hd-pr">' + UREK + qiymet + "</div>";
      m.onclick = ac;
      grid.appendChild(m);
    };
    musiqiKafel(SEKIL_PAPKA + "klip.png", "🎬", KLIP_QIYMETI, () => {
      const kimin = hedef;
      bagla();
      const bt = document.getElementById("musiqiBtn1");
      if (!bt) { if (window.MusiqiPanel) window.MusiqiPanel.open("popular"); return; }
      window.__klipHedef = (kimin && kimin !== MEN) ? kimin : null;
      bt.click();
      klipHedefIzle();
    });
    musiqiKafel(SEKIL_PAPKA + "mahni.png", "🎵", MAHNI_QIYMETI, () => {
      const kimin = hedef;
      bagla();
      const bt = document.getElementById("musiqiBtn2");
      window.__klipHedef = (kimin && kimin !== MEN) ? kimin : null;
      if (bt) { bt.click(); klipHedefIzle(); }
      else if (window.MusiqiPanel) window.MusiqiPanel.open("popular");
    });
  }
  /* "Musiqi qoy" rejimində hədiyyələr göstərilmir, yalnız klip və mahnı */
  if (musiqiModu) return;

  if (tab === "premium") {
    /* premium hədiyyələr premium-hediyye.js faylındadır; bir toxunuş = bir hədiyyə */
    if (!PREMIUM_HEDIYYELER.length) {
      const b = document.createElement("div");
      b.className = "hd-bos";
      b.textContent = "Premium hədiyyələr tezliklə əlavə olunacaq";
      grid.appendChild(b);
      return;
    }
    PREMIUM_HEDIYYELER.forEach(g => {
      const c = document.createElement("div");
      c.className = "hd-cell";
      c.innerHTML = '<div class="hd-e">' + gorsel(g) + '</div><div class="hd-pr">' + GEM + g.q + "</div>";
      c.onclick = () => { gonderPremium(g); };
      grid.appendChild(c);
    });
    return;
  }

  /* "Sadə" bölməsi: basıb saxlayanda davamlı, bir-bir basanda hər basışa 1 hədiyyə */
  SADE_HEDIYYELER.forEach(g => {
    const c = document.createElement("div");
    c.className = "hd-cell";
    c.innerHTML = '<div class="hd-e">' + gorsel(g) + '</div><div class="hd-pr">' + UREK + g.q + "</div>";
    c.addEventListener("pointerdown", e => basmaBasla(e, g));
    c.addEventListener("contextmenu", e => e.preventDefault());
    grid.appendChild(c);
  });
}

root.querySelectorAll(".hd-tabs button").forEach(b => b.onclick = () => {
  tab = b.dataset.k;
  root.querySelectorAll(".hd-tabs button").forEach(x => x.classList.toggle("on", x === b));
  ciz();
});

function klipHedefIzle() {
  const pen = document.getElementById("klipPenceresi");
  if (!pen) { setTimeout(() => { window.__klipHedef = null; }, 120000); return; }
  const mo = new MutationObserver(() => { if (pen.hidden) { mo.disconnect(); setTimeout(() => { window.__klipHedef = null; }, 10000); } });
  mo.observe(pen, { attributes: true, attributeFilter: ["hidden"] });
}

function yerlesdir() {
  const u = document.getElementById("ustPanel"), c = document.getElementById("chatYeri");
  const ur = u ? u.getBoundingClientRect() : null, cr = c ? c.getBoundingClientRect() : null;
  const top = $(".hd-top"), main = $(".hd-main");
  top.style.top = (ur && ur.height > 0 ? ur.top : 0) + "px";
  top.style.height = (ur && ur.height > 0 ? ur.height : innerWidth * 0.124) + "px";
  main.style.top = (cr && cr.height > 0 ? cr.top : innerHeight * 0.55) + "px";
  tray.style.top = ((ur && ur.height > 0 ? ur.bottom : innerWidth * 0.124) + innerWidth * 0.01) + "px";
}
window.addEventListener("resize", () => { if (root.classList.contains("open")) yerlesdir(); });

/* musiqi=true: "Musiqi qoy" rejimi (yalnız klip + mahnı, həmin oyunçu adına). Öz kartından açılanda adına qoşulmur. */
function ac(uid, musiqi) {
  if (!uid || (uid === MEN && !musiqi)) return;
  const my = document.getElementById("modalYer");
  if (my && getComputedStyle(my).display !== "none") return;
  if (uUnsub) { uUnsub(); uUnsub = null; }
  if (!root.classList.contains("open")) { isaret.clear(); tray.classList.remove("open"); }
  if (musiqi) { isaret.clear(); tray.classList.remove("open"); }
  musiqiModu = !!musiqi;
  root.classList.toggle("hd-musiqi", musiqiModu);
  hedef = uid;
  hedefAd = "..."; basliq();
  uUnsub = onSnapshot(doc(fsdb, "users", uid), s => { hedefAd = (s.data() || {}).username || "Oyunçu"; basliq(); }, () => {});
  yerlesdir(); ciz();
  root.classList.add("open");
}
function bagla() {
  basmaBitir(false);
  root.classList.remove("open");
  root.classList.remove("hd-musiqi");
  musiqiModu = false;
  if (uUnsub) { uUnsub(); uUnsub = null; }
  hedef = null;
  isaret.clear(); tray.classList.remove("open"); markYenile();
}
$(".hd-x").onclick = bagla;
$(".hd-av").onclick = () => { if (hedef && window.ProfilKart) window.ProfilKart.ac(hedef); };
$(".hd-plus").onclick = () => tray.classList.toggle("open");

function basliq() {
  if (musiqiModu) {
    $("#hdAd").textContent = "Musiqi qoy";
    $("#hdSub").textContent = (hedef && hedef !== MEN) ? hedefAd + " adına" : "";
    return;
  }
  if (isaret.size) { $("#hdAd").textContent = "Seçilmiş: " + isaret.size; $("#hdSub").textContent = "oyunçuya hədiyyə göndər"; }
  else { $("#hdAd").textContent = hedefAd; $("#hdSub").textContent = "üçün hədiyyə göndər"; }
}
function markYenile() {
  for (const u of [...isaret]) if (!Object.values(oturacaqlar).some(o => o && o.uid === u)) isaret.delete(u);
  const var_ = new Set();
  for (const k in oturacaqlar) { const o = oturacaqlar[k]; if (o && isaret.has(o.uid)) var_.add(k); }
  document.querySelectorAll("#masa .yer").forEach(el => {
    const m = /yer-(\d+)/.exec(el.className);
    el.classList.toggle("hd-mk", !!(m && var_.has(m[1])));
  });
  basliq();
}
setInterval(markYenile, 400);
function isaretle(uid) {
  if (!uid || uid === MEN) return;
  if (isaret.has(uid)) isaret.delete(uid); else isaret.add(uid);
  markYenile();
}
function toplu(qiz) {
  const l = [];
  for (const k in oturacaqlar) { const o = oturacaqlar[k]; if (o && o.uid && o.uid !== MEN && (o.cins === "q") === qiz) l.push(o.uid); }
  if (!l.length) { toast(qiz ? "Masada qız yoxdur" : "Masada oğlan yoxdur"); return; }
  const hamisi = l.every(u => isaret.has(u));
  l.forEach(u => (hamisi ? isaret.delete(u) : isaret.add(u)));
  markYenile();
}
$(".hd-tg").onclick = () => toplu(true);
$(".hd-tb").onclick = () => toplu(false);
$(".hd-tx").onclick = () => { isaret.clear(); tray.classList.remove("open"); markYenile(); };

window.HediyyePanel = { ac, bagla, hedef: () => hedef, modu: () => root.classList.contains("open") && tray.classList.contains("open"), isaretle, acMusiqi: uid => ac(uid, true) };

const YAP_YOL = "masalar/" + MASA_NOMRESI + "/hediyyeYapisan/";
const YIG_YOL = "masalar/" + MASA_NOMRESI + "/yigim/";

const GORULME_KEY = "hdSon_" + MASA_NOMRESI + "_" + MEN;
const GORULME_TOLER = 4000;
function gorulmeYaz() { try { localStorage.setItem(GORULME_KEY, String(Date.now())); } catch (e) {} }
if (MEN) {
  let sonGorulme = 0;
  try { sonGorulme = Number(localStorage.getItem(GORULME_KEY)) || 0; } catch (e) {}
  if (!sonGorulme || Date.now() - sonGorulme > GORULME_TOLER) {
    remove(ref(rtdb, YAP_YOL + MEN)).catch(() => {});
    remove(ref(rtdb, YIG_YOL + MEN)).catch(() => {});
  }
  gorulmeYaz();
  setInterval(gorulmeYaz, 1000);
  addEventListener("pagehide", gorulmeYaz);
  document.addEventListener("visibilitychange", gorulmeYaz);
}

let oturacaqlar = {}, spin = null, offset = 0, aktivKlip = null;
const evvelkiYer = {};
const silmeTaymer = {};

onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => {
  oturacaqlar = s.val() || {};
  const indikiYer = {};
  for (const k in oturacaqlar) {
    const o = oturacaqlar[k];
    if (o && o.uid) indikiYer[o.uid] = k;
  }

  for (const uid in indikiYer) {
    if (silmeTaymer[uid] && evvelkiYer[uid] === indikiYer[uid]) {
      clearTimeout(silmeTaymer[uid]);
      delete silmeTaymer[uid];
    }
  }

  for (const uid in evvelkiYer) {
    const kohne = evvelkiYer[uid];
    const yeni = indikiYer[uid];

    if (yeni && yeni !== kohne) {
      if (silmeTaymer[uid]) { clearTimeout(silmeTaymer[uid]); delete silmeTaymer[uid]; }
      remove(ref(rtdb, YAP_YOL + uid)).catch(() => {});
      remove(ref(rtdb, YIG_YOL + uid)).catch(() => {});
      evvelkiYer[uid] = yeni;
    } else if (!yeni && !silmeTaymer[uid]) {
      silmeTaymer[uid] = setTimeout(() => {
        delete silmeTaymer[uid];
        if (!indikiYer[uid]) {
          remove(ref(rtdb, YAP_YOL + uid)).catch(() => {});
          remove(ref(rtdb, YIG_YOL + uid)).catch(() => {});
          delete evvelkiYer[uid];
        }
      }, 3500);
    }
  }

  for (const uid in indikiYer) {
    if (!evvelkiYer[uid]) evvelkiYer[uid] = indikiYer[uid];
  }
});

onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/raund/spin"), s => { spin = s.val() || null; });
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/aktivKlip"), s => { aktivKlip = s.val() || null; });
onValue(ref(rtdb, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });

function djUid() {
  const d = aktivKlip;
  if (!d || !d.djUid) return null;
  const bas = num(d.startedAt), dur = num(d.durationSec);
  if (bas && dur && Date.now() + offset > bas + dur * 1000 + 3000) return null;
  return d.djUid;
}

let meHearts = null, meJeton = null, meXerc = null;
if (MEN) onSnapshot(doc(fsdb, "users", MEN), s => {
  const d = s.data() || {};
  meHearts = num(d.hearts);
  meJeton = num(d[PREMIUM_AYAR.jetonSahesi]);
  meXerc = num(d[PREMIUM_AYAR.xercSahesi]);
  premiumInfoYenile();
}, () => {});

/* Premium paneli: jeton balansı + səviyyə (yalnız Premium bölməsində görünür) */
function premiumInfoYenile() {
  const j = $("#hdJeton");
  if (!j) return;
  const sv = seviyye(meXerc || 0);
  j.textContent = meJeton === null ? "…" : meJeton;
  $("#hdLv").textContent = sv.no;
  $("#hdNx").textContent = sv.max ? "Maksimum səviyyə" : "Növbəti səviyyəyə " + sv.qalan;
  $("#hdNxG").style.display = sv.max ? "none" : "inline-flex";
  $("#hdBarI").style.width = sv.faiz + "%";
}

/* topaz: hər göndərişdə əvvəlkindən fərqli variant (forma + rəng) seçilir */
let sonTopaz = -1;
function topazSec(n) {
  let v;
  do { v = Math.floor(Math.random() * n); } while (n > 1 && v === sonTopaz);
  sonTopaz = v;
  return v;
}

/* alici: göndəriləcək oyunçular (verilməsə alicilar()). Göndərilibsə true, göndərilməyibsə false qaytarır
   (davamlı göndərmə false gələndə dayanır). */
function gonder(g, c, alici) {
  if (!MEN) { dbg("MEN yoxdur: cariOyuncu() boşdur, hədiyyə göndərilmir"); return false; }
  const alanlar = (alici || alicilar()).filter(u => u !== MEN);
  if (!alanlar.length) { toast("Oyunçu seçilməyib"); return false; }
  const cost = g.q * c * alanlar.length;
  dbg("göndərilir: " + g.id);

  if (meHearts !== null && meHearts < cost) { toast("Bonus ürəyiniz çatmır"); if (window.HeartShop) window.HeartShop.open(); return false; }
  if (meHearts !== null) meHearts -= cost;

  const odenis = updateDoc(doc(fsdb, "users", MEN), { hearts: increment(-cost) });

  const n = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const payload = { to: alanlar, i: g.id, c, n };
  const t = Date.now() + offset;
  const ucusSuresi = g.ucusMs || 900;
  const dusmeVaxti = t + ucusSuresi;
  const yigUpd = {};
  let yigVar = false;

  const sekileOturur = !!(g.yapis || g.yigim || g.koktel);

  if (sekileOturur) {
    const p = {};
    alanlar.forEach(k => {
      const q = g.koktel
        ? { x: 50, y: 50, r: 0 }
        : g.yapis
        ? { x: 20 + Math.round(Math.random() * 60), y: 20 + Math.round(Math.random() * 60), r: Math.round(Math.random() * 70 - 35) }
        : { x: 15 + Math.round(Math.random() * 70), y: 15 + Math.round(Math.random() * 70), r: Math.round(Math.random() * 200 - 100) };
      if (g.variantlar) q.v = topazSec(g.variantlar.length);
      p[k] = q;
      const yz = { i: g.id, x: q.x, y: q.y, r: q.r, n, from: MEN, t, l: dusmeVaxti };
      if (q.v != null) yz.v = q.v;   // Firebase undefined qəbul etmir
      yigUpd[k + "/" + n] = yz;
      yigVar = true;
    });
    payload.p = p;
  }

  const r = ref(rtdb, "masalar/" + MASA_NOMRESI + "/hediyye/" + MEN);
  onDisconnect(r).remove();
  set(r, payload).then(() => dbg("hədiyyə bazaya yazıldı")).catch(e => dbg("HƏDİYYƏ YAZILMADI: " + (e.code || e.message)));

  if (yigVar) {
    try { update(ref(rtdb, YIG_YOL), yigUpd).catch(e => dbg("ÖPÜŞ YIĞIMI YAZILMADI: " + (e.code || e.message))); }
    catch (e) { dbg("ÖPÜŞ YIĞIMI XƏTASI: " + e.message); }
  }

  /* qeyd: göndərəndən sonra panel yenidən çəkilmir və seçim (oğlan/qız işarələri) saxlanılır,
     ki basıb saxlayanda göndərmə kəsilməsin və eyni oyunçulara davam etsin */

  odenis.then(() => {
    if (g.opus) {
      alanlar.forEach(k => {
        rtTx(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + k), v => num(v) + c).catch(() => {});
        reytinqArtir(k, "kiss", c);
      });
    }
    const dj = djUid();
    if (dj && alanlar.includes(dj)) {
      if (window.Xallar) window.Xallar.musiqiHediyye(dj, c);
      reytinqArtir(dj, "music", c);
    }
  }).catch(e => {
    meHearts = null;
    remove(r).catch(() => {});
    if (sekileOturur) alanlar.forEach(k => remove(ref(rtdb, YIG_YOL + k + "/" + n)).catch(() => {}));
    console.error(e);
    toast("Xəta: " + (e.code || e.message));
  });
  return true;
}

/* ======================= PREMIUM HƏDİYYƏLƏR (jeton + video) =======================
   Göndərən qiyməti jetonla ödəyir, alıcı qiymətin yarısını jeton kimi alır.
   Video YALNIZ alıcının ekranında oynayır (masadakı digər oyunçular görmür). */
function gonderPremium(g) {
  if (!MEN) { dbg("MEN yoxdur"); return false; }
  const alanlar = alicilar().filter(u => u !== MEN);
  if (!alanlar.length) { toast("Oyunçu seçilməyib"); return false; }
  const cost = g.q * alanlar.length;

  if (meJeton !== null && meJeton < cost) {
    toast("Jetonunuz çatmır");
    if (window.JetonShop && window.JetonShop.open) window.JetonShop.open();
    return false;
  }
  const evvelki = seviyye(meXerc || 0).no;
  const odenis = updateDoc(doc(fsdb, "users", MEN), {
    [PREMIUM_AYAR.jetonSahesi]: increment(-cost),
    [PREMIUM_AYAR.xercSahesi]: increment(cost)
  });

  const n = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const r = ref(rtdb, "masalar/" + MASA_NOMRESI + "/hediyye/" + MEN);
  onDisconnect(r).remove();
  set(r, { to: alanlar, i: g.id, c: 1, n, t: Date.now() + offset })
    .catch(e => dbg("PREMİUM YAZILMADI: " + (e.code || e.message)));

  odenis.then(() => {
    const sv = seviyye(meXerc || 0);
    toast(sv.no > evvelki
      ? "🎉 Yeni hədiyyə səviyyəsi: " + sv.ad + " · Lv " + sv.no
      : (g.ad || "Hədiyyə") + " göndərildi");
  }).catch(e => {
    remove(r).catch(() => {});
    console.error(e);
    toast("Xəta: " + (e.code || e.message));
  });
  return true;
}

async function oyuncuAdi(uid) {
  try {
    const s = await getDoc(doc(fsdb, "users", uid));
    return (s.exists() && (s.data() || {}).username) || "Oyunçu";
  } catch (e) { return "Oyunçu"; }
}

const pNovbe = [];
let pOynayir = false;
const pBonus = new Set();

function premiumGelen(kimden, x, g) {
  const l = Array.isArray(x.to) ? x.to : [x.to];
  if (!MEN || !l.includes(MEN)) return;
  if (x.t && Date.now() + offset - x.t > 20000) return;

  /* alıcı qiymətin yarısını jeton kimi alır (hər hədiyyə yalnız bir dəfə) */
  const m = Math.floor(g.q * PREMIUM_AYAR.alanPay);
  if (m > 0 && !pBonus.has(x.n)) {
    pBonus.add(x.n);
    updateDoc(doc(fsdb, "users", MEN), { [PREMIUM_AYAR.jetonSahesi]: increment(m) })
      .catch(e => { pBonus.delete(x.n); console.error(e); });
  }
  pNovbe.push({ kimden, x, g, m });
  if (!pOynayir) premiumNovbeti();
}

function premiumNovbeti() {
  const it = pNovbe.shift();
  if (!it) { pOynayir = false; return; }
  pOynayir = true;
  const { kimden, g, m } = it;

  const c = document.getElementById("chatYeri");
  const cr = c ? c.getBoundingClientRect() : null;
  const wrap = document.createElement("div");
  wrap.className = "hd-pv";
  wrap.style.top = ((cr && cr.height > 0) ? cr.top : innerHeight * 0.55) + "px";
  const v = document.createElement("video");
  v.src = g.video;
  v.preload = "auto";
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  wrap.appendChild(v);
  const b = document.createElement("div");
  b.className = "hd-pv-b";
  b.style.display = "none";
  wrap.appendChild(b);
  document.body.appendChild(wrap);

  Promise.all([oyuncuAdi(kimden), oyuncuAdi(MEN)]).then(([a1, a2]) => {
    b.innerHTML = esc(a1) + " → " + esc(a2) +
      "<small>" + esc(g.e) + " " + esc(g.ad || "Hədiyyə") + " · " + GEM + " " + g.q +
      " · alana +" + GEM + " " + m + " · Masa " + esc(MASA_NOMRESI) + "</small>";
    b.style.display = "block";
  });

  let bitdi = false, sg = null;
  const bit = () => {
    if (bitdi) return;
    bitdi = true;
    clearTimeout(sg);
    wrap.classList.remove("on");
    setTimeout(() => { wrap.remove(); premiumNovbeti(); }, 300);
  };
  v.onended = bit;
  v.onerror = bit;
  sg = setTimeout(bit, 30000);
  const gor = () => wrap.classList.add("on");
  v.play().then(gor).catch(() => {
    /* səsli avtomatik oynatma bloklanıbsa səssiz oynat */
    v.muted = true;
    v.play().then(gor).catch(bit);
  });
}

function fotoTap(uid) {
  const ortalar = document.querySelectorAll("#masa .orta");
  if (spin && spin.qu === uid && ortalar[0] && ortalar[0].classList.contains("goster") && fotoRect(ortalar[0])) return ortalar[0];
  if (spin && spin.ou === uid && ortalar[1] && ortalar[1].classList.contains("goster") && fotoRect(ortalar[1])) return ortalar[1];
  let ehtiyat = null;
  for (const k in oturacaqlar) {
    if (oturacaqlar[k] && oturacaqlar[k].uid === uid) {
      const e = document.querySelector("#masa .yer-" + k);
      if (e && e.classList.contains("dolu")) return e;
      if (e && !ehtiyat) ehtiyat = e;
    }
  }
  return ehtiyat;
}
const merkez = el => {
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null;
};
const fotoRect = el => {
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  return r.width ? r : null;
};

const KOKTEL_REF = { MX: 1.0835, MY: 0.766, H: 0.4926 };
const KOKTEL_GORUNEN = { l: 0, t: 0, r: 1, b: 1, en: 1 };
(function koktelSerhedOlc() {
  const g = HEDIYYELER.find(h => h.id === "g21");
  if (!g || !g.img) return;
  const im = new Image();
  im.onload = () => {
    try {
      const w = im.naturalWidth, h = im.naturalHeight;
      if (!w || !h) return;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, w, h).data;
      let l = w, t = h, r = -1, b = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 32) {
            if (x < l) l = x;
            if (x > r) r = x;
            if (y < t) t = y;
            if (y > b) b = y;
          }
        }
      }
      if (r < l || b < t) return;
      KOKTEL_GORUNEN.l = l / w; KOKTEL_GORUNEN.r = (r + 1) / w;
      KOKTEL_GORUNEN.t = t / h; KOKTEL_GORUNEN.b = (b + 1) / h;
      KOKTEL_GORUNEN.en = w / h;
      dbg("koktel sərhədi: " + [l, t, r, b].join(",") + " / " + w + "x" + h);
    } catch (e) { dbg("KOKTEL ÖLÇÜ XƏTASI: " + e.message); }
  };
  im.src = g.img;
})();
function koktelOlcusu(rw) {
  const v = KOKTEL_GORUNEN;
  const gh = (v.b - v.t) || 1;
  const fs = rw * KOKTEL_REF.H / gh;
  return { fs, dx: ((v.l + v.r) / 2 - 0.5) * fs * v.en, dy: ((v.t + v.b) / 2 - 0.5) * fs };
}

const olcu = (d, r) => d.i === "g21" ? koktelOlcusu(r.width).fs : r.width * (d.i === "g15" ? 0.38 : d.i === "g3" ? 0.42 : 0.4);
function noqte(d, r) {
  if (d.i === "g15") return [r.left + r.width * 0.022, r.top + r.height * 0.022, -44];
  if (d.i === "g21") {
    const k = koktelOlcusu(r.width);
    return [r.left + r.width * KOKTEL_REF.MX - k.dx, r.top + r.height * KOKTEL_REF.MY - k.dy, 0];
  }
  return [r.left + r.width * d.x / 100, r.top + r.height * d.y / 100, d.r || 0];
}

function bez(x1, y1, x2, y2) {
  return t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let a = 0, b = 1, m = 0.5;
    for (let i = 0; i < 24; i++) {
      m = (a + b) / 2;
      const xx = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m;
      if (xx < t) a = m; else b = m;
    }
    m = (a + b) / 2;
    return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m;
  };
}
function egri(e, u) {
  for (let i = 1; i < e.length; i++) {
    if (u <= e[i][0]) {
      const a = e[i - 1], b = e[i];
      return a[1] + (b[1] - a[1]) * ((u - a[0]) / ((b[0] - a[0]) || 1));
    }
  }
  return e[e.length - 1][1];
}
function canli(to, ms, hedef, uygula, bitdi) {
  const t0 = performance.now();
  let son = null, bitib = false;
  const bit = () => { if (bitib) return; bitib = true; bitdi(); };
  const fn = now => {
    const u = Math.max(0, Math.min(1, (now - t0) / ms));
    try {
      const e = fotoTap(to), r = e && fotoRect(e);
      if (r) son = hedef(r);
      if (son) uygula(u, son);
    } catch (er) { dbg("UÇUŞ XƏTASI: " + er.message); }
    if (u < 1) requestAnimationFrame(fn); else bit();
  };
  requestAnimationFrame(fn);
  setTimeout(bit, ms + 1500);
}
const tr = (dx, dy, s, rot) => "translate(calc(-50% + " + dx + "px),calc(-50% + " + dy + "px)) scale(" + s + ") rotate(" + rot + "deg)";

function ulduz(x, y) {
  const s = document.createElement("div");
  s.className = "hd-spark";
  s.textContent = ["✦", "★", "✧"][Math.floor(Math.random() * 3)];
  s.style.left = x + "px"; s.style.top = y + "px";
  s.style.color = ["#ffe34d", "#ff5fa2", "#7dff6a"][Math.floor(Math.random() * 3)];
  fxLayer().appendChild(s);
  s.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.2) translateY(3vw)" }], { duration: 600 }).onfinish = () => s.remove();
}

function ulduzIzi(d) {
  return setInterval(() => {
    const q = d.getBoundingClientRect();
    if (q.width) ulduz(q.left + q.width / 2 + (Math.random() * 16 - 8), q.top + q.height / 2 + (Math.random() * 16 - 8));
  }, 45);
}

function ucurYapis(g, x, to, pa, b, p) {
  const r0 = fotoRect(b);
  if (!r0) return;
  const hed = { i: g.id, x: p.x, y: p.y, r: p.r };
  const d = document.createElement("div");
  d.className = "hd-fly";
  d.style.left = pa[0] + "px"; d.style.top = pa[1] + "px";
  d.style.fontSize = olcu(hed, r0) + "px";
  d.style.opacity = "0";
  d.innerHTML = (g.ucusAdi ? gorsel(g) : gorselStk(g)) + (x.c > 1 ? "<i>x" + x.c + "</i>" : "");
  fxLayer().appendChild(d);
  const iz = ulduzIzi(d);
  const ease = bez(.2, .7, .3, 1);
  canli(to, g.ucusMs || 900,
    r => { const n = noqte(hed, r); return [n[0], n[1], n[2], olcu(hed, r)]; },
    (u, h) => {
      const e = ease(u), k = e < .12 ? 0 : (e - .12) / .88;
      const s = e < .12 ? .4 + .7 * (e / .12) : 1.1 - .1 * k;
      d.style.fontSize = h[3] + "px";
      d.style.opacity = e < .12 ? e / .12 : 1;
      d.style.transform = tr((h[0] - pa[0]) * k, (h[1] - pa[1]) * k, s, h[2] * k);
    },
    () => {
      clearInterval(iz);
      sesCal(g.sl);
      ogelen.add(x.n + "|" + to);
      yigimCiz();
      d.remove();
    });
}

function ucurTac(g, x, to, pa, b, p) {
  const r0 = fotoRect(b);
  if (!r0) return;
  const hed = { i: g.id, x: p.x, y: p.y, r: p.r };
  const d = document.createElement("div");
  d.className = "hd-fly";
  d.style.left = pa[0] + "px"; d.style.top = pa[1] + "px";
  d.style.fontSize = olcu(hed, r0) + "px";
  d.style.opacity = "0";
  d.innerHTML = gorsel(g) + (x.c > 1 ? "<i>x" + x.c + "</i>" : "");
  fxLayer().appendChild(d);
  const iz = ulduzIzi(d);
  canli(to, g.ucusMs || 5000,
    r => { const n = noqte(hed, r); return [n[0], n[1], n[2], olcu(hed, r)]; },
    (u, h) => {
      const pr = 1 - (1 - u) * (1 - u);
      d.style.fontSize = h[3] + "px";
      d.style.opacity = 1;
      d.style.transform = tr((h[0] - pa[0]) * pr, (h[1] - pa[1]) * pr, tacOlcu(u).toFixed(3), h[2] * pr);
    },
    () => {
      clearInterval(iz);
      sesCal(g.sl);
      ogelen.add(x.n + "|" + to);
      yigimCiz();
      d.remove();
    });
}

const KOKTEL_OLCU = [[0, 1], [.55, 1], [.675, .95], [.775, .855], [.875, .795], [.975, .765], [1, .765]];
const KOKTEL_UCUS_ORAN = 1 / 0.765;

function ucurKoktel(g, x, to, pa, b) {
  const r0 = fotoRect(b);
  if (!r0) return;
  const hed = { i: g.id };
  const d = document.createElement("div");
  d.className = "hd-fly";
  d.style.left = pa[0] + "px"; d.style.top = pa[1] + "px";
  d.style.fontSize = (koktelOlcusu(r0.width).fs * KOKTEL_UCUS_ORAN) + "px";
  d.style.opacity = "0";
  d.innerHTML = gorsel(g) + (x.c > 1 ? "<i>x" + x.c + "</i>" : "");
  fxLayer().appendChild(d);
  canli(to, g.ucusMs || 5000,
    r => { const n = noqte(hed, r); return [n[0], n[1], 0, koktelOlcusu(r.width).fs * KOKTEL_UCUS_ORAN]; },
    (u, h) => {
      const pr = 1 - (1 - u) * (1 - u);
      d.style.fontSize = h[3] + "px";
      d.style.opacity = Math.min(1, u / 0.025);
      d.style.transform = tr((h[0] - pa[0]) * pr, (h[1] - pa[1]) * pr, egri(KOKTEL_OLCU, u).toFixed(3), 0);
    },
    () => {
      sesCal(g.sl);
      ogelen.add(x.n + "|" + to);
      yigimCiz();
      d.remove();
      urekEffekti(to);
      bonusVer(g, x, to);
    });
}

function urekEffekti(to) {
  const d = document.createElement("div");
  d.className = "hd-fly";
  d.style.opacity = "0";
  d.innerHTML = UREK;
  const sv = d.firstChild;
  sv.style.display = "block"; sv.style.height = "auto";
  fxLayer().appendChild(d);
  const OM = 1170, GEC = 70;
  canli(to, OM,
    r => [r.left + r.width * KOKTEL_REF.MX, r.top + r.height * KOKTEL_REF.MY - r.width * KOKTEL_REF.H / 2, 0, r.width],
    (u, h) => {
      const tt = u * OM - GEC;
      if (tt < 0) { d.style.opacity = "0"; return; }
      const op = tt < 300 ? 1 : Math.max(0, 1 - (tt - 300) / 800);
      const sc = Math.min(1, 0.6 + 0.4 * (tt / 100));
      sv.style.width = (h[3] * 0.16) + "px";
      d.style.left = h[0] + "px";
      d.style.top = (h[1] - 0.54 * h[3] * (tt / 1000)) + "px";
      d.style.opacity = op;
      d.style.transform = "translate(-50%,-50%) scale(" + sc.toFixed(3) + ")";
    },
    () => d.remove());
}

const bonusVerilen = new Set();
function bonusVer(g, x, to) {
  if (!MEN || to !== MEN || !g.bonus) return;
  const key = x.n + "|" + to;
  if (bonusVerilen.has(key)) return;
  bonusVerilen.add(key);
  const m = g.bonus * Math.max(1, num(x.c));
  if (meHearts !== null) meHearts += m;
  updateDoc(doc(fsdb, "users", MEN), { hearts: increment(m) }).catch(e => { bonusVerilen.delete(key); console.error(e); });
}

function oynaBir(kimden, x, to) {
  const g = HEDIYYELER.find(h => h.id === x.i);
  const a = fotoTap(kimden), b = fotoTap(to);
  if (!g || !b) return;
  const pb = merkez(b), pa = (a && merkez(a)) || [innerWidth / 2, innerHeight * 0.6];
  if (!pb) return;
  if (g.koktel && x.p && x.p[to]) {
    const ra = a && fotoRect(a);
    ucurKoktel(g, x, to, ra ? [ra.left + ra.width * 0.5, ra.top + ra.height * 0.2] : pa, b);
    return;
  }
  const py = g.yigim && x.p && x.p[to];
  if (py) { ucurYigim(g, x, to, pa, b, py); return; }
  const p = g.yapis && x.p && x.p[to];
  if (p && g.tacUcus) { ucurTac(g, x, to, pa, b, p); return; }
  if (p) { ucurYapis(g, x, to, pa, b, p); return; }
  const d = document.createElement("div");
  d.className = "hd-fly";
  d.style.left = pa[0] + "px"; d.style.top = pa[1] + "px";
  d.style.opacity = "0";
  d.innerHTML = gorsel(g) + (x.c > 1 ? "<i>x" + x.c + "</i>" : "");
  fxLayer().appendChild(d);
  const ease = bez(.42, 0, .58, 1);
  canli(to, 1800,
    r => [r.left + r.width / 2, r.top + r.height / 2, 0],
    (u, h) => {
      const e = ease(u);
      const k = e < .15 ? 0 : e < .6 ? (e - .15) / .45 : 1;
      const s = e < .15 ? .4 + .6 * (e / .15) : e < .6 ? 1 + .1 * k : e < .85 ? 1.1 + .5 * ((e - .6) / .25) : 1.6 + .3 * ((e - .85) / .15);
      d.style.opacity = e < .15 ? e / .15 : e < .85 ? 1 : 1 - (e - .85) / .15;
      d.style.transform = tr((h[0] - pa[0]) * k, (h[1] - pa[1]) * k, s, 0);
    },
    () => d.remove());
}

function oyna(kimden, x) {
  const g = HEDIYYELER.find(h => h.id === x.i);
  if (g && g.video) { premiumGelen(kimden, x, g); return; }   // premium: video yalnız alıcıda
  if (g) sesCal(g.s);
  const l = Array.isArray(x.to) ? x.to : [x.to];
  l.forEach((to, i) => setTimeout(() => oynaBir(kimden, x, to), i * 120));
}

let ilk = true;
const sonN = {};
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/hediyye"), s => {
  const v = s.val() || {};
  for (const uid in v) {
    const x = v[uid];
    if (!x || sonN[uid] === x.n) continue;
    sonN[uid] = x.n;
    if (!ilk) oyna(uid, x);
  }
  for (const uid in sonN) if (!v[uid]) delete sonN[uid];
  ilk = false;
});

/* ======================= ÖPÜŞ YIĞIMI (g.yigim) ======================= */
const OLCU_EYRISI = [[0, .7], [.012, 1.17], [.05, 1.32], [.11, 1.28], [.16, 1.27], [.22, 1.28], [.28, 1.37], [.36, 1.48],
                     [.42, 1.55], [.49, 1.55], [.57, 1.51], [.63, 1.45], [.69, 1.41], [.77, 1.24], [.86, 1.09], [.93, 1.02], [1, 1]];
const YAVASLA = "cubic-bezier(0.5,1,0.89,1)";

let yigData = {}, yigIlk = true, yigQat = null;
const ogelen = new Set();
const ogorulen = {};
const yigEl = {};
const yigSilinir = new Set();

onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/yigim"), s => {
  yigData = s.val() || {};
  for (const uid in yigData) for (const key in (yigData[uid] || {})) {
    if (!yigData[uid][key]) continue;
    const kk = key + "|" + uid;
    if (!(kk in ogorulen)) { ogorulen[kk] = Date.now(); if (yigIlk) ogelen.add(kk); }
  }
  yigIlk = false;
  yigimCiz();
});

function ucurYigim(g, x, to, pa, b, p) {
  const r0 = fotoRect(b);
  if (!r0) return;
  /* ölçü: hədiyyənin öz əyrisi varsa (topaz) o, yoxsa köhnə öpüş əyrisi; yerdəyişmə əyrisi də eləcə */
  const ms = g.ucusMs || 4900, L = r0.width * yigBaza(g), dir = p.d < 0 ? -1 : 1;
  const olcuE = g.olcuEgri || OLCU_EYRISI;
  const ease = g.ucusEase ? bez(g.ucusEase[0], g.ucusEase[1], g.ucusEase[2], g.ucusEase[3]) : bez(0.5, 1, 0.89, 1);
  const a = document.createElement("div");
  a.className = "hd-yf";
  a.style.cssText = "left:" + (pa[0] - L / 2) + "px;top:" + (pa[1] - L / 2) + "px;width:" + L + "px;height:" + L + "px;font-size:" + (L * 0.8) + "px";
  a.innerHTML = '<div class="hd-yf-r"><div class="hd-yf-s">' + gorselV(g, p.v) + "</div></div>" + (x.c > 1 ? "<i>x" + x.c + "</i>" : "");
  fxLayer().appendChild(a);
  const rot = a.firstChild, olc = rot.firstChild;
  olc.style.opacity = "0";
  canli(to, ms,
    r => [r.left + r.width * p.x / 100, r.top + r.height * p.y / 100, p.r],
    (u, h) => {
      const e = ease(u);
      a.style.transform = "translate(" + ((h[0] - pa[0]) * e) + "px," + ((h[1] - pa[1]) * e) + "px)";
      rot.style.transform = "rotate(" + (h[2] - 90 * dir * (1 - e)) + "deg)";
      olc.style.transform = "scale(" + egri(olcuE, u) + ")";
      olc.style.opacity = u > 0 ? 1 : 0;
    },
    () => {
      sesCal(g.sl);
      ogelen.add(x.n + "|" + to);
      yigimCiz();
      a.remove();
    });
}

function yigimCiz() {
  if (!yigQat) { yigQat = document.createElement("div"); yigQat.className = "hd-yigQat"; (document.getElementById("masa") || document.body).appendChild(yigQat); qatTransformUygula(); qatGorunurlukYenile(); }
  const gizli = gizliKes;

  const srv = Date.now() + offset;
  for (const kk in yigEl) {
    const [key, uid] = kk.split("|");
    if (!(yigData[uid] && yigData[uid][key])) { yigEl[kk].el.remove(); delete yigEl[kk]; yigSilinir.delete(kk); }
  }
  for (const uid in yigData) {
    const col = yigData[uid];
    if (!col) continue;
    const f = fotoTap(uid), r = f && fotoRect(f);
    const gor = !!r && !gizli;

    const qruplar = {};
    for (const key in col) {
      const e = col[key];
      if (!e) continue;
      const gh = HEDIYYELER.find(h => h.id === e.i);
      if (!gh) continue;
      const land = num(e.l) || (num(e.t) + (gh.ucusMs || 4900));
      const qk = gh.qrup || e.i;
      (qruplar[qk] = qruplar[qk] || []).push([key, e, land, gh]);
    }

    /* NÖVLƏRARASI SOLMA: bir növ hədiyyə düşəndə şəkildə olan BAŞQA növ hədiyyələr (hələ solmayanlar)
       həmin hədiyyənin düşmə vaxtından başlayaraq ən köhnədən bir-bir solur. Hər hədiyyənin solma vaxtı
       onu əvəz edən ilk fərqli növ hədiyyəyə görə bir dəfə təyin olunur, ona görə sonradan dəyişmir. */
    const caprazSol = {};
    {
      const hamisi = [];
      for (const gk in qruplar) for (const it of qruplar[gk]) hamisi.push([gk, it]);
      hamisi.sort((a, b) => a[1][2] - b[1][2]);
      let gozle = [];
      for (const [gk, it] of hamisi) {
        const getdi = gozle.filter(w => w[0] !== gk);
        if (getdi.length) {
          const addim = Math.min(CAPRAZ_ADDIM, CAPRAZ_PENCERE / getdi.length);
          getdi.forEach((w, i) => { caprazSol[w[1][0]] = it[2] + i * addim; });
          gozle = gozle.filter(w => w[0] === gk);
        }
        gozle.push([gk, it]);
      }
    }

    for (const gid in qruplar) {
      const L = qruplar[gid].sort((a, b) => a[2] - b[2]);

      /* "qal" hədiyyələr (topaz, öpüş, pomidor): hamısı qalır; i-ci hədiyyə ən tez düşməsindən QAL_OMUR sonra,
         özündən sonrakı hədiyyə düşəndən əvvəl yox, əvvəlki hədiyyənin solmasından ən azı QAL_ADDIM sonra solur.
         Beləcə köhnədən başlayaraq sıra ilə solur, SON hədiyyənin solma vaxtı yoxdur və qalır.
         Hər vaxt yalnız özündən əvvəlkilərdən və növbətidən asılıdır, ona görə yeni hədiyyə gələndə
         artıq solmağa başlayanlar geri qayıtmır. */
      const qalSol = {};
      if (L.length > 1 && L[0][3].qal) {
        let evvel = 0;
        for (let i = 0; i < L.length - 1; i++) {
          if (!L[i][3].qal) continue;
          const sv = Math.max(L[i][2] + QAL_OMUR, L[i + 1][2], evvel + QAL_ADDIM);
          qalSol[i] = sv; evvel = sv;
        }
      }

      for (let idx = 0; idx < L.length; idx++) {
        const [key, e, , g] = L[idx];
        const kk = key + "|" + uid;
        const solMs = g.qal ? QAL_SOLMA : (g.solMs || OPUS.SOLMA_MS);
        let sol = g.qal
          ? (qalSol[idx] || 0)
          : (idx < L.length - 1 ? (g.koktel ? num(L[idx + 1][1].t) : L[idx + 1][2]) : 0);
        const cs = caprazSol[key];
        if (cs && (!sol || cs < sol)) sol = cs;

        if (sol && srv - sol >= solMs) {
          if (yigEl[kk]) { yigEl[kk].el.remove(); delete yigEl[kk]; }
          if (!yigSilinir.has(kk)) { yigSilinir.add(kk); remove(ref(rtdb, YIG_YOL + uid + "/" + key)).catch(() => {}); }
          continue;
        }
        const ok = ogelen.has(kk) || (Date.now() - (ogorulen[kk] || Date.now()) > 8000);
        if (!ok) continue;

        let rec = yigEl[kk];
        if (!gor) { if (rec) rec.el.style.display = "none"; continue; }
        if (!rec) {
          const el = document.createElement("div");
          el.className = (g.yapis || g.koktel) ? ("hd-stk" + (g.koktel ? " hd-nosh" : "")) : "hd-yig";
          el.style.zIndex = g.tacUcus ? "2" : "1";
          el.innerHTML = g.yapis ? gorselStk(g) : gorselV(g, e.v);
          yigQat.appendChild(el);
          rec = yigEl[kk] = { el, sol: false, k: "" };
        }
        const el = rec.el;
        let k, stil;
        if (g.yapis || g.koktel) {
          const [px, py, rot] = noqte(e, r);
          const fs = olcu(e, r);
          k = [px, py, rot, fs].join("|");
          stil = () => {
            el.style.display = "block";
            el.style.fontSize = fs + "px";
            el.style.left = px + "px"; el.style.top = py + "px";
            el.style.transform = "translate(-50%,-50%) rotate(" + rot + "deg)";
          };
        } else {
          /* düşəndən sonrakı ölçü = uçuş ölçüsü × son əmsal (topaz: 0.8, öpüş: 1) */
          const L2 = r.width * yigBaza(g) * yigSon(g);
          const lx = r.left + r.width * e.x / 100 - L2 / 2, ly = r.top + r.height * e.y / 100 - L2 / 2;
          k = [lx, ly, L2, e.r].join("|");
          stil = () => {
            el.style.display = "flex";
            el.style.width = el.style.height = L2 + "px";
            el.style.fontSize = (L2 * 0.8) + "px";
            el.style.left = lx + "px"; el.style.top = ly + "px";
            el.style.transform = "rotate(" + e.r + "deg)";
          };
        }
        if (rec.k !== k || el.style.display === "none") { rec.k = k; stil(); }

        if (sol && srv >= sol && !rec.sol) {
          rec.sol = true;
          const an = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: solMs, easing: "linear", fill: "both" });
          an.currentTime = Math.max(0, srv - sol);
        }
      }
    }
  }
}
(function kadrDongusu() {
  try { qatKalibrle(); yigimCiz(); kalPanel(); } catch (e) { dbg("KADR XƏTASI: " + e.message); }
  requestAnimationFrame(kadrDongusu);
})();
