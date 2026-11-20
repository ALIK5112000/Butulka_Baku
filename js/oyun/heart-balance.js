// js/heart-balance.js

window.BBHeartBalance = (function () {
  let currentBalance = 0;
  let unsubscribe = null;

  // Rəqəmi animasiya ilə ekranda yeniləmək
  function updateUI(newValue) {
    const countEl = document.getElementById('bb-heart-count');
    if (!countEl) return;

    const val = Number(newValue) || 0;
    if (val !== currentBalance) {
      countEl.textContent = val;
      countEl.classList.remove('balance-pop');
      void countEl.offsetWidth; // Animasiyanı sıfırlamaq üçün
      countEl.classList.add('balance-pop');
      setTimeout(() => countEl.classList.remove('balance-pop'), 300);
      currentBalance = val;
    } else {
      countEl.textContent = val;
    }
  }

  // Real vaxtda Firebase dinləyicisi (Həm Realtime DB, həm Firestore dəstəyi)
  function listen(uid) {
    if (!uid) return;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // 1. Əgər layihədə Firebase Realtime Database (firebase.database) istifadə olunursa:
    if (typeof firebase !== 'undefined' && firebase.database) {
      const ref = firebase.database().ref('users/' + uid);
      const listener = ref.on('value', (snap) => {
        const data = snap.val() || {};
        // Bazada balans hansı adla saxlanırsa onu götürür (hearts, bonus və ya jeton)
        const bal = data.hearts ?? data.bonus ?? data.jeton ?? 0;
        updateUI(bal);
      });
      unsubscribe = () => ref.off('value', listener);
      return;
    }

    // 2. Əgər layihədə Firestore (firebase.firestore) istifadə olunursa:
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      unsubscribe = firebase.firestore().collection('users').doc(uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data() || {};
            const bal = data.hearts ?? data.bonus ?? data.jeton ?? 0;
            updateUI(bal);
          }
        });
    }
  }

  // Ürəyə toxunanda açılacaq pəncərə üçün hazır klik hadisəsi
  function initClick(onOpenCallback) {
    const btn = document.getElementById('bb-heart-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof onOpenCallback === 'function') {
        onOpenCallback(currentBalance);
      } else if (typeof window.openHeartShopModal === 'function') {
        window.openHeartShopModal(currentBalance);
      } else {
        console.log('Ürək mağazası pəncərəsi açılır... Cari balans:', currentBalance);
      }
    });
  }

  // Avtomatik giriş etmiş oyunçunu izləmək
  function autoInit() {
    initClick();
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          listen(user.uid);
        } else {
          // Əgər oyunçu custom localStorage ID ilə giribsə:
          const localUid = localStorage.getItem('bb_uid') || localStorage.getItem('userId');
          if (localUid) listen(localUid);
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', autoInit);

  return {
    listen,
    updateUI,
    getBalance: () => currentBalance
  };
})();
