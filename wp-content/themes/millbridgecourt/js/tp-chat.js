/* The Page — concierge chat.
   ============ CLIENT CONFIG — edit here ============ */
var TP_CHAT = {
    whatsapp: '919999999999',            /* booking WhatsApp number, country code, digits only */
    aiEndpoint: '/api/chat',
    bookingUrl: 'https://thepagerohtak.bookingjini.in/', /* live rates & instant booking (Bookingjini) */             /* Vercel function; activates automatically once OPENAI_API_KEY is set in Vercel */
    rates: { deluxe: 4500, executive: 6500, suite: 9500 },
    address: 'The Page Hotel, Delhi Bypass Road, Opposite Tilyar Lake, Rohtak, Haryana 124001'
};
/* =================================================== */
(function () {
    'use strict';
    try { sessionStorage.setItem('tpConcierge', '1'); } catch (e) {} /* chat replaces the old concierge card */

    function fmt(n) { return '₹' + n.toLocaleString('en-IN'); }
    function wa(text) {
        return 'https://wa.me/' + TP_CHAT.whatsapp + '?text=' + encodeURIComponent(text);
    }
    var RATES = 'Room rates vary by date and are always best-price when booked direct — breakfast included. Tap below to see live prices for your dates and book instantly.';

    /* pre-trained answers: [keywords, reply, whatsappLabel|null] */
    var KB = [
        [['rate','price','cost','tariff','room','stay','kitna','kimat','charge','suite','deluxe','executive'], RATES, 'LIVE'],
        [['book','booking','reserve','reservation','available','availability','check in date'], 'Lovely! You can check live availability and book instantly below — or send your dates on WhatsApp and our team will handle it for you.', 'LIVE'],
        [['wedding','shaadi','marriage','banquet','event','function','reception','party','engagement','anniversary','corporate'], 'The Page Banquet hosts weddings and events for up to 500 guests, with in-house catering, décor support and a dedicated event manager. Our three halls also suit meetings and intimate parties. Event pricing is customised — our team will build a quote for you.', 'Plan my event'],
        [['restaurant','kaagaz','food','dining','dinner','lunch','breakfast','menu','khana','eat'], 'Kaagaz Restaurant serves veg and non-veg cuisine daily, 7:30 AM to 11 PM — Indian, Continental and Pan-Asian. Jain and custom dietary menus are available on request.', null],
        [['lounge','bar','panna','cocktail','drink','rooftop','terrace','nightlife'], 'Panna Lounge & Bar, our rooftop lounge, is open 5 PM to midnight with handcrafted cocktails, mocktails and city views. The Open Air Terrace also hosts sunset coffees and candle-lit dinners.', null],
        [['time','timing','check-in','checkin','check out','checkout','hours','open','close'], 'Check-in is 1 PM and check-out is 11 AM. Kaagaz Restaurant: 7:30 AM–11 PM. Panna Lounge: 5 PM–midnight. Early check-in or late check-out? Ask us — we accommodate whenever possible.', null],
        [['address','location','where','direction','reach','map','kahan','distance','tilyar'], 'You will find us at: ' + TP_CHAT.address + ' — right opposite Tilyar Lake on the Delhi Bypass.', null],
        [['parking','car','valet'], 'Yes — complimentary parking with valet service for all guests and event visitors.', null],
        [['pet','dog','cat'], 'We love them, but pets are not permitted at the hotel — sorry about that.', null],
        [['cancel','cancellation','refund'], 'Direct bookings can be cancelled free of charge up to 48 hours before check-in. Flexible-rate bookings can be cancelled anytime.', null],
        [['contact','phone','number','call','whatsapp','email'], 'The quickest way to reach us is WhatsApp — tap below and our team replies within minutes.', 'Chat on WhatsApp'],
        [['hello','hi','hey','namaste','good morning','good evening'], 'Hello! Welcome to The Page. Ask me about rooms and rates, dining, events, or anything else — or tap a quick question below.', null],
        [['thank','thanks','shukriya','great','nice'], 'A pleasure! If there is anything else, I am right here. We hope to welcome you to The Page soon. ✦', null]
    ];
    var CHIPS = [['Rooms & rates','rates'],['Book a stay','booking'],['Weddings & events','wedding'],['Dining','restaurant'],['Timings','timings'],['Location','address']];

    var aiDead = false;
    try { aiDead = sessionStorage.getItem('tpAiDead') === '1'; } catch (e) {}

    /* ---- UI ---- */
    var btn = document.createElement('button');
    btn.className = 'tpc-fab'; btn.setAttribute('aria-label', 'Chat with The Page concierge');
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 12c0 4.418-4.03 8-9 8-1.02 0-2-.14-2.9-.4L3.5 21l1.6-4.2C4.4 15.5 4 13.8 4 12c0-4.418 4.03-8 9-8s8 3.582 8 8z" stroke="#08391B" stroke-width="1.6"/><circle cx="9.5" cy="12" r="1" fill="#08391B"/><circle cx="13" cy="12" r="1" fill="#08391B"/><circle cx="16.5" cy="12" r="1" fill="#08391B"/></svg>';
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'tpc-panel';
    panel.innerHTML = '<div class="tpc-head"><div><p class="tpc-head__label">THE PAGE</p><p class="tpc-head__title">Concierge</p></div><button class="tpc-close" aria-label="Close chat">&#10005;</button></div><div class="tpc-msgs"></div><div class="tpc-chips"></div><form class="tpc-form"><input type="text" placeholder="Ask about rooms, events, dining…" autocomplete="off" /><button type="submit" aria-label="Send">&#10148;</button></form>';
    document.body.appendChild(panel);

    var msgs = panel.querySelector('.tpc-msgs');
    var chipsBox = panel.querySelector('.tpc-chips');
    var form = panel.querySelector('.tpc-form');
    var input = form.querySelector('input');

    CHIPS.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'tpc-chip'; b.textContent = c[0];
        b.addEventListener('click', function () { ask(c[1], c[0]); });
        chipsBox.appendChild(b);
    });

    function bubble(text, who, waLabel, waText) {
        var d = document.createElement('div');
        d.className = 'tpc-msg tpc-msg--' + who;
        d.textContent = text;
        if (waLabel) {
            var a = document.createElement('a');
            if (waLabel === 'LIVE') {
                a.href = TP_CHAT.bookingUrl;
                a.textContent = 'See live rates & book ↗';
            } else {
                a.href = wa(waText || 'Hi! I have a question about The Page, Rohtak.');
                a.textContent = waLabel + ' ↗';
            }
            a.target = '_blank'; a.rel = 'noopener';
            a.className = 'tpc-wa';
            d.appendChild(document.createElement('br'));
            d.appendChild(a);
        }
        msgs.appendChild(d);
        msgs.scrollTop = msgs.scrollHeight;
        return d;
    }

    function typing() {
        var t = bubble('• • •', 'bot');
        t.classList.add('tpc-typing');
        return t;
    }

    function match(q) {
        q = q.toLowerCase();
        var best = null, score = 0;
        KB.forEach(function (row) {
            var s = 0;
            row[0].forEach(function (k) { if (q.indexOf(k) !== -1) s += k.length; });
            if (s > score) { score = s; best = row; }
        });
        return score > 0 ? best : null;
    }

    function answer(q) {
        var hit = match(q);
        var t = typing();
        if (hit) {
            setTimeout(function () {
                t.remove();
                bubble(hit[1], 'bot', hit[2], 'Hi! I would like to enquire: ' + q);
            }, 550);
            return;
        }
        /* unknown: try the AI endpoint (activates when the client adds OPENAI_API_KEY in Vercel) */
        if (!aiDead && TP_CHAT.aiEndpoint) {
            fetch(TP_CHAT.aiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q }) })
                .then(function (r) { if (!r.ok) throw 0; return r.json(); })
                .then(function (j) { t.remove(); bubble(j.reply || fallbackText(), 'bot', j.reply ? null : 'Ask on WhatsApp', q); })
                .catch(function () {
                    aiDead = true;
                    try { sessionStorage.setItem('tpAiDead', '1'); } catch (e) {}
                    t.remove(); bubble(fallbackText(), 'bot', 'Ask on WhatsApp', 'Hi! I have a question: ' + q);
                });
            return;
        }
        setTimeout(function () { t.remove(); bubble(fallbackText(), 'bot', 'Ask on WhatsApp', 'Hi! I have a question: ' + q); }, 550);
    }
    function fallbackText() { return 'I want to get that exactly right for you — our team on WhatsApp will answer in minutes.'; }

    function ask(q, label) {
        bubble(label || q, 'user');
        answer(q);
    }

    var opened = false;
    function open() {
        panel.classList.add('tpc-open');
        btn.classList.add('tpc-fab--hide');
        if (!opened) {
            opened = true;
            var h = new Date().getHours();
            var greet = h < 12 ? 'Good morning!' : h < 17 ? 'Good afternoon!' : 'Good evening!';
            bubble(greet + ' Welcome to The Page, Rohtak. I can help with rooms and rates, dining, weddings and more — tap a question or type your own.', 'bot');
        }
        input.focus();
    }
    btn.addEventListener('click', open);
    panel.querySelector('.tpc-close').addEventListener('click', function () {
        panel.classList.remove('tpc-open');
        btn.classList.remove('tpc-fab--hide');
    });
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (!q) return;
        input.value = '';
        ask(q);
    });
})();
