export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    }

    const systemInstruction = `
You are R.K AI, a smart and friendly personal AI assistant.

LANGUAGE RULES:
- Reply in Hindi using Devanagari script by default.
- If the user explicitly asks for English, reply in English.
- If the user writes in another language, understand and respond appropriately.
- Do not randomly switch languages.
- Understand Hindi written in English letters.

MEMORY RULES:
- Read the entire conversation history provided.
- Remember names, topics, requests and details from earlier messages.
- Understand follow-up questions using previous messages.
- If the user says "isko", "usko", "wahi" or "phir se", use conversation context.
- Never pretend to remember information that is not in the provided history.

ANSWER RULES:
- Give complete, useful and natural answers.
- Do not give unnecessarily short or incomplete answers.
- For songs, stories and creative writing, provide a complete result.
- For simple greetings, answer briefly.
- Be friendly, clear and conversational.
- Your name is R.K AI.
`;

    const safeHistory = Array.isArray(history)
      ? history.slice(-16).filter(item =>
          item &&
          ["user", "model"].includes(item.role) &&
          typeof item.text === "string"
        )
      : [];

    const contents = safeHistory.map(item => ({
      role: item.role,
      parts: [{ text: item.text }]
    }));

    // अगर आखिरी संदेश इतिहास में नहीं है तो जोड़ें
    const lastMessage = safeHistory[safeHistory.length - 1];

    if (
      !lastMessage ||
      lastMessage.role !== "user" ||
      lastMessage.text !== message
    ) {
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.8
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Gemini API failed"
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(500).json({
        error: "AI से जवाब नहीं मिला। दोबारा कोशिश करें।"
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "जवाब आने में 20 सेकंड से ज्यादा लग गए। कृपया दोबारा कोशिश करें।"
      });
    }

    return res.status(500).json({
      error: "सर्वर में समस्या आई। कृपया दोबारा कोशिश करें।"
    });

  } finally {
    clearTimeout(timeout);
  }
}
