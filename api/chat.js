export default async function handler(req, res) {
  // केवल POST request स्वीकार करें
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: message
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", data);

      return res.status(response.status).json({
        error: data.error?.message || "AI request failed"
      });
    }

    const answer =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        .find(item => item.type === "output_text")?.text;

    return res.status(200).json({
      reply: answer || "कोई जवाब नहीं मिला।"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
