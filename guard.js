!function() {
    "use strict";
    var e = location.hostname;
    if ((!("localhost" === e || "127.0.0.1" === e) || /[?&]guard=1\b/.test(location.search)) && !window.__gameGuard) {
        window.__gameGuard = !0;
        var t = { KeyI: 1, KeyJ: 1, KeyC: 1, KeyK: 1, KeyE: 1, KeyM: 1 };
        window.addEventListener("keydown", onKey, !0),
        document.addEventListener("keydown", onKey, !0),
        document.addEventListener("contextmenu", function(e) {
            if (!function isEditable(e) {
                if (!e) return !1;
                var t = (e.tagName || "").toLowerCase();
                return "input" === t || "textarea" === t || e.isContentEditable
            }(e.target)) return block(e)
        }, !0),
        document.addEventListener("dragstart", function(e) {
            var t = e.target;
            !t || "IMG" !== t.tagName && "A" !== t.tagName || e.preventDefault()
        }, !0);
        var n = null, o = !1, a = !1, i = null;
        try { i = Function("debugger") } catch (e) {}
        (!window.matchMedia || window.matchMedia("(pointer:fine)").matches) && (setInterval(check, 1e3), setTimeout(check, 300));
        try {
            console.log("%chackAlik!", "color:#ff4f7b;font-size:42px;font-weight:900;"),
            console.log("%cBu, qorunan oyun kodudur.", "font-size:15px;")
        } catch (e) {}
    }
    function block(e) {
        return e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation && e.stopImmediatePropagation(), !1
    }
    function onKey(e) {
        var n = e.code || "", o = (e.key || "").toLowerCase(), a = 0 === n.indexOf("Key") ? n : 1 === o.length ? "Key" + o.toUpperCase() : "", i = e.ctrlKey || e.metaKey;
        if ("F12" === e.key || "F12" === n || 123 === e.keyCode || i && e.shiftKey && t[a] || e.metaKey && e.altKey && ("KeyI" === a || "KeyJ" === a || "KeyC" === a || "KeyU" === a) || i && !e.shiftKey && !e.altKey && ("KeyU" === a || "KeyS" === a))
            return block(e)
    }
    function check() {
        var e = function devtoolsOpen() {
            if (!i) return !1;
            var e = Date.now();
            return i(), Date.now() - e > 150
        }();
        if (e && !o) return o = !0, void function lockdown(e) {
            if (e && !n) {
                (n = document.createElement("div")).setAttribute("style", "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0c0614;color:#fff;font:600 16px/1.5 Inter,Arial,sans-serif;text-align:center;padding:24px;"),
                n.innerHTML = '<div style="max-width:380px"><div style="font-size:44px;margin-bottom:10px">&#128274;</div><div style="font-size:20px;font-weight:800;margin-bottom:8px">Developer Tools bağlanmalıdır</div><div style="color:#c9bcd9;font-weight:500">Oyunun kodu qorunur. Davam etmək üçün Developer Tools (F12) pəncərəsini bağlayın - səhifə avtomatik yenilənəcək.</div></div>',
                (document.body || document.documentElement).appendChild(n);
                var t = document.createElement("style");
                t.id = "guard-lock-style", t.textContent = "body>*:not([data-guard-overlay]){visibility:hidden!important}",
                n.setAttribute("data-guard-overlay", "1"),
                (document.head || document.documentElement).appendChild(t);
                try { console.clear() } catch (e) {}
            }
        }(!0);
        e || !o || a || (a = !0, location.reload())
    }
}();
