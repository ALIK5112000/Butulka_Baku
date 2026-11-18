import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function initHourlyBonus({ db, getMyDocId, getLiveUserData, showPlainToast, setAnimatingHearts, setDisplayedHearts }) {
    
    // Hər saat üçün bonus cədvəli (1 saat: 100, 2 saat: 200 ... max 1000)
    const bonusTiers = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

    function getStorageKey(userId) {
        return `butulka_bonus_start_${userId}`;
    }

    function getClaimedHourKey(userId) {
        return `butulka_bonus_hour_${userId}`;
    }

    // Uçan tək ürək animasiyası (saatlıq bonusu götürəndə)
    function flyBonusHeartToBalance(btnEl, endVal) {
        setAnimatingHearts(true);
        const targetIcon = document.getElementById("hudHeartIcon");
        const numEl = document.getElementById("hudHearts");
        const targetRect = targetIcon.getBoundingClientRect();

        const destX = targetRect.left + targetRect.width / 2 - 11;
        const destY = targetRect.top + targetRect.height / 2 - 11;

        const rect = btnEl.getBoundingClientRect();
        const startX = rect.left + rect.width / 2 - 11;
        const startY = rect.top + rect.height / 2 - 11;

        const heart = document.createElement("div");
        heart.className = "flying-heart";
        heart.style.width = "24px";
        heart.style.height = "24px";
        heart.style.left = `${startX}px`;
        heart.style.top = `${startY}px`;
        heart.innerHTML = `<svg viewBox="0 0 36 36" width="24" height="24"><path d="M18 32.5C18 32.5 3 22.8 3 11.8C3 6.9 6.8 3 11.6 3C14.5 3 17 4.4 18 6.6C19 4.4 21.5 3 24.4 3C29.2 3 33 6.9 33 11.8C33 22.8 18 32.5 18 32.5Z" fill="#f96316"/></svg>`;
        document.body.appendChild(heart);

        const dx = destX - startX;
        const dy = destY - startY;

        const anim = heart.animate([
            { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(1.2)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.8)`, opacity: 0.9 }
        ], {
            duration: 900,
            easing: "cubic-bezier(0.25, 0.75, 0.35, 1)",
            fill: "forwards"
        });

        anim.onfinish = () => {
            heart.remove();
            targetIcon.animate([
                { transform: "scale(1)" },
                { transform: "scale(1.45)", offset: 0.4 },
                { transform: "scale(1)" }
            ], { duration: 400, easing: "ease-out" });

            setTimeout(() => {
                setDisplayedHearts(endVal);
                numEl.textContent = endVal;
                setAnimatingHearts(false);
            }, 150);
        };
    }

    // Taymerin işləməsi və UI yenilənməsi
    setInterval(() => {
        const liveUser = getLiveUserData();
        if (!liveUser || !liveUser.id) return;

        const userId = liveUser.id;
        const storageKey = getStorageKey(userId);
        const claimedKey = getClaimedHourKey(userId);

        let startTime = localStorage.getItem(storageKey);
        const now = Date.now();

        if (!startTime) {
            startTime = now;
            localStorage.setItem(storageKey, startTime);
            localStorage.setItem(claimedKey, "0"); // neçənci saat götürülüb
        }

        const elapsedSeconds = Math.floor((now - Number(startTime)) / 1000);
        const totalDuration = 3600; // 60 dəqiqə = 3600 saniyə
        let remaining = totalDuration - (elapsedSeconds % totalDuration);

        let currentHourIndex = Math.floor(elapsedSeconds / totalDuration);
        if (currentHourIndex >= bonusTiers.length) {
            currentHourIndex = bonusTiers.length - 1;
            remaining = 0; // 1000 bonusda dayanır
        }

        const currentBonusAmount = bonusTiers[currentHourIndex];
        const lastClaimedHour = Number(localStorage.getItem(claimedKey) || "0");

        // Taymer formatı (MM:SS)
        const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
        const secs = String(remaining % 60).padStart(2, '0');
        const timeStr = `${mins}:${secs}`;

        // Mağazadakı 8-ci kartı (saatlıq bonus kartı) tapırıq
        const cardTitleEl = document.getElementById("hourlyBonusTitle");
        const cardBtnEl = document.getElementById("hourlyBonusBtn");
        const cardSubEl = document.getElementById("hourlyBonusSub");

        if (cardTitleEl && cardBtnEl) {
            cardTitleEl.textContent = `❤️ ${currentBonusAmount}`;

            if (remaining <= 0 || currentHourIndex > lastClaimedHour) {
                // Vaxt bitib və ya yeni saat açıqdır -> Mavi "Götür" düyməsi
                cardBtnEl.textContent = "Götür";
                cardBtnEl.className = "btn-cyan-pill"; // Mavi rəng
                cardBtnEl.onclick = async () => {
                    const myDocId = getMyDocId();
                    if (!myDocId) {
                        showPlainToast("Hesab məlumatı tapılmadı");
                        return;
                    }

                    const oldHearts = Number(liveUser.hearts || 0);
                    const newHearts = oldHearts + currentBonusAmount;

                    // Qeyd et ki, bu saat götürüldü
                    localStorage.setItem(claimedKey, String(currentHourIndex));
                    // Növbəti saat üçün taymeri təzələ
                    localStorage.setItem(storageKey, Date.now());

                    window.closeHeartsShop();
                    flyBonusHeartToBalance(cardBtnEl, newHearts);

                    try {
                        await updateDoc(doc(db, "users", myDocId), {
                            hearts: increment(currentBonusAmount)
                        });
                        showPlainToast(`+${currentBonusAmount} ürək bonusu götürüldü!`);
                    } catch (e) {
                        showPlainToast("Xəta baş verdi");
                    }
                };
                if (cardSubEl) cardSubEl.textContent = "🎁 Bonus hazırdır!";
            } else {
                // Hələ vaxt gedir -> Yaşıl düymə, üzərində taymer
                cardBtnEl.textContent = timeStr;
                cardBtnEl.className = "btn-green-pill";
                cardBtnEl.onclick = () => {
                    showPlainToast(`Növbəti bonus üçün ${timeStr} gözləyin`);
                };
                if (cardSubEl) cardSubEl.textContent = `⏱ ${timeStr}`;
            }
        }
    }, 1000);
}
