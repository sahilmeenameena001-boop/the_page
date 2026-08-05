/* The Page — scroll reveal enhancements (text elements only; image-reveal components are untouched) */
(function () {
    'use strict';
    if (!('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('tp-anim');

    var selectors = [
        '.block__content .center > *',
        '.blocks .block__heading',
        '.heading__wrapper',
        '.site-footer .middle',
        '.footer__content .heading',
        'main .prose > p'
    ];
    var targets = [];
    selectors.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
            if (el.closest('image-reveal')) return; /* never touch image transitions */
            if (targets.indexOf(el) === -1) targets.push(el);
        });
    });

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('tp-in');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) {
        el.classList.add('tp-reveal');
        io.observe(el);
    });

    /* safety net: if nothing has fired after 4s (odd embeds, prerender), show everything */
    setTimeout(function () {
        targets.forEach(function (el) { el.classList.add('tp-in'); });
    }, 4000);
})();

/* === crazy pack === */
(function () {
    'use strict';
    /* intro splash: once per session, ~1.7s, lifts like a curtain */
    var splash = document.querySelector('.tp-splash');
    if (splash) {
        var seen = false;
        try { seen = sessionStorage.getItem('tpSplashSeen') === '1'; } catch (e) {}
        if (seen) { splash.parentNode.removeChild(splash); }
        else {
            try { sessionStorage.setItem('tpSplashSeen', '1'); } catch (e) {}
            document.documentElement.style.overflow = 'hidden';
            setTimeout(function () { splash.classList.add('tp-splash--done'); document.documentElement.style.overflow = ''; }, 1700);
            setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 2800);
        }
    }

    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    /* hero mouse parallax (GPU transform on the bg wrapper only) */
    var hero = document.querySelector('.page-hero');
    var heroBg = document.querySelector('.page-hero__bg');
    if (hero && heroBg) {
        var hx = 0, hy = 0, queued = false;
        hero.addEventListener('pointermove', function (e) {
            hx = (e.clientX / window.innerWidth - 0.5) * 26;
            hy = (e.clientY / window.innerHeight - 0.5) * 16;
            if (!queued) { queued = true; requestAnimationFrame(function () { heroBg.style.transform = 'translate3d(' + (-hx) + 'px,' + (-hy) + 'px,0)'; queued = false; }); }
        });
        hero.addEventListener('pointerleave', function () { heroBg.style.transform = 'translate3d(0,0,0)'; });
    }

    /* cursor glow: gold dot + trailing ring */
    var dot = document.createElement('div'); dot.className = 'tp-cursor-dot';
    var ring = document.createElement('div'); ring.className = 'tp-cursor-ring';
    document.body.appendChild(dot); document.body.appendChild(ring);
    var mx = -100, my = -100, rx = -100, ry = -100, live = false;
    document.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY;
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        if (!live) { live = true; rx = mx; ry = my; loop(); }
    }, { passive: true });
    function loop() {
        rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        requestAnimationFrame(loop);
    }
    document.addEventListener('pointerover', function (e) {
        if (e.target.closest && e.target.closest('a,button,[role="button"]')) ring.classList.add('tp-cursor--big');
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
        if (e.target.closest && e.target.closest('a,button,[role="button"]')) ring.classList.remove('tp-cursor--big');
    }, { passive: true });
})();