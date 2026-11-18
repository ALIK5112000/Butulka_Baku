import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { playHeartLaunchSound, playHeartLandSound } from "./sesler.js";

export function initHeartsShop({ db, getMyDocId, getLiveUserData, showPlainToast, setAnimatingHearts, setDisplayedHearts }) {
    let isBuying = false;

    // Videodakı kimi: mağaza bağlanır, 1 tək ürək hamar uçub sol üst ürəyin içinə oturur
    function flySingleHeartToBalance(startX, startY, startVal, endVal) {
        setAnimatingHearts(true);
        const targetIcon = document.getElementById("hudHeartIcon");
        const numEl = document.getElementById("hudHearts");
        const targetRect = targetIcon.getBoundingClientRect();

        const destX = targetRect.left + targetRect.width / 2 - 14;
        const destY = targetRect.top + targetRect.height / 2 - 14;

        const heart = document.createElement("div");
        heart.className = "flying-heart";
        heart.style.width = "28px";
        heart.style.height = "28px";
        heart.style.left = `${startX}px`;
        heart.style.top = `${startY}px`;
        heart.innerHTML = `<svg viewBox="0 0 36 36" width="28" height="28"><path d="M18 32.5C18 32.5 3 22.8 3 11.8C3 6.9 6.8 3 11.6 3C14.5 3 17 4.4 18 6.6C19 4.4 21.5 3 24.4 3C29.2 3 33 6.9 33 11.8C33 22.8 18 32.5 18 32.5Z" fill="#f96316" stroke="#ffffff" stroke-width="2.4"/></svg>`;
        document.body.appendChild(heart);

        playHeartLaunchSound();

        const dx = destX - startX;
        const dy = destY - startY;

        const anim = heart.animate([
            { transform: "translate(0px, 0px) scale(0.85)", opacity: 1 },
            { transform: `translate(${dx * 0.45}px, ${dy * 0.55 - 24}px) scale(1.12)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(1.0)`, opacity: 1 }
        ], {
            duration: 950,
            easing: "cubic-bezier(0.22, 0.85, 0.32, 1)",
            fill: "forwards"
        });

        anim.onfinish = () => {
            heart.remove();
            playHeartLandSound();

            // Böyük ürək ikonunun videodakı kimi yaylanıb oturması
            targetIcon.animate([
                { transform: "scale(1)" },
                { transform: "scale(1.42)", offset: 0.35 },
                { transform: "scale(0.92)", offset: 0.7 },
                { transform: "scale(1)" }
            ], {
                duration: 420,
                easing: "ease-out"
            });

            numEl.classList.add("glow");
            setTimeout(() => numEl.classList.remove("glow"), 350);

            // Rəqəmin hamar artması
            const steps = 15;
            let step = 0;
            const counter = setInterval(() => {
                step++;
                const val = Math.round(startVal + ((endVal - startVal) * step) / steps);
                setDisplayedHearts(val);
                numEl.textContent = val;
                if (step >= steps) {
                    clearInterval(counter);
                    setDisplayedHearts(endVal);
                    numEl.textContent = endVal;
                    setAnimatingHearts(false);
                }
            }, 22);
        };
    }

    window.openHeartsShop = function () {
        document.getElementById("heartsShopOverlay").classList.add("open");
    };

    window.closeHeartsShop = function () {
        document.getElementById("heartsShopOverlay").classList.remove("open");
    };

    window.buyHeartsPackage = async function (jetonCost, heartsReward, btnEl) {
        if (isBuying) return;
        const liveUser = getLiveUserData();
        const myDocId = getMyDocId();
        const currentJetons = Number(liveUser.jetons || 0);
        const oldHearts = Number(liveUser.hearts || 0);

        if (currentJetons < jetonCost) {
            showPlainToast("Kifayət qədər jetonunuz yoxdur");
            return;
        }
        if (!myDocId) {
            showPlainToast("Hesab məlumatı tapılmadı");
            return;
        }

        // Düymə bağlanmamışdan əvvəl koordinatını götürürük
        const rect = btnEl
            ? btnEl.getBoundingClientRect()
            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        const startX = rect.left + rect.width / 2 - 14;
        const startY = rect.top + rect.height / 2 - 14;

        isBuying = true;
        try {
            // 1. Videodakı kimi pəncərə dərhal bağlanır
            window.closeHeartsShop();

            // 2. Tək ürək uçub sol yuxarı küncə oturur və səs verir
            flySingleHeartToBalance(startX, startY, oldHearts, oldHearts + heartsReward);

            // 3. Firebase-də jeton çıxılır və ürək əlavə olunur
            await updateDoc(doc(db, "users", myDocId), {
                jetons: increment(-jetonCost),
                hearts: increment(heartsReward)
            });
        } catch (e) {
            setAnimatingHearts(false);
            showPlainToast("Xəta baş verdi, yenidən yoxlayın");
        } finally {
            isBuying = false;
        }
    };
}
