// js/ses-effektleri.js
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, delay = 0, vol = 0.15) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration);
  }

  // Bonus / Ürək alanda çıxan xoş səs
  playBonus() {
    this.playTone(587.33, "sine", 0.14, 0, 0.18);      // D5
    this.playTone(880, "sine", 0.18, 0.09, 0.18);        // A5
    this.playTone(1174.66, "triangle", 0.3, 0.18, 0.2);  // D6
  }

  // Öpüş səsi
  playKiss() {
    this.playTone(900, "sine", 0.08, 0, 0.2);
    this.playTone(1400, "sine", 0.12, 0.05, 0.22);
    this.playTone(650, "triangle", 0.15, 0.11, 0.15);
  }

  // Şüşə fırlanma səsi
  playSpinTick() {
    this.playTone(320, "triangle", 0.04, 0, 0.08);
  }

  // Hədiyyə səsi (növünə görə fərqli)
  playGift(type = "default") {
    if (type === "tomato" || type === "frog") {
      this.playTone(180, "sawtooth", 0.18, 0, 0.16);
      this.playTone(130, "sawtooth", 0.22, 0.12, 0.16);
    } else if (type === "drink") {
      this.playTone(523.25, "sine", 0.12, 0, 0.15);
      this.playTone(659.25, "sine", 0.15, 0.1, 0.15);
    } else {
      this.playTone(660, "sine", 0.12, 0, 0.16);
      this.playTone(880, "sine", 0.14, 0.08, 0.16);
      this.playTone(1320, "sine", 0.25, 0.16, 0.18);
    }
  }

  // Təpik xəbərdarlığı səsi
  playKick() {
    this.playTone(150, "square", 0.15, 0, 0.16);
    this.playTone(110, "square", 0.25, 0.14, 0.18);
  }

  // Yeni chat mesajı səsi
  playMessage() {
    this.playTone(740, "sine", 0.07, 0, 0.07);
  }
}

export const Sounds = new SoundEngine();
