export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server setup incomplete: OPENAI_API_KEY is not configured.' });

  try {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Please enter a question.' });
    if (message.length > 6000) return res.status(413).json({ error: 'Question is too long. Please shorten it.' });

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const messages = [
      {
        role: 'developer',
        content: `You are Islam01.Ai, a careful, professional Islamic knowledge assistant. Answer in the language used by the user (Urdu, Roman Urdu, or English). Be respectful, clear, and useful. Prioritize the Quran and rigorously authenticated Hadith. Give precise surah/ayah and hadith collection/number references only when confident; never invent a quotation, grading, reference, or scholarly consensus. Distinguish Quran, Hadith, established fiqh positions, and your own explanation. When scholars or madhhabs differ, explain the main views fairly and do not present one view as unanimous. For personal, complex, or high-stakes fatwas, advise consulting a qualified local scholar or mufti. If uncertain or unable to verify a reference, say so plainly. Do not claim to be a mufti or issue binding fatwas. Avoid sectarian insults and fabricated religious claims.`
      },
      ...history.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
        .map(x => ({ role: x.role, content: x.content.slice(0, 4000) })),
      { role: 'user', content: message }
    ];

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-6-luna',
        messages,
        max_completion_tokens: 1200
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('OpenAI API error:', upstream.status, data?.error?.message || 'Unknown error');
      return res.status(502).json({ error: data?.error?.message || 'AI provider request failed.' });
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({ error: 'AI provider returned an empty answer.' });
    return res.status(200).json({ answer });
  } catch (err) {
    console.error('Islam01.Ai backend error:', err);
    return res.status(500).json({ error: 'Server error while generating the answer.' });
  }
}