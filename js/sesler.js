// Bütün oyun səsləri (Modulyar Səs Modulu)
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

// 1) Yaşıl düyməyə basanda və ürək uçmağa başlayanda çıxan yumşaq yüksələn səs
export function playHeartLaunchSound() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
}

// 2) Uçan ürək yuxarıdakı böyük ürəyin içinə oturanda çıxan dolğun "pop-chime" səsi
export function playHeartLandSound() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Yumşaq alt "boop" zərbəsi
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(520, now);
    popOsc.frequency.exponentialRampToValueAtTime(980, now + 0.11);
    popGain.gain.setValueAtTime(0.18, now);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.2);

    // Üstündə incə parlaq zınqırov əks-sədası
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = "triangle";
    bellOsc.frequency.setValueAtTime(1318.5, now + 0.03); // E6
    bellGain.gain.setValueAtTime(0.001, now + 0.03);
    bellGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now + 0.03);
    bellOsc.stop(now + 0.48);
}
