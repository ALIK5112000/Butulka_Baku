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

// Ürək alınanda çalınan kristal melodiyası
export function playHeartPurchaseSound() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [880, 1174.66, 1567.98];
    notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.065);
        gain.gain.setValueAtTime(0.001, now + idx * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.16, now + idx * 0.065 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.065 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.065);
        osc.stop(now + idx * 0.065 + 0.4);
    });
}

// Hər uçan ürək yuxarıdakı balansa oturanda çıxan "pop" səsi
export function playHeartPopSound(pitchOffset = 0) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1050 + pitchOffset * 35, now);
    osc.frequency.exponentialRampToValueAtTime(1480 + pitchOffset * 35, now + 0.07);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
}
