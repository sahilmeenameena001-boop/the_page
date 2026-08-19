/* The Page — AI concierge endpoint (Vercel serverless function).
   Dormant until the client adds OPENAI_API_KEY in
   Vercel -> Project -> Settings -> Environment Variables.
   The chat widget falls back to WhatsApp while this is off. */

const KNOWLEDGE = `You are the concierge for The Page, Rohtak — a luxury hotel and events destination at Opp. Tilyar Lake, Delhi Road, Rohtak - 124001. Phone: 7664007601 / 7664007602.
Facts you may state:
- Live room rates and instant booking: https://thepagerohtak.bookingjini.in/ (rates vary by date; always direct guests there or to WhatsApp for exact pricing — never quote a fixed number).
- Check-in 2 PM, check-out 12 noon.
- Kaagaz Restaurant (1st floor): PURE VEG, daily 11 AM to 11 PM (last order). Jain and custom menus available.
- Panna Lounge & Bar (rooftop): 5 PM to 11 PM (last order). Alcohol served; food is veg and non-veg. Open Air Terrace hosts sunset coffee and candle-lit dinners.
- Events: 4 banquet halls, 3 kitty halls and a rooftop venue. Syahi Hall (1st floor) 15-20 pax; Kalam Hall (1st floor) 20-25 pax; Kitaab Hall (1st floor) 35-40 pax; Crystal 1 (2nd floor) 80-100 pax; Crystal 2 (2nd floor) 150-250 pax; Opus (ground floor) 150-300 pax; Amaanat Banquet (ground floor) 150-300 pax; 360 Degree Rooftop (5th floor) 15-20 pax. Event pricing is customised on request.
- Parking: free, 24/7 valet. Pets: not allowed.
- Cancellation: free up to 48 hours before arrival; no-show is charged 100% of the booking amount; early departure charges may apply; prepaid banquet/hall bookings follow their specific terms; peak dates, special events and group bookings may carry separate terms.
Rules: answer warmly and briefly (2-4 sentences). Never invent prices, discounts or availability beyond the facts above. For booking, availability, or anything you are not sure of, direct the guest to WhatsApp (7664007601). You may reply in Hindi or Hinglish if the guest writes in it.`;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(503).json({ error: 'AI not configured' });
    try {
        const { message } = req.body || {};
        if (!message || typeof message !== 'string' || message.length > 500) {
            return res.status(400).json({ error: 'Bad message' });
        }
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 220,
                temperature: 0.4,
                messages: [
                    { role: 'system', content: KNOWLEDGE },
                    { role: 'user', content: message }
                ]
            })
        });
        if (!r.ok) return res.status(502).json({ error: 'Upstream error' });
        const j = await r.json();
        const reply = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        return res.status(200).json({ reply: reply || null });
    } catch (e) {
        return res.status(500).json({ error: 'Server error' });
    }
};
