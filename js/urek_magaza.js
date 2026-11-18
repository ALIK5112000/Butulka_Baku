import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function initHeartsShop({ db, getMyDocId, getLiveUserData, showPlainToast, setAnimatingHearts, setDisplayedHearts }) {
    let isBuying = false;

    function flySingleHeartToBalance(startX, startY, endVal) {
        setAnimatingHearts(true);
        const targetIcon = document.getElementById("hudHeartIcon");
        const numEl = document.getElementById("hudHearts");
        const targetRect = targetIcon.getBoundingClientRect();

        const destX = targetRect.left + targetRect.width / 2 - 11;
        const destY = targetRect.top + targetRect.height / 2 - 11;

        // Təmiz narıncı-qırmızı kiçik ürək
        const heart = document.createElement("div");
        heart.className = "flying-heart";
        heart.style.width = "22px";
        heart.style.height = "22px";
        heart.style.left = `${startX}px`;
        heart.style.top = `${startY}px`;
        heart.innerHTML = `<svg viewBox="0 0 36 36" width="22" height="22"><path d="M18 32.5C18 32.5 3 22.8 3 11.8C3 6.9 6.8 3 11.6 3C14.5 3 17 4.4 18 6.6C19 4.4 21.5 3 24.4 3C29.2 3 33 6.9 33 11.8C33 22.8 18 32.5 18 32.5Z" fill="#f96316"/></svg>`;
        document.body.appendChild(heart);

        const dx = destX - startX;
        const dy = destY - startY;

        // Tamamilə səssiz, səlis uçuş
        const anim = heart.animate([
            { transform: "translate(0px, 0px) scale(1.05)", opacity: 1 },
            { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.95)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.75)`, opacity: 0.9 }
        ], {
            duration: 1050,
            easing: "cubic-bezier(0.25, 0.75, 0.35, 1)",
            fill: "forwards"
        });

        anim.onfinish = () => {
            heart.remove();

            // Ürək çatanda böyük ürək sıxılıb böyüyür (SƏSSİZ)
            targetIcon.animate([
                { transform: "scale(1)" },
                { transform: "scale(0.80)", offset: 0.16 },
                { transform: "scale(1.52)", offset: 0.48 },
                { transform: "scale(0.94)", offset: 0.78 },
                { transform: "scale(1)" }
            ], {
                duration: 480,
                easing: "ease-out"
            });

            setTimeout(() => {
                setDisplayedHearts(endVal);
                numEl.textContent = endVal;
                setAnimatingHearts(false);
            }, 200);
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

        const rect = btnEl
            ? btnEl.getBoundingClientRect()
            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        const startX = rect.left + rect.width / 2 - 11;
        const startY = rect.top + rect.height / 2 - 11;

        isBuying = true;
        try {
            window.closeHeartsShop();
            flySingleHeartToBalance(startX, startY, oldHearts + heartsReward);

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
