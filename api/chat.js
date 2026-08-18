/* The Page — AI concierge endpoint (Vercel serverless function).
   Dormant until the client adds OPENAI_API_KEY in
   Vercel -> Project -> Settings -> Environment Variables.
   The chat widget falls back to WhatsApp while this is off. */

const KNOWLEDGE = `You are the concierge for The Page, Rohtak — a luxury hotel and events destination on Delhi Bypass Road, opposite Tilyar Lake, Rohtak, Haryana 124001.
Facts you may state:
- Live room rates and instant booking: https://thepagerohtak.bookingjini.in/ (rates vary by date; always direct guests there or to WhatsApp for exact pricing — never quote a fixed number).
- Check-in 1 PM, check-out 11 AM. Free cancellation up to 48 hours before check-in.
- Kaagaz Restaurant: veg + non-veg, 7:30 AM–11 PM, Indian/Continental/Pan-Asian, Jain and custom menus available.
- Panna Lounge & Bar: rooftop, 5 PM–midnight, cocktails and mocktails. Open Air Terrace for sunset coffee and candle-lit dinners.
- The Page Banquet: weddings and events up to 500 guests; three additional halls for meetings and family functions; event pricing is customised on request.
- Complimentary valet parking. Pets not allowed.
Rules: answer warmly and briefly (2-4 sentences). Never invent prices, discounts or availability beyond the facts above. For booking, availability, or anything you are not sure of, direct the guest to WhatsApp. You may reply in Hindi or Hinglish if the guest writes in it.`;

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
