/**
 * Server-side replacement for window.cowork.askClaude — extracts structured
 * data from a pasted freelance-offer email using an LLM.
 *
 * Provider priority:
 *   1. DEEPSEEK_API_KEY  -> DeepSeek's OpenAI-compatible chat completions API
 *      (cheap, good for this kind of structured-extraction task)
 *   2. ANTHROPIC_API_KEY -> Anthropic Messages API (fallback / alternative)
 *
 * Only active if at least one of the two keys is set — the frontend checks
 * /api/config first and hides the AI section entirely if neither is present.
 */
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

function buildPrompt(text) {
  return 'From the following freelance job-offer email, extract the data and return ONLY valid JSON — no markdown, no explanation — exactly in this shape: ' +
    '{"hh_firma": "name of the agency/headhunting firm SENDING the email (the intermediary), or an empty string if the email is directly from the end client", ' +
    '"kontakt_osoba": "name of the person who sent the email (recruiter/agency contact), or an empty string if it cannot be determined", ' +
    '"klijent": "name of the END client the position is for (not the agency), or an empty string if the end client is not disclosed", ' +
    '"opis": "a ONE-sentence summary of the job", ' +
    '"radni_mod": "one of: Remote, On-site, Hibrid, or an empty string if not mentioned", ' +
    '"sap_fokus": "classify which SAP technology/tool this is about - exactly one of: Signavio, SAP Solution Manager ChaRM, SAP Solution Manager FB, SAP CALM, Ostalo", ' +
    '"budzet": number (the budget THE CLIENT STATED in EUR per day, number only, or null), ' +
    '"trajanje_mjeseci": number (promised duration in MONTHS, convert weeks/years to months, or null), ' +
    '"najavljeni_pocetak": "start date as YYYY-MM-DD (compute it relative to today = ' + new Date().toISOString().substring(0, 10) + '), or null", ' +
    '"napomene": "any other relevant detail: deadlines, contact person, conditions"}\n\nEmail:\n' + text;
}

function extractJsonBlock(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Nisam uspio protumačiti AI odgovor.");
  return JSON.parse(match[0]);
}

async function callDeepSeek(apiKey, prompt) {
  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data && data.error && data.error.message) || "DeepSeek API error");
  const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  return extractJsonBlock(raw);
}

async function callAnthropic(apiKey, prompt) {
  const resp = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data && data.error && data.error.message) || "Anthropic API error");
  const raw = (data.content && data.content[0] && data.content[0].text) || "";
  return extractJsonBlock(raw);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    res.status(400).json({ error: "Nedostaje tekst emaila." });
    return;
  }

  const prompt = buildPrompt(text);
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!deepseekKey && !anthropicKey) {
    res.status(400).json({ error: "Nijedan AI ključ nije postavljen na serveru (DEEPSEEK_API_KEY ili ANTHROPIC_API_KEY)." });
    return;
  }

  try {
    const parsed = deepseekKey
      ? await callDeepSeek(deepseekKey, prompt)
      : await callAnthropic(anthropicKey, prompt);
    res.status(200).json({ parsed, provider: deepseekKey ? "deepseek" : "anthropic" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
