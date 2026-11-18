import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { playHeartPurchaseSound, playHeartPopSound } from "./sesler.js";

export function initHeartsShop({ db, getMyDocId, getLiveUserData, showPlainToast, setAnimatingHearts, setDisplayedHearts }) {
    let isBuying = false;

    function flyHeartsToBalance(btnEl, startVal, endVal) {
        setAnimatingHearts(true);
        const targetIcon = document.getElementById("hudHeartIcon");
        const numEl = document.getElementById("hudHearts");
        const targetRect = targetIcon.getBoundingClientRect();
        const destX = targetRect.left + targetRect.width / 2 - 12;
        const destY = targetRect.top + targetRect.height / 2 - 12;

        const srcRect = btnEl
            ? btnEl.getBoundingClientRect()
            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        const startX = srcRect.left + srcRect.width / 2 - 12;
        const startY = srcRect.top + srcRect.height / 2 - 12;

        const count = 10;
        for (let i = 0; i < count; i++) {
            const heart = document.createElement("div");
            heart.className = "flying-heart";
            heart.innerHTML = `<svg viewBox="0 0 36 36" width="24" height="24"><path d="M18 32.5C18 32.5 3 22.8 3 11.8C3 6.9 6.8 3 11.6 3C14.5 3 17 4.4 18 6.6C19 4.4 21.5 3 24.4 3C29.2 3 33 6.9 33 11.8C33 22.8 18 32.5 18 32.5Z" fill="#f96316" stroke="#ffffff" stroke-width="2.4"/></svg>`;
            heart.style.left = `${startX}px`;
            heart.style.top = `${startY}px`;
            heart.style.opacity = "1";
            document.body.appendChild(heart);

            const spreadX = (Math.random() - 0.5) * 90;
            const spreadY = (Math.random() - 0.5) * 50;
            const delay = i * 55;

            setTimeout(() => {
                const anim = heart.animate([
                    { transform: "translate(0px, 0px) scale(0.7)", opacity: 1 },
                    { transform: `translate(${spreadX}px, ${spreadY}px) scale(1.15)`, opacity: 1, offset: 0.25 },
                    { transform: `translate(${destX - startX}px, ${destY - startY}px) scale(0.85)`, opacity: 0.95 }
                ], {
                    duration: 580,
                    easing: "cubic-bezier(0.25, 0.9, 0.35, 1)",
                    fill: "forwards"
                });

                anim.onfinish = () => {
                    heart.remove();
                    playHeartPopSound(i);
                    targetIcon.classList.add("pulse");
                    numEl.classList.add("glow");
                    setTimeout(() => {
                        targetIcon.classList.remove("pulse");
                        numEl.classList.remove("glow");
                    }, 130);

                    const progress = (i + 1) / count;
                    const currentVal = Math.round(startVal + (endVal - startVal) * progress);
                    setDisplayedHearts(currentVal);
                    numEl.textContent = currentVal;

                    if (i === count - 1) {
                        setDisplayedHearts(endVal);
                        numEl.textContent = endVal;
                        setAnimatingHearts(false);
                    }
                };
            }, delay);
        }
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

        isBuying = true;
        try {
            playHeartPurchaseSound();
            flyHeartsToBalance(btnEl, oldHearts, oldHearts + heartsReward);

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
