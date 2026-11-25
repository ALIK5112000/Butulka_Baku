import { fsdb, rtdb } from "../core/firebase.js";
import { MASA_NOMRESI } from "../core/config.js";
import { cariOyuncu } from "./yardimci.js";
import { doc, onSnapshot, updateDoc, runTransaction, collection, query, where, getCountFromServer, getDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { topMu, topDeyis, TOP_RENG } from "./top-oyuncular.js";

/* ================= DONMA VAXTI YOXLAMA VƏ BƏRPA ================= */
const FREEZE_FIELD_MAP = {
  kisses: "freeze_kisses",
  music: "freeze_music",
  smiles: "freeze_smiles"
};

const SAVED_FIELD_MAP = {
  kisses: "saved_kisses",
  music: "saved_music",
  smiles: "saved_smiles"
};

function vaxtMs(val) {
  if (!val) return 0;
  if (typeof val === "number") return val > 0 && val < 1e12 ? val * 1000 : val;
  if (val && typeof val.toMillis === "function") return val.toMillis();
  if (val && typeof val.seconds === "number") return val.seconds * 1000;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function donmaBitisVaxti(d, sahe) {
  if (!d) return 0;
  let maxMs = 0;

  if (d.dondurulmusXallar && d.dondurulmusXallar[sahe] !== undefined) {
    maxMs = Math.max(maxMs, vaxtMs(d.dondurulmusXallar[sahe]));
  }

  const fKey = FREEZE_FIELD_MAP[sahe];
  if (fKey && d[fKey] !== undefined) {
    maxMs = Math.max(maxMs, vaxtMs(d[fKey]));
  }

  return maxMs;
}

function aktivDonmaVarmi(d, sahe) {
  return donmaBitisVaxti(d, sahe) > Date.now();
}

async function donmaVaxtiYoxla(uid, d) {
  if (!uid || !d) return;
  const indi = Date.now();
  const yenile = {};
  let deyisdi = false;

  const dz = d.dondurulmusXallar || {};
  for (const sahe of Object.keys(dz)) {
    const bitis = vaxtMs(dz[sahe]);
    if (bitis > 0 && indi >= bitis) {
      yenile["dondurulmusXallar." + sahe] = deleteField();
      if (d.saxlanilanXallar && d.saxlanilanXallar[sahe] !== undefined) {
        yenile[sahe] = Number(d.saxlanilanXallar[sahe]) || 0;
        yenile["saxlanilanXallar." + sahe] = deleteField();
      }
      deyisdi = true;
    }
  }

  for (const [sahe, fKey] of Object.entries(FREEZE_FIELD_MAP)) {
    const bitis = vaxtMs(d[fKey]);
    if (bitis > 0 && indi >= bitis) {
      yenile[fKey] = 0;
      const sKey = SAVED_FIELD_MAP[sahe];
      if (sKey && d[sKey] !== undefined && Number(d[sKey]) > 0) {
        yenile[sahe] = Number(d[sKey]) || 0;
        yenile[sKey] = 0;
      }
      deyisdi = true;
    }
  }

  if (deyisdi) {
    try {
      await updateDoc(doc(fsdb, "users", uid), yenile);
    } catch (e) {
      console.error("Donma açılma xətası:", e);
    }
  }
}

const CSS = `
.pf-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;font-family:Roboto,Arial,sans-serif}
.pf-ov.open{display:flex}
.pf-card{position:relative;width:80vw;background:#fff;border-radius:4.4vw;box-shadow:0 1vw 4vw rgba(0,0,0,.35);animation:pfin .25s ease}
@keyframes pfin{from{transform:translateY(5vw);opacity:0}}
.pf-photo{position:relative;width:100%;height:80vw;border-radius:4.4vw 4.4vw 0 0;overflow:hidden;background:#0b1530}
.pf-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.pf-cap{position:absolute;left:0;right:0;bottom:1.1vw;text-align:center;color:#fff;font:700 3.8vw/4.4vw Roboto,Arial,sans-serif;text-shadow:0 .2vw .8vw rgba(0,0,0,.85)}
.pf-cap small{display:block;font:500 3.4vw/4.4vw Roboto,Arial,sans-serif}
.pf-zoom{position:absolute;right:2.4vw;bottom:2.1vw;width:5.85vw;height:5.85vw;border:0;background:none;padding:0}
.pf-zoom svg{width:100%;height:100%;display:block}
.pf-close{position:absolute;top:-2.6vw;right:-2.6vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3);z-index:3}
.pf-close svg{width:4.2vw;height:4.2vw}
.pf-stats{display:flex;justify-content:space-between;align-items:center;padding:1.2vw 4.5vw 0 2.9vw}
.pf-row{display:flex;align-items:center;height:7vw;white-space:nowrap}
.pf-ic{width:7.6vw;margin-right:1vw;display:flex;align-items:center;justify-content:center}
.pf-ic svg,.pf-ic img{display:block}
.pf-row b{font:700 3.7vw/1 Roboto,Arial,sans-serif;margin-right:3vw}
.pf-rk{font:400 2.6vw/1 Roboto,Arial,sans-serif;color:#9a9a9a}
.pf-k b{color:#d2381a}.pf-m b{color:#b0508f}.pf-c b{color:#f08a00}.pf-h b{color:#c0391b}
.pf-trophy{width:17.8vw;height:18.9vw;flex:none;transform:scaleX(.93);transform-origin:right center}
.pf-dv{display:flex;align-items:center;height:3.9vw;margin:1.5vw 3.9vw 0}
.pf-dv i{flex:1;height:.3vw;background:#e3e3e3}
.pf-dv span{width:8.8vw;height:3.9vw;margin:0 2.1vw;border-radius:1vw;background:#ececec;display:flex;align-items:center;justify-content:center;cursor:pointer}
.pf-dv svg{width:4.6vw;height:2.4vw}
.pf-dv.up svg{transform:rotate(180deg)}
.pf-user{display:flex;gap:3vw;margin:2.8vw 3.9vw 0;height:16.7vw}
.pf-ava{width:16.7vw;height:16.7vw;border-radius:3.3vw;object-fit:cover;background:#dfe9f1;flex:none}
.pf-info{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;min-width:0}
.pf-name{font:400 3.6vw/3.9vw Roboto,Arial,sans-serif;color:#555;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-name u{text-decoration:none;color:#3aa0e0;font-weight:700}
.pf-heart{display:flex;align-items:center;height:6.5vw}
.pf-heart img{width:7.4vw;height:auto;margin-right:2.1vw}
.pf-heart b{font:700 3.6vw/1 Roboto,Arial,sans-serif;color:#2b2b2b;margin-right:2.8vw}
.pf-heart .pf-rk{font-size:2.7vw}
.pf-follow{background:#7cc92f;color:#fff;border:0;border-radius:.5vw;min-width:20.8vw;padding:0 2vw;height:6.2vw;font:400 3.4vw/1 Roboto,Arial,sans-serif}
.pf-follow.g{background:#c9c9c9}
.pf-follow:disabled{opacity:.7}
.pf-ln{height:.3vw;background:#e6e6e6;margin:2.6vw 3.9vw 0}
.pf-act{display:flex;justify-content:space-between;padding:2.35vw 3.9vw 4.9vw}
.pf-btn{width:12vw;height:12vw;border-radius:50%;border:0;color:#fff;padding:0;display:flex;align-items:center;justify-content:center}
.pf-btn svg{width:7vw;height:7vw;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pf-btn.t{font:700 2.9vw/1 Roboto,Arial,sans-serif}
.pf-act .pf-btn:nth-child(1) svg{width:10.2vw;height:10.2vw}
.pf-act .pf-btn:nth-child(3) svg{width:7.6vw;height:7.6vw}
.pf-act .pf-btn:nth-child(4) svg{width:8.9vw;height:8.9vw}
.pf-act .pf-btn:nth-child(5) svg{width:8.6vw;height:8.6vw}
.pf-st{height:9.33vw;box-sizing:border-box;padding:0 4vw;display:flex;align-items:center;justify-content:center;text-align:center;font:italic 400 3.7vw/1.2 Roboto,Arial,sans-serif;color:#111}
.pf-st span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.pf-stl{height:.3vw;background:#e6e6e6;margin:0 3.9vw}
.pf-full{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10001;display:flex;align-items:center;justify-content:center}
.pf-full img{max-width:100%;max-height:100%}
.pf-toast{position:fixed;left:50%;bottom:24vw;transform:translateX(-50%);max-width:80vw;text-align:center;z-index:20000;background:rgba(35,35,35,.92);color:#fff;font:500 3.5vw/1.3 Roboto,Arial,sans-serif;padding:2.6vw 4.6vw;border-radius:3vw}
.pf-ov.pf-bekle .pf-card{visibility:hidden}
/* oyunçu masada deyilsə: təpik, musiqi və məktub düymələri solğun, basılmır */
.pf-solgun{pointer-events:none;cursor:default}
.pf-act .pf-btn:first-child.pf-solgun,
.pf-kick.pf-solgun{filter:grayscale(1) brightness(1.35) !important;opacity:.9}
.pf-btn.pf-mus.pf-solgun{background:#8b8b8b !important}
.pf-btn.pf-mail.pf-solgun{background:#a0a0a0 !important}
/* TOP lenti: 1-10 ci yerdə olan oyunçuda VIP lentinin yerində görünür */
.pf-topimg{position:absolute;top:4.26vw;left:-3.9vw;width:14.9vw;height:auto;margin:0;z-index:2;pointer-events:none;-webkit-user-select:none;user-select:none}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const IC = {
  dudaq: '<img src="images/profil/opucuk.png" alt="" style="width:5.7vw;height:auto;display:block">',
  nota: '<img src="images/profil/mahni.png" alt="" style="width:4.6vw;height:auto;display:block">',
  smayl: '<img src="images/profil/smaylik.png" alt="" style="width:4.7vw;height:auto;display:block">',
  urek1: '<img src="images/profil/tek_urek.png" alt="" style="width:6.4vw;height:auto;display:block">',
  urek2: '<img src="images/profil/cut_urek.png" alt="" style="width:7.4vw;height:auto;display:block">',
  kubok: '<svg class="pf-trophy" viewBox="0 0 64 68"><defs><linearGradient id="pfg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aebfd0"/><stop offset=".45" stop-color="#eef3f8"/><stop offset="1" stop-color="#93a9bf"/></linearGradient></defs><path d="M13 9C0 9 0 30 20 34M51 9c13 0 13 21-7 25" fill="none" stroke="#9db2c6" stroke-width="5" stroke-linecap="round"/><path d="M12 5h40v17c0 14-8 22-20 22S12 36 12 22z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><rect x="28" y="44" width="8" height="11" fill="#9db2c6"/><path d="M17 55h30l3 9H14z" fill="url(#pfg)" stroke="#8aa0b5" stroke-width="2"/><path d="M32 13l3.200 6.500 7.100 1-5.200 5 1.300 7.100L32 29.200l-6.400 3.400 1.300-7.100-5.200-5 7.100-1z" fill="#f6b300" stroke="#d99700" stroke-width="1.200"/></svg>',
  chev: '<svg viewBox="0 0 46 24"><path d="M6 6l17 12L40 6" fill="none" stroke="#9a9a9a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/></svg>',
  qalxan: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 3v6c0 5-3.400 8.600-8 10-4.600-1.400-8-5-8-10v-6z"/><path d="M12 8l1.300 2.700 3 .4-2.200 2.100.5 3-2.600-1.400-2.600 1.400.5-3-2.200-2.100 3-.4z"/></svg>',
  musiqi: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  tesdiq: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.500 12.500l3 3 6-6.500"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  bosAva: '<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block"><rect width="100" height="100" fill="#dfe9f1"/><g fill="none" stroke="#b9c7d3" stroke-width="3" stroke-dasharray="5 4"><ellipse cx="50" cy="38" rx="14" ry="17"/><path d="M18 96c0-20 14-30 32-30s32 10 32 30"/></g></svg>'
};

const pick = (d, keys) => { for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k]; return null; };
const vipMi = d => d.role === "admin" || (d.vip && (!d.vipUntil || Number(d.vipUntil) > Date.now()));
const fmt = n => (Number(n) || 0).toLocaleString("ru-RU");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOPHOTO = "images/avatar/nophoto.svg";
const TOP_LENT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAADpCAYAAABV9O44AAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAACWy0lEQVR42u39abAtS3YWCH5ruUfsvc90xzdl5tOYCJrsrsIKWSOJQZlQKiGoKgkp32OUGNSSmq5qytoKftADN283P8qsBrCmTRhilNDQ9q5KQEEJFYKSUiQUotSoBwSSUsrMp8w33flMe4gI99U/3CPCY9wR++xzh5fb03a+e/YQ4eHD8rW+tda3CJfQbt0CfxRfzx/9yIuyye/vAHj99TvmH//wn31pf7r8Bhb7QYjV9e8xu/9aCwgkjTV95ji5/hMfe/322RtvvKZew5NtP/0Ld+ljtz+ZAcDP3vnu30Wa/1cmlX3Atv/AlP+x4Xes+6v6XvslrLWAdd8lyCms/Ktv+M4f+RQAyBuvqSc7AndwB6/h9dfvmB/6K99988X95D8gi1ehRIsIEdMC4M881Fd/4vXX/8ICAH7gv/wj+x/8kP5GY+xXEDAlIgEA7prs2nBw8f8tA6QYXL8Sl/9loOXzlutY7vzcWlSvwu0TpfxNTWMyXS/cW27WGw8f3v/SP297Bg4GzraMNVfmoLnoGjcM3sqfvTrGhv33/GfK1u7PxfaBagy5DbcXYDNkRgSCx4sV/sU3ffvf+ldyC0y3YWnbWyC/8EWv88kf+P1ftz+Lv3caqX+XYQGIf5WNyHVf8qewhCRZfXKxWP3Jr/2jf/ff4im0n/wrr1154Vry56N48j1aqcgL5+oY5f3P/xb3DRLxn/v/BY8sUn4//7HkAhAASCAisJlZANl/fffuh//87/nP/tLqaYzBz975j7+ahP6K0vrfY2bfb/c8VgBjsv+BJP1zREIG0Z/XSv/7YAIRQCAwAC8Hi/Gi6tMXc05gEAgC68Y5Hydy11O54PRjDAKECMzk11DL5kQw2EK1DWyBoG/u86Bv1L5OCVR8TURqE8lwXc/vXf+cqqvnUj8HiNs+p+D3te0t7D8X/7y1xVp8no+HDf6kxhgK5TvA+u5yZf7z34tIvjjqUqjYRRBArECswFogzeTRKjV/9mu+7e/8FRHwVgTgrVvgT3zkNcIv3BG6Dfsjf/n3f9nNvfTrIpXc1JwpjRTKS272+k7bcc6wIKIJBP9LVvpbjqZqf7lMhGFFapsC4aYgci8QzSaajs9Wd43Y/07An7bMqW1XG4JucOXkY+X/NrkOxm3HOdhYRAC0siASZrIvwdA3HBxEvylJLYw1tlzrVN1TKNeh+5uKuwjlE0i+j9Kc51z4i/gN7y7GRBzHCqsk/Rcs5qeEcB8CKY5l06FSqnWndsfHwZgyc5wZ/o2A+pa9mTo6X2SSa3TuPwSAeDrVOJunSyJgf6qny1UGIXclEvLfspXDon5oFFMvgQCkmgAEFYdkcQwRVQ7P6tXz60pN4LZ8N/99LlWL96XxHXLz4uYTAlsXgJUutJ10bQJMej6vy4MRn1Mo6lqlS3PMat+h1iELBVjdMKRW8VUZ7pbf5wIORK19k+Ji4sedoXTMxBMsV/SffOU3/sT3XlgAyq1bTLdvF7vpp//67/h9syn9xcOpfMk0SjHhDEoyQAwgBgQBl0/l/2WLeSEAiiwWywzWZBYC9nuj5bQuF1qhBAqsjjVPYg0jBBGCsLsyBbtJwsn21yVql5BSu6+Q23Is7lkIBoBAkcAYg9Uqs+4ifgkReS2gtt4k0GQpOJj9CSrFAElDAhTistgMUio6BNmfalaKYKzbfKHARLDAhdpRCq4tKgp/T8Hm9l0TfwsmYLE0yIy1RMR5hymQXAKx7K1Ga8R9j6lyKIBl0MajXHsgKTpDfo5azouqJhNst3qrCsimAAyOK1Qnr1zbFN7KrwFpFYDS8u/wc671VWpaKneMT48A7xFA/d/t6meLeVLRioOrSl1SSktvqLMvUv2/YC5abCwq58gKwyK20WSfz1eTZWKjj24kAOsa3z/8m9/8ZTfi849pnP7uCKuPX52tmMzcxJRAUwYWA8BArEVF2Q0XufXjJl6KidebZT2MWCxWEhARLLEwBfY9oSEA/S6vXSc/OajYqoUgajniimVpnQAUErfuBVyYsIWCSsUp1hSA+VxJbQ1R9xlM4TKR6mITQECWSKRufoU3qArAqoStH6qFwpP3mallj4gXsMREhUWP4Izx2prrogDgXOVrW/ZU7hEJT602KwDVMZTGOHEgNKSqca0VgN3jX25C6tQA62LDUnMmugVRzfxs6MR9AmxTrabeBenRKBEImY7POyCgLmE6SAB2rYE2MeitD2s1LM1ged+SPuAHJ+pPjx65Osb3Mz/8ez9+GK3+m6vTxat7dAazPIWSudWyZCUrMFJn2lYWXce8SbiRMET29VhtwblA7fOI2qYO97SElnXXuUlrFsrITVU3DYT6ztkuQdU/yFVNSIK1Kmu+j0Hvd/WYAoEdwuik+rdvOQf5gULD5FIhhDz+RFzie5U+ypq5GqYxVcdDWoVkcVzRuoVNHX+v7/d4jU/w/mzUOCScANyDVVesoUN69yH+r3qU8BMwEezf+cvf/GUvXE0/OqP5N03Uw49fmSwY6ZkRWSHGijWWTFiBJQUQaH3Sf3aJNN/vU7ala51VTuYB+1OGGwVdYx0qFnXh0Di7pLl5pG/ftB6+0uFRGWrGDHxfRg4IdXxdJDQYc32sRStvdqeqBcsw7aUYDxv8V5o4F61ZXK0LQgZvmLYDcp1C1bz+WCElF/z8/dCkJubFO8oIAgWDiDJD6WAB+FO3oImQ/eO/8Q3/0bWD0++9MVt9aF/NkS6PwcnckqRKwUAhBUsGgvEbmdBhvfScaaUkkIbXLDT8pBVIzlXeAnanpgFBLfisrZ/m1N6/4nrULsBE6hohte6H7q1NHZM4YL+v0Yzqz9CLl7dg5lKDCbq1YaqYmlJbmDkmaqXrwKIq3kPjtn6ACjewz3ZIoDon0mqW9WlldEkCh7D+RPpiEGhdsEDPzqivQdKwFMHQBJndQ2IBPUz4fb3+2O1PZp/8gY9+243Z6Q9cm5zvqfTUcLbATJbMkjDE4WBETsZW0av2RbV+0ofiMN2LRoJdLUEPZMD963jSesOFBmnjlU3a8gyCDnxvwHlHo4Dsjs3asrbqmJpI7SrFKUDrAKViZcig/tROqcGCkII5kfFra6zKi3Em8/YE4iVggM+dAOxaZ9TyHiMzEVZZhGUm6wVgLvx+5m//7o/f2D/94SvqcRRlJ0bLXClZgq0LcSGSBrpClUU7ANSjNSZu8X4R8tE43VsFmDRNn8GmC3UjMutkTAXAb9syPlYt71/F01o6VcaZW0RrMMFhOhSh5qTLnZ0tG73wcFOplxfPVNPspD7E1I+5FSFlEmieNGY8pKrx0qbQwDpcVzb6/a5tx9xtx4uq/2AiiDAyy1gkLKuMtB4k/H74d3/8xnT+A0fqcaTNqY0wV4wFyHpTdwBe97SHp6IV5wrLSDjpYje/yM/pAhfbwFSSbhire8xKAXWhcdvKoD8txYTWDdKubX9XD1/n5PC/JGOsUkVJwstOAejj+7J/8be//uNXp49/+JCPI5Ud25gWrGQF8lofgVo0sDoGNuwZqGU79R/yMgIG9dqJBB5JEkhPNEGIP1GbdG/4C+qaXO3CLeNRicuTerwUFXGEdRO1CKlp/EZqmklHkKi0Z9WQVOGD8no5nCINRVPEj2MYkztQZot0L+h2CKC8Fw2QlF1WRNcS7XKKrLNGusd7AOAysA+71if8ekxiF28FIYYVJRaaThdk5pn+l60C8NYtMN2+bX/2h3/n77s2Pf6BQz6OtD21Ea2YfWhLEZw8QsMgatVMe83HyzpQn5VDWkR6wmOen50gz6zmdhHt+TldVLvWMjcEIgVAC6kJp5b/i9/7nT/+09wm/G7fhv3Uj3zLV0716q8eRaezyB6bGHOOsIKmFAoZGNZnQUglXi73urbt6fx9Kr5HvbFxRQZFDfbpun5VIylf9d/V3+8T2G1WTR6juFGsYov20NmfrueU7t/Ux7TQztaM8ZAxyPtD6/DnkVZj+zN2zVE1q2YIRkdUaghda2MbB9naa9cSOXbtsjXEMPyDAVF2Npnw+dz+s3/0b7/mzzFDGhrgJz7yGuHWHd6Pzn/7zdnqBiVnJpKlYqx8ErTdbh+fymkeSLUx0QvBeNIlTtuYJ6YBG7PivJDQOTMMgqMCThgezE604UNTz8dtg0FjBdXI/u3ac2oW1xeIAqAEiMFQP3H79m0rb7ymWjPeb9+GjXH6H+zxucSyFIUUDJfPKy22TteJVznsqE2Dklpuau1VnKY+Pb12mo8/pV1ucOU6QQ5yswPVV13jo9prnQY6ZAorYxaomSTS6o3OU2BJqpph5d75v6X6fWrTXLz3WagkaSi1LmofEwSafd7XgnSkOkqNMaz1qU1gWSlzOIDa9Yt+BwCaUMtcuPnv0tzWz2p17Y4/cLuvOdi02bWhO6eq+UFDEEGgkaQKieHH+UTo6uS+pojumH/1w1//8QN18q3J4hQTmyhGmet6oT627WB5OsNFmxwudPko3ToojS57EGiDTtITnLhd27WRh4+QgkAhswopCKlVOl9NuhR+t5jotvmffvB3fOt+PP/BmE4nbOaikRIjQzurXRu1UM1z2GV+UPP9voOxHQtqx9S6sLbmdWX8fqd2k6wtBphoy/aZjJc1RD2h0dJ8HuoKpZYOTkPqxzeJhuUWD5mEVuajlnVQaIK5ijng/hXLhoZPVd91uzzt6+d/J7a2cl76DStgWGEYy0iFkKbld9iPOxHdtp/6kd/zzVf2sh/c1ycTNmc25owoMD7Gau7Sr6BeQNXdtuY8wqy+ZC1kWE8uAAOsm4shQ9xFULLFOel6wtzklpogJ3ke5cZO0j2J3SRQEImQiUZmGFngxuBbt24xEeSfvPGHf/1Er/7Glfh0puXUTtSKmTKApQqrUIChhWBSDaDO5YqlJqtJZfH2QSMV6KQJylHtNXrZeUywfEDqF/D55hTPQxdgYOHmzPvcwOPCewl1P24H5hfimEMxqhDjcnNC5auOyQkCzLEDkwuHitDAFS+KsVELTlmXjxblukINc6Q1oOI6DE8wrr8XO+bWjAEItBOSFzN/wRAoWGgYGyGzEUxWJoDwR+FCYbQ5+W1XZ8vrlB2bKc9ZYYnc9H1isM0219gGHaWhJtrTxKIGqtJtpE9ymVqIXM5zNpZE3xq5jHkp2cafBWVmpzSObgwhDUMxUkRIrIZBnOSf6rxw0YQWhxOcSYQFlCyhJC1SISo5qtKkNKjjJ9Rga0Ejli9csG24DlpQxwbeIu1419oMEalyhkgl4YxKmuMeLSEMJ6n0WmoLdgtxgiF2RBXQsQ13rDLTBIVHWge7Kwe3C8PbVO6MuV6l+7WwHeqbE68hj8HwGnyKNQzwMsKoyzzpNWdRDROkNfti15rWkmUFSxEyiiWzMZ8uCCtR/1/AFV8rMMCpWuipTkkhcXRWYl262/vq0Gr2JjAOw/IBw2EbGQ9Xbn9MKBTfva91dx8d5nHZEyxVDb2uBW8PXw4epBqLNWBRPDua/65Vm4WCxRSZTIX0jBYr+kuf+pXHn7p1C/z663cM37lzB0SQSMtvnukMCsbVuPAYFNW0hd4TPMBeCA6X4RY4RqQJZkvl/bKiU1scXtfv16+Qqigoqq/lsNyauL0GvXzXoqz3txOg68cE6ziaiFR/UsMEydP+s5SFCquQGHXEyYXX6cfwcvwzf4V+JNlEgHZJ0DJM08WrV2Idq2Nrw6HEyNjLIj6wdsPc2vEVxdbFNba91uOh9YcNJ7a5rS6cevR+R/wqWWMe/xMFI7GNoj0+PuOfjU4+/J/fvv3J7BOfcCPMr9+B+bkf+6b/cD+235IsVsJFCaGhi+diGqDI++RQk3FflWe0v30e/Wd2np63/u7ak1ngRBBoWNFiZQJjo7//1d/zfam88ZryXMvQP/E3v/U3wJ7+1ZjTqU0zIVjiohhQPZeWGvBE/6KsYlf1+ECRHiywLetqaBjVBUkU1jF/9AoTWt/fsXjYkMkekuIlNfzTfb+eK92Bo3ZhiJXSnsPHsPnsHXyAAY4qLfGWNHYSO6Rn2a9xsXu7xI1nCfMrJE2goTOMVZTYCJmJ79cDC1jH6b8/i+XlJFlZIkNh3YS+CSbaTubOZS6gpga6Xb2gTFm7uMonF+3DJteRcWNIm3T0Sahi0jPvsu3VdDkrc9e2PWa+trMwrGjJTITUal1PgdcK2U22VhgGRAZCrj49SZ/wo2Ga0Ujht+19QlQWFndaijQ0Q6Ju7WNtYkZfKQKgWSOkprIU8XmBi3wIuUFe+Lutxknt/FrDLScVjSzPzy4OOLTVAgr6HGqSazjO6v1ZqwWHmmWLdtnU8qkIe63XMJG8Lu+AEW63Iqi7kDrGUuO0Zo/v5Nvow2foODMyUUjsBKlEDfIXhmQZUUa8LZaXAaf/YDm+xUPyWTxrL+rBlI3vusG41dTMIlB3nWNsU01ww0HZ6VW7Fq4GIQUjGqnVkkmUAS78pdAAI2VEcQoyBixB2EuAvazD1Fpxo5A9uCNnGDWuusp9qKVCmAwjXC2aRQWL7KoH0ZW7TCNrMlGHpO0kC6YyAIfGVj5rUU8rJLJdvwxVMaK12u06kiEZIc+GaNX177eVOe7kD2zVeGkrMItIWzzOEEyq61nztV9KelpnEu0k+6Dxdqod+xAYJRYxzRNFC5n+m/pvdKQsmFxtj62r4n3WzRNgEG6WSLyE52sLgamXoGx5TqpxC9IGY9J6+7bawq3cfzJuDFsPQbn0uipyyd/f6KoXJoR82ibv82h+y+hdDygYUaLiKS8e46++eaw/5XgP7phCTmpk0MjAMCiJD7pyYsV7yar2SWt8U+gkCYLRcs+y5LUtgleFO5Aq22xU9HsRnuOBzCL3Vfq1yDKsJ/cg5a+W+C7q/n1nvGLt+gQfs1eLcWvEB9bj9yhgy/a5sEAjhK16b6oVVfc3bDIZl30UHwpfyR/217EQWBFY2587235/NNZOuYYC/kG/MML71p+xbQ6shJniMoytudb/cu6lqNIXBiF25T73r6s24EPW4IQD8qVb0p+7wwYJm+Y3P70wxCFj5k9pYoAYIgwLZaJ4ysfn8nO/fDr9U9/zPd+XNjBAzslOYQZLW2oxgUeFdFB3imWvd5kuctJtCcLcEsj0pBaT0CaoH3Uuv+bYbDYgl+0c3t713w+o4hcTMpoTIEQwoiCIACs/9sf/+Pcvw/i/wgQGsvycHy40KI/ra8dY+rMpQtIBalQaozrHHrp5Bddjc9U6u1SzRQfzB1IzZq73nGjjPZT1mOOY3S1DcncJw9WUPtxTmqZ1AWvyBtfbyDYeCWPUqbuDw3rceLSbi2P5A8fhjJv1tTFa1AdfbHBNevaFn8t/ytlfNK1WCkmi7nYht3rMKdHu/L8AINLCYL1dWFDW9v5JaO+XHe7TvyS68R7pnDoZLI6aB6cMmhUa8SkNmGKiyx5bqjyvXGTVyhCHVQf2uNES7osUlcHPfrEV/CRwRycABRoiGtZqGNYQRKqrDLhmcBnOUOtb6N1t87BRo8Ys9R7GVGeBDgRggRNJztDQIS+pioX0s3OOGWjGuoJP6wl7udqPrgyRNZtXeo6jsYHOtGbxdjH7rI19rMk74qbm3tvf3usLmIMvyojt1cI9iUrcYK1287qtHizePNe6jIVsXj90TXVlJtFY765QRdAWFhNT80HXKMNts7K+LvFFBSBtSYgOWfI5/18MQ5FY0TDgzvrnumsGtlp7ovWqDtymHlOg0/StbL4B9MTrJrRyHemx1mjNmc+t/RiuI8jFteoRukxRyFy6TInu0ZA6TGEQCIpAu5H1lPQUjFk5ArINRrHGfeXCbuWwV1RUzGu9LEnnVg+jkaShPEslBEwaIdxyMcFEXZLx+Q/IFq8BWophECO1kRjRnZqNZn96k81Psrz613BWjcYJV4sLpMCjWIo8X1WYqKoJteBbZbycrcyTgGvCYqDgKDJC/CZfi5PZGiaTC2juWDfSKmSJbDW+Mt9KuepLtuAiFK9WkB9Y2fBU6hRAVMJXUhz7DkAmclWfC28oyswPIqqIJ6lcJBgjQotKKD7SAAXuTORWgls81s+xbWWmGaKdt+YKt2T7dNcsCTj3pGqnCgBLzmKSInCTUXq7g3UiuabWLh5tcGBKRaDZ4p2yCl85WYLQ/UxrtHSpHSF1M15CP/3zL/yEIMSwPIGxE8lkSucrTalVvwRUA6DXYoBbTaEMwypynnwQbN0NbGvnW73CnXDlLBRpapWDmqViwIZpBU7QlpubqvjaEA1TvMAMaKdd2EIpDZloFLX/UAFIQZ/zIcsdOqEObuFDSCQPIdEAaV9VqwybcIJfAaxgoUDEftOXJBrFISH5PrcADEhSiBiIzUBioMiA4bgni3ILLXofjQmEaiGr3ZbH3UpVK4N41kwCBKpmjvsDWiyaYf3hZNRPKD9+ttTGqXA2BoqJaUbi1/Peaa2mSAME4DbQ+csXsPmaFcTIZCo6OuD5Y/ztk7dO/nk9/q9FAAYa2MjqVH0ZIu5c965pUhDhYkOJj4eRDqZbauAwVVNzLDNuA6skjLiOBF61LlbldWZHrnWoIEou3/zW25GZr1bXQsTZhumR9Gp8LXK4xTnMfi4ULLnygRYRiGOQmoI4hpD288Qg0mAVAxwDiEBKgZRfSmIBa2ADzY9JQMgASSBmCWtWkGwFYAVBAkYGJgNCVghDEeP76rKTunGpdjyLgkVd1KAO1nknJtiIAAixN1ddTKBAUC7bwML3kAvBbUOYAV6zR5tEpgroRhxqbDbIo+ISoyeCzVdsDferRF+S1IRgsP68lkkFm+I6whC5GIzwRLRLFwNooWEkMlrvqfsn/PMP9m/+yd/zn/3gSv7UWi+w1LaIDL1t8X/dbFEEkAZoAtIRCNpvOuUWVWFKdoCzrYG2G8yE1LmbhqUxFBE7VDObZIQADJ+A2QdBCwQWLBkECURW/n7ZlhdOSAJbzpP4wtECDbACKILwBMQRiCZgNYOKD8DRDEKxO3iEARWB9QzgCYRikI7BUezGyGaQLIWIbQpAu4Jkc6jsHCY5h5gFYBYgrCCyctohMhjJAHGxqZybykUYUxUzXOd9lgGoyJAsHGeJMoQit44pAjgCsRNQIAaBy6BpastAahRfqMwNFfz/VSeaE4Cl5KYOzcOFmEkh4ESs748XwF4QS3HwGpBkIDhtvBTWUhvj58U8Jl//NwKpGYyZvPGN3/SD5y7+r6n9eQHIhQEk+clAaOXj68YAqbIsw4lx2QgKxFNwdATWByA1BSiGIPaAJYcWcLPedle8nkWvJiYdtWyHavTi7B0wyO39DncZARtphJwvVruCmHOY5DEkPQbsHC4wnQaaKOvnxuaYq3hNpjh8YggikJo4Yaf3wGoG0BQq2oeeHEFNDiAcO7PXC0CKpk4DpBiIpkA08RBWCmQJYE1NRhlAEiCbQ5Iz2OQUNp3Dmjlg5hBzDpglxCxgzQrGLkCSgG2pFZJYrymKD95fc3bV8OQCfahFElD1NCuYdsJ1Z4UgpAG1D1ZXwHofpKZgjrzZ5a0an+VEBYOM1LDHcl6okSQeam51bZ8CRSMoxxfg6kS+Qh45DdoYA/jSFu77psAZRQys18jJrEA2BUmKMi44zwyzxX/lmWOjppoGTJ4BOqIkjWAoflsE1Ar+tZnAF1FsqdfsUiC1BzV5AXr/RdD0KqAOINiDIHILqzh3pAnYb0kA0kinma2ZRw0yBekIpVgrAJ154zQjA5g57Oo+cPYFZGcGkqYObCKpaTwXmScnBPPoeOEpwHsQPoCoPSA+AM2uQc+ul5s73oeaXAHiPSfovKYD0oDWAEUAYkBHgIq8A8cAJnMCsOIPsgAywCyBbAmVzSHZAjY9g6RzSHYCSc8gySnS5BQ2OYZk51BmCYgzl90GTaAqwm+AitdCUQYaYlDXAHaJwfoa1OwDoOlNUHQF0DN/kJcCsLkOArNW/JFKTUsCOY7aSo4QmuJ1AZhjj8a/ZwGTQZkM1mRegJnAFAdEMoiZwySnMMkJkJ6DZQnCEpClG29kYMrAzjX2nBRjIhirYThGZmJFBJE3hghACqqQSqnCS4cAksA7iwIipyBAwOfhWoIhDfABePoS1NGXA4evAJObAB8BiCES5V6AmtrNHQiWVJwZnRKuJT95FDQxmFV4NJTun9eAbAqYM9D5F5yXfHUCm50BSD1jCyo4TsN7Kd2YYFHkCQxLDtczFEN4HxxdAU9ugOKbkOgqKL6GaP8G4v0XQfEBoKYgPQPifUDPnNDzHs/ShaycVkhciwASVFMrUQgAiHEvpCC7gkrnkGQOpMdAegpJHoMWj2Dm92CWj8DmFGRPYdMTiDkHYe42KSTQUnq2gzQFXJvvoYIJB3YzeT5BKwyLKVjfAO99KXD0pcD0BSA6AskEJBEAVeS4VzS4gt4oxPVCquua02SNrU6VwQ5VWlscQmQzUJaCsrRwQLnP85/6dbd4iGR+D6IfA/YUsGeQ7BjWnoFk4aCJBlYwEnvvh6236wQRBSsK1kxh7Gytgqd7MUXf+3GSvy1aTkEwhagjyORF0P6rwOwDgLoOYAZCFNwwJGTgFsEhbUbyhhJuoIrbpR7QBQSgeExGVkB2AiYFPrsL6EOvbS2D593ENPAiRxiAhqUJDE0gvA81uQ699xLUwaugvQ8C05ug6Br09Bp4ch2IvMbHU0BNAEQIyiy1bL6gLFWlinwfuO4cPogT0GQBZOeAOQdlx9Crh4hP34VdPgCbR6D0EbL5XcjqAWzGheeVKyQetlVTpnVn26jNFbtDe/ISMPsyYO9lILoGyAyQCIBup0QLwhpaQZMGbVBX3dd15GS5ABTAZoDJQDarCcB8bgxgzqAm96Gjd2HT+1DmBGQeQ5b3gfQhbHoMa89hsAAh9deoHzrPilaYI8UMkQgGkRhRMkAA2lJMt9Dgl/mzMtznEGqPAAAnlVOJwTKD4iNQdA1QNwHk5lUo5OoLoevk4UGewc2M98tsNgC6Vw4PjR4C+sA5FqCcRi7rPdpNDjnyGp/D+QxFEJoC6gDQB+D4GuL9lzA5+hDoypeBDr4EmN4E1CGI9wHaBzjyZ6PH/aCwnj1kbKiEKc1ifQiolTd1z8GzG5hEV4HkIWCPgeUDcHSE9OwAdnkfmTkG2VOwLKEkASMBIYV4dLPpwepZIlTHDNGII8yVWgsFIXeQk74K6JuAugZg5scqwsVDt4ese/QCToAASgBtPU5kSyGYa3FinZkbX0MUXYGkN0H2BMiOIat74MVdZPN7sMlDWHOMDHOwOLMYFJjVTx0DzJ/cOfOMaDESY5FFJGb2qwD6IMAhGOAIGqoa4FwzfsAWMEJQ0G6xUARg4hdPm2dvrAAcI4CAp8eSYavPQzGAGBbaTySNXPzVTedcKxopprC0B9JXoKY3oGcvQO29hOjwFaiDDwKHHwRmLwHqit/EHtPzCeWA8jADt3gPMF4dlra5i5wpTQqgiVsP8RRMM8DcAOQMWD2CVlcAdQ0mvosseeC0wfQxxB5DybnHqbJBAiiXAX1lA6Ru8UlukeQHQ/jy/e4UgGPzYLvWPQ0Y2Bpxa4W+zpZrj8Rr4BMQT0HmOmDPAHsOSh8Bs/tA9BbM+duwq/dgsocw5gSMJZSsoCitWCjbytjZ/KBw69VASxTv8+IMdxanL/5PXfF/hQC0XK+7QDXusibE1srDhtCFT0WuQFnuNOT0Y48fcc20kpEaHa2xa2jN756QAOzEEm0paIRdJXub18GldjOt9kdRE5goEH4KBlNYPoSNX0A0fRHRwYcQHX4I6vCD4L2XndYXXwXUfqDBtMwJj+ONo8Ef1q8bBffXzrOsUwArIHoBTFcR6Reh9+5DL+8hnb8Ns3gbsnwHxpCr3QvAwpl8DOmFgUP/WhkcXqqBBY4deoqJIcS1MVJeKOpAU5YLanQXJQ6Qdq2wcQAb78SaOQ0cK+epny2A6SMo/RJI30B2dohs+RZsomHtieegdN5hZot1YWnbx/zC6i9UaIAW2sbRjO+fyP8P6fS7PvbHby/lj/UvSf3E5DVRlTpJaidSmzazFqiRkaDdQA23zTy6kKiUfnOl9d2WeEdah/k54ZdJBMMzUHQd8f6riK58KaKjL4U+eBW0/0Egug7oI695Rj4WUHnv5JMo2iO1uS7TI+GdCaC49GjqQ2BvBtLXQNlLoOQ+cH4FfDqDJcAuLSQ1MJKjQHVNf3ivaI2uIZ2ini6wmTfNyaWR90GArYsX2OK0V7LO8UbetJ3eAOgQrPahdAw5iyDnBKwY1mfxMIzLziJAngoeGMS2QkFECakJCPxDX/369x33xf+VApBzpufSN0UhHtIqzHoFfnPx5AGcxCAONT72y1WhnbekLR6q72brRJVFW25kE0yV2gA3yfXHzZN0nOwUaD0+4r/iaWVfp4V6gz3E1z+1FMEgQsYzQN9AvP8qptc+DHX9w6CjV0HTlwF9A6ADr/V5z26RakEdG7vr7rLhBu0Rrg1PozgtJYoAdQjIVZC9Bj3dh4piWHYOZCOAyRRYzkBIYJF6kSr9faUW9KWGgQtC9l6fLx3CBMUcdmmAm8NKl2iWtMxDFpjKEyBWgNJQWoFUBPbYsqwyGJN79AlMpoh9fKLPJig0cYsImWhKVgzD/Pl18X/rNcCtP4s/eYQ73r/oCTfk+zzCNN7G6d71e0Z7qE94Qo9rGTQyO4FV++DoOvTBBzG5+mFE178KuPrlwN5LAF8FsA/IpDTbhAY8I2043pvOWT2AWDuBzR6jVBMQuxxkJhejZ8HI5tp7iU8hPtRbxLSjD1tb7jRg/VzGuF3UNGlb414jFPIa+KEb+j0CswYTI2MgkwRYpS7rR5aw1gf0P2k4vTi4tSdAVchIIcvU2vi/YSYwV9MNSZpmrdMEh5magnGRJNtnoB2IY1G/ktB5NdnkttJjtZeflawtXhPNswK82WsxgeFDSHQT0eGrmF37SugbXwVc+TAwewXgKyXWRzlmRdsNdbzAhqxSoNU1US76WxwQioA9d/oricCIAZnALAnIBNraSr61asCxNeoyyvUXqRa2yvOIZcvC6wkO97A9F6i/hbYbAzgEFAMz56xSEFi7hJUVbJJCRMDWQD1BzY/C+t7k+f8kgpEYGWkY0YMnSQ+XtJuKnCBVp0j695WACnXbbFHatZls265JdtHJNoE4zeOzqmlQ65szlU2B+e25kIYDZ/ZGN74KuPIVwN4rPlRjD9WQlkt4bho7tDSSEp8B0eUmZQZmBIaCEoUIBEMJZJnCphlIcp96Bhs4Rp4NsTUEyx56nnfBFJtaMhRohFNAlNO+pwCZJXT6CFl6AmPnsFkGlz4nPiZTnuA45uRp2tUAQQRjIxjRMloAltWzuse4KzOtUxOUwPAUgUIKxgqgJVyg7wIlEzNvyeamAI/hmjYxxrQMPWVSoIPtuuDYo9oEwj/xrxQEAyYDkwdKd6Ly7Lezn3Q+gMQ3EB+8itn1D0Pf/PXAlS9zwo+vAThwmE6FP5HXaH51B1XdaTUkUb7ubfcvCTQ5/6K+4snh/BUYoSo1wZlCBIZii4yWMJTAwMIaBiy5NScpLExR0L3kD/QUXqEGGlSfCxmD5EKVrKQF27S1V31t0QD5VxsfCR4iwJaHmeX170T+I28xsAGmZ+D9+1DJY9jsDMa4GEwmC/GC8LKT5vIpsOL9/aRhJYaxE2SYIDORAjAEArx8L7BbSMYNEhIwFiA5B+yJH9g02Jx25MWppqHmMWtR6eHMgf4Geeo64ZenbBmAMgwuzTdaA0z8QeByXskzoKwbCwMNI5NC+EUHH8L0+ocR3/gqL/xe9mbvNBgD2mDD5n3J/MulscFmru/SUk86DxUhDuLnlGcEin38p6rijzJEG6zHfUVOs1UA7QkUpSBZgiSDFYJZKE9oIUHGSDjH40TWtrSWMjMj8+s/8ew3uTku7ZpGowWpiDmmS/XDf1MriFsUhxmgrwKzV8DJQ8jyGJLMYXkBKwkYjCcbHO0LIFEEgxiZjZCKlszycBOYETBTDM286cBvGngf5zxsBmQTl+qUHgPLe858UQs3qBS329lrq25zTQD6TcFTQO257Aee+Q3XksLVyVXuk/plCRinPQCZZ9NoC90Z2/JgVPhUuGMgeQyYOSAJSEx5kobx0r7bRrzXiw8g0YuIDz6Eveu52fuVHvO7WmJ+ldzRsA9dtRqCzIF8g9olYBMAK8AugGwOZAufveGfJz+E2JtM7GPjxM+LmgHxAcB77tCjqHoWj64EoMuNwABmBiwGWhiZ0TAZw1jjhXXqTGAy7slrccIhL4EEMKCrgXwxYRjSGJRWRQLIArAuBRB2iYKwIF+D1vZYsOQFXuRYedTUB5KHB7+uQR5j416paVXRATB5CTI7BSbHwOIUYk4hMncM64RaMQPp1FvGypl6BAf5MRBMYDCRVCZYJERLI28CwGuv/UYZuoIuEe3w7nVZwqanMIv7jj0kXQJ80LIRwtRJ6bEkw0Lh7Nk6FMATcHQIxNdAUwJFqnH9YS0D0jkkPYWYudvokuMdBm00qjRKALqZJ0mdADy/C1keA9nS38e2ul0EAiuEDDGgriDa/wCm174S0fVfB7ryFU74FZifDpwHQ7ZouEFzwefzdNNTiFmAZA6bnsKujoHk1G/cLBCADLAGRROQit0CFe3mWe+D966BJtf84bQH0NRv2rYwHOqBJkLnCAOyB/B1YGbBFojSDJImyOwCNnHUWnnVEdokoX+r2l/OinMCSR5AkkeOiEDSqgDMORWpQxiQBngCUnugaB/Qe+6QoSCrh2I/xhEaZBYbRVlMAHUVNHkJenYfsrgPMfcAeRRo++M4RTcfUfYOwAiZxBJNDnhxiv8+W974WREhZrIjBKAUTMS0Jve3qwZIqBGW1bIEiiwEK9j0GNnZO7DZEojuA7wHi9gJrsYJEebC5l4fqnkKc0GoYIRgRIH0DHp6HfHhh6BzTZDHToQFJIVkZ7Dz+8hWD2GyM1A2B3ms7uIaYM4HmILMGWT+LmR+D5LNQdaUm5RyQcsgdthVZhUsTxBNbmD/6pciuvGVoKse81NXPeYXB6Z/H9hex6K8aWvnTjNJTiDLx7CLh46zz57DJCdI54+QJSee0NSgrIDBINbQegIVOXJVIxpWIpA+RLx/A3rvJmhyFYivAfEVl41CE5RZFbmzZt2x4rWg4hn2HMHGnoVOE1C2BMkpMswhaQpjHQltSThrG8ZGWy4wERoVEy+GARrALJDNH8LO30K2egdIH4Jk5bRUFl+Tp16LhgILiyCswTQB632oeB8cHwB6340nT5wgVPtAdOgsoUIzjDow8nXmpvaQygEougG99zJo+R6y9C2ImTjNHwo5l6XUtOutC0DyzJBWW633+cGJ+kVZzP7EN37Hf30u3/5f0RC49tIxwJzq1MoSkj5GZjPw6gTgKSxPYKFhLbeoUuRNXFsTgLVC7ESARMgsIRMFivYxOXgFSsdQ0+sge91PiMIY7g9ICmRnMMv3sDr5ApL5fUhyApYVFBJcrDaqRZ6+zTBgu4Rkx5DlXSA99SZbs5SzzX8hGpb2oGc3EV35EOjoS4Kc3mkgRNpiDG23xoslIHPAnDqTfPUA9vwesvMHyOb3IeYMYhYw2TnM6gQmnTuIgEyluBKxglURlJ6AWMMKwyCC8Azm/Ari2Q3o/ZtQey+C9l4EJteB6MibxjP/DGE8JLWA9VL7XHmhvw9oC9pPoO0CkFNA5jDnCWwmgMkzRZKn4P0ttWubnSOb30d6+gWYxedA6T2wXYALwoJakaWqxuELiikQRSCeQuspONoDx/sg5bVBfQCOr7qsjviK07pp31sH4ToZunbzw2YCqAPQ9BrU7Drs8giSToBMVZwvl48Hkg+BURY0ZWP1D/zW7/jBu2+88ZoiokE37xWAVDDjtmsQlXicnnFz1NtLSCZAtoCBN42IizoLhRZa+Fq5rLBQqeVRc7QTOW+oYWSiwfERRAskueE0mAKoN+sT+ivPmYDMGbC6j+TkTcyPvwBZPYCWORQWnqG4epG1PtEKK6cNMhozsKzAdg5l5p56yBY4lRTzQF6Q7IEmV0H7LwIHHwSmr3hqsb2aOdl1JIUuZltiUtbjs8ldYPEu7Nm7SM/eRnJ2H9nyEaw5h9glSBKQTcCSAqG2mmMzPkTF+nxvS75UoWiszqbI4kNE+y9guv8yosMPAPsvO6dNfAPQ1x1rRmHCcw2Up34NRXyIzAQAZVByjomZY2VSpHNbFmNC2ll2s+r99cQpkpPBrkuWQw1rRsmxCeNwZFnBmDOY5AGyxduQ+Zvg5F2HoyFzzOMtKmfIAJRXVBSvLVvSAEdgPXWEtnofHF+Bnt4A770EzF4AJi94Bpub/jlUbdV2VDmsxGZ6OIP2gegqML0KFe0XygxAYAmKhtHllqoXq5CZmBc2QibTN0VAd+4Mv8YADZAHe836fJYszrEgWHnNjn0FSAJJwMPVUmRd6sSRLQLQGobCBMwplDkC21MH2CPboO+m1IjMCZA8AJbvAsu7gJx6Uk7jAfQqv3ovju+Db6lerIYEkudg+ippUhH1XvOzCgYTcHQEvf8C9MErblGrq07zqRAaDH1Oj/fJObC8B3vyGdizNyHnb8Gcv4t0/i7M8hGQnQFm6ainyEBRCZk0zhABJKhYxkSeqggwlmHTKUx2D6vVXdjFXfD+B8BXHkMdvApMrX8M9tEBqkNLoZaxDclaBZi8ADr8EDg5AS/PgNUcNpvDYgk1uOLXtjBA1Ly/S8CegbLHQHofnN2DwhkYmVsLQeW+MjW+XtS9WudFoCCsYdUMpPZg9RFkcRW8eAG09wp4/1XwXgJMI0CHLExDIwQ4EBsT72h0tWFyvFmEIQU34+XblwKNTDRWdiKpiUEEeeONCwtAaQr/Gt131RTt0wTzaXLJ00BWSbms1FglN3hlPWEutVAH/5diIXfVCUFo4vuTgSmGwgIKS7CEpmTolVKdp3UFqEYKlgQaS8SYA3QGjTNozMHIGuSWdk38E0kVRM2L2EhRPAhFLQmqUA1pQDRS6wKep7Ob2Lv6IejDV4D4OoQPQJg6IgFitBfTrnt5TYn3yTmwugtz8iZW938J6eNfhSzeBlYPgOwx2M5BsgBLCiJTVhUTKaIHQqblIq4uLwzkNRUNgWWCYAGkCdLsFMv5Y/D8ISarM0ySJfShAfYNMDEu95dmgVbbt1HDuELtn/EAiF8E9k+B82PQ4hg2dfFrFgufzB8cWhRaLTXjtaVI32ZSUfxeyMBIoLAAMIfCGSKcgSn1YZLSOLilwdcphac6r/XiKMxOXVyceYxk9QB2/gA8f4h4dQ5tCcwHIJXzcEogCIeY8OSC0SnHGGewHLlcG2GQqNKbfalOEG/+kpYMMVYmpoWJ3xl7lSfGBlNOnPiNnociBBWzPJutLTLATCXIuqDfz82TgsvVeFNAwCxOO6l4C2nDhWqdE4cB7SnrIpGCtQ+NuNhhAaDV8sJSbi7qjuh3J51Ld+O9lxBf+SCw/xJEHwahD2oAqB06O1YAnJlvTz6L5OGnsXr4aSSnnwOSe1D2DBpLKEqhKIFi44q7ixTCniBlfHK45IsaPqVHUDhHPjMYnMOYFCZdwWRLwCSQbIU4TaFNAj5aAdOXXKBzEdg+dHDz30SOwXn6ItTsFejpPWSru4B9DLHaU2eZgfkS266OJuDcQcgGzAYsqSMWoHyN22Y0SnGQBsY7h6tPYMUVNRKbwZolLBbO8WgthPcQxzdA0ZErZFVcQA0c4wBvpbI06maxphf0LjDDGpbJdJ+XD+h/uHr46/6lOEfB4MRk3Yr/V07EZpGWvPSfdMRrUo2Pb12t2oYrrs2j3AkC1JQ42VY2SZ5uBQhLcfrmGQE2tPfaMKR1GGML61f+DyFbEWNGHNmB5T3Q5Caw/wGH/c1ugqIDH+pQDX6l3iCOPAPlHEjvwZy9idWDX8Lq0S8hPXsTSN6Dso8d2zKl3strnFeS2vzZ3YEVpfYufuNKEcCgYcEkyKyFXaRYmiXSdIGJOceEl1AswET7eMIITaKInpAZIa+lHALxC1B7j0F7d4HVuzDmPqzEXouXvAROodVWSjHzkCW1mXAMl4OIhfWV7/Kjpb+Il7Rsm7DOry86qwyUWKTWIFsQSB8hmr3k8DuaupM9hE2CSnrUi3cqABOQmoF46kqqQsH6NdgHMYyFBUskIMAUnQfYRtGE75/KL3Nm/vhv+sY/cy7yp4mIxqfCPWl/2DAV1wdXSJUlWlA9HcPIrhKVooufMIGhYT1ZlXji0m7wew1mGchNapXi5X9zH7ixAkMKKjqC3n8Zav8DkMkL7hQv8BceOOpe+7NLIHsEzN9GdvwZJI9+Benpm0B6Fxon0LyEQs77Vvoky6XFXqxJ5fxh6RYLIfJJJIjYQiiBsgapzZAuU2TWUa7riYKKJj6MY+bDZAjDGFckAOynID4CzV4E7b8MtbgGu9wDsshbDcYXJJcnzFJFfjYoiJrzuSo+nk7Ils6ECtS0xrLx2rciC2JxronMYGUi2NVdmPk74OkLoOjQ1XwpsqbWRaKHcX4eauDI15HWRZ3vdg1lm+NWUOmJ0hMYsX/zq7/th96REd7fQgDafEClDfer4YFUeneK3Eh0x/nU4wSH1hUNTcN8YYT3EJHmPmA8kQVMRdHrXNRx+e8gY0P63OOVcprSMn5UgoJCriIZRYhm1zG78iomhx8CxTcA3keZRrhOIARhGJK6cJv5e8iOP4f08WeQnX0BWN6Dssce41wWRckrolmCCIANYmm5UvjbuqLcIGdaG4M0AexcwZzswcaH4OiGS+nTe2hmJlCrxZDjx6XNuO9CQQ5eBM6vAWd7QBLD2qhIkZO8AHsbB+22icPDAu/1U4J96kkokDttdGk1iagw68k7GjNoaFjMXX2P5X3Q8i707IYXgvtBtAX1lHWlVryVKAIpDabIRXSQurzNKD5yhCIYiWi5YjD0p4fy/3WrOehVaoaAJJeMHdY2s1wmPtNcXG0mJbW+P0T/XJdT7NJ8rDcUDTREz6D3bmJ65QNQ+y8DOo/5GxrfGDh37AJYnSA7fRfJw88hPf48sLoHtqdQWEIhhfKCgVpzoKWxDYbLiNp1PLOwogyRSqFxDiQPkJ29g+z0HcjiPpCd+lq1YYbMkKXNhakGdQhMrwKxCwp2tXx1USD+6S13aaynkjl9bO55aAPlZUit1+IzKHbpnVnyCNnyISQ5dmthcKQEtWqEpCOQngIqArFuL7KyRe3PFz9CZt0rsVHpKx3rBMlzgcFlcRApTB3pxba6NLvuDJL1dYZDA4YC77J0mZRyWStUihtT8GouBNtSQ4Vq40OjBbUUBEMaoqbg+ArU/gug/ZddPdqKAOzBFyhE63zISzaHXT5EevoOlidvITt/B5w9hMY5FBLwUOqoPAyIUKnO0P+bdgJCR+wliABklpHO74Lid6H270HNXgGiK674+hpHTzVrggJ2lBmg953Gow9g1QyQBZSkvsu2Npcl/tR4bWVpCazH0ilPN5GwvGUzEwotGSGd168PMfvC7GYJuzqBXT2GmBN/sKSFZbN2Y9UQKSIG6QlIz0BqArGRj++lwoK7aCZIKE9z7j8rE2QmRkYRVpkezP7SrwEOPcYvrbDxs1JltNqTcNFLr0azzR4QjCUYaLDeRzS7Cj27Dkyu+qyJ/QAXG/o81hW9MeewyWNky4ewq4eg9BhazgrhN/owleHFAqRFtxZ/iBIsNKVQModNj5HOfQbK8lGgBaYYR0aRA/au6hzrA+j4CkgfwvIUgmitBniZa36Qljl+Olr+9hiRTWHSOUx66sg3sAIuktpJzuQl9qQMXqOWS9BKcvdZTn+VSYzURsgG1P9d7wSREtOhkQNPRAVzbnhQtWmCVAXJRprAXTU8npDjRqTwgIOa/QszPUpYdf1CaGKp5OichCGsoaM9xLMriKZXnNeX94Lc2QGnVl6AijKAEoicwSaPgfQxyJ6Bce7iJgcIl058aGTEkUjV00lB2BFbAck5bPII2fl9qP27UNNrhZlVxvn1PXsTJCaKoOIj0OwGzOoqTHYKMU6orjUk/NwLZLtGR0FAKAHk0OJAkKomGDqU2rR1x/AUqoO5tmNgzQrGLCHWMx2J3TBjo4XfkUpQhGi7xllR+BwRLCbIZIJUJrB2uvFtGM9Joy+ymwu88wMazBPoaA8cTf0pG+b6jilEngJeu8qWD2CSRyAz96EuWW0Dju2vXCQQpFjeOfKpkALmHOniHpKzd2AXdx1rjgTsM4OKMlVLb1J8CLV3HSq+BlIHPnzj2aG59zVkhxFHj9zopbMuOMi3Yb1ULnF5pWaL6m/I+f9ipJkWK7SxHNN5zm1eDjFnhW47EKSWmkO9cX65N6nJKiMtZR5lAGw0aC9RWYWuiWmM3JhElfzhgt6/QwsKx6Gq/cmgPpQYq69zAOWAep64QkAq9oWBuEoGC2nBiWpAFgyAJZCewMzvYXX6HtLzh6DsHGxTT2hgvSYSLGKSzmds0wxDxh5qmTyhrrVAxffdMjcw9hzJ4i5wdgXR/jWo2RVH+KD2fKbBAPqs0Hrg2MEHk+uOLo0PXMaEcBGcH4ritZjmVvZ5oD0JVYQxURe+Jy14Z+04kno8Uu50cmQVpHKqtJEBzFTPfh8PBTX5AIdWzsuzPyYwmEpqJ1immhYJvbuxAGQgqNoxSs70mKr1CZanAatsXwkcYmlu6Ulzdd9CQXjiYuH01IcYdC2YNRkgMgdWj2Dn95AtHsAkx1BmCSlSBmVNAc7xanNrrvAAq5AhIFk5M3hx1zHlJC8DkwWgspG2d55qGQHRHiQ+glVHEHLeYAtVDTV9aiuMRkEJa1kepVri1vrYSFZTqDyAeVAMKfrXVf4SkzNHXNDM6q4u5hQDjUwiieMDXp3yz7yT7v+/REDAndGEBdzAGKjfa9MWF5UzSpe4Q/kQlNcDJmp8v9Sw2icvf+U5w8Xv6idS8H6BRUo9VIYusCz9c40oXESd4zMs6VzAsBYQROB4z2k/kwOIij1oz8NO7kITNUA6BxYPIPMHQHYMsguwJFAwrv7wBlk0Xc8kkmtzA8vU+xTIIgKALEhWgDkDpY+A1UMgfeyBe1MItXK+1wkDHxjNM4g6gPA+LKawOYGEVHPdu1QCIcBuw8oLFGwSalpc4vN7hcYLUYQ1jAlCDENOcIBn4OgQKroC0ntBFtHYgkpB2QibAibxeKIjPuGeMSQZCjnWg8ycQmBsZJXap/Ol/iyJ/WPf/u1/6cR702VjASgtFsO2NH+i/ukaPK9PH6BBv4OgV6aP3iFGXHAI9Aw0OQSi/cLTNp7ZVxx3X3IGys7AsgBTWlTyokuIo6wbRTTy9yQGSlZgM3de4PQMMAtPzb+J55Kd80jtg/QehKceUlBPFQesGr4XweQ6KOhBsKJgEAG8Dx1fg5pcd6FUBVHq6JJ+/p8GYhNYs4IYJwAvgiX3CwHP/mIjYTUjI+qvfs3rdz7r+f82uiEXcFKuoYRh6hRgstQ34F3LvFpJjDyF0qBJrt1bqCMgV5qaIG1j+KWGSdezsAbInebzDlzcVAK+FpHHAKfuxZFj3qWcgWBdKHItA8QuQHYOtkuQTUFinIez0DpqOF91ElAvjFYC6u13LmafhsXH5vdngc8szUB24QRgduZqkUheRMiUY0z9VZvdXz5/NXIU8hzvARx7YJ1q/u/6mqaq9rKxnKptrELf9PhcYYnJgHNXel752nB51IIJLM1A0RXo6YvQ05dB0U2APZmGqG7nS+99DaxNYLMlbFA/R1B6lrs0vvL9IXuEQVAQiZDamE8WGivs/bLIxaKu2dYZJ7aqedU9TheDRZ5WpGC+Lp7snb3HiyJIHmNF2lfS4xETFcQA2gQ2nUPSOWBXoKIS2ZPRm8dW4XAjkIFkBZOcwSxPgHThTK6iQp0MvAuVAoEn4GgPKtoDqwmEGTLCEUBbmNvmKdqWZta16ptlRcOXiNf4RCNzRKEQ7IH1FajZC9AHH4DaexkUXXdFjiqFs4bMYskoJDaBmBXErNzBhAyykXY+bP7EP9fKTiTJtGyq+RVOkHKxodCeyMclSQf4vw4qqlBYSdMUHlJTpA5NVpYIDevH9kUSFXjgmBoRLYzmlUUvtZjIosATRSB2jBvg2LGiVOie+pwAUguht7DpEuniFOnqxNUeQeqwNtRdVdI5N91536FnMohBQ39KfIjdhsJMYEEEKFIQmyBbngPzM8TJAspkQFQtGtXV31ahQd4RoGcQHQFpOK6ygfDawLQoE/ohpGBIgaE9Zpd/xXYYnjViEAprHecxggpGIl80fA+kj6CnH4A+fBXq8FXQ3sueEWY2zBFSZMvkVPepq2qXLnwhL3coOb7IdjIQCqyqzQ5SgoUSYydIzIRSM3tw0T39VNhgnue27eDOLjMQAJhjQM/Aalpif7JJBzzziFkhW50iW7oAYEJSFDS6nAOjFTUaLijI5bGKTWGyFZAuEZmOWsSjNC8GkfYv5UNeng7QbC1BrCvsxZ5ESmz3aSPF+0HWAvln8hqg9bFylqYwNAP0FejZC9BHXw599JWOTi26DlBeQmFoKExIprtyDqnk3OGykq+ly2ODJvdsMp3t8b3H6p/F5y/+/Kbe30IAcu0UHqNVNSW5NDSmuka30Sai9k1EbTVCLk0iURkraWnUrpaOk6+uvBec1WId/ZaKwNEMSs0c9keqynLSaZBJUJGr1BbFZpBsBckWgHEmMNWFCfVpdhhd1LWIC8w3fJBFw35wKJhLK3lItQWDYH09FxeondVCLUqW4vI5aYDm5byrFqWXVXwtEZGqIJQA5xSxG4V7d8EUInmhKw2BBknk57cQj8GYUxnYEAg9Ee9vZcfKAtKwFENoClKHYHUFmLwIdfhB8JWvAA6/FIhf8djfFJDAqbaOCasQgA5LRnIKWZ3A5pAKMpBYh6YGFoCsS13uCGEtIlJFPF0624gn/GCONxO798e+7ttvn8iv3GK6fXtzAdgnwLalMW0TS9oeDvPsttxwJF/khvTEY39jsz9qG08sRFJXi1jSWv3h7T6BSI/8qSt6rRMqhZHnypD6jdVZpnyMBkcBZwoFQucytcB6YS/2+O7UFbnifdicebKwa3MByNUDuBCAefgOg3TsUgU5BtEUxPvg+AY4vgmafgB8+Cro8INAfNPRiyH3/o6pIROUUpCFo1RLTwvHFEnWcCUNWQLD1rDj/4vjCeTU/JWv++bv/RV54zVFr9++UOk53QlCEkpvqkgvprVeCLZpgtTJJrOWZaZ2WBWxaJLjR9JC43RRKR4GJlbi9Vuxy9ZDgFrClSXkWSxziIVcgXHmGMQTz26sB58orRRilAuRfBHbkn5pbRydrMHYqsu8MONzKyDQ+uok3uEPqOb0Il8bQ2wKa1KIdcIQYkfuJKqYUsR5An9U5K9KXqKBqAZ5UBHPuhkAkDdPz+VLWVJ0ADW5BrEvgg3AWIBhSzWPgto4zM5E9pXp8pq4Ijkl1QSsfYEingHRoWMPn74Emr4CmrwIiq85hmzkBZFUyL3VP9eSF+1KASwBnAP2xKUnmjngIwqYDSrFgAdoLd1LqgwQEqtgoXmxZIjE//rWrVt8B//mwseS7tez3g+6lGz1avWJG2vdD4vY84uaI7CegEIM8ALjEIbHygUi9IaY++v0UcGwBEHyOKDxNUPEulizQak5HZoESIFVDK0nEB3Bsuo4ndqusOlYhVTyEYgPoKY3QWYBxBFgX4DCqkqGUAgiBVIKin15AFa1tDl2XHw6XycTFzM6uQZMbgD6hjd58wJTYzW/cC9lABaAPYWk92GShxBzCkga4MnSAVlt0righcusQioKmWV7+/Zt+8Ybr6lLEoDjWFoKG17WYIK1miLrhG6XN7mrr0T1LJPtyvMcAVEVQLqjby33prpzzHYwalsAiqA4goqm4Gji8Z16DnDfZquHh/g8X3FamXRt5hoeIxsKQApqqIQdljzzgakgha/fPszBJRLAZrBeACJ3goxiMAk958p7gSfQ0RRWxxDSEHbYbkiNRSjjEqXzmkODQsPQlglYHyGafRCip4B9AZB5wOQczGFO7Ke0K2WpoiIUqvJdYicYoV3KH7n8cah9uJKpOXuQxjoSXWocUfl8+HxyOYEkd5HN30G2eA9IT1xcKYJ58TndLhhhXa4v1VHwQAN09FdGIqSi85fa1p5+yl7gy/I+0oXOnI11StrWY0sBbLOOwCryhYE2qboVxgHawozfCrHnSOQrNGt4AH1qTpElIk7zy1KIyWpOkE20MA2iGMwxOIcVhAoShPLeQyaNRtw7FzwxSB2CppFjqKalw2NzgodQs8jNYaWBggxDoz0UKjezw+D4XOiF74+dPesKuiMF5AzI7kMWb8Ms3oVZPQBlp+CQV7BTI+gby66kSYKQgoir/5sKIdvi+tTrJpRavEPShgnKCE2xgz+wy4wKefaaF3flNKWLin4bhF95pnwYJxloCERNLCNksa5rRfV0wzCWkwJLDezr7pLnWRsagCh1vcsJP7EWVtxLpLnJKx73muQSGQY/1ueqGUc4LDIgZAV3NYsMxGetoEHlRCNOHAqKDnniTiFf/o26F7MEWS8iGzCRh15qz8DOMYA9LzhsgJ3VaZL8Gii0N42ekoM1QUI9QkhatNda/ZjivytAToH0PnD+BeDs88DqLmBPQLIC0XqHWqWeTC840nYU5izTBGMuVQA+m60Pb5MniFvSFi9CvZ9bF3ZRhH3Yi93TGsBkEDE1/G/78zQECwwp0QZQxuJSWLdFasXOh/RELjjxFAg05fE42y2QQoEoIY646WIdU1/E+NfcaX7pe8D5r0FOPgt7+mtAchcKZ2BKRnBAyxO1BgcJwH4EYz1Wt65KX53+b2xcoPTUENl+/ZW6Kt6kc+oiH6nmyKKXoq9v/ErPp4HNnPfTRdobvwXrPmhZU5s50ACtePp5r9WQ9LOp1DE9qcZ2kdQqEa/hD2zEfAlV6lewlE+YE/BU9DzaVqiKlOq5lJGIOXYVVsOrU+tZAExVF46MKsZKNfOEejAxqp6YQj3wwpAO0ADTtCxYBZoD8ghI7wLnb8KefBrZ8adhFm8CyT0wzqBoBYapiQiqLYlulxfVnAg1Axgkzg3CZKFYEMckWxWATxYDatukzxKCuMlpOUzr6ep/6xgJYG2GLFvBZksP/l8kd5dcKAWXUHtYS55GmHQVmLrFVO4fn65wmjJUmgapznR5c9sbuhHu6m1optKzWeoBQzUTuTWCuC0+kgeohmVRdVD+78Sbve8BZ5+DPflVZCe/gnTutT97DE0rMKUd81ZVJPrjoaVzIxAMSAw0GUeIryh7qgKQ+sa/bRNQXZug9Zgi1uV3BuYLVQkLZOtitYlt0BrTvO39rvGqrxzyWJ8xGZAsYdIFxKSgIhOhJSeGuhaUOHNLa3AUQSkNwwqWXNwbD8T2pMU7TCNBAaJum7dxfQquL1SQFQhVue6GhaW0Za90Rx6EMGsRc0wBM0cQD7oda0MGqAtNW40GV1KS9YeA+JKpsN4ZkwI4DjS/X0Hy+DMwi88D6T0oOYHCHPDZHxcKqaIOuZ0LTjFQZKBhZC8SOltmNwDgtedBA3ySGRuXy9gSxNLRQI12YBgOdWxCscaFf1Q8n5s05cInlAukpS3wPhM2K3nY/X3psBzK+r5Cm2TCdKwSajmZh2jRGMyJO2LWacPNQj3SZIjGF/ybcgGYAFgC9gzI7jnhd/xpZMefQTb/NUh6D1pOveZncKGKcoPny6VCKs4kVhks8G0AfhCv3bG4YLAbF0uCSs2jHXzuqjwVMs92+HBqvF99HHLV67fz6XXHBV6OyC6JTqnkTfTs173lzanODD1QYORsyhIGDobBzDQCty29jyKAsQLjcS/yYRkh+3YdDpSO7cQ+lKWokzaU5tc/V31N5HMdOnnzEkkCl7XBKgJxKQSpkrMrPc6ddsosruiStsAERYIST10DgCpJ5EWQybE5+Ot/XyfzRMcrJDfIMzxOAPMusPoscPpvYY//DdKTX0I6/wyQvgNlH0FhAYIj0+XO8W6RHR2bJZc/Je9mJTvc1auhDERGLZZzmU75W/753/uTf5YguHXr1sX4AC+usVVLYr+f8kg6TY+NVKVxpx75gtmK2GcryQUIOIu9DVuYk9zonGw0GpelprvdYIQgrKH0FFpPwSp2ISQ0tJBO13eCWhbr0iZb395m3nCf4O4jC13Tb+p6Gf/KNb45IOeAHAPZPcjic5CTX4Q8+tcwx7+I7OxzkPQ9KHkMTedguGD09R7xkRKhMqTVElUFIQZlgCxBJP+Xn/pvP/Hrb9++beXWrYtUhWt2ggbtt1L7K5fV2Dq/1TdoMCZY7Yc8JfErtf5RDX5rw83WFhkrGI7IEWCQ9WQAeQ7sphHMBJAG6QikYghFgOREoLaBo4fOvAJKpDbQbhh61Q36tc2tW1dGPLROGjqeQU/3QdEkCAofYw5Xk+/EZrAmhbVuI68NDLdoV5EvJOgkwNwuUAeT+sC0Cmru/2X8mkpdeQEzB+wcsI+A5F2Y08/BnHwWMv8C7Oo9UHYfLKdQWDqC2sLjWy2GSk06l5HwSFhZkGpC0ACSQSElmKXsTewsNae/AcAv3vnIv6HtCcAL6EgXIQratbbmTr0CnMamGRBO2Xf5rzMYPYPhyJGuYnzOm/SeBhv+vmVVCAAjBLCG1lNE8b6vjZwHBG9yXMGRw2ap87CbFCL2Ag8+VvjVA41TENIWLG1ESmrjPqU5X8aPhmw6ngzDLIH0HFgeQ9ITIHsEu3wX2dmbyM7fhk3ug+1jaDqDwhKM5JLqfQwZbO8NRoqIM4llBc1xdNG76IrRRSH+0hzgOkxdYXv2p2ibhictmGD4SS7ru4b20vC+jVi7JcCbemFlhEkRxXLuiFioYIWAS1tDVlbbgvGaQpA10OstbAYGkorA0R5Y7cFwDLGRx34yD75IpyUFUC2ea41W3FlVTZqwHOrM0C5Q2PHlKUdcqmZQ0QykJq1pgTQIa5BS+8sSmGQFaxMIMp/qZWuTRD7LqCz8LrQNIei9rJI6zQtzQPJUsroga9mB0vZ2Hec0gPWHpzjtyZUS8LVhkALZObA8gVk8gFk8gk0fw64ewqb3IcljsJyDsABh5YQ0DXXE0aiNVpcHfV9kMmAkFNGSYuZsawIQ2Lx2w0U0uWem4NsG5zhtSa52XUVMCpMtYTNfb8FmgLIYngIWXo5BFIH1HjjaA9QUYiJPqMlrp5e2UTh6hNovRQ0IDUIM8rRgRHUGYxqxkkrQX2zq6lnYtCiw1FvDbgv1carCKQHMGSR9BGSPvSBMaoJsjQDkwDwPCikRLMRmrgqgJIAkEJs4jU+82SuJE4DJCczyIbLlY5j0FDBzsCygKAFRCkIGzosc+UOAL2vPNoJLm7uJYKE5hZYFJiraggDkure1jMGisVBEJ79fVZMrri9N7ZKCH3TlCjdgpIIPkKp1grc9SySNGLGwc43+tvAXDhGcRAz2BAA2XcCm50AyB0wC0dZjdnb9rqSqdkAcQ+s9JPoAVu3B4hQsGoKkpje2aJAio9j4O/kD/Q6qs4VXxy43tBgEDdDECT+OHdMJdJBK1jeabRUKM8dpR14I2BRkjfNMk1yyeRf0QVaQ1TGyxXswi3ch5jFIliWllF9oodYttRjFRqaF31AEgZgEJltC7AqwCcQsYLMlxKxAkvjXAmTOIfYclM2h7BIkicP5yDpuQpS59tJ/VHbyeradJfWSNe0bp779XGVgzYnsqYTOk/lVEdCdOxfVAOsJ9mPDoy6A/RGeI88xXawczlAt2YXLCESMq7eazJ0AzJZAlAFqkwp7BOgpaHYVNL0KOT+E0COvAV4y/LWxuHA8cIpcbRTomaN4opDSacxMGKdlyQKw5xBz7rWkrJICJ5f8VIABzBKSniA7exers89ClnfBMndlQMlWBaB3fOUCkIrg/+BvLwDzc9/aFFm2dBquTSB25QViAraZC2OhFRSlYE5djWiVudAWm6dc2lHz31YAbbtDJy4ekFJROgEMfzMR/rbInYtR4ktxujSZYET6EsD7GZDb8lP7YSSpQDDkXZD1+7djglSw924sjeol6Goxf0UPQ0ZoaavqVrlEmThQ9wYLOk86p/9YCFJHmpk5AUg29WZwn7ZTGUTfSQVMDoGjF8DnL4NO7wJ8z9fE9ZttHcGrdOM74bNVh0Oa2kDPmiq1eoYVhhFfzHxyCJodAdEMwlFLbZR1Yse6MqC0gGTHsN7sk/QcbLOy0FIjaYSCrDd7gZrlEpipFpAUkp7CLu/CnL0JWbwFyJnHI20Rbe3iJQWufvcaAejn0OHz1kEm4jM1JIXyz0mU+QhLL/DE+FJK+RjYBkbHLRAFUfsaqJc1bpBLBvWC2ye/S75YMBkoytRidW73Z5Nv+5//7mv/B6I7f0FubVYbRF9GRYhduwAoWiwvCyYHYpNdleUHbYrSI8wDDOu8KUAdAHsvAnv3QNEVgGeea42eycETMIxoR/EeXwGmV4B4z3Pi8QY2RAbYc2D5CGbxEGZ1DJgFeEhtlK1EWdWdIEuQPQYl94DkHZAcu3CPwtlgyqyjsAhcEH8VlLwqBIjAkzWQE/zsBSSzeIo164WrdzvmpRK8kJbWWLy+xd2eJhqmMG8PgjJgpI6BRpZg2vu//dQPffc/pD98+xdFbjHROCGoq0pEqULnqjeFtTtq9R42wQSpogW0Z0FKw+zswgTDqnBPNg4wFDlUS86vcOKJNMyBZi5/qTJLgWpnYGKQOA1QsnNQtiiLGZFBlel4nfbBAKaAvgJMrgL6CMJ7riiPzU1K2XzV1vBOaYzFmFODYUlBOAawD9JXnMCODgGeOXbshglM/RNFcIfH6gyYP4QsXS0LkhTs4yCl5wKVmtkbASE1J4hkYEnAskCEM4g8hrKPHQbIAMhCkDntq46JB9NKQGvf6yQVDAZxiRHmX5J8B0mwE3tgVekxcaXxc6n9ZtOg0aoDiySFkhWTndv9yZX9hc0+AuAX79wZHw+oB63pS8IE5dJE09PVadsggFbzsnNc85POYVaSniNbHCNanYHMCmVc4FBPcC4kY4CmIH0Ejq+AowNIMvXFszXKEJuLzyVtmBOfl922FrA0gZ5cR7T3InhyA1BHAE2HC7/GQBsgnQPLM1B27og8x9SypYsiwM04QIaFIgOhDIqcx5UJELIuBpQAJva/sN2YcW0YpKXfFJrivSNHm+1XGW6PbG4XGBASMFbQFCPmVCacxRdzgtQHrxJlIc2sgPopswkc0jNI1HBAyghhF+QaPyU5WOYqS2NhtMu/RoQlCALNBoIVsuQYcnYfOHyIOD0PuAGjEUdJ7jWdQqkjTGY3INMbyJZvw5oJjKzKSACSzlUvIv37RIK86RZzoStOkHLNhABrBakAEs0Q77+IydGXQM0+AKirAO9t5AApmbETkJ2D7RwseZiIF/zUVnlw21s5IIKlKpt4PgYi1nuk8yG0VVyVq8NPNW4HofoUSoenonv9VrV3qh1qeamC6ghRh5zoFLDSHJN1oIjDAVMoWkJxDGUTIpOYiwvAgdJ++3XEnk09chsCcNPCQvB09YoNLFZIk1Ok5w/Ai0eI0jOQrAIccEhBHk/5DgCYQMVHmOy/CNl/AbK44qp7ydKVNSyIAdYcXnTB6aIuEUUwwkitAk8OEB+8gsmVLwHvvwLoqyiL+2zSAetDXxY+9WsFoB6AfNk6TF3fLQtUhTVJHFlF0WsvAL3AkVLi1QM4+uwfqTmxLh7yI035RZe3I8lr8YQETIyIEqScIo7Tja+pGSjwjVDSS93mr/dkTI5zW1yfrKdP769FK9U4wBoGdylxgCOmiqh5stEQYVAkERswAZAMNpsjS05hVidFIWpRC4AYhHjAZnWlIIuCQPEB9OFNxIuXYec3kSYPYJIEsIDCCgoZUKmt3KU05Phwld2nQnzasRYamJ9XuYQULGkI7YPia1AHL4MPXwFmL7jSjjTBsEIv0vyvpJDsHGZ1ApOeQewSLKYQ+JVDK69qVosCuLgKUCWnkMC8KlYxUVEjuuFV6AjQLQQkNRdUd53tfL9vuXTiBTUkCuKFm9CQBYuBkgyaDWIYKOUOsE34AXXfNPUEV2xHnMs2LvDseTAb5A0DEaqmsZgnnWdOW0nPgOQESI9d3VelA9N2iAnsBCD0PrB3A/rKK4gXr8Kmp0hhka1QxMNxF88bDZtMkeHEzQUaJgzBDJb3oOIXofdeAe+9BExvOucN9rzZzyN2Y64/+eDj5BTZ8jFscgrYBUjM5cSsjcID12PXdU/ws2gNyRO6C4mBQgbNGTQMJmw3VgErGKDz/lIVWA02ct07K2uwu3WaoHSaiPXShPXasu0bM/RYdwJvGwm0stYwjQBCCV0nb7WL4XYWKr9A3hmiSMEihaRnMIv70KsHQHwI4qk3CaXp9ms1t/IpnwDRFfDBBxFfP4bJEqRWkBkLZMbzvPksIwprPVCgwPgNa2uYHkl11hpZC2WFvfx3LghDI5MJDB2BopuYHH4p4qtfDjV7GdBHcEW9J8GSHSK18nKOvph3dga7OoZZHUPSU5BdFtXMwgyYavF2aS781oXVnUYngYbX13epm7qgSk1iqrBkt9yBvM5es5zWVuCrVy2sYXNNj351DKQHC77QvmsVMPlad8HcUZwBi+RIBIQ7FxGA6D/sO2KPW1zfF7fyn8325PpWFeICxYCFgV0dY3X2HnDwIvT0ChAdADQDEA/QhkMPprjfzV4EX10iSg10msFmKWSxhDGJCzUgKhwyZbBR/YCRhlpCPRZR3QniEq4YVmJYOoBELyI6eBXT61+F6NpXgmYvOs1PIm/GD9X+QuaTJWBPIItHLuk/OQXs3LObrKmzEpbDHKQD0eWuIXmCq1OexW1ZetCJMok4hRX7u4nw/ZtkhHBxQgTHQFEXITx5Akbkxrai8Rs8xIIoyN9t0+DqjLdFRBbRUzFf8vuW3k4a97zBuFGFCbdMg6M8r5MIigElGbLlMRYn7yA9fQeyegBkZxBZQSoMMV0UxmHMoHJCUx0Be69AX/1yzK5+BaaHHwJNX0CmjpDSDCliWJpAKHIB02CIUECgQBUtQjrlbgj4O4Fn4LA+SxoZpshoH4hvYnr4KmbXPwx948OgK18CTG8AKjd9cwG4LgtEfAkBr/3JHLJ4AHPyDrLz+7DZKUhWUJRB+VCUtRwyuSDcQCpsHjgjjcibXMMLX0VvNqSWLtahdNe3IRr+ZF3fb+t35Trr+F0LNnHxdoNRi8XCTmN6/ef/+2//LiLIWHLU56Yu8LOmKNIWflyHGLouTkQgSWHSE5jzu8hO3waOXgAmNwA+AtR+oAV29bBeg0LDBUZfBR9kmKYuGV6QIAFgVgrWnEPJEgppwQXXXgxIBo6TC8jOhaCIgsUUlvch0Q3EB69idu3DiG58FXD0ZcDsJUBdcf0c7fnNa1ysAHsCc/Yu0uO3kc3vQ7K5yybIiQdG1cp9Ntfa5VROfsYss8rZY321uBQRJUw2+69+5sf+k0/St97+5TEZIbowuag7kr7wnvvYpHr4jrSyU4ToByrmU7s50UGBQ6FXqBtjKWtaCFqJHTaa7P5lVZ7GVQyl7eSrYinD9lT+PMTiNqw5h0kewp6/A3v6ItTsRUDf9ELCoC0wuF225l5hOPMyuglctdAkmJEFU4TV2QzZ4h5s+ggiZ1AwTgSRLej6i2T9emEz6upFWdjbIkJqYxg+gtI3MDl8FdNrH4a+8VXAlS8HZi+7uD/MAsdHl+esmZ8sYkFIAJxCkvvI5m8hOXsL2fIh2MxBNgWRKzovkIAJ3Rv7hRUkI8zbPl2vLe9pgCiTTgrJIlrDSpWZiAIMWbA+K6eZClkP/qR14FwVE5RuTXPY3hsoxsWCybDNlnZ/ao6W5vTfAfDLYzJC9LYFNG1FxD8rB5Bcqi4w/BrOKaFpBbYnkMU9mJO3wXuvgCYfBKKlY0kZTBNPwdT7GhtTt+EnILCaQfQBRO1BzhVMSj7YNvF5s8abmFUS1dAM5lZflDeBKYLBDJYPgPgFqIMPYXrtw4hvfhVw9JVe87tWc3x0nRrULkDIY3/mIWTxNsz5WzDLu5D0GLBLzwGY9QBdm6Q/0ZZmvHborrG6w7yF1igZ2vJCfVr7scWHxDDQnCGWpcRMozNC9OD7eiynzB2s1o1o1VSlq3zkurrA1TgSob4Z4RI8kxZcQi4y6bnDQFprIdJAdY5qqnEj/nHNXnM8aAYRE4wsYFcPsTp7F3R+F9HhY2By08XHEXmqKF04C9ovnWOBeQ6wdt+YvABcAaJoilm8BxXFSJlg5xFgpjBmDmPmgKQgyQruupB2MCeW5uBeeTEmkAJxDMtTCB9Bxzeh978Ek2tfjujGh73Z+zKgrqMMeekqhVk/bm3wX+M4/8wpMH8XOPk1YP4OkDwCyRyE1JGG+jxt6khslW1592S7MkDWZnBUg8RkJFC+ebD7sEOj6Z32qXok4wSsuPlWlMhUrzhimY31BuvBzxROwLoD4YIFQoYVZWoxPi7VKSK9IHKf6g/adEFVPcKKXA2JND1BMr8Pdfou9NF7oMk1RxSqKcDLhoya/574tDrac0JQx4j1BEpFUDqGOb8GWT6ASY6RrY5h03OQXQIohWB+yaq55VmdQbCkAY7A0QyI9sGTG4j3XsH06Mugr34ZcPQqMMnN3j0Mz/gIN13u+EhAOAeSB5CTL8A8/jXI+Tsg89ixHXsB+CzifdvEBCv76bkB92XEjvRhYpxBRSso0O8kwl+/des3ygUEYIlXOaWKgveq2BrXToz1da2G6tLjToJQACIUgtuKkx6kqbW6rcZtrRazMahO4TGd1JWLXD1GevYu9PGvQU+OwDoGtAZEe2FWfXgaJAxjx7SsNbAXQfEEcXQIO/8QZHEfZvEAdH4P6eIRsvQU1rhaEYqkcJAUKBe5azLHEESuloeagqIDqNkVxAcvIj74APT+B4H9l72397Cm+dEwO8jjQc7sTQCcA6sHwOlbSB5/DqvjN2EX74LMsXfqZJVc2zxmTTpx2Eva11JGYJTF/ry3nFqWUce2kJrBY2uCj0KVTobUNaGaJijtKuKmBd3rrDZdO6Ir0LhIiHExq5oytUwWdhrHr//sj37zT/6Wj9/+W0P5AXXfGBTRX9Lqm8BALH+0sJFNYJgnQC1dhrIOIWgdIFAHznu4tAnWxefZOZL5XdCjz2I6OUA0mYL0FFB5cLTF4OoNFGKC3jzWGphNoaKrUPsnwPIR7PIB+Ow90Pk9YPEIJp37cJKcucYWOKCAAY5AagZWM3C0D9L7oPgIenYVk4MXwHs3gcl1F+iscrwvxvpYP2odG4fpLQFzDJy/g+zxm1gdv4lk/jY4vY9IzqGwqmqtwVHzdDWlJq7ZeX5Lf95t40pyUZJ3addPLpDr3pzO4GmH0u2JgNlAU+YyQ9RKgyd/8Sd/5Nv/Of3B279869Ytvr1GCOpR/WyhdOoUgtQT5jFkP7b8rscHXMPqLsfmkFDTbCwEGhgsu75OMIW+BYEnyPR18whQrGGxwmr5AOb418CTfcSzQxcYPdkDOBciIX42IF+4wA69FqmmAB8A+jowuQnefwnR4cugxX1EZw9hVyeAWYKR+lqxtpwRUQDHoGgPPDkAxUdAdAjSB+DoADw5cv3lfZ/fGwV9ppGniGfOxhLAGSS9j/T081g9/hzSs7eB9CGUPYOilRfU7VqJoI+/kLa8oKgVw6Nt3GpomZRnB9ocstFb9on4VEbHDwij7eHs6Mo8k38PwC9/ZEC9YF8UqUqGUN2dteDkPhBQqt6o8ThX+0gQ1dz/0va9MO9TLr5wwmjlrq/WxmKdc6dNo6zSkElDoxVvsxCVVPyKLKykgDlGNtdIj/dgZkdQ0QFA+5Bp5OczrKCmBjy4QkmMavy/I4AnwGQKxAfgvauID25C9h8By1PAOJJWgvVpcDlfuxOA0DPQZB+YHLkcZJp6h00u9MI+ckX7Wb8HAnZlWgE4A8x92PlbSE7exOrkC5DkAbTMoSnxJA+blSB3lioFhAOy4dqimuomtfvXfbrj70PoA7bGS9hOp0jHB50KzMDotM5eSl1j9LWCZQWSBSKKMVVGNNL97TlBOgZk7BlNGwz4mIMNeDIlNp843WrrZrNgpNAkgD1Gdv4WFg9nmEb70PrAVU+LGaCDYJrVyJsGo0m5pz3PI56BDg6Bqas4VoTFFLiap98iBagI0BOAp3AOGh30hwOhuwnDcm72JnC5vg+B+ReA489Azt6EJO+BzCkUUiiYdviitrLkknS+YWNdFXo0UkBQj9X0RKz3BvZ++dXVCNazeq+gaQlNKU1jSUcJwCI1hWoByG1DLCVsWSSMSyNXvhXmGmKdlsHM3awq4fsS1DC4LAu4/viC/uJOMtLmb9J+SZFi22q9iAEEiEmgaYE0eYDFcQzoA+xFR2D2MYExADr0gsaOEDJt0czKP683kdUMUEEtXbHtm5o8pihhGhsHeb3tTg3qHaNA88MKkHNQ+hA4fwty/Cuwjz4NzL8AlT0Cy8IROxSPU/fYUaXiRRE63CBEvTyOYxECiU8zDDd2131FWgV1p+ZVj0LopZnrVj3WOUUKhNybbNVi99LA+Rss1jLQSSqhZWidIw6Jo3KjBApO/r02VACOnrJLdDgQdXs0aIBa+OSB7Es85XoC9BkGigCLJay1yFYRVqdvgSdXMeEJlONSB7QK4opyTY7RnrnQF8fD/c9aYYkJmU+q1V7Ek+4R1hRkb9X2vAuTAuFnT4HkEWT+NszxZ5E9/FVkx5+DXbwLlhPv9MhauysD7no5a0q2sEeeGNT2DLfcMWi8RZQi4gSRSgZfoUiFG5LUXxVQVUncGMm6lB9RSKlMzG4vjN4ClT1ZlT80UVoKo49f0B0F5dcaTc70jCAQe45seReLx3sAK8zI0apjJkB01cX4IULV2dD0EodlKauN+8ClpseLuk6msdsux3psgE16b689BRZ3IedvIzt5E+njX0Hy+LOwi3dA2WMoLFzhIV9mPQxslnXHWW7p0BpNZCweVC87IB0rV/I4tw0wtuHV67cqUaVWT0CkP9yhQbq8UR2ZsoCYVhk0pyCkZpQA7AIQhtBh9WF2feceDTG/Bl40zDV+8rRc8kRFb70xucq+GkvY5CGyM8aKDBRSRJKCTQrsveLCTXgfZRocBbbRNvVn2vLYSlBT1ws+LJzwW96FnHwO6cPPYnXyOWRnX4BZvu2EnyygKC1DXvLi4u1G6Nrs3PdT63IudFZ6GzNdNPzXFx/XXBHJwERQKpWJsphFZnLr1jDzQgPsqZg875uURYvrNQMqKTUUkBsMeZRWAlXpOJT6CR0pLJZQwzrcs9gLAoIybAkRXDK9dJkotVIAawDqburyZv/Ke7ATgjaFticwK4OMEiwkAbIV4mwFmCWIEiB+Aa5IbB4riIYpvFEVy17zrFZkm8bw+QXmL6Wl1mceA6u7kJNfQ/rgl7F69BkkZ1+AJA9B9gQaSyjK2V5shdq/+JfH+FikdX1WC98H9E001pxsI9S4YMZ8DxlPFxkaApSOIB2CpL36r6WBimT3yq7tU9mSIM8pawWEDIqM6MhARL7+9m38jU/cusMDBGC/mfWsnoBV7bSNSCwMjcnNJtWB3fm6uYKCbbZaenIc2RCN1IyryxM186FnAKQUFgopQAYkBibJkInBPEuRpivodIWJTUAHiWN+0Z5Ci2KUzpF6vGAX+D8GAG6v2td9BEht3vJbZgDmgDkBlvdgF+/CnH8B5vhzSB99GunZ50HJPbA9ByMpArNL4YduhxLGBvSH/cvXVv7inu+b2qu6tuQJgjedATYXDXB+qs0C1qrFfClxRH/g537s4/+AvvVH78gtMN3uznvUbUfY2ADmodTbtGHqSOf1q8d0sahyUlFwuEAzdAfmhBvVh1aQCRa59ApComH9X5vgTFVB2IWBhhpv7n0lIjAsNFmQWGQJsMosVlmG2CTgdIFocQzsvQzaewGYXoPoAxBNA2wwjMdjdDOkDKGl6oIypEdDtD4v2Xihlzs7lkDyGFjehz15C9npW0hOv4D0/POQ+ReA9D6UnEKRY3h2oREWlZSJLn2kRiEVevrrsKVLW7Med7IVIUgVOrK2AyNfg6UAJFgQWVfvdwyeOHjfNDG6/gySgdGXdQp96kRSR/WvG1Os76OaNZQjJGwJktpYZzHI/uV/8iPf8a/oD/7Ar/ZlhIwui7mRmjYg5WsQjlzbUxR6HqlknylJiHMhaJv2cuO09mZzLvBISlM6oIS/6DNczPTu+Lag6CP7ZazkHJIJsoVFZpaYLx8jOn8X+uAVREcfAB+8DJpdB6IrLgdX7XvTOA6WBTeFXmE/DsT6OmPEUDt0EAi+BJAlYM8do0v2GDi/B3v2DpLjzyM9eRvp/D3Y5CEoewSFMzBWYK8Bo6jo1tOzoPLYWtS58KJ7wVoIVxuwBEnNbK+fajWhSf7VcrheNGFjnY6+dc1uY3fydm1MsRYCwyZd2cOZ3Dhbrn4LgF/tywjRbdhUVSfakGGlJSawvi6GFlUiONJHG9BKcaBQCZUCwAHexhUPl5XbSFjUTJQwJq0mYcm670vir5EznrhTul6yT2pKT8WX1EZm2QMSy5jDQ7rxQYZLD2JaQFtBtphjtXyAdPEu4vk7wOJtxPNXgP2XQNOXgdmLwPS6o8hX+4FGGAYpc5mZAh/GMmCnViqJVBRwW4UoJC3JDKzT+CS5D1q9Byzegz17F+npO0hO30a6uA/JHLEBy8qxu5DXHsVW00rzw6HQ9Kih9dRjWNsdBdaB7ZKBJRfQS7fGiP2zqJowDNaXeI2WDFzs4srTipkyiybPpBH375JmTNZYFnVZLR0Yc1B1Nfw9SasmSJ3OsVpcoJT5O+5AkUocYLfga48THEycKk0NlmCgOUWMRGKFw40xwPI+T4RlYF1dmurAUMdBK858FbuCZOeg5LFjBRFGNcneC0ChdpOMFoB9AKQnIJunepleTfBZwkbdOBkoJBAxYHuOTDRkcYbMnGKxeoDk9F3Q3itQBw+hj46h918GzW44jZD2XPobKUezRcplgVDNPG6N9qcWQCl3ZKAKM4jXhmzqipXLygmV7BQyv4f0/C2Y089Dzt+GWd6FXT6AWT0AslMorHwSvK+fAjtynOp5IevNNYZ1RenNHEhPgHTP716vOReCUJoQgDVO6LNxB2z2GDBnjlZMqnjzttbYOv3q+Y8DbDGHYaHIIFIpTSOTAf0B0brzQpRXq8eoGL52270d/hqjWRL58zX3PgeUOiwuIlzIQGQFm57CLu9BnX0BsAxEj7wADHNeqTjZq24fC9ASsI+BhSs+RObM06unFWBdxmKdtWJTY3OFh+CCFOrvXmuJGFCUQWBhUoM0Ocfi/DFwdozo/ATT+SPI4T3ogxfB05uAPnBECBQ5pukohqiJy+1ljWrqWj1/nALVN8wXCsw/yQCTupcYV/N4derqHqdnkOQYyfw9rE7fQXryBcfkbB5D2XMoew6NJZgyV12ESq1HGoXDW8Y6n4Ma3trloMmfgHPnmDmDXd0Dz/eAbAGoAxSs1RUBWD9XPUs1W6flpsfA8h1I+hhklxAxhQVTJxwmWq/5dZr5vSz9MoBwINTUpFfQWqmWsxX0Z5ysixPs+n61PGegOXrrR1OGiBIoVtkwDZDQya+zVf1vACa4SVFB9+AuQ8DKCjZ9hOT0C1AGoPOHjnUEURC24zQYFylTntZOsFqAEhDmUOYYsrjvmITtwjMJG6yjyie6bNBlDIoiYM5j3TKILMA2BZkEYhMYu8BidR/p2TVE+zcR778AnhyB1AykJiA9A8Uz0GQPiGYup5fCGh3ePGYOMkx8apzYYHyz0tQ1CZAu3H8lA9IF7PwR0sVjmMVj2NUxstUjZKvHsKuHoOwEhDmYEigkYGTey1t99qHYWbcXmNAekOycaowVJH0Mc/5rELOA6EMIHN+hUAiptGQxSV7pz3poZQFOHkFW77kDVrK1OPPGmtqagbloPLSs6/C2Vc1O4N3DFJxgohLESq+NB9SOYklKSidQOV4ia7ZWu3etVRPswQTXFVWqYf0lc02B81gw+XxXSWDTYxhjHF+desdpL1BBdiUVArB6gpXmGZOrwUHZHJTMXSEdZGDqNrWklpTZ1BQ3LY4oA1IX2hd1FWMxbhSUeBL8E5h0gSy5h+X5BNn5Vdi9a9DTIxA7fkGlZ1DxPniyD0z2Ab3nwmcoLmt5snakB0qXu8hk7mVzz2fqhd8Kki2AZA4yiZuvbIHk/BGW54+QLB5D0jPALr2Zm0C56H6wZK6QUYEpSmE4hto1DXBhSodJjA7D2BGoroD0AcxZBrO8B0GMTHy5UOJAA2yfJi40c1fjhWUJmDOwPQOQgsVUgONKskiAx+VFjGhIdb4wUYDGCkdq5vH2rfv6mDWKo1F3P8YI5HpJTZJC3hBZaE4tRwkryb729m183yekOx5QM8KK888QkDVaa7JO1JNxeIvJIHYBwUNInnifC+b6VpHwtHdmmpCFJXeiwDjw24VYyHMWH1WN6GQIiAyUZ5dmmYMsYESBFscw5iFkOYXwBESxI1ZQU1A0A+J9sN4HqZnDCL0AJBWBo4ljpVYKYi1MuoLNUpDJvNacQmQJSeew6QLIlmCbgCSB2CVMModdnYLSU8AsochAs9NemaUMPaGWDbAtrYKq6GDzLilgTmCWS4AiiKjSaKXmmDfCUIITX8itMULq6JyQ9grP7T7j5lDUs7/SLSCZWi7nEkfT3//Pf+hrfozoX/z9W7fAt1viAbWXGggzAQhV5tO+XNxNMcFaLfY1J8hQHds4iJ598WUYWLvyAo9b7sM1tikpKD0rUeYBPlN5rhyrqQeQSo26uyMweih/IPUUdmhggq1jWlUHyVd0y59CKVfs3JKFzRLYLIIlBYiGiEYGDUsRSM/A0R6YZwBHrkA6MVhp6ChGFE1ArGCsRZIukWUpyDhhS0ggdoUsm8OaBcikYGTes5qCkUIhdVq3TsEUBDHbUIsYtoE7U5Ibi6Aq7oi9GR/EEZbam4HYlRPmfs8oYp+C2azNRq3B1/79ori3LclkqT1jqIjCqc2pdLC6tK63Dk0wLArVzEAayxrTL1DrucLrMb81AprqFo53giAlsks7jfRM6/iv/YO//ru+9j/8zn/ymTYhqIGnwHF3MchiWIVWAqxYMGyxWJu/qVZOs5AiV0QqILHFhao8DYEvnsooeyTP71kLAyMWRjKQ+KhCy86LLgxJY9jVBMIxQKqIPGRmiNKwyjkCrAiMSWGMC/FweTYZBCnELCE2BYkPACYDgXMOMFkwG19GyR0+IsPGdT3euo5dr4b51Q7XUkzaoKASgUPcT6RiabSXzw0y16XGZj4Q+8pTyWi7S6Ea5rnJxhuDULde66JxgfmhkkJRwjZd2it7By8uVvhaAJ/5yEdeI9RKxmlrfa5jm+t+1NbeQCx0aYJrQmLy4FVeF2AtuUbbJeKlMtthbnI1gUCAtsDateBxKXjFL1wJA12FAg9m28/bkoeH5gujghPVY7/C35cnqAX78oRGnM6rmKHF60CUQbCC2BDRIsCQg/dQFhVn72oqnVQWlGfmsC1zzn0wMYnXgqx4kSkd1kRdk5PqWNQ/b31u6bFWbDCp9XTJQIsr8LzqGnHjzf37RVrUjlaHbNtcS4sGJK1j1Ipp1rzLIetS3aHEteuzlB/0BloXGCV1WiFVTJBa+i+dmqBQ12nnnG0kKRQ0ptpIKlYYcg1oD4fZamH0jQThOOKXVocSUVs9DikpvgrnxhBJ3nQ4yBpMctPc36en93U9fImOKpbyhCLyjgwfjC4tSYEisH53MRGIHcVa1SgUEDfj3KS4ctcMXwJkvCEkTY2RkpYDTwbQaWye8UGDvzGMjWVIH0guogle7lqukjCYQgBqyihWhqax7WSI1k3xYoNN3c/GciEssIVxuoJnSbvmh9opSp6njohgra2exuAA3bGdC4UC/LPUhtu0VerHk9aFMdTYp8pYLa8ljiBAqI8praswmkendFKJSNNtUhl0Kg8VCspf1skZGUUWAFV8C97rLqE27ZmD150uPXF9haedynGhPvyJhuSXNq9fRogJ+vz61M3jHMxF1YTtwoKprx5Nm/4jUqmNvdaDO0ACFnIgT8cacdiUzyGDMMG1/IFdlmKFE8BHcSCD5gwxWWjupgfUvRu4rQzcZR6vbQBnu9Y/8CCyGFZ+ZZsPU+3ZM+czHgqzNJkAKgKhcQhy9bdUo6APq0uPHv/WiZaBMMSTHrhnP79iVM/GV6sceGfZ+oiVYWfGp8RZRJQhUnaoAKydcEVtYOm/oQwb2oYmSLUtQf0mbxPzo0qMXH59a6WiYskatb6LdaL5fvvzioQZr2ExoXHupUGsOnUNZk2Ufmep0i4Z1JEQK/3yZ63zQTbdhDW8qL5m2mLO+stbolfbauR6Sy10iqoGcJeWEuYfj+4DDWRjARrab3MttMTqNvgDpapsS1OkhJciWsP318AkSyuCqFqbRFpUuzact1cTbKw0R57ragZbTNiYEQLw8o8fqgmupwLq9GzaMAd8nALcXmOj/4R7ArnWT0GfkFHf3gjweaYwVXpaN38fxPDRhX/VgpeR4/TUnIFio7syQjRX6gLXIbZ6XWBcGBMsYtqkjXWiY347ZUT78qO1LMVV2dPoP0mvdtWoVkcdpKGyfpcMybW8iPZItAYTHHz99jluxD4OlIBj06+KtVJ13A+IjxynhRV5QjVNkCTIb6WLScDcr1Sfs64+1zMnGuVENnzmYvyHxphi2Nz11fluwyXLuNr+34f7rR1/DxaXtYBKrVYZK8l+8+3bsG0ZITxmg7Vv9Cd3BA3lZc77SkQXus9mp1XZy3q114s91fu7jVpJlzxcskG/x++ELe6di45HH+k5XcJ490WlbfE+YkQtlyuJNP7Az73x238nEazcusVVAViJA6Thy0GC4AahSjR235NU6iv0nJAtcF9R8yN/lXhCFS2sCkBqv37wk/zv4tqo8qaFJy9J6L3LE9xz/raQj7DkD+ziVw6L/kgl84YuLMQbd5FS2+2lPF8zhW0jWsRm0niRIWtigOtzXs5dfbLa+9tYb2s6mkdq9n2tEkuXz21tbYT3bq55KtfcgD6TUOVVGQ8/AeH9u+/bPt9Ue1X61dvPMo5QZMRBLtWSPcXvi1f7min3g0DEBi9pzY4kCIkxMovkgMR8/z/4ax/7Urp924bmMON91y6zCv36Pd0mIJ6snvyUNLULPmDXJntexoOe82ce9Axb1tAua18Ueo8jR2BjEnvtEB86ipa/AwA+8ZHXittqMLvA1d54lKaGUsWT+r0163CrVsxhAH9gV8R7JTStBWMbW5tkSE2PklGsDIZFjdetbyWU7L/9XsH1dVeaY9pSyrkxNkOvj1osY0kpNzD4Nng2qmuoYzHB9pIfwzBBaWdDXounSdDrvkTvQdfcnjSRDfHItnVIPZpv2xxtbKQIemuUjBJ4CKzBPIVcLIgM4sjKHluZRvZG/be6Yes/Y6frZrrdiJUw9rnXogT1wiX9e0O20KVnY3aGDbTUnRjPi0FB9SenLT/D9oRih2tw+PUDQSdjbjhiWbRHg1JH7ZhNx8EVoNLaYqosTXUzHEZXBozI10ygNVgeVdxHIsOSs7uih9q0DqpVp5MBF6yTTVCHClmv8SoDeyxdcXoSaCW1FSTojkRsevdkg7q8G0jXymkujbHru5Y0jBdb7UarQlRixY6z0WO4wSB01ZQlGbCmpJsN56Ke0spSoTCLpwTgpCfXdtg96uwx0rrOuuqaNAL7KnNNndfv0iDrxVHrdYElKHfCqHqlK2QKHdqx1Ly+kGocooj0HjHSaQlKYKiJN4ENFFJilSLWknVrgFs6Zy7jVOsMwVgjWJu9oVLdFrmMw3er+oA8zQuPHJPhX38e4x5Dc317OvvGdFNrsoyeF+36smMoc35AQiZEK0w1uB4PyF3KXf+chBQ+3QEjRMNOwbrXk3qCkyqcNbWvEVVfnfhVzbs6Foxt/J7aXxecuUFjtRbTqY9t4U2r9rHRf6wL3XEEpRQaAy3Xa2j1Oft4Tp6wjUXewQfYdvmxnvXy+aoPWXo+q+9vZf7X9XnNgu2IfWh6S9ft8JFOGmmx7Hox5eAGOX5XZSmSUbGxxeWCOWBYwCSIaAmS5Dc5PsA7PQJwIzkuG3zWPNX6AiClp3TnaOfUM+duDDYWnnxU4IXuR0Ov0UJxhe2HsDXWRGiX5Uw2TRartXcpiMw68ZhACK55bSqMRwsCKc1BGbSyqFu5lSZpUjgcsuV9sJ0F7cpkkiS8XC4kVub1n/9/fuS30usw4jVBvYncoEa+aBtLhAT4TQ3nGeCBqxA85GuO202tej5oJ54l7diK9IU69uBR3Uy63dhm342E6pCwVLzD4UONzRrpyxVueoarcWDr9oqgJT9V1oGRtVXTIHtryWhpY8PpIE2tYoJUMRullRSsxgxNNZNXqqkhJUNQaMbmdWZkzd6UivDLY+gGZ9msEVxVTF568N9qaYj8GQpORFQFH4WYYIj7UXt/1wn3anRDN39gezW4nnGuEIIaEKUkhu3BXnwUze0P/MTf+OqP0p/4uc/fugV+onGABNrId9Zb2e/ZUuCex8vXfVoX0gR7H4C2/8SD539Lako9iH57SNj2ULz3cxzq+GZBkkFRxlmW2CsH/BX7LB8DgI/i61mvwz+k5ZBenwtbVVuI6j5taTUyKqd7WQKuWRA9PDUGHAhdJ886Lr3BfIcd2sO6QB4ZGX5D6Gd2HvPMFYyrpYtDc4Xzy3Fnji8157lHQ2UOeKRFOk2yuie/rjVRTRyEHvoq9tmfR96tt/qICarn8Q6vcdtd02NzrxwF+1bW6EtN1hYZNNcYGAe4aT720DFct/FdNQuBkAFTijg2MmGRiZYXAeCjH3lR9MXqXWzjtBt2lA3xs21MuYSLLTjIRbVR2daIbW2GaMzAX8LUb+8BuudNNh2Pba9BQS/12LOuva3tby2USLZxQxq6d31qKjE0CyYRKI5LG1+X4NZwokqRTaZK1vIGVk4iKlnXhmo5bXF1fQKvyVdWx+DQEuQcXr9a06MeONrkD+zqzrA4wTb25LWn90D+QJFurRNtQr6ugEmHdVDHQ9fWhJWGmAoZqmXY0KGlyHRjAxF6MkSKOZCGdlWaldKiVZVp8rS2j+5+Aqqtl3bdrQsTrGBprZpe7WpF/2hDTa2m+Uk372T+g0pZsjVCsLNaZK2mMzGVsaSBxSlt8ZRiocgiZotIlfGAvG384Vlrw/CP9m8NxU7kyXTyyYwXtRNNXqh7z1PY3xbwvY0uIXT5C0GekfF9KjIgZ4kWTBQojwfk6sKndgB1k/g26ouXk1Y7vyvupytcYEg8XndxBqmcrOtqj7avWYElgTBB2F2kLUav6/qV2DxUPWJdns2uuRgf39Y1dv79ejrAyL1JNc6+of1rMKGsGZPOs6SDWaRrLgr2lJqXmHrUFOkIiRnt7+lU+av7b6uyPWBx2TQcp+JsHZRht67UaYs23RfLmWPBFY25mVNEBDAJIBmUykBsP5LHA/K2hfvTZLarL5ThcYI93xiC+Qxc8Ztzxz2XyuQT7NCaUa2FwrRtst4qBIX5RsN7U4nDW7cGBc8TLyRhQGmF2g+283TBnVvGd90+tSK8WCYSKXz8Z3/4676aXofRhe1PF0MnpYaXhNJDhmAhG41HZ3Zx5UDtvn+tFmwHBicDPIN5dJj04HENTDFfGOtYnFsWWUeRM9SDvRp9J+kxR6isgSG1YkabMFO0xIjSWFwX7YmfVS9z/dRvqRNcVB5rfi4htlf3yNZq3Ba80FS9QJGnWwO4wn1BXdZIWLtGmthesxqhtGJj1BEuIdSeu74uzrCzKp3012Whtvu3lJ4dwvzc9nc9DqksOVKLa8wJOAoBaMnYzO7P5Jo6Tb//x7/vf/2NulvKXvZJ1F4/49Judcm3aJJX9FeTrXbnMjo4uvzbuLnfeImMk6RNp259XIevI+lgGGnuQ8LFMlXDiG08s7B69xM+6Q7Txdcwtf2uWovQ+VYtp1lmj/b5N54v6Xfrvmt1OhY3qQvcWgugbopIKz7VWSuhpg2I3Sw5fG1t2DXPWy/wVz+5sCa3dvB4Ehpxen1wwFAewvbTt3/tjV8D7dfvHNO6J3RQbJz0YovF1YKHzsMOZc04rGPLqa7RUN+VEb1cW1ex9wpjORXRE9cnA+6XV2kUbu9Hpde0fm0MwQTbvk9d16tDtGLBMIi1xZ5AJtp+UA/Gwi4gx+sfirQZNzLawhq6PrrXbtsnI7O/aYjhJr0Gngxa3l3j2R+EuO6a1dKm63XSdclI65l7bPtc1Om06odKK02WtKSudZ0bUrU4qWPd1tM81oTvUMchWFkHMm7DS+e6kTWKuIxDijrfFucc6Ki+JB1LMHxDRo2V9M/ZgH1UoURryTlnHw9oYRCpDNM4o2ksYS5wXlDAVjQZ6Tmmw8VOgzTV2hBUWKbRfYx05A7Xxz2/hm3EqHUPPfUtHApIPFuuzz3PLKGaJi1caTW8TmS9kiM1TI9rhwptUANe1v2b2rEyuSCqUeHMs5eOULQfXNRvGl/IrswxXhmnKEibpKj9wKKW8SIX6GOHhJKGNtvT/446xfXtTCPyWUexhA8oSJgfmEQGrDJEkmDKsr26wJWhkja9VxrgKK3TL9YETne5sLljyqjGZj4cp5TKE3JjvUil77XQ2fIky+Vh8UNGqccIsIbnrd5s2AfuokWvXbOLJHYgFjdkg/t0/9bfNwVrebj12R+24mZqcXCN2O/SI2OkeTZVYRLqDyCvDs/4DHZBWzVVqo3FOgLilroFm1hIwlUFYaDV0Uir8ANuO/rZrdd1spp0yO2u6+U4oAJAYAgUWdGRWB0KBMqjw4UC04OCxSCDFDsXYU/VibDu1hURIVL7HXUchR1Hi/SbzeIjxIWa4jXM4OhXTwIg1bar+mL9hmeGgGF9HTjJlW9uXze5x1CCIi5VAVmCGEHaaQu+UmUVqeINXBFJ0qAMps5TOxzjfElQ7ffCNZXPWxASMCzUQ92ofjIHOJwVaZfTeSgLSTsJ4JpshnJKpV1zCuecmqcp1RmNghUgLRuSekQUdWIo7m9bUxrKEBxbMDGKnwsudlU5h1xzZpVe6OCwC2oTCHW4QSRUHKQpmKjr8KEarCIVNQIhszV1HUbUElVSijlqOWaK2xFVyOXc/gQsKQimgMQQRERkfnVrGmCTDy3opvWDWUFLWwqHN44mWnNwtrMjUO0ooi5aK2k/o5tpW122Nfnyfk7oidWwFMGShoiChYKAYEm5RekDzkw+v4VcqZQHqv0derDaz0KqlPe0tQOEaouynibPveh49dDr0tg50E3C3HLucAO0KBXFFazfKNSrpXDjtB/m0yTIGh2sGQZDPdqYo/iX1lxeau0L1fSkegmKkAQtHwkOdP5wPbjPmaqFNKihvraKimCkO8NRiIiJpPzFOpM0LAlmi4tIzUIsEhvFh8NQkwJChKgOTUuLJSnlWhBvFdmqAMzHwYiCUGSvTo/0vcf8P7K58uMazEUcYLW+5xpglcJNV5q83Far1eb2Ug3MqrjWpP4nhnq9em3EdRhUy/VEqq7W7vv4BxcFQCNFjIynEJ5AEMOQhoGCtdpNmnWbxZBYYuKYmZjK4aBAAywEWx6x32UMhFo0eQ0qYCsm4g4M0X8u/QKwdDdLo75JVTtpM36aIrsR82ipZnLWq61Vz0oigDisz1IFjKSmwVFd6wgPlU7ct7rOQxaevM5LrmWQ13jzCnvFGHtriuqEi0yB+jlMAIZzUHQq0PYthbnE+aFW8nYRUysUVGSy1Gie8tsZKzDGWhFfLKgLDsjf9/chm297t3fYj4Nb1wIAlolZa3clYwXGioUQEYEsjGUijjSRW79dLhVfe9uWVkrBZB0IIApM4CiO+a0H/Kk0sX/oK3/fJx8P0AD7ymWGC7kW/W6cxiQCwAR6gADWSuhrqVBV9kuwkWU3razDqDsEq1RP3F4ByBACUiEsLSNRGqL3wHofBjFSaDFGudUpFgLBJNK8TAzmYj8PYFEs5br55z8whQCUwA73X7FSoYeyIlUTB9zp2Cjhji5PHQcJ7Mb5BmvxViRVHZCoY410UZBZWu9IaTFPG2ZPqFxQUyOhqhJVYqaNVa0qJh+1jIwNzCwiCYreU0PxppYzoX4IYZ1JXMPeXOiObdjpNJDCp2oKh7K5FJRMUAJ6eTrV+8tVCrHW5G43aphSxa/821X+6VyL9vAGTWcRny+zhA3eEoERyM1JpK8KBGlmZTJVfLZKLRt5C6BF5+6zxgsUKTQGK4CxFtaYUvvyeiQRnQHqn53ag9tf9/o/eihyq8oHSBSqz015V2gTtnRFkRDIWogRwOSbkWAzgc0MrC1P+bzqvLVA3vfqxK3z148QgC35iTZ8lub8tbCvSKhBd6j+FpYtllZwaoAVK/BsD5qvIuOpNYgZKnKHGxFizXhwfv5Pgez/THbyb5NVvMoOJy1Pcr/yn652f+07N7fqQL3Zcaebg395f+t9eiLt5hMZ3ifTpP99fbqiPRaV7aevzM/4T1AU/+dxrJUxtuacqPoJmnG6Adgqrg4NM+H++fKHFNn/ZplN3oyJTRql16N59h+ziv6POtIvnM2T/06Q/RcC/ensmJPscCI3Wrr7oNH/+8UH93Hf31wV7/38j0eL25/8ZFaa97etHjdaNczHwAk9AyAFssxCDEEswRqBzQCbBcBlnndpnRBEB9Q2xFs2SAOUdghvuACsewLbATjLQGIJi1RhribQ+gBRfMXqyXWerwipUV8whAUTnSLJ/rHol//8b/uW//IUu7Zrz3Z7BOBP/9Mf/VP/Sln1XcbQK0RWWVPdKaSoVduHdwVaZ6YaVvTAGPPGb/+2v/UXa/d5DOAv/sydP/k/Rpa/bPnzH//xj93+WHYpsv8WGJ+AFEjGv/2J3/J/evFg+ecj+9BOcMpa5mCkaOZT5uaUd2YYAKkAiYWkFtlKkKVes/ManvgXpAUykA1yg2mkAFwjTteGF/VAkMXBxgSrpjiTGe6tDnDONxFd/ZLs6itfrk+W0SeXQn9uSdNfNPPry5/9lX9nfttP7BtvvKZee+2O3e2xXXtm2ydu0SdwG445BXjjjf/HwTVEapNLncfKfsu3fNdp6eK4xcDtYGfdIqLbttzb9c8v3qglSmaAAORSAObODMtAIrBL616JIE0Am3qIygamt/UAaIsA4bFMypsk5AcqOwceSeoRiELtxV7IhpLR5sgvMr2HUznAe6tDnKkXs6MP/i90Et38h49Xkz/we7799kn1BLrF+MTt4gTatV175i1mucWhcLqsa8mtW3znI/+GXnv9jqUnFBffIQCTIG2BS8Q4s4ABJAPMUmAWgnQpTvBlABkvJALBxkKF4LE+2DUXfHxBDXCsABxakKkTILch2O29S8RI1CFO5BB3k8PMHH6pXkw++PeSyW/4w9/4HX/m/Kdu3dIf/cRt03UC7dquPT+C8GL5Ms/i+td1eVLtHZd4XwbYlXuZ1MIsvRBMPeV+4AWuIAKMiqewkg42djjrQzeUzdAO/P66qeGqLA61SCuQ6XSi763MP0gXqz/8jX/mz5zLrVtMt29nuL3bPLv2/Lf3o9WimS2YpchHdfFVym1t63Y2DIClQOYG2RLO3E0AGK/1deUaeaDM1jSxkQpctwY4VG7SwDtS/7eqYSRSFp0mY6cT4oeL7F/QXvIHv/E//cHzW0747TC+Xdu1Z1kAdksZ7/AwAqwssqXALIB0AZjMaX0sHUpVLXZRRlICbb1xocIPE7BDkvgRBDAThJnAlH7fx/7TT5791E9Bf+xjt7Pd8tq1XXvWBaBliKUiLayIAbXO7JUVkC0EZi7IloCkgDJVaVCJM28jpW3JGWwj4LgsodjHUtH6xZ6CYq0ykUgtUgFBvSkCuvP6DufbtV17HhrbmlbDFs7Lm8GFtywF2UKQLgGTOsGYI4MBQrhWAeMB1ixd0mvo9S9qkZMV2nl3d23XnksTmACrfIyfgaSCbG6RzQG7ACRxeB+38PVQRbzk70klDb6V16GuGT5l0bE2LrAWSF1NuSIQvc9qiu7arr3/BaAtNzAYMASbAmZhkc0d7ife4cGXJKAuUn3hUjry5H64a7u2a09VAFoGCYHBYCFIJjBLg2QhsMtS+JFdt9/rHt4e0sfnVE9qKwUYkK1g5/XYtV17Lk1gBkOBhWEz5/TIHR7s4/t4kJ5T/YZ9VjS7LUvAnZ27a7v2PhGA7MUfGYZkBJsQbFJqfq308R105OtM2a5KW51/d8hXGnj/AaUPRv++zn5XAAhE0Lv1tGu79rxpgApkLWxmkSUGNrUurc2imtVBIyTGUInYJZnGliR7khJwpwLu2q69jwSgBawxyJIMdpFBltaltkn5KvZ9S/3Qrr+lTiocyBPpMCXrhe274gTX/r7jb4z8ftfvpfYd9z2LnQq4a7v2nAlAawGTGdhVCl5moMSCPLHpNora0xjN6aKfP40WFjTauUF2bdeeNw3Qm70rC7Wy4ETApkpV1ZVJsY5QlDCu2PdYvr7G78f2bxvRK7sImF3btee2udreRhyFvXUECFQvHHZh1W/Xdm3Xdu0Z1ADZumLBsO5FrixMRT3qoqynNUKvkQ58gd8/kc8HKnsh2Q3BDZ1LAtmBgLu2a8+VALTWVxKzgnrNadmZdzutdtd27f0sALOVgWEDpMaXWGzSonZlblw0o2Pd75/2532qYMgN2FVjdtd2bdeedQGYZUjJQFvZ7eKdVrhru/ZFZgInFhLluFZZF9hhdmPrqvV/TnSx3z8rn1d5DcnXU961Xdu1504Aosj4oGahi512NOK5diJw13btuROAzK5cZFizV4qadOsk4Rfn5xLwIAoBQgLZCcBd27XnUACCG1T1OyhwhFjcOUF2bdeeYxM4IKt3ITBtdvBOu6nKvNr4UE0svgbgzm6cdm3XnnkBmFkLES/0PJhPshN8ayRgoQqWQdE7HXDXdu25E4AuEJrhagGXO7vM3CCIdBl5z6cXd3uf79qu7drz3BiWYUWhqAO8axdUC3dt13btuRGACcVkoWDAsDVDTiR/yS4trkfm7YZm13btORWAVrS2pEWIW5UY2W3vXdu1XXufNm1J3bOIyJISEa6SoJKsse6+2OME69bvjg1m13btuRKAiZn85Hm6evtoMvmAXbL4OJhiY++QrTXysaDEJ0DvGKF3bdeeKxP4G/73//CXM6W+ayV6oZSGEAuIfK0LAhH7/+5ezVdeE4R3B8Wu7drzKADfeA3qa7/rZ348SenvTmcTAmC3Ugzki6XtxmnXdu35FYCvvfYaREDC0f+cCMMSQ6i9koeQVF4NizD8rPa5rPn9ZXwuPf27yOeGpHAO0U4Q7tquPb8CEACIIIlEWQoNA4K05DVI7YU1n6/7Di74eVvIcv1zGvkMF+3Dru3arj1frXBbpjLRGSYgcjGBuSWci5a+zV6yx1QFRVHfV7bLsvU0W5glSPU3dl7gXdu1508DBICVxDqTWAQaAvYvGqTpyMj3n+cWFkPatV3btedcA/zpX7hLALAk/SiRmDRiCEWwELA4tlSidra7Qi/sCJeRGqtgnWC6rlc+6c+pxuInjeeQBvUVNbTcdrxw13Zt154DDfCn8VELAKk5+KfHC/VQRfsqxcRaiiBQQJ+2Q+iNFaS62tSnTj0Dn9PA39eF5k4d3LVde04F4O3bt60I6Jv+d3d+ySL6E2eyvxB9wClNrGENlyJHnvn44pXgnjVzNtTmdlrcru3aF5kA9KahyK1b/DV/8qf/3mka/ZFzHK5E7XNGWoTofZ8PvBN+u7ZrX8QCEADo9m0rb7ymfvP/9ud+7Ez2/siS91eGYhhQWS44MPvaNMFQSxRqmpCNz9f9/pI/b4Sz1Po55Pko/yIBwC4Vbtd27bkUgABAr98x8gbUv/ud//JHT7PJj0WzAwgiI5WvvX9s4E01v87f7KJgdm3Xnl8B6NpruHULvML+P5pjnxKakeUpLEWwpFyWCJUU+tVX+9sNZ0PxdV+HuOv3tf81nRbDft/1ecsPRvYv6CPtJOCu7dpzLwA/8Qt35PZt2GNz9E/vL/YeyOSKSmjPWDWBkC7rhrQJtjX6YePzdb/v+Lz43oa/Lz6uC+iuDg+5/q7t2q49/wLw9m3YW7fAv+t7fuJXl3b6Xaf2aJFGR2qFmQ+NYSc4GAErio8VXKfxNT53OcPdv5fKq3mdYb/f9uftfQR2GOCu7dpzbwI7ISi3bvHXfffP/J3Hyd53nMtRanxojJCGJe6/6lBVcGj83rrvXfT6l9W/Xdu1XXv+BCDgvMI/devr9dd896d+9HFy8IfOcXVh9BGvaGYzTJCJLuuIeAaZuvdUqP3V1S4aZ3jR6w/9fBcys2u79j4XgADwsdufzHIh+Cjb/45Tuppm+iovsWczTGGgIDvVZ9d2bdfejwKwFILQX/Odn/rRR8n+Hzqj6/Msus4r3reGY1hSBW/Mphrburg7C/caqkmOvX7X5/X7tv9e3GcC7LzAu7Zr7zMB6IQgnCb4nZ/60fvJ/h89o2tJFl3hFc2soRjWM8h8sbQGIcKu7dquPZdtsMqSa4K/9Ts/+aOf+msfFRvR9x9FtL9ITkyMBRRlrCgjggWJdSwpggq1Kq01mGW45AGaVyPp/wE2/JzK/lf+JfDucHY502q3oHZt1953GmBVE4T+bf+bn/5v7y0O/+Dd9IW3kskHlNl7Wc3pGp3jSFa0j4ynMBTDkoYlncfMFJIk55xuvtqdq0zu1fisEqLS9vt11+//nEnAFHwehN+QHzwXFilCLLBidjbwru3a+1EDDIWgCJjoJ//+3/u/v/avl3vHH4t49k0x9r/t6nROJjk3EVZQSMDIwGSYkDkkTwTwWqE0FayKHkY1hU5avkgtipurDVIqhHXqKqkpjGM/D/vnvmMEksHaDMTpOQDgzm5h7dquPQ9tYxeu3ALTbdj875/569/w8X09/wtX48WHprTAlJaIZIVktQRJYhmWSQxILNi5FlpM1nYBSDXBVqivUpV/tEYAWqp+d1MBKSAQBOzkuYn3jtS78yu/ejedfs1Xf88v3xdXXXkHD+7arr1fBSAA3LoF/sRHXiP8wh2h27D/4Ht/11e8MFt87VSWN2Ne7GuT/mbF5luO4oyTNLGMzJHtky1MWEAgOdUMlRItjC3OJYkNuk0AWKTxFFKTpBR8LjVhWR8AqY0K2frnXApAchrt3lTzUvYfHyd7r33pH/30P64fDLu2a7v2PhWAfRph3v7ff/Wr/yMV0V/Uyn6FIoOIBYoEzPAcWwIRG0irquYXCqa604MF1R80hCD5X0hTOKLfBVLXEHPBVxbDdEEyIvjVZTr9rl/3x/4/P+WggZ3w27Vd+6ITgLlG+FF8PX/0Iy8KcAf4BQjdhv3R7/29X3EzTj9KIi8pLawYYFjvgbEN/Y6rfxbv2soXyu+w/4G11Y/L31j/vcDnY22HpKr1o/VTBomxBLx3lu391Nd/909+9o03oF5/HWa3pHZt156f9v8HOn6U252q30wAAAAASUVORK5CYII="; /* lent şəkli koda daxildir, ayrıca fayl lazım deyil */
const num = v => Number(v) || 0;

let tT = null;
function toast(msg) {
  let t = document.getElementById("pfToast");
  if (!t) { t = document.createElement("div"); t.id = "pfToast"; t.className = "pf-toast"; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(tT); tT = setTimeout(() => { t.style.display = "none"; }, 2600);
}

/* ================= XALLAR ================= */
const men = cariOyuncu();
const MEN = men && men.docId ? men.docId : null;

const xalVer = (uid, sahe, n = 1) => {
  if (!uid || !n || n <= 0) return;
  const uRef = doc(fsdb, "users", uid);

  return runTransaction(fsdb, async tx => {
    const snap = await tx.get(uRef);
    if (!snap.exists()) return;
    const d = snap.data() || {};

    if (aktivDonmaVarmi(d, sahe)) {
      return;
    }

    const yenile = {};
    let bitmisVar = false;

    if (d.dondurulmusXallar && d.dondurulmusXallar[sahe] !== undefined) {
      const bitis = vaxtMs(d.dondurulmusXallar[sahe]);
      if (bitis > 0 && Date.now() >= bitis) {
        yenile["dondurulmusXallar." + sahe] = deleteField();
        if (d.saxlanilanXallar && d.saxlanilanXallar[sahe] !== undefined) {
          const kohne = num(d.saxlanilanXallar[sahe]);
          yenile["saxlanilanXallar." + sahe] = deleteField();
          yenile[sahe] = kohne + n;
          bitmisVar = true;
        }
      }
    }

    const fKey = FREEZE_FIELD_MAP[sahe];
    if (fKey && d[fKey] !== undefined) {
      const bitis = vaxtMs(d[fKey]);
      if (bitis > 0 && Date.now() >= bitis) {
        yenile[fKey] = 0;
        const sKey = SAVED_FIELD_MAP[sahe];
        if (sKey && d[sKey] !== undefined) {
          const kohne = num(d[sKey]);
          yenile[sKey] = 0;
          yenile[sahe] = kohne + n;
          bitmisVar = true;
        }
      }
    }

    if (bitmisVar) {
      tx.update(uRef, yenile);
      return;
    }

    tx.update(uRef, { ...yenile, [sahe]: num(d[sahe]) + n });
  }).catch(e => console.error("Xal xətası:", e));
};

window.Xallar = {
  opus: (uid, n = 1) => xalVer(uid, "kisses", n),
  musiqiQosdu: uid => xalVer(uid, "music", 9),
  musiqiHediyye: (uid, n = 1) => xalVer(uid, "music", n),
  smayl: (uid, n = 1) => xalVer(uid, "smiles", n),
  hediyye: (uid, n = 1) => xalVer(uid, "gifts", n),
  beyenme: (uid, n = 1) => xalVer(uid, "likes", n),
  cutluk: (uid, n = 1) => xalVer(uid, "couples", n),
  oyunVaxti: (uid, n = 1) => xalVer(uid, "playTime", n),
  donmaYoxla: donmaVaxtiYoxla
};

if (MEN) {
  let evvel = null;
  onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/opus/" + MEN), s => {
    const v = num(s.val());
    if (evvel !== null && v > evvel) xalVer(MEN, "kisses", v - evvel);
    evvel = v;
  });
}

let urekGizli = false;
setInterval(() => {
  const acik = !!document.querySelector(".sp-root.open, .hd-root.open, .pf-ov.open");
  if (acik === urekGizli) return;
  urekGizli = acik;
  ["urekBtn", "urekSayi"].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = acik ? "none" : ""; });
}, 300);

/* ================= MƏFTUN ƏMƏLİYYATLARI (tranzaksiya) ================= */
function meftunTx(isle) {
  return runTransaction(fsdb, async tx => {
    const W = {}, P = {};
    const al = async uid => {
      if (!W[uid]) { const s = await tx.get(doc(fsdb, "users", uid)); W[uid] = s.data() || {}; P[uid] = {}; }
      return W[uid];
    };
    const yaz = (uid, k, v) => { W[uid][k] = v; P[uid][k] = v; };
    await isle(al, yaz);
    for (const uid in P) if (Object.keys(P[uid]).length) tx.update(doc(fsdb, "users", uid), P[uid]);
  });
}

async function meftunOl(hedef) {
  const info = {};
  await meftunTx(async (al, yaz) => {
    const h = await al(hedef), m = await al(MEN);
    const q = Math.max(1, num(h.meftunQiymet));
    if (h.meftunUid === MEN) throw new Error("ARTIQ");
    if (num(m.hearts) < q) throw new Error("YETMIR");
    const prev = h.meftunUid || null, odenen = num(h.meftunOdenis);
    if (prev) {
      const p = await al(prev);
      if (!aktivDonmaVarmi(p, "cutUrek")) {
        yaz(prev, "cutUrek", Math.max(0, num(p.cutUrek) - odenen));
      }
    }
    yaz(MEN, "hearts", num(m.hearts) - q);
    if (!aktivDonmaVarmi(m, "cutUrek")) {
      yaz(MEN, "cutUrek", num(m.cutUrek) + q);
    }
    yaz(hedef, "meftunUid", MEN);
    yaz(hedef, "meftunOdenis", q);
    yaz(hedef, "meftunQiymet", q + 1);
    info.metn = "💘 " + (m.username || "Oyunçu") + ", " + (h.username || "Oyunçu") + " adlı oyunçuya məftun oldu (" + q + " ❤️)";
  });
  return info;
}

async function terkEt() {
  const info = {};
  await meftunTx(async (al, yaz) => {
    const o = await al(MEN);
    if (!o.meftunUid) throw new Error("BOS");
    const q = Math.max(1, num(o.meftunQiymet));
    if (num(o.hearts) < q) throw new Error("YETMIR");
    const prev = o.meftunUid, odenen = num(o.meftunOdenis);
    const p = await al(prev);
    const prevAd = p.username || "Oyunçu";
    if (!aktivDonmaVarmi(p, "cutUrek")) {
      yaz(prev, "cutUrek", Math.max(0, num(p.cutUrek) - odenen));
    }
    yaz(MEN, "hearts", num(o.hearts) - q);
    yaz(MEN, "meftunUid", null);
    yaz(MEN, "meftunOdenis", 0);
    info.metn = "💔 " + (o.username || "Oyunçu") + ", məftunu " + prevAd + " adlı oyunçunu tərk etdi (" + q + " ❤️)";
  });
  return info;
}

function chatYaz(info) {
  if (!info || !info.metn || !MEN) return;
  push(ref(rtdb, "masalar/" + MASA_NOMRESI + "/chat"), { isMeftunNotice: true, uid: MEN, metn: info.metn, vaxt: serverTimestamp() }).catch(() => {});
}

/* ================= SIRA (real vaxt) ================= */
const ov = document.createElement("div");
ov.className = "pf-ov";
document.body.appendChild(ov);

const SIRA_SAHELERI = ["kisses", "music", "smiles", "meftunQiymet", "cutUrek"];
let sonD = null, unsub = null, acik = false, ownerUid = null;

const rkN = {};
const rkTxt = (uid, k) => (rkN[uid] && rkN[uid][k] ? fmt(rkN[uid][k]) + " sıra" : "");

/* ================= TOP LENTİ (1-10 ci yer) ================= */
function topLentYenile() {
  if (!ownerUid) return;
  const w = ov.querySelector(".pf-topw");
  if (!w) return;
  const var_ = topMu(ownerUid);
  let el = w.querySelector(".pf-topimg");
  const vipEl = w.querySelector(".pf-vipimg");
  if (vipEl) vipEl.style.display = var_ ? "none" : "";
  if (!var_) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("img");
    el.className = "pf-topimg";
    el.alt = "";
    el.src = TOP_LENT;
    el.onerror = () => { el.style.display = "none"; };
    w.insertBefore(el, w.firstChild);
  }
}

function siraYaz(uid, k) {
  if (uid !== ownerUid) return;
  const t = rkTxt(uid, k);
  ov.querySelectorAll('[data-r="' + k + '"]').forEach(el => { if (el.textContent !== t) el.textContent = t; });
  topLentYenile();
  hazirsaGoster();
}

const taym = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("vaxt bitdi")), ms))]);
const isde = {}, gozle = {};
async function siraYenile(uid, d) {
  if (!uid || !d) return;
  if (isde[uid]) { gozle[uid] = d; return; }
  isde[uid] = true;
  try {
    const rk = rkN[uid] || (rkN[uid] = {});
    await Promise.all(SIRA_SAHELERI.map(async k => {
      if (aktivDonmaVarmi(d, k)) { rk[k] = 0; siraYaz(uid, k); return; }
      const v = k === "meftunQiymet" ? Math.max(1, num(d[k])) : num(d[k]);
      if (v <= 0) { rk[k] = 0; siraYaz(uid, k); return; }
      try {
        const snap = await taym(getCountFromServer(query(collection(fsdb, "users"), where(k, ">", v))), 8000);
        rk[k] = snap.data().count + 1;
        siraYaz(uid, k);
      } catch (e) { console.error("Sıra xətası:", e); }
    }));
  } finally {
    isde[uid] = false;
    const d2 = gozle[uid];
    if (d2) { delete gozle[uid]; siraYenile(uid, d2); }
  }
}
setInterval(() => { if (ov.classList.contains("open") && sonD && ownerUid) siraYenile(ownerUid, sonD); }, 1000);

/* ================= KEŞ ================= */
const udata = {};
function azalt(obj, max) {
  const ks = Object.keys(obj);
  for (let i = 0; i < ks.length - max; i++) if (ks[i] !== ownerUid) delete obj[ks[i]];
}
const sekilIsit = u => { if (u) { try { const im = new Image(); im.src = u; } catch (e) {} } };
[
  "images/profil/opucuk.png",
  "images/profil/mahni.png",
  "images/profil/smaylik.png",
  "images/profil/tek_urek.png",
  "images/profil/cut_urek.png",
  "images/profil/vip.png",
  TOP_LENT,
  NOPHOTO
].forEach(sekilIsit);

/* ================= MƏFTUNUN CANLI MƏLUMATI ================= */
let mUid = null, mUnsub = null, mD = null;
const mKesh = {};
const mYarat = (uid, x) => ({ uid, ad: x.username || "Oyunçu", avatar: x.avatar || "", qiz: x.gender === "Qadın", vip: vipMi(x) });
function izleMeftun(uid) {
  if (uid === mUid) return;
  if (mUnsub) { mUnsub(); mUnsub = null; }
  mUid = uid; mD = uid ? (mKesh[uid] || null) : null;
  if (!uid) return;
  mUnsub = onSnapshot(doc(fsdb, "users", uid), s => {
    mD = mKesh[uid] = mYarat(uid, s.data() || {});
    if (sonD) ciz(sonD);
  }, () => {});
}

/* ================= KART ================= */
let gurulu = false, sig = {};

let bekleT = null;
function hazirMi() {
  if (!sonD || !ownerUid) return false;
  if (sonD.meftunUid && !(mD && mD.uid === sonD.meftunUid)) return false;
  const rk = rkN[ownerUid];
  return !!rk && SIRA_SAHELERI.every(k => rk[k] !== undefined);
}
function kartiGoster() {
  clearTimeout(bekleT); bekleT = null;
  if (!ov.classList.contains("pf-bekle")) return;
  ov.classList.remove("pf-bekle");
  const c = ov.querySelector(".pf-card");
  if (c) { c.style.animation = "none"; void c.offsetWidth; c.style.animation = ""; }
}
function hazirsaGoster() {
  if (ov.classList.contains("pf-bekle") && hazirMi()) kartiGoster();
}

function bagla() {
  if (window.TepikPencere) window.TepikPencere.bagla();
  sonD = null; ownerUid = null; gurulu = false; sig = {};
  if (mUnsub) { mUnsub(); mUnsub = null; } mUid = null; mD = null;
  clearTimeout(bekleT); bekleT = null;
  ov.classList.remove("pf-bekle");
  ov.classList.remove("open");
  if (unsub) { unsub(); unsub = null; }
  ov.innerHTML = "";
}
ov.addEventListener("click", e => { if (e.target === ov) bagla(); });

/* Oyunçu hazırda bu masada oturubmu? */
const masadaMi = uid => !!uid && Object.values(oturacaqlar).some(o => o && o.uid === uid);

/* Masada olmayan oyunçunun kartında məktub, musiqi və təpik düymələri solğun olur və basılmır */
function duymeHal() {
  if (!ownerUid) return;
  const var_ = masadaMi(ownerUid);
  ["pf-mail", "pf-mus"].forEach(c => {
    const b = ov.querySelector("." + c);
    if (!b) return;
    b.disabled = !var_;
    b.classList.toggle("pf-solgun", !var_);
  });
  /* təpik düyməsi: başqasının kartında oyunçu masada deyilsə solğun, öz kartımda həmişə aktiv.
     Class adından asılı olmasın deyə 1-ci düymə mövqeyinə görə tapılır */
  const kAktiv = var_ || ownerUid === MEN;
  const kb = ov.querySelector(".pf-act .pf-btn:first-child");
  if (kb) {
    kb.classList.add("pf-kick");
    kb.disabled = !kAktiv;
    kb.classList.toggle("pf-solgun", !kAktiv);
  }
}
/* düymə kart açıldıqdan sonra əlavə oluna bilər: açıq kartda vəziyyət tez-tez yoxlanır */
setInterval(() => { if (ov.classList.contains("open")) duymeHal(); }, 300);

/* Musiqi düyməsi: kart bağlanır, "Musiqi qoy" paneli (klip + mahnı) həmin oyunçu adına açılır */
function musiqiAc() {
  const uid = ownerUid;
  if (!uid || !masadaMi(uid)) return;
  bagla();
  if (window.SmaylPanel) window.SmaylPanel.bagla();
  if (window.HediyyePanel && typeof window.HediyyePanel.acMusiqi === "function") window.HediyyePanel.acMusiqi(uid);
}

function mesajYaz() {
  const uid = ownerUid, ad = sonD ? pick(sonD, ["username"]) : null;
  if (!uid || uid === MEN || !ad) return;
  if (!masadaMi(uid)) return; /* masada deyilsə çatda adı yazılmasın */
  bagla();
  if (window.HediyyePanel) window.HediyyePanel.bagla();
  if (window.SmaylPanel) window.SmaylPanel.bagla();
  if (typeof window.CatHedef === "function") window.CatHedef(ad, uid);
  else {
    const inp = document.getElementById("mesajInput");
    if (inp) { const mur = ad + ", "; if (!inp.value.startsWith(mur)) inp.value = mur + inp.value; inp.focus(); }
  }
}

const adRengi = m => (m.vip ? (m.qiz ? "#e0201c" : "#1f5fd6") : (m.qiz ? "#f26aa6" : "#3aa0e0"));

const onerr = "this.onerror=null;this.src='" + NOPHOTO + "'";
const R = k => '<span class="pf-rk" data-r="' + k + '">' + esc(rkTxt(ownerUid, k)) + "</span>";
const row = (cls, ic, val, k) => '<div class="pf-row ' + cls + '"><span class="pf-ic">' + ic + "</span><b>" + fmt(val) + "</b>" + R(k) + "</div>";

function qur() {
  ov.innerHTML =
    '<div class="pf-card">' +
      '<button class="pf-close" aria-label="Bağla"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg></button>' +
      '<div class="pf-topw"></div>' +
      '<div class="pf-stw"></div>' +
      '<div class="pf-stats"><div class="pf-rowsw"></div>' + IC.kubok + "</div>" +
      '<div class="pf-dv"><i></i><span>' + IC.chev + "</span><i></i></div>" +
      '<div class="pf-userw"></div>' +
      '<div class="pf-ln"></div>' +
      '<div class="pf-act">' +
        '<button class="pf-btn pf-kick" style="background:#ec5440">' + IC.qalxan + "</button>" +
        '<button class="pf-btn t" style="background:#ef8c0b">Buto</button>' +
        '<button class="pf-btn pf-mus" style="background:#ab5a98">' + IC.musiqi + "</button>" +
        '<button class="pf-btn" style="background:#f9a23a">' + IC.tesdiq + "</button>" +
        '<button class="pf-btn pf-mail" style="background:#4fa9de">' + IC.mail + "</button>" +
      "</div>" +
    "</div>";
  gurulu = true; sig = {};
  ov.querySelector(".pf-close").onclick = bagla;
  ov.querySelector(".pf-mail").onclick = mesajYaz;
  ov.querySelector(".pf-mus").onclick = musiqiAc;
  ov.querySelector(".pf-dv span").onclick = () => { acik = !acik; if (sonD) ciz(sonD); };
}

function ciz(d) {
  if (!gurulu || !ov.querySelector(".pf-card")) qur();
  const ad = pick(d, ["username"]) || "Oyunçu";
  const yas = pick(d, ["age"]);
  const yer = [pick(d, ["country"]), pick(d, ["city"])].filter(Boolean).join(", ");
  const sekil = pick(d, ["avatar"]) || NOPHOTO;
  const qiymet = Math.max(1, num(d.meftunQiymet));
  const mVar = !!d.meftunUid;
  const menimdir = ownerUid === MEN;
  const mailBtn = ov.querySelector(".pf-mail");
  if (mailBtn) mailBtn.style.visibility = menimdir ? "hidden" : "visible";
  duymeHal();

  const sTop = [sekil, ad, yas, yer, vipMi(d)].join("|");
  if (sig.top !== sTop) {
    sig.top = sTop;
    ov.querySelector(".pf-topw").innerHTML =
      (vipMi(d) ? '<img class="pf-vipimg" src="images/profil/vip.png" alt="">' : "") +
      '<div class="pf-photo"><img src="' + esc(sekil) + '" alt="" onerror="' + onerr + '">' +
      '<div class="pf-cap">' + esc(ad) + (yas ? ", " + esc(yas) : "") + (yer ? "<small>" + esc(yer) + "</small>" : "") + "</div>" +
      '<button class="pf-zoom" aria-label="Böyüt">' + IC.zoom + "</button></div>";
    ov.querySelector(".pf-zoom").onclick = () => {
      const f = document.createElement("div");
      f.className = "pf-full";
      f.innerHTML = '<img src="' + esc(sekil) + '" alt="">';
      f.onclick = () => f.remove();
      document.body.appendChild(f);
    };
  }
  /* TOP lenti: innerHTML yenilənəndə silinir, ona görə hər dəfə yenidən yoxlanır */
  topLentYenile();

  const stat = String(pick(d, ["status"]) || "").trim();
  if (sig.st !== stat) {
    sig.st = stat;
    ov.querySelector(".pf-stw").innerHTML = stat ? '<div class="pf-st"><span>' + esc(stat) + '</span></div><div class="pf-stl"></div>' : "";
  }

  const kVal = aktivDonmaVarmi(d, "kisses") ? 0 : d.kisses;
  const mVal = aktivDonmaVarmi(d, "music") ? 0 : d.music;
  const sVal = aktivDonmaVarmi(d, "smiles") ? 0 : d.smiles;
  const cVal = aktivDonmaVarmi(d, "cutUrek") ? 0 : d.cutUrek;

  ov.querySelector(".pf-dv").classList.toggle("up", acik);
  const sRows = [kVal, mVal, sVal, qiymet, cVal, acik ? 1 : 0].map(num).join("|");
  if (sig.rows !== sRows) {
    sig.rows = sRows;
    let rows = row("pf-k", IC.dudaq, kVal, "kisses") + row("pf-m", IC.nota, mVal, "music");
    if (acik) rows += row("pf-h", IC.urek1, qiymet, "meftunQiymet") + row("pf-h", IC.urek2, cVal, "cutUrek");
    rows += row("pf-c", IC.smayl, sVal, "smiles");
    ov.querySelector(".pf-rowsw").innerHTML = rows;
  }

  const mOK = mVar && mD && mD.uid === d.meftunUid;
  const sUser = [d.meftunUid || "", mOK ? mD.ad + "|" + mD.avatar + "|" + mD.qiz + "|" + mD.vip + "|" + topMu(mD.uid) : "", menimdir, d.meftunUid === MEN].join("#");
  if (sig.user !== sUser) {
    sig.user = sUser;
    let mAva, mAd;
    if (!mVar) { mAva = IC.bosAva; mAd = "Məftun yoxdur"; }
    else if (mOK) {
      mAva = '<img style="width:100%;height:100%;object-fit:cover;display:block" src="' + esc(mD.avatar || NOPHOTO) + '" alt="" onerror="' + onerr + '">';
      mAd = 'Məftun <u style="color:' + (topMu(mD.uid) ? TOP_RENG : adRengi(mD)) + '">' + esc(mD.ad) + "</u>";
    } else { mAva = IC.bosAva; mAd = "Məftun ..."; }

    let dugme;
    if (menimdir) dugme = mVar ? '<button class="pf-follow" data-a="terk">Tərk et</button>' : '<button class="pf-follow g" disabled>Məftun ol</button>';
    else if (d.meftunUid === MEN) dugme = '<button class="pf-follow g" disabled>Məftunsan</button>';
    else dugme = '<button class="pf-follow" data-a="ol">Məftun ol</button>';

    ov.querySelector(".pf-userw").innerHTML =
      '<div class="pf-user"><div class="pf-ava" style="overflow:hidden">' + mAva + "</div>" +
      '<div class="pf-info"><div class="pf-name">' + mAd + "</div>" +
      '<div class="pf-heart"><img src="images/profil/tek_urek.png" alt="" style="width:7.2vw;height:auto;display:block;margin-right:2.1vw"><b class="pf-hv"></b>' + R("meftunQiymet") + "</div>" +
      dugme + "</div></div>";

    if (mOK) {
      const goster = () => window.ProfilKart.ac(d.meftunUid);
      const av = ov.querySelector(".pf-userw .pf-ava"), nm = ov.querySelector(".pf-userw .pf-name");
      av.style.cursor = nm.style.cursor = "pointer";
      av.onclick = nm.onclick = goster;
    }
    const b = ov.querySelector(".pf-follow[data-a]");
    if (b) b.onclick = async () => {
      b.disabled = true;
      try {
        chatYaz(b.dataset.a === "ol" ? await meftunOl(ownerUid) : await terkEt());
      } catch (e) {
        if (e.message === "YETMIR") toast("Kifayət qədər bonus ürəyiniz yoxdur");
        else if (e.message === "ARTIQ") toast("Artıq məftunsunuz");
        else if (e.message === "BOS") toast("Məftun yoxdur");
        else { console.error(e); toast("Xəta baş verdi, yenidən cəhd edin"); }
      }
      if (b.isConnected) b.disabled = false;
    };
  }
  const hv = ov.querySelector(".pf-hv");
  if (hv) hv.textContent = fmt(qiymet);
  hazirsaGoster();
}

window.ProfilKart = {
  ac(docId) {
    if (!docId) return;
    if (unsub) unsub();
    if (ownerUid !== docId) {
      gurulu = false; sig = {}; sonD = null; ov.innerHTML = "";
      if (mUnsub) { mUnsub(); mUnsub = null; } mUid = null; mD = null;
      ov.classList.add("pf-bekle");
      clearTimeout(bekleT); bekleT = setTimeout(kartiGoster, 700);
    }
    ownerUid = docId;
    ov.classList.add("open");
    if (!sonD && udata[docId]) {
      sonD = udata[docId];
      izleMeftun(sonD.meftunUid || null);
      ciz(sonD);
      siraYenile(docId, sonD);
    }
    unsub = onSnapshot(doc(fsdb, "users", docId), snap => {
      if (!snap.exists()) { bagla(); return; }
      sonD = snap.data();
      donmaVaxtiYoxla(docId, sonD);
      udata[docId] = sonD;
      mKesh[docId] = mYarat(docId, sonD);
      izleMeftun(sonD.meftunUid || null);
      ciz(sonD);
      siraYenile(docId, sonD);
      if (sonD.meftunUid) onYukle(sonD.meftunUid, 1);
    }, err => { console.error("ProfilKart:", err); bagla(); });
  },
  bagla
};

/* TOP siyahısı dəyişəndə açıq kart yenilənir (lent + məftun adının rəngi) */
topDeyis(() => { if (sonD && ownerUid && ov.classList.contains("open")) ciz(sonD); });

const hazir = {};
async function onYukle(uid, derinlik = 0) {
  if (!uid) return;
  const indi = Date.now();
  if (hazir[uid] && indi - hazir[uid] < 120000) return;
  hazir[uid] = indi;
  try {
    const s = await getDoc(doc(fsdb, "users", uid));
    if (!s.exists() || uid === ownerUid) return;
    const d = s.data();
    donmaVaxtiYoxla(uid, d);
    udata[uid] = d;
    mKesh[uid] = mYarat(uid, d);
    azalt(udata, 60); azalt(mKesh, 60); azalt(rkN, 60);
    sekilIsit(d.avatar);
    siraYenile(uid, d);
    if (d.meftunUid && derinlik < 1) onYukle(d.meftunUid, derinlik + 1);
  } catch (e) { delete hazir[uid]; }
}

let oturacaqlar = {}, spin = null;
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/oturacaqlar"), s => {
  oturacaqlar = s.val() || {};
  duymeHal();
  Object.values(oturacaqlar).forEach(o => { if (o && o.uid) onYukle(o.uid); });
});
onValue(ref(rtdb, "masalar/" + MASA_NOMRESI + "/raund/spin"), s => {
  spin = s.val() || null;
  if (spin) { onYukle(spin.qu); onYukle(spin.ou); }
});

function ackart(uid) {
  const S = window.SmaylPanel, H = window.HediyyePanel;
  if (uid === MEN) {
    if (H) H.bagla();
    if (S && !document.querySelector(".sp-root.open")) { S.ac(); return; }
  } else if (H) {
    if (S) S.bagla();
    if (typeof H.modu === "function" && H.modu()) { H.isaretle(uid); return; }
    if ((typeof H.hedef === "function" ? H.hedef() : null) !== uid) { H.ac(uid); return; }
  }
  window.ProfilKart.ac(uid);
}

const icinde = (el, x, y) => {
  const r = (el.querySelector(".foto") || el).getBoundingClientRect();
  return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

window.addEventListener("click", e => {
  if (ov.classList.contains("open")) return;
  if (e.target && e.target.closest && !e.target.closest("#masa, #taxta")) return;

  if (spin) {
    const ortalar = document.querySelectorAll("#masa .orta");
    const uidler = [spin.qu, spin.ou];
    for (let i = 0; i < ortalar.length && i < 2; i++) {
      const el = ortalar[i];
      if (el.classList.contains("goster") && uidler[i] && icinde(el, e.clientX, e.clientY)) {
        ackart(uidler[i]);
        return;
      }
    }
  }

  for (const el of document.querySelectorAll("#masa .yer.dolu")) {
    const m = /yer-(\d+)/.exec(el.className);
    if (!m) continue;
    const o = oturacaqlar[m[1]];
    if (o && o.uid && icinde(el, e.clientX, e.clientY)) {
      ackart(o.uid);
      return;
    }
  }

  const panelAcik = document.querySelector(".sp-root.open, .hd-root.open");
  const panelIci = e.target && e.target.closest ? e.target.closest(".sp-root, .hd-root, .pf-ov") : null;
  const masa = document.getElementById("masa");
  if (panelAcik && !panelIci && masa) {
    const r = masa.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      if (window.SmaylPanel) window.SmaylPanel.bagla();
      if (window.HediyyePanel) window.HediyyePanel.bagla();
    }
  }
}, true);


/* ================= TƏPİK VUR VƏ QORU PƏNCƏRƏLƏRİ =================
   Profil kartındakı qırmızı qalxan düyməsi: qiymət pəncərəsi, "?" ilə izah pəncərəsi.
   Pəncərəni tepik-baglanti.js öz kartımda düyməyə basılanda window.TepikPencere.ac() ilə açır.
   "Oldu" yalnız pəncərəni bağlayır. */
(function () {
const T = { qiymet: 15 };

const CSS = `
.tp-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:2147483000 !important;font-family:Roboto,Arial,sans-serif;-webkit-tap-highlight-color:transparent}
.tp-ov.open{display:flex}
.tp-card{position:relative;width:80vw;background:#fff;border-radius:4.4vw;box-shadow:0 1vw 4vw rgba(0,0,0,.35);animation:tpin .25s ease}
@keyframes tpin{from{transform:translateY(5vw);opacity:0}}
.tp-close{position:absolute;top:-2.6vw;right:-2.6vw;width:8.3vw;height:8.3vw;border-radius:50%;background:#fff;border:0;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:0 .6vw 1.8vw rgba(0,0,0,.3);z-index:3}
.tp-close svg{width:4.2vw;height:4.2vw}
.tp-head{position:relative;height:11.4vw;display:flex;align-items:center;justify-content:center}
.tp-head h3{margin:0;font:700 3.2vw/1 Roboto,Arial,sans-serif;color:#b9b9b9}
.tp-q{position:absolute;left:1vw;top:.4vw;width:8vw;height:8vw;border:0;background:none;padding:0;display:flex;align-items:center;justify-content:center;font:700 5.8vw/1 Roboto,Arial,sans-serif;color:#c3c3c3}
.tp-main{padding-bottom:4vw}
.tp-txt{margin:0;padding:0 5vw;text-align:center;font:400 3.3vw/4vw Roboto,Arial,sans-serif;color:#111}
.tp-pb{margin:4.4vw 5.9vw 0;height:12.5vw;background:#fdf7df;border-radius:4vw;display:flex;align-items:center;padding:0 3.9vw 0 2.1vw;box-sizing:border-box}
.tp-sh{display:block;width:8.8vw;height:8.8vw;flex:none}
.tp-sh svg{width:100%;height:100%;display:block}
.tp-bar{flex:none;width:41.7vw;height:4.1vw;border-radius:2.1vw;background:#97cd32;margin:0 3.6vw 0 2.3vw}
.tp-ok{width:5.7vw;height:5.7vw;flex:none;display:block}
.tp-price{display:flex;align-items:center;justify-content:center;height:6.5vw;margin-top:1vw;font:400 3.3vw/1 Roboto,Arial,sans-serif;color:#111}
.tp-price img{width:3.7vw;height:auto;display:block;margin:0 .8vw 0 1.5vw}
.tp-price b{font-weight:700;font-size:3.5vw}
.tp-oldu{display:block;width:20.8vw;height:7.8vw;margin:2.6vw auto 0;border:0;border-radius:2vw;background:#8cc63f;color:#fff;padding:0;font:400 3.7vw/1 Roboto,Arial,sans-serif}
.tp-info{padding-bottom:3.9vw}
.tp-r{display:flex;align-items:flex-start;padding:0 4vw 0 3.9vw;margin-bottom:3.9vw}
.tp-r.l{margin-bottom:0}
.tp-ic{width:12vw;height:12vw;border-radius:50%;background:#edf3fb;flex:none;margin:1vw 3.9vw 0 0;display:flex;align-items:center;justify-content:center}
.tp-ic svg{width:8.4vw;height:8.4vw;display:block}
.tp-rt{flex:1;min-width:0;margin:0;font:400 3.6vw/5.23vw Roboto,Arial,sans-serif;color:#111}
.tp-rt b{font-weight:700}
.tp-info .tp-oldu{margin-top:4vw}
`;
const st = document.createElement("style");
st.textContent = CSS;
document.head.appendChild(st);

const X = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="#7cc92f" stroke-width="3.2" stroke-linecap="round"/></svg>';

/* rəngli qalxan + təpik + partlayış */
const QALXAN =
  '<svg viewBox="0 0 64 64">' +
    '<path d="M62 42L53.4 45.1L57.3 53.3L49.1 49.4L46 58L42.9 49.4L34.7 53.3L38.6 45.1L30 42L38.6 38.9L34.7 30.7L42.9 34.6L46 26L49.1 34.6L57.3 30.7L53.4 38.9Z" fill="#f04a2f"/>' +
    '<path d="M24 38l12-5 14 16-6 7-17-3z" fill="#ffc933" stroke="#e8920e" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M20 4l14 5v11c0 9-6 15-14 18-8-3-14-9-14-18V9z" fill="#f7a823" stroke="#e8591e" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="M20 11l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" fill="#fff3b0"/>' +
  "</svg>";

const SAATOLCEN =
  '<svg viewBox="0 0 64 64">' +
    '<rect x="27" y="3" width="10" height="7" rx="2" fill="#2f7fd6"/>' +
    '<rect x="47" y="11" width="7" height="9" rx="2" fill="#2f7fd6" transform="rotate(42 50 15)"/>' +
    '<circle cx="32" cy="37" r="24" fill="#2f7fd6"/>' +
    '<circle cx="32" cy="37" r="19" fill="#fff"/>' +
    '<path d="M32 22v3M32 49v3M17 37h3M44 37h3" stroke="#2f7fd6" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M32 37l8-9" stroke="#e8392e" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="32" cy="37" r="3.5" fill="#e8392e"/>' +
  "</svg>";

const VIPMEDAL =
  '<svg viewBox="0 0 64 64">' +
    '<path d="M14 2h11l9 16h-11z" fill="#d93a2e"/>' +
    '<path d="M50 2H39l-9 16h11z" fill="#d93a2e"/>' +
    '<rect x="12" y="17" width="40" height="44" rx="6" fill="#fff" stroke="#7bbf2e" stroke-width="3"/>' +
    '<path d="M19 38l3-12 6 7 4-9 4 9 6-7 3 12z" fill="#f6b300" stroke="#d99700" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<text x="32" y="55" text-anchor="middle" font-family="Roboto,Arial,sans-serif" font-weight="700" font-size="13" fill="#6cb52d">VIP</text>' +
  "</svg>";

const OK =
  '<svg class="tp-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#8ec63a"/>' +
  '<path d="M6.5 12.5l3.8 3.8 7.2-7.8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ================= PƏNCƏRƏ ================= */
const ov = document.createElement("div");
ov.className = "tp-ov";
document.body.appendChild(ov);

let gorunus = "ana";

function anaHtml() {
  return '<div class="tp-card tp-main">' +
    '<button class="tp-close" aria-label="Bağla">' + X + "</button>" +
    '<div class="tp-head"><button class="tp-q" aria-label="Məlumat">?</button><h3>Təpik vur və qoru</h3></div>' +
    '<p class="tp-txt">Təpik vur və qoru ilə oyunçunu masadan kənarlaşdıra, eləcə də ya özünüzü, ya da digər oyunçunu kənarlaşdırılmaqdan qoruya bilərsiniz.</p>' +
    '<div class="tp-pb"><span class="tp-sh">' + QALXAN + '</span><div class="tp-bar"></div>' + OK + "</div>" +
    '<div class="tp-price">Aktivləşdirmənin qiyməti:<img src="images/profil/tek_urek.png" alt=""><b>' + (Number(T.qiymet) || 0) + "</b></div>" +
    '<button class="tp-oldu">Oldu</button>' +
  "</div>";
}

function infoHtml() {
  return '<div class="tp-card tp-info">' +
    '<button class="tp-close" aria-label="Bağla">' + X + "</button>" +
    '<div class="tp-head"><h3>Təpik vur və qoru nədir</h3></div>' +
    '<div class="tp-r"><div class="tp-ic">' + QALXAN + "</div>" +
      '<p class="tp-rt"><b>"Təpik vur və qoru"</b> – sizə oyunçunu təpiklə masadan kənarlaşdırmağa və özünüzü və ya kimisə kənarlaşdırılmaqdan qorumağa imkan verən xüsusiyyətlər toplusudur. Onlardan istifadə edilməsi taymeri işə salır və istifadəsinə davam edilməsi vaxt bitənə qədər ürəklər tələb edir.</p></div>' +
    '<div class="tp-r"><div class="tp-ic">' + SAATOLCEN + "</div>" +
      '<p class="tp-rt">Təpik vurma <b>30</b> saniyə sonra aktivləşəcək və oyunçu <b>15</b> dəqiqə ərzində masadan kənarlaşdırılacaq.</p></div>' +
    '<div class="tp-r l"><div class="tp-ic">' + VIPMEDAL + "</div>" +
      '<p class="tp-rt">Hər kəs özünü təpik vurulmasından qoruya bilər, lakin yalnız <b>VIP</b> oyunçular başqalarını təpiklə kənarlaşdıra bilər və ya bundan qoruya bilərlər. VIP oyunçular hər iki variantdan pulsuz olaraq iki dəfə daha tez istifadə edə bilərlər.</p></div>' +
    '<button class="tp-oldu">Oldu</button>' +
  "</div>";
}

function ciz() {
  ov.innerHTML = gorunus === "info" ? infoHtml() : anaHtml();
  const q = ov.querySelector(".tp-q");
  if (q) q.onclick = () => { gorunus = "info"; ciz(); };
  ov.querySelector(".tp-close").onclick = geri;
  ov.querySelector(".tp-oldu").onclick = gorunus === "info" ? () => { gorunus = "ana"; ciz(); } : bagla;
}

/* izah pəncərəsindən ana pəncərəyə qayıdır, ana pəncərədən isə tam bağlayır */
function geri() {
  if (gorunus === "info") { gorunus = "ana"; ciz(); }
  else bagla();
}

function ac(q) {
  if (q) T.qiymet = q;
  gorunus = "ana";
  ciz();
  ov.classList.add("open");
}

function bagla() {
  ov.classList.remove("open");
  ov.innerHTML = "";
  gorunus = "ana";
}

ov.addEventListener("click", e => { if (e.target === ov) geri(); });

window.TepikPencere = T;
T.ac = ac;
T.bagla = bagla;
})();
