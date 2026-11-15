export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "अपना सवाल लिखें।" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY नहीं मिली।"
      });
    }

    const prompt = `
तुम R.K AI हो, एक समझदार, मित्रवत और उपयोगी AI असिस्टेंट।

भाषा के नियम:
1. उपयोगकर्ता हिंदी में बात करे तो हमेशा हिंदी में जवाब दो।
2. उपयोगकर्ता Roman Hindi में लिखे तो आसान Roman Hindi में जवाब दो।
3. उपयोगकर्ता अंग्रेज़ी में लिखे तो अंग्रेज़ी में जवाब दो।
4. बिना माँगे भाषा मत बदलना।
5. जवाब स्वाभाविक बातचीत जैसे होने चाहिए।

जवाब के नियम:
1. सवाल को ध्यान से समझो और पूरा जवाब दो।
2. गाना माँगे तो पूरा गाना लिखो, सिर्फ दो लाइन नहीं।
3. कहानी माँगे तो पूरी कहानी लिखो।
4. कोड माँगे तो पूरा और उपयोगी कोड दो।
5. छोटे सवालों का जवाब छोटा और सीधा दो।
6. बड़े सवालों का जवाब विस्तार से, साफ-सुथरे ढंग से दो।
7. अधूरा जवाब देकर बीच में मत रुको।
8. उपयोगकर्ता से दोस्त की तरह बात करो।
9. अपना नाम R.K AI बताओ, Gemini नहीं।

उपयोगकर्ता का सवाल:
${message}
`;

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
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "AI से जवाब नहीं मिला।"
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    return res.status(200).json({
      reply: reply || "माफ़ कीजिए, इस बार जवाब नहीं मिल पाया।"
    });

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "जवाब आने में 20 सेकंड से ज्यादा लग गए। दोबारा कोशिश करें।"
      });
    }

    return res.status(500).json({
      error: "सर्वर में समस्या हुई। कृपया दोबारा कोशिश करें।"
    });

  } finally {
    clearTimeout(timeout);
  }
}
