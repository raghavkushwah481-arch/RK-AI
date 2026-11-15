export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

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

    // छोटे सवालों के लिए छोटे जवाब
    const isShort = message.trim().length < 100;

    const instructions = isShort
      ? "You are R.K AI. Give short, direct and fast answers. Reply in the user's language. Avoid unnecessary details."
      : "You are R.K AI, a helpful intelligent assistant. Reply in the user's language. Explain clearly with useful details. Keep answers organized.";

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
            parts: [{ text: instructions }]
          },
          contents: [
            {
              parts: [{ text: message }]
            }
          ],
          generationConfig: {
            maxOutputTokens: isShort ? 256 : 2048
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

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "कोई जवाब नहीं मिला।";

    return res.status(200).json({ reply });

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "जवाब आने में 20 सेकंड से ज्यादा लग रहे हैं। कृपया दोबारा कोशिश करें।"
      });
    }

    return res.status(500).json({
      error: "Server error"
    });

  } finally {
    clearTimeout(timeout);
  }
}
