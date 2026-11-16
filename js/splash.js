/* Giriş ekranının məntiqi: fon → yüklənmə → brend → oyun */
(function () {
  const C = window.SPLASH_CONFIG;
  const $ = id => document.getElementById(id);
  const stageLoading = $("stageLoading"), stageBrand = $("stageBrand");
  let leaving = false;

  // --- Giriş yoxlaması (istəsən config-də aktiv et) ---
  if (C.requireLogin && !localStorage.getItem("currentUser")) {
    location.replace(C.loginPage);
    return;
  }

  // --- Arxa fon şəkilləri (varsa) ---
  function mountBackground(el, list) {
    if (!list || !list.length) return;
    const slides = list.map(src => {
      const d = document.createElement("div");
      d.className = "bg-slide";
      d.style.backgroundImage = 'url("' + src + '")';
      el.appendChild(d);
      return d;
    });
    let i = 0;
    const show = () => slides.forEach((s, k) => s.classList.toggle("on", k === i));
    show();
    if (slides.length > 1) {
      setInterval(() => { i = (i + 1) % slides.length; show(); }, C.slideEveryMs);
    }
  }
  mountBackground($("bgLoading"), C.loadingBackgrounds);
  mountBackground($("bgBrand"), C.brandBackgrounds);

  // --- Yüklənmə ---
  const toLoad = [...(C.preload || []), ...(C.loadingBackgrounds || []), ...(C.brandBackgrounds || [])];
  let loaded = 0;
  toLoad.forEach(src => {
    const img = new Image();
    img.onload = img.onerror = () => { loaded++; };  // xəta olsa da gözləməsin
    img.src = src;
  });

  const fill = $("bottleFill"), pct = $("pct");
  const start = performance.now();
  function frame(now) {
    const timeP = Math.min((now - start) / C.minLoadingMs, 1);
    const realP = toLoad.length ? loaded / toLoad.length : 1;
    const p = Math.min(timeP, realP);
    fill.setAttribute("y", String(140 - 140 * p));
    pct.textContent = Math.round(p * 100) + "%";
    if (p < 1) requestAnimationFrame(frame);
    else showBrand();
  }
  requestAnimationFrame(frame);

  // --- Brend ---
  function showBrand() {
    setTimeout(() => {
      stageLoading.classList.remove("is-active");
      stageBrand.classList.add("is-active");
      setTimeout(goNext, C.brandMs);
    }, 400);
  }

  function goNext() {
    if (leaving) return;
    leaving = true;
    location.href = C.nextPage;
  }
  stageBrand.addEventListener("click", goNext); // toxunsa keçsin
})();
