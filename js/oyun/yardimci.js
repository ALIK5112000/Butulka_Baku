export function cariOyuncu() {
  try { return JSON.parse(localStorage.getItem("currentUser")); } catch (e) { return null; }
}
export function cinsTap(g) {
  g = String(g || "").toLowerCase();
  return /qad|qız|qiz|fem|жен|woman|girl|ქალ/.test(g) ? "q" : "o";
}
export function vipMi(p) {
  return !!(p && p.vip && (!p.vipUntil || p.vipUntil > Date.now()));
}
export function adRengi(cins, vip) {
  return vip ? (cins === "q" ? "#e11d2e" : "#1f3fd0") : (cins === "q" ? "#f06ba8" : "#3d9be9");
}
export function toast(m) {
  const d = document.createElement("div");
  d.textContent = m;
  d.style.cssText = "position:fixed;left:50%;bottom:26vw;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:2.4vw 4vw;border-radius:3vw;font-size:3.6vw;z-index:99";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}
