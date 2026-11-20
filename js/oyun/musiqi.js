/* musiqi.js — YouTube musiqi paneli (js/ qovluğuna at)
   oyun.html-də: <script src="js/musiqi.js"></script>
   Klip düyməsinin onclick-ində: MusiqiPanel.open()  */
(function () {
  var CFG = {
    API_KEY: "BURA_YOUTUBE_API_ACARINI_YAZ",
    COST: 9,          // ürək qiyməti
    REGION: "AZ",
    // "İfa et" basılanda çağrılır. v = {id,title,thumb}
    // Burada ürəyi çıx və serverə/Firebase-ə göndər ki, hamıda MusiqiPanel.play(v) işləsin
    onPlay: function (v) { MusiqiPanel.play(v); }
  };
  var API = "https://www.googleapis.com/youtube/v3/";
  var tab = "pop", $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ls = function (k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "[]"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return []; } };

  var css = '#mq-ov,#mq-cf{position:fixed;inset:0;background:#0006;display:none;z-index:9998}#mq-cf{z-index:9999;align-items:center;justify-content:center}' +
    '#mq-sh{background:#fff;color:#111;margin:16px 12px;border-radius:28px;padding:16px;height:calc(100% - 32px);display:flex;flex-direction:column;position:relative;font-family:system-ui,sans-serif}' +
    '#mq-x{position:absolute;top:-12px;right:-6px;width:44px;height:44px;border-radius:50%;background:#fff;color:#7ab800;font-size:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px #0004;cursor:pointer}' +
    '#mq-tb{display:flex;justify-content:center;gap:28px;font-size:30px}#mq-tb span{opacity:.35;cursor:pointer}#mq-tb .on{opacity:1}' +
    '#mq-h{color:#aaa;margin:10px 0;font-weight:bold}#mq-q{display:none;background:#f0f0f0;border:0;border-radius:12px;padding:12px;font-size:16px;width:100%;margin-bottom:10px}' +
    '#mq-g{overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;align-content:start}' +
    '.mq-v{position:relative;font-size:14px;cursor:pointer;line-height:1.2}.mq-th{position:relative;padding-top:56%;background:#333 center/cover}' +
    '.mq-d{position:absolute;right:4px;bottom:4px;background:#000a;color:#fff;font-size:12px;padding:1px 4px}' +
    '.mq-st{position:absolute;top:4px;right:6px;font-size:24px;color:#fff;text-shadow:0 0 3px #000}.mq-st.f{color:#f5b800}.mq-e{grid-column:1/-1;text-align:center;padding:30px}' +
    '#mq-dl{background:#fff;color:#111;border-radius:24px;padding:20px;width:88%;max-width:420px;text-align:center;font-family:system-ui,sans-serif}' +
    '#mq-dl img{width:100%;border-radius:8px}#mq-dl button{border:2px solid #8cc63f;background:none;color:#8cc63f;border-radius:10px;padding:12px 18px;font-size:17px;margin:4px}#mq-dl .g{background:#8cc63f;color:#fff}' +
    '#mq-pl{position:fixed;right:8px;bottom:80px;z-index:9997;background:#222;border-radius:12px;padding:6px;display:none}#mq-pl b{position:absolute;top:-10px;right:-6px;background:#fff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:28px;cursor:pointer}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var box = document.createElement("div");
  box.innerHTML = '<div id="mq-ov"><div id="mq-sh"><div id="mq-x">✕</div><div id="mq-tb"><span data-t="pop" class="on">🔥</span><span data-t="fav">⭐</span><span data-t="his">🕒</span><span data-t="src">🔍</span></div><div id="mq-h"></div><input id="mq-q" placeholder="Mahnı adı yaz və Enter bas"><div id="mq-g"></div></div></div><div id="mq-cf"><div id="mq-dl"></div></div><div id="mq-pl"><b id="mq-px">✕</b><div id="mq-fr"></div></div>';
  document.body.appendChild(box);

  var TITLES = { pop: "Populyar bölməsindən musiqi seç", fav: "Sevimlilər", his: "Tarixçə", src: "Musiqi axtar" };
  var items = {}; // id -> video

  function dur(iso) {
    var m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || ""); if (!m) return "";
    var h = +m[1] || 0, mi = +m[2] || 0, s = +m[3] || 0, p = function (n) { return (n < 10 ? "0" : "") + n; };
    return (h ? h + ":" : "") + p(mi) + ":" + p(s);
  }
  function api(path, params) {
    params.key = CFG.API_KEY;
    var u = API + path + "?" + Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    var c = sessionStorage.getItem(u); if (c) return Promise.resolve(JSON.parse(c));
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message);
      try { sessionStorage.setItem(u, JSON.stringify(j)); } catch (e) { }
      return j;
    });
  }
  function toVideos(j) {
    return j.items.map(function (x) {
      var t = x.snippet.thumbnails;
      return { id: x.id, title: x.snippet.title, thumb: (t.medium || t.default).url, dur: dur(x.contentDetails && x.contentDetails.duration) };
    });
  }
  function popular() {
    return api("videos", { part: "snippet,contentDetails", chart: "mostPopular", videoCategoryId: 10, regionCode: CFG.REGION, maxResults: 12 }).then(toVideos);
  }
  function search(q) {
    return api("search", { part: "snippet", type: "video", videoEmbeddable: "true", maxResults: 12, q: q }).then(function (j) {
      var ids = j.items.map(function (x) { return x.id.videoId; }).join(",");
      if (!ids) return [];
      return api("videos", { part: "snippet,contentDetails", id: ids }).then(toVideos);
    });
  }

  function render(list, empty) {
    var g = $("#mq-g"), fav = ls("mq_fav").map(function (v) { return v.id; });
    list.forEach(function (v) { items[v.id] = v; });
    g.innerHTML = list.length ? list.map(function (v) {
      var f = fav.indexOf(v.id) > -1;
      return '<div class="mq-v" data-i="' + v.id + '"><div class="mq-th" style="background-image:url(' + esc(v.thumb) + ')"><span class="mq-d">' + esc(v.dur || "") + '</span></div><span class="mq-st' + (f ? " f" : "") + '" data-f="' + v.id + '">' + (f ? "★" : "☆") + "</span>" + esc(v.title) + "</div>";
    }).join("") : '<div class="mq-e">' + (empty || "Boşdur") + "</div>";
  }
  function show() {
    $("#mq-h").textContent = TITLES[tab];
    $("#mq-q").style.display = tab === "src" ? "block" : "none";
    if (tab === "fav") return render(ls("mq_fav"));
    if (tab === "his") return render(ls("mq_his"));
    if (tab === "src") return render([], "Mahnı adı yaz");
    $("#mq-g").innerHTML = '<div class="mq-e">Yüklənir…</div>';
    popular().then(function (l) { render(l); }).catch(err);
  }
  function err(e) { $("#mq-g").innerHTML = '<div class="mq-e">Xəta: ' + esc(e.message) + "</div>"; }

  document.querySelectorAll("#mq-tb span").forEach(function (s) {
    s.onclick = function () {
      tab = s.dataset.t;
      document.querySelectorAll("#mq-tb span").forEach(function (x) { x.classList.remove("on"); });
      s.classList.add("on"); show();
    };
  });
  $("#mq-q").onkeydown = function (e) {
    if (e.key !== "Enter" || !this.value.trim()) return;
    $("#mq-g").innerHTML = '<div class="mq-e">Axtarılır…</div>';
    search(this.value.trim()).then(function (l) { render(l, "Hər hansı musiqi tapılmadı"); }).catch(err);
  };
  $("#mq-x").onclick = function () { $("#mq-ov").style.display = "none"; };

  $("#mq-g").onclick = function (e) {
    var f = e.target.dataset.f;
    if (f) {
      var a = ls("mq_fav"), i = a.map(function (v) { return v.id; }).indexOf(f);
      if (i > -1) a.splice(i, 1); else a.unshift(items[f]);
      ls("mq_fav", a); if (tab === "fav") show(); else { e.target.classList.toggle("f"); e.target.textContent = i > -1 ? "☆" : "★"; }
      return;
    }
    var v = e.target.closest(".mq-v"); if (v) ask(items[v.dataset.i]);
  };

  function ask(v) {
    $("#mq-dl").innerHTML = "<h3 style='color:#aaa'>Musiqini ifa etdir</h3><img src='" + esc(v.thumb) + "'><p>❤️ <b>" + CFG.COST + "</b> üçün \"" + esc(v.title) + "\" musiqi hər kəs üçün ifa edilsin?</p><button id='mq-no'>Ləğv et</button><button class='g' id='mq-ok'>İfa et</button>";
    $("#mq-cf").style.display = "flex";
    $("#mq-no").onclick = function () { $("#mq-cf").style.display = "none"; };
    $("#mq-ok").onclick = function () {
      $("#mq-cf").style.display = "none"; $("#mq-ov").style.display = "none";
      var h = ls("mq_his").filter(function (x) { return x.id !== v.id; }); h.unshift(v); ls("mq_his", h.slice(0, 30));
      CFG.onPlay(v);
    };
  }

  $("#mq-px").onclick = function () { $("#mq-fr").innerHTML = ""; $("#mq-pl").style.display = "none"; };

  window.MusiqiPanel = {
    cfg: CFG,
    open: function () { $("#mq-ov").style.display = "block"; show(); },
    play: function (v) {
      $("#mq-fr").innerHTML = '<iframe width="240" height="135" src="https://www.youtube.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&playsinline=1" allow="autoplay; encrypted-media" frameborder="0"></iframe>';
      $("#mq-pl").style.display = "block";
    }
  };
})();
