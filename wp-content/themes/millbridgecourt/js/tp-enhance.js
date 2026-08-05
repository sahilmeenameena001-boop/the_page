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
