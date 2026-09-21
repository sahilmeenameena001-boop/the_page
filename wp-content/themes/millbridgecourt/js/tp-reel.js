/* ---------------------------------------------------------------------------
   tp-reel.js - scroll-driven sprite-sheet reel.

   Adapted from the reference frame-player.js. Kept: the sprite decoding, the
   sheet/cell arithmetic, the cover-crop draw and the DPR handling. Dropped:
   the whole time-based playback loop (intent/wake/tick and its rate/boost
   machinery) and the host page's wheel and touch interception. Nothing here
   calls preventDefault or scrollTo - the page scrolls normally and this only
   ever reads the scroll position.

   Memory note: a decoded sheet is 4x1280 by 2x720, i.e. 5120x1440, which is
   about 29MB of RGBA. The reference player keeps roughly fifteen of those
   alive. Here the decoded cache is deliberately small and the encoded .webp
   bytes are left to the browser's HTTP cache, so scrubbing back over ground
   already covered re-decodes rather than re-downloads.
--------------------------------------------------------------------------- */
(function () {
    'use strict';

    var BASE = 'assets/reel';
    var MAX_SHEETS_FINE = 4;
    var MAX_SHEETS_COARSE = 2;
    /* Decoding a 5120x1440 sheet costs ~180ms of CPU. Six of those in flight
       will starve the main thread on a modest machine and the page judders -
       which is worse than a frame arriving late, because it makes the whole
       document scroll badly, not just this section. Two at a time. */
    var MAX_CONCURRENT = 2;
    var MAX_FAILURES = 3;
    /* While the reader is flicking rather than reading, speculative sheets
       are wasted work: they are obsolete before they decode. Above this many
       frames of travel per rendered frame, fetch only the sheet actually
       needed to land on. */
    var FLICK_FRAMES = 40;

    var root = document.querySelector('.tp-reel');
    if (!root) return;

    var canvas = root.querySelector('.tp-reel__canvas');
    var poster = root.querySelector('.tp-reel__poster');
    var status = root.querySelector('.tp-reel__status');
    if (!canvas) return;

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Reduced motion: the poster is already in the markup and visible. Leave it
       be, never fetch a single sheet, and stop here. */
    if (reduced) {
        root.dataset.reelState = 'static';
        return;
    }

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    /* ---------------------------------------------------------------- store */
    function SheetStore(variant, info, perSheet, max, onLoad, onError) {
        this.variant = variant;
        this.info = info;
        this.perSheet = perSheet;
        this.max = max;
        this.onLoad = onLoad;
        this.onError = onError;
        this.cache = new Map();
        this.loading = new Map();
        this.failures = new Map();
        /* -1, not 0: want() early-returns when the centre has not moved, and
           starting at 0 would make the very first want(0) a no-op and nothing
           would ever load. */
        this.centre = -1;
        this.dir = 1;
        this.closed = false;
    }

    SheetStore.prototype.url = function (i) {
        return BASE + '/' + this.variant + '/' + String(i).padStart(3, '0') + '.webp';
    };

    /* Sheets we would like resident, nearest-first, biased in the direction of
       travel so scrolling on loads what is about to be needed. */
    SheetStore.prototype.plan = function () {
        var out = [];
        var n = this.info.sheets;
        out.push(this.centre);
        for (var step = 1; out.length < this.max; step++) {
            var ahead = this.centre + step * this.dir;
            var behind = this.centre - step * this.dir;
            if (ahead >= 0 && ahead < n) out.push(ahead);
            if (out.length >= this.max) break;
            if (behind >= 0 && behind < n) out.push(behind);
            if (step > n) break;
        }
        return out;
    };

    SheetStore.prototype.want = function (sheet, dir) {
        sheet = clamp(sheet, 0, this.info.sheets - 1);
        if (sheet === this.centre && dir === this.dir) return;
        this.centre = sheet;
        if (dir) this.dir = dir;
        this.evict();
        this.pump();
    };

    SheetStore.prototype.evict = function () {
        var keep = {};
        this.plan().forEach(function (i) { keep[i] = true; });
        var self = this;
        this.cache.forEach(function (bitmap, index) {
            if (!keep[index]) {
                if (bitmap && bitmap.close) bitmap.close();
                self.cache.delete(index);
            }
        });
        this.loading.forEach(function (controller, index) {
            if (!keep[index]) controller.abort();   /* obsolete request, drop it */
        });
    };

    SheetStore.prototype.pump = function () {
        if (this.closed) return;
        var plan = this.plan();
        for (var i = 0; i < plan.length; i++) {
            var index = plan[i];
            if (this.loading.size >= MAX_CONCURRENT) break;
            if (this.cache.has(index) || this.loading.has(index)) continue;
            if ((this.failures.get(index) || 0) >= MAX_FAILURES) continue;
            this.load(index);
        }
    };

    SheetStore.prototype.load = function (index) {
        var self = this;
        var controller = new AbortController();
        this.loading.set(index, controller);

        fetch(this.url(index), { signal: controller.signal })
            .then(function (res) {
                if (!res.ok) throw new Error('sheet ' + index + ': ' + res.status);
                return res.blob();
            })
            .then(function (blob) {
                if ('createImageBitmap' in window) return createImageBitmap(blob);
                var url = URL.createObjectURL(blob);
                var img = new Image();
                img.src = url;
                return img.decode().then(function () {
                    URL.revokeObjectURL(url);
                    img.close = function () { img.src = ''; };
                    return img;
                });
            })
            .then(function (bitmap) {
                var stale = self.closed || controller.signal.aborted ||
                    self.plan().indexOf(index) === -1;
                if (stale) { if (bitmap.close) bitmap.close(); return; }
                self.cache.set(index, bitmap);
                self.onLoad(index);
            })
            .catch(function (err) {
                if (controller.signal.aborted || self.closed) return;
                var n = (self.failures.get(index) || 0) + 1;
                self.failures.set(index, n);
                if (n >= MAX_FAILURES) self.onError(err);
            })
            .then(function () {
                self.loading.delete(index);
                self.pump();
            });
    };

    SheetStore.prototype.dispose = function () {
        this.closed = true;
        this.loading.forEach(function (c) { c.abort(); });
        this.loading.clear();
        this.cache.forEach(function (b) { if (b && b.close) b.close(); });
        this.cache.clear();
    };

    /* ----------------------------------------------------------------- reel */
    var ctx = canvas.getContext('2d', { alpha: false });
    var store = null;
    var info = null;
    var perSheet = 0;
    var columns = 0;
    var count = 0;
    var drawn = -1;          /* frame currently painted */
    var pending = -1;        /* latest frame asked for; newest always wins */
    var lastSheet = -1;
    var dir = 1;
    var raf = 0;
    var started = false;
    var inView = false;
    var dead = false;
    var maxSheets = MAX_SHEETS_FINE;
    var drawW = 0, drawH = 0;
    /* centred cover crop: scale to fill, trim evenly on both axes. On a narrow
       portrait viewport this is what keeps the subject centred instead of
       letterboxing a 16:9 frame into a tall box. */
    var FOCUS_X = 0.5, FOCUS_Y = 0.5;

    function say(msg) { if (status) status.textContent = msg || ''; }

    function resize() {
        var rect = canvas.getBoundingClientRect();
        var w = Math.max(1, rect.width);
        var h = Math.max(1, rect.height);
        var native = window.devicePixelRatio || 1;
        /* no point rendering beyond the source frame's own resolution */
        var sharp = info ? Math.max(info.width / w, info.height / h) : 1;
        var dpr = Math.min(native, Math.max(1, sharp), 3);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        drawW = w;
        drawH = h;
        if (drawn >= 0) paint(drawn, true);
    }

    function blit(image, sx, sy, sw, sh) {
        var scale = Math.max(drawW / sw, drawH / sh);       /* cover */
        var dw = sw * scale;
        var dh = sh * scale;
        ctx.drawImage(image, sx, sy, sw, sh,
            (drawW - dw) * FOCUS_X, (drawH - dh) * FOCUS_Y, dw, dh);
    }

    function paint(index, force) {
        if (!store || (!force && index === drawn)) return true;
        var sheet = Math.floor(index / perSheet);
        var bitmap = store.cache.get(sheet);
        if (!bitmap) return false;                          /* keep last frame up */
        var cell = index % perSheet;
        blit(bitmap,
            (cell % columns) * info.width,
            Math.floor(cell / columns) * info.height,
            info.width, info.height);
        drawn = index;
        if (root.dataset.reelState !== 'playing') {
            root.dataset.reelState = 'playing';             /* fades the poster out */
        }
        say('');
        return true;
    }

    /* scroll position -> 0..1 through the tall section */
    function progress() {
        var rect = root.getBoundingClientRect();
        var scrollable = rect.height - window.innerHeight;
        if (scrollable <= 0) return 0;
        return clamp(-rect.top / scrollable, 0, 1);
    }

    /* Driven from rAF while the section is on screen rather than from scroll
       events. Scroll events are not fired for every kind of scroll position
       change - this page moves the viewport programmatically during its intro
       - and reading the position once per frame is both more reliable and
       naturally coalesced: a fast flick lands on where it ended up instead of
       crawling through everything on the way. The loop only runs while the
       section is actually visible. */
    function loop() {
        raf = 0;
        if (dead || !inView) return;
        raf = requestAnimationFrame(loop);
        if (!started || !store || count < 1) return;

        var target = Math.round(progress() * (count - 1));
        var travel = 0;
        if (target !== pending) {
            travel = Math.abs(target - pending);
            dir = (pending < 0 || target >= pending) ? 1 : -1;
            pending = target;
        }
        var sheet = Math.floor(pending / perSheet);
        if (sheet !== lastSheet) {
            lastSheet = sheet;
            /* narrow to just this sheet while travelling fast, widen again
               once the scroll settles */
            store.max = (travel > FLICK_FRAMES) ? 1 : maxSheets;
            store.want(sheet, dir);
        }
        if (!paint(pending) && drawn < 0) say('Loading…');
    }

    function runLoop() {
        if (!raf && inView && !dead) raf = requestAnimationFrame(loop);
    }

    function onSheetLoaded() {
        if (dead) return;
        if (pending >= 0) paint(pending);                   /* newest wins */
    }

    function fail(err) {
        if (dead) return;
        root.dataset.reelState = 'error';                   /* poster stays up */
        say('');
        if (window.console && console.warn) console.warn('[tp-reel]', err);
    }

    function start() {
        if (started || dead) return;
        started = true;
        root.dataset.reelState = 'loading';

        fetch(BASE + '/manifest.json')
            .then(function (r) {
                if (!r.ok) throw new Error('manifest ' + r.status);
                return r.json();
            })
            .then(function (manifest) {
                if (dead) return;
                var variant = 'desktop';
                info = manifest.variants[variant];
                perSheet = manifest.columns * manifest.rows;
                columns = manifest.columns;
                count = info.count;
                var coarse = (window.matchMedia &&
                    window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 900;
                maxSheets = coarse ? MAX_SHEETS_COARSE : MAX_SHEETS_FINE;
                store = new SheetStore(variant, info, perSheet, maxSheets,
                    onSheetLoaded, fail);
                resize();
                /* prime the first sheet at wherever the section currently sits;
                   the loop takes it from here */
                pending = Math.round(progress() * (count - 1));
                lastSheet = Math.floor(pending / perSheet);
                store.want(lastSheet, 1);
                runLoop();
            })
            .catch(fail);
    }

    /* ------------------------------------------------------- wiring/teardown */
    var io = null;
    if ('IntersectionObserver' in window) {
        /* Outer margin starts the fetch early; the loop itself only runs while
           the section is genuinely on screen. */
        io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    start();
                    inView = true;
                    runLoop();
                } else {
                    inView = false;         /* loop stops itself next frame */
                }
            }
        }, { rootMargin: '150% 0px' });
        io.observe(root);
    } else {
        start();
        inView = true;
        runLoop();
    }

    /* Safety net. The observer is the intended trigger, but if it never
       delivers - no support, or an environment where it silently does not
       fire - the section would sit on a poster forever. This polls cheaply
       until the reel is running and then stops for good. */
    var watchdog = setInterval(function () {
        if (dead || started) { clearInterval(watchdog); watchdog = 0; return; }
        if (onScreen()) {
            start();
            inView = true;
            runLoop();
            clearInterval(watchdog);
            watchdog = 0;
        }
    }, 500);

    /* Skip: jump clear of the whole section rather than scrubbing out of it.
       The reel is five viewports tall, which is a long way to scroll past if
       you only came for what is underneath it. */
    var skip = root.querySelector('.tp-reel__skip');
    function onSkip() {
        var past = root.offsetTop + root.offsetHeight - window.innerHeight + 2;
        window.scrollTo({ top: past, behavior: 'auto' });
    }
    if (skip) skip.addEventListener('click', onSkip);

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize, { passive: true });

    function onScreen() {
        var rect = root.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    /* A backgrounded tab should not burn frames; coming back should not wait
       for the observer to happen to fire again. */
    function onVisibility() {
        if (document.hidden) {
            inView = false;
        } else if (onScreen()) {
            inView = true;
            runLoop();
        }
    }
    document.addEventListener('visibilitychange', onVisibility);

    function teardown() {
        if (dead) return;
        dead = true;
        inView = false;
        if (skip) skip.removeEventListener('click', onSkip);
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
        window.removeEventListener('pagehide', teardown);
        document.removeEventListener('visibilitychange', onVisibility);
        if (watchdog) { clearInterval(watchdog); watchdog = 0; }
        if (io) { io.disconnect(); io = null; }
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (store) { store.dispose(); store = null; }
    }

    window.addEventListener('pagehide', teardown);
    root.tpReelTeardown = teardown;          /* so a future SPA-ish nav can call it */
})();
