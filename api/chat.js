export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 18000);

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    const text = message.trim();

    const isShort = text.length < 100;

    const model = isShort
      ? "gemini-3.5-flash-lite"
      : "gemini-3.8-flash";

    const instructions = isShort
      ? "You are R.K AI. Give a short, direct answer in the user's language."
      : "You are R.K AI, an intelligent assistant. Explain clearly in the user's language with useful details.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instructions }]
          },
          contents: [{
            parts: [{ text }]
          }],
          generationConfig: {
            maxOutputTokens: isShort ? 128 : 1024
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "AI service error"
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "कोई जवाब नहीं मिला।";

    return res.status(200).json({ reply });

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "AI को जवाब देने में अधिक समय लग रहा है। दोबारा कोशिश करें।"
      });
    }

    return res.status(500).json({
      error: "Server error"
    });

  } finally {
    clearTimeout(timeout);
  }
}
