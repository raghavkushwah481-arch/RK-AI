export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const startTime = Date.now();

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "कृपया अपना सवाल लिखें।"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY नहीं मिली।"
      });
    }

    const text = message.trim();

    // आसान सवालों की पहचान
    const isSimple =
      text.length < 100 &&
      !/गाना|कहानी|निबंध|कोड|प्रोग्राम|समझाओ|विस्तार|लिखकर दो|बनाकर दो/i.test(text);

    // भाषा पहचान
    const hasHindi = /[\u0900-\u097F]/.test(text);

    const isRomanHindi =
      !hasHindi &&
      /\b(hai|hain|kya|kaise|kyu|kyun|mera|meri|mujhe|tum|aap|batao|likho|karna|chahiye|hindi|mein|me|nahi|haan)\b/i.test(text);

    let languageRule = "Reply in English.";

    if (hasHindi) {
      languageRule = "जवाब हमेशा सरल और स्वाभाविक हिंदी में दो।";
    } else if (isRomanHindi) {
      languageRule = "Reply in simple Roman Hindi. Do not switch to English.";
    }

    const instructions = `
You are R.K AI, a helpful and intelligent AI assistant.

LANGUAGE:
${languageRule}

IMPORTANT RULES:
1. Always answer the user's actual question.
2. Give complete and useful answers.
3. For songs, write a complete song with verses and chorus.
4. For stories, write a complete story.
5. For coding, provide working and complete code.
6. Simple questions should get short, direct answers.
7. Complex questions should get detailed answers.
8. Never stop an answer unnecessarily in the middle.
9. Talk naturally and politely, like a helpful friend.
10. Your name is R.K AI.
`;

    const models = isSimple
      ? ["gemini-3.5-flash-lite", "gemini-3.8-flash"]
      : ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

    let lastError = "AI जवाब नहीं दे पाया।";

    for (const model of models) {
      const remaining = 19000 - (Date.now() - startTime);

      if (remaining < 1000) break;

      const controller = new AbortController();

      const attemptTime = Math.min(
        remaining,
        model === models[0] ? 9000 : 9500
      );

      const timeout = setTimeout(() => {
        controller.abort();
      }, attemptTime);

      try {
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
              contents: [
                {
                  role: "user",
                  parts: [{ text }]
                }
              ],
              generationConfig: {
                maxOutputTokens: isSimple ? 512 : 4096
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          lastError =
            data.error?.message || "Gemini API में समस्या आई।";

          // Quota या server error पर दूसरे मॉडल को मौका
          if (
            response.status === 429 ||
            response.status >= 500
          ) {
            continue;
          }

          return res.status(response.status).json({
            error: lastError
          });
        }

        const reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

        if (reply) {
          return res.status(200).json({
            reply,
            model
          });
        }

        lastError = "इस बार AI का जवाब खाली आया।";

      } catch (error) {
        lastError =
          error.name === "AbortError"
            ? "पहले मॉडल को जवाब देने में देरी हुई।"
            : "AI कनेक्शन में समस्या आई।";

      } finally {
        clearTimeout(timeout);
      }
    }

    return res.status(504).json({
      error:
        "दोनों AI मॉडल से समय पर जवाब नहीं मिला। कृपया दोबारा कोशिश करें।"
    });

  } catch (error) {
    return res.status(500).json({
      error: "सर्वर में समस्या हुई। कृपया दोबारा कोशिश करें।"
    });
  }
}
