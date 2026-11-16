// Masa çatı: real vaxtda mesajlar. Smaylik yalnız VIP üçündür.
import { db } from "./firebase-init.js";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { CONFIG } from "./game-config.js";

const $ = id => document.getElementById(id);
let unsub = null, table = null, joinedAt = 0, me = null, lastSent = 0, notify = () => {};

export function init(notifyFn) { notify = notifyFn; bindUI(); }

export function setMe(info) {
  me = info;
  $("emojiBtn").classList.toggle("locked", !info.vip);
}

export function close() {
  if (unsub) { unsub(); unsub = null; }
  table = null;
}

export function open(tableNo, joinedAtMs) {
  close();
  table = tableNo;
  joinedAt = joinedAtMs;
  $("chatBox").replaceChildren();
  const q = query(collection(db, "tables", String(tableNo), "chat"), orderBy("createdAt", "desc"), limit(CONFIG.chatKeep));
  unsub = onSnapshot(q, snap => {
    const msgs = [];
    snap.forEach(d => { const m = d.data(); if (m.createdAt >= joinedAt) msgs.push(m); });
    msgs.reverse();
    render(msgs);
  });
}

function render(msgs) {
  const box = $("chatBox");
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.replaceChildren(...msgs.map(bubble));
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

function bubble(m) {
  const row = document.createElement("div");
  row.className = "msg" + (m.kind === "emoji" ? " msg-emoji" : "") + (me && m.uid === me.id ? " mine" : "");
  const name = document.createElement("span");
  name.className = "msg-name";
  name.textContent = (m.vip ? "👑 " : "") + m.name + ": ";
  if (m.vip) name.style.color = CONFIG.vipColors[m.gender] || "#f59e0b";
  const text = document.createElement("span");
  text.className = "msg-text";
  text.textContent = m.text;
  row.append(name, text);
  return row;
}

async function post(text, kind) {
  if (!me || table === null) return false;
  const now = Date.now();
  if (now - lastSent < CONFIG.chatCooldownMs) { notify(CONFIG.texts.tooFast); return false; }
  lastSent = now;
  await addDoc(collection(db, "tables", String(table), "chat"), {
    uid: me.id, name: me.name, gender: me.gender, vip: me.vip, text, kind, createdAt: now
  });
  return true;
}

async function sendText(raw) {
  let text = raw.trim().slice(0, CONFIG.chatMaxLen);
  if (!text) return false;
  if (!me.vip && /\p{Extended_Pictographic}/u.test(text)) {
    notify(CONFIG.texts.vipOnlyEmoji);
    text = text.replace(/\p{Extended_Pictographic}\uFE0F?/gu, "").trim();
    if (!text) return false;
  }
  return post(text, "text");
}

async function sendEmoji(e) {
  if (!me.vip) { notify(CONFIG.texts.vipOnlyEmoji); return; }
  await post(e, "emoji");
}

function bindUI() {
  const input = $("chatInput"), panel = $("emojiPanel");

  CONFIG.emojis.forEach(e => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = e;
    b.addEventListener("click", async () => { await sendEmoji(e); panel.hidden = true; });
    panel.appendChild(b);
  });

  $("emojiBtn").addEventListener("click", () => {
    if (!me || !me.vip) { notify(CONFIG.texts.vipOnlyEmoji); return; }
    panel.hidden = !panel.hidden;
  });

  const go = async () => {
    const ok = await sendText(input.value);
    if (ok) input.value = "";
    input.focus();
  };
  $("sendBtn").addEventListener("click", go);
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
}
