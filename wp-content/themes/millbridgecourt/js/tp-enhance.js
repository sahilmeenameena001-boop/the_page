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

/* === native scroll restore === */
/* The theme intercepts wheel events (non-passive) and replays scrolling through
   an easing engine, which feels delayed and stutters on modest hardware.
   Stopping the event in the capture phase before it reaches the theme's listener
   restores the browser's native, buttery scrolling. The theme still tracks
   position via regular scroll events, so parallax and header states keep working. */
window.addEventListener('wheel', function (e) {
    e.stopImmediatePropagation();
}, { capture: true, passive: true });

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

    /* walk into the hotel: scroll dollies through the entrance doors into the lobby.
       Runs on touch devices too - it is scroll-driven, not pointer-driven. */
    var walk = document.querySelector('.tp-walk');
    if (walk && !reduced) {
        var entImg = walk.querySelector('.tp-walk__scene--entrance img');
        var entScene = walk.querySelector('.tp-walk__scene--entrance');
        var lobImg = walk.querySelector('.tp-walk__scene--lobby img');
        var wVeil = walk.querySelector('.page-hero__veil');
        var wContent = walk.querySelector('.page-hero__content');
        var wCaption = walk.querySelector('.tp-walk__caption');
        var wCue = walk.querySelector('.page-hero__scroll');
        var hx = 0, hy = 0, wp = 0, queued = false, span = 1;
        function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
        function measure() { span = Math.max(1, walk.offsetHeight - window.innerHeight); }
        function frame() {
            queued = false;
            var p = wp;
            /* entrance: accelerate toward the glass doors */
            var p1 = clamp01(p / 0.55);
            var zoom = 1 + p1 * p1 * 1.7;
            var damp = clamp01(1 - p * 2.4); /* mouse parallax eases off as we move */
            entImg.style.transform = 'translate3d(' + (-hx * damp) + 'px,' + (-hy * damp) + 'px,0) scale(' + zoom.toFixed(4) + ')';
            entScene.style.opacity = (1 - clamp01((p - 0.45) / 0.17)).toFixed(3);
            /* lobby: appears through the doors and settles around you */
            var pl = clamp01((p - 0.45) / 0.5);
            lobImg.style.opacity = clamp01((p - 0.45) / 0.17).toFixed(3);
            lobImg.style.transform = 'scale(' + (1.45 - pl * 0.42).toFixed(4) + ')';
            /* veil: darkens at the threshold, clears once inside */
            var veilA = p < 0.5 ? p * 0.7 : Math.max(0, 0.35 - (p - 0.5) * 1.4);
            if (wVeil) wVeil.style.backgroundColor = 'rgba(8,54,26,' + veilA.toFixed(3) + ')';
            /* headline steps aside as you walk */
            if (wContent) {
                wContent.style.opacity = Math.max(0, 1 - p * 5).toFixed(3);
                wContent.style.transform = 'translateY(' + (-p * 130).toFixed(1) + 'px)';
                wContent.style.pointerEvents = p > 0.15 ? 'none' : '';
            }
            if (wCue) wCue.style.opacity = Math.max(0, 1 - p * 7).toFixed(3);
            if (wCaption) {
                var pc = clamp01((p - 0.7) / 0.12);
                wCaption.style.opacity = pc.toFixed(3);
                wCaption.style.transform = 'translateY(' + (-50 + (1 - pc) * 22) + '%)';
            }
        }
        function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
        measure(); window.addEventListener('resize', function () { measure(); queue(); });
        window.addEventListener('load', function () { measure(); queue(); });
        window.addEventListener('scroll', function () {
            wp = clamp01(window.scrollY / span);
            queue();
        }, { passive: true });
        walk.addEventListener('pointermove', function (e) {
            hx = (e.clientX / window.innerWidth - 0.5) * 26;
            hy = (e.clientY / window.innerHeight - 0.5) * 16;
            queue();
        });
        walk.addEventListener('pointerleave', function () { hx = 0; hy = 0; queue(); });
        queue();
    }

    if (!fine || reduced) return;

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
        if (Math.abs(mx - rx) < 0.2 && Math.abs(my - ry) < 0.2) { live = false; return; }
        requestAnimationFrame(loop);
    }
    document.addEventListener('pointerover', function (e) {
        if (e.target.closest && e.target.closest('a,button,[role="button"]')) ring.classList.add('tp-cursor--big');
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
        if (e.target.closest && e.target.closest('a,button,[role="button"]')) ring.classList.remove('tp-cursor--big');
    }, { passive: true });
})();
/* === everything pack === */
(function () {
    'use strict';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    var onHome = /(?:^|\/)(index\.html)?$/.test(location.pathname);

    /* --- time-aware hero: daytime shows the daylight entrance, evening the dusk shot --- */
    var heroImg = document.querySelector('.page-hero__bg img');
    if (heroImg) {
        var h = new Date().getHours();
        if (h >= 6 && h < 17) heroImg.src = 'images/home/hero-entrance.jpg';
    }

    /* --- typesetter headline: letters scatter in from the tray --- */
    var title = document.querySelector('.ph-title');
    if (title && !reduced) {
        title.classList.add('ph-scramble');
        var li = 0;
        title.querySelectorAll('.ph-word').forEach(function (word) {
            var text = word.textContent;
            word.textContent = '';
            for (var i = 0; i < text.length; i++) {
                var s = document.createElement('span');
                s.className = 'ph-letter';
                s.textContent = text[i];
                s.style.setProperty('--dx', ((Math.sin(li * 7.3) * 46) | 0) + 'px');
                s.style.setProperty('--dy', ((Math.cos(li * 5.1) * 34 - 14) | 0) + 'px');
                s.style.setProperty('--rot', ((Math.sin(li * 3.7) * 14) | 0) + 'deg');
                s.style.setProperty('--del', (0.45 + li * 0.045).toFixed(2) + 's');
                word.appendChild(s);
                li++;
            }
        });
    }

    /* --- magnetic buttons --- */
    if (fine && !reduced) {
        document.querySelectorAll('.ph-btn, .site-footer .btn--ghost').forEach(function (btn) {
            btn.classList.add('tp-magnet');
            btn.addEventListener('pointermove', function (e) {
                var r = btn.getBoundingClientRect();
                var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
                var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
                btn.style.transform = 'translate(' + (dx * 10).toFixed(1) + 'px,' + (dy * 8).toFixed(1) + 'px)';
            });
            btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
        });
    }

    /* --- film reel: draggable + flingable, auto-glides, IO-gated --- */
    var track = document.querySelector('.tp-strip__track');
    if (track && !reduced) {
        track.classList.add('tp-js');
        var off = 0, vel = 0, auto = 0.55, dragging = false, lastX = 0, visible = false, running = false, hovered = false;
        var half = 0;
        function measureTrack() { half = track.scrollWidth / 2; }
        measureTrack(); window.addEventListener('resize', measureTrack);
        window.addEventListener('load', measureTrack);
        function tick() {
            if (!visible || document.hidden) { running = false; return; }
            if (!dragging) {
                if (Math.abs(vel) > 0.05) { off -= vel; vel *= 0.94; }
                else if (!hovered) { off -= auto; }
            }
            if (half > 0) { off = ((off % half) + half) % half; }
            track.style.transform = 'translate3d(' + (-off) + 'px,0,0)';
            requestAnimationFrame(tick);
        }
        function start() { if (!running) { running = true; requestAnimationFrame(tick); } }
        new IntersectionObserver(function (en) {
            visible = en[0].isIntersecting; if (visible) start();
        }, { threshold: 0 }).observe(track);
        document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) start(); });
        track.addEventListener('pointerenter', function () { hovered = true; });
        track.addEventListener('pointerleave', function () { hovered = false; });
        track.addEventListener('pointerdown', function (e) {
            dragging = true; lastX = e.clientX; vel = 0;
            track.classList.add('tp-dragging');
            track.setPointerCapture && track.setPointerCapture(e.pointerId);
        });
        track.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            var d = e.clientX - lastX; lastX = e.clientX;
            off -= d; vel = d * 0.9;
        });
        ['pointerup', 'pointercancel'].forEach(function (ev) {
            track.addEventListener(ev, function () { dragging = false; track.classList.remove('tp-dragging'); });
        });
        track.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }

    /* --- concierge card (homepage, once per session) --- */
    if (onHome && !reduced) {
        var seenC = false;
        try { seenC = sessionStorage.getItem('tpConcierge') === '1'; } catch (e) {}
        if (!seenC) {
            setTimeout(function () {
                try { sessionStorage.setItem('tpConcierge', '1'); } catch (e) {}
                var hr = new Date().getHours();
                var msg = hr < 12 ? 'Good morning. The lobby is bathed in light - breakfast is waiting.'
                        : hr < 17 ? 'Good afternoon. The banquet halls are glowing today. Shall we show you around?'
                        : 'Good evening. The rooftop is lovely right now - the lights just came on.';
                var card = document.createElement('div');
                card.className = 'tp-concierge';
                card.innerHTML = '<p class="tp-concierge__label">THE PAGE CONCIERGE</p><p class="tp-concierge__msg"></p><button class="tp-concierge__close" aria-label="Close">&#10005;</button>';
                document.body.appendChild(card);
                var msgEl = card.querySelector('.tp-concierge__msg');
                requestAnimationFrame(function () { card.classList.add('tp-on'); });
                var i = 0;
                var typer = setInterval(function () {
                    msgEl.textContent = msg.slice(0, ++i);
                    if (i >= msg.length) { clearInterval(typer); card.classList.add('tp-done'); }
                }, 34);
                function bye() { card.classList.remove('tp-on'); setTimeout(function () { card.remove(); }, 700); }
                card.querySelector('.tp-concierge__close').addEventListener('click', bye);
                setTimeout(bye, 14000);
            }, 3500);
        }
    }

    /* --- continuous ambient tune (generative, WebAudio; mute toggle persists) --- */
    (function () {
        var muted = false;
        try { muted = localStorage.getItem('tpSound') === 'off'; } catch (e) {}
        var btn = document.createElement('button');
        btn.className = 'tp-sound';
        btn.title = 'Music on/off';
        btn.innerHTML = '&#9834;';
        btn.setAttribute('data-muted', muted ? '1' : '0');
        document.body.appendChild(btn);

        var ctx = null, master = null, timers = [];
        var CHORDS = [
            [261.63, 329.63, 392.00, 493.88],  /* Cmaj7 */
            [220.00, 261.63, 329.63, 392.00],  /* Am7  */
            [174.61, 220.00, 261.63, 329.63],  /* Fmaj7 */
            [196.00, 246.94, 293.66, 329.63]   /* G6   */
        ];
        var BELLS = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.5];
        var chordIx = 0;

        function ensureCtx() {
            if (ctx) return true;
            try {
                ctx = new (window.AudioContext || window.webkitAudioContext)();
                master = ctx.createGain();
                master.gain.value = 0.0;
                var lp = ctx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 1500;
                master.connect(lp).connect(ctx.destination);
                return true;
            } catch (e) { return false; }
        }
        function pad(freqs) {
            if (!ctx) return;
            var t = ctx.currentTime;
            freqs.forEach(function (fq, i) {
                [0, 1.7].forEach(function (detune) {
                    var o = ctx.createOscillator(), g = ctx.createGain();
                    o.type = 'triangle';
                    o.frequency.value = fq;
                    o.detune.value = detune + (i - 1.5);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.028 / freqs.length, t + 3.2);
                    g.gain.setValueAtTime(0.028 / freqs.length, t + 5.4);
                    g.gain.linearRampToValueAtTime(0, t + 9);
                    o.connect(g).connect(master);
                    o.start(t); o.stop(t + 9.2);
                });
            });
        }
        function bell() {
            if (!ctx) return;
            var t = ctx.currentTime;
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = BELLS[(Math.random() * BELLS.length) | 0];
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.014, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
            o.connect(g).connect(master);
            o.start(t); o.stop(t + 2.8);
        }
        function startLoop() {
            stopLoop();
            pad(CHORDS[chordIx]);
            timers.push(setInterval(function () {
                chordIx = (chordIx + 1) % CHORDS.length;
                pad(CHORDS[chordIx]);
            }, 8000));
            timers.push(setInterval(function () { if (Math.random() < 0.75) bell(); }, 4600));
        }
        function stopLoop() { timers.forEach(clearInterval); timers = []; }
        function fadeTo(v, secs) {
            if (!ctx) return;
            master.gain.cancelScheduledValues(ctx.currentTime);
            master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
            master.gain.linearRampToValueAtTime(v, ctx.currentTime + secs);
        }
        var booted = false;
        function play() {
            if (document.hidden) return; /* never start sound in a background tab */
            if (!ensureCtx()) return;
            if (ctx.state === 'suspended') ctx.resume();
            startLoop();
            fadeTo(1, 2.5);
        }
        function hush() { fadeTo(0, 1); stopLoop(); }

        function boot(e) {
            if (e && e.isTrusted === false) return; /* ignore synthetic events */
            document.removeEventListener('pointerdown', boot);
            document.removeEventListener('keydown', boot);
            booted = true;
            if (!muted) play();
        }
        document.addEventListener('pointerdown', boot);
        document.addEventListener('keydown', boot);

        document.addEventListener('visibilitychange', function () {
            if (muted || !booted) return;
            if (document.hidden) { if (ctx) { ctx.suspend(); stopLoop(); } }
            else { play(); }
        });

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            muted = !muted;
            btn.setAttribute('data-muted', muted ? '1' : '0');
            try { localStorage.setItem('tpSound', muted ? 'off' : 'on'); } catch (err) {}
            if (muted) hush(); else play();
        });
    })();
    /* --- gold ink trail (desktop, sleeps when faded) --- */
    if (fine && !reduced) {
        var cv = document.createElement('canvas');
        cv.className = 'tp-ink';
        document.body.appendChild(cv);
        var ictx = cv.getContext('2d');
        var pts = [], inkRunning = false, dpr = Math.min(2, window.devicePixelRatio || 1);
        function sizeInk() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
        sizeInk(); window.addEventListener('resize', sizeInk);
        document.addEventListener('pointermove', function (e) {
            pts.push({ x: e.clientX * dpr, y: e.clientY * dpr, a: 1 });
            if (pts.length > 26) pts.shift();
            if (!inkRunning) { inkRunning = true; requestAnimationFrame(inkTick); }
        }, { passive: true });
        function inkTick() {
            ictx.clearRect(0, 0, cv.width, cv.height);
            var alive = false;
            for (var i = 1; i < pts.length; i++) {
                var p = pts[i];
                p.a -= 0.035;
                if (p.a <= 0) continue;
                alive = true;
                ictx.strokeStyle = 'rgba(255,195,113,' + (p.a * 0.35).toFixed(3) + ')';
                ictx.lineWidth = 1.6 * dpr * p.a;
                ictx.lineCap = 'round';
                ictx.beginPath();
                ictx.moveTo(pts[i - 1].x, pts[i - 1].y);
                ictx.lineTo(p.x, p.y);
                ictx.stroke();
            }
            if (alive) requestAnimationFrame(inkTick);
            else { inkRunning = false; pts.length = 0; ictx.clearRect(0, 0, cv.width, cv.height); }
        }
    }
})();