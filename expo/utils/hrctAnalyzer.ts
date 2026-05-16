import { HRCT_SYSTEM_PROMPT } from "@/constants/hrctSystemPrompt";
import type { ClinicalContext, HRCTAnalysis, ImageType } from "@/types/hrct";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

function buildContextText(imageType: ImageType, context: ClinicalContext): string {
  const typeLabel = imageType === "cxr" ? "Chest X-Ray" : imageType === "hrct" ? "HRCT chest" : "CT Pulmonary Angiogram (CTPA)";
  let text = `\nIMAGE TYPE: ${typeLabel}\n`;
  if (!context || Object.keys(context).length === 0) return text;
  text += "\nCLINICAL CONTEXT PROVIDED:\n";
  if (context.age) text += `- Age: ${context.age} years\n`;
  if (context.gender) text += `- Gender: ${context.gender}\n`;
  if (context.smoking) {
    const smokingMap: Record<string, string> = { non: "Non-smoker", ex: "Ex-smoker", active: "Active smoker" };
    text += `- Smoking: ${smokingMap[context.smoking] ?? context.smoking}\n`;
  }
  if (context.history) text += `- History: ${context.history}\n`;
  if (context.symptoms?.length) text += `- Symptoms: ${context.symptoms.join(", ")}\n`;
  if (context.suspicion) text += `- Clinical suspicion: ${context.suspicion}\n`;
  text += "Use this clinical context to refine differential diagnosis probability.\n";
  return text;
}

function extractJson(raw: string): HRCTAnalysis {
  let cleaned = raw.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last >= 0) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned) as HRCTAnalysis;
}

export async function analyzeHRCT(params: {
  imageBase64: string;
  imageMime: string;
  imageType: ImageType;
  context: ClinicalContext;
}): Promise<HRCTAnalysis> {
  const userText = `Analyze this ${params.imageType.toUpperCase()} image using the pattern recognition algorithm.${buildContextText(params.imageType, params.context)}\nFollow the 5-step analysis framework strictly. Return ONLY the JSON object as specified in the system prompt.`;

  const body = {
    system_instruction: {
      parts: [{ text: HRCT_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: params.imageMime,
              data: params.imageBase64,
            },
          },
          { text: userText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  if (!GEMINI_API_KEY) {
    console.log("[hrctAnalyzer] Missing EXPO_PUBLIC_GEMINI_API_KEY");
    throw new Error("AI service is not configured. Please contact support.");
  }

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.log("[hrctAnalyzer] Gemini HTTP error", res.status, errText.slice(0, 500));
    let upstream = "";
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string; status?: string } };
      upstream = parsed?.error?.message ?? "";
    } catch {}
    if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(errText)) {
      throw new Error("AI service key is invalid. Please update EXPO_PUBLIC_GEMINI_API_KEY.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("AI service rejected the API key (auth/permission). Please update the key.");
    }
    if (res.status === 429) {
      throw new Error("AI service quota exceeded. Please wait a minute and try again.");
    }
    if (res.status === 404) {
      throw new Error("AI model not found. The Gemini model name may have changed.");
    }
    if (res.status === 413 || /too large|payload/i.test(errText)) {
      throw new Error("Image is too large for the AI service. Try a smaller image.");
    }
    throw new Error(`AI service error (${res.status}). ${upstream || "Please try again shortly."}`.trim());
  }

  const data = await res.json();
  const parts: unknown = data?.candidates?.[0]?.content?.parts;
  let raw = "";
  if (Array.isArray(parts)) {
    raw = (parts as Array<{ text?: string }>).map((p) => p.text ?? "").join("\n");
  }
  if (!raw) {
    console.log("[hrctAnalyzer] empty content", JSON.stringify(data).slice(0, 300));
    throw new Error("AI returned an empty response. Please try again.");
  }

  try {
    return extractJson(raw);
  } catch (e) {
    console.log("[hrctAnalyzer] JSON parse failed", raw.slice(0, 300));
    throw new Error("AI returned an invalid report format. Please retry.");
  }
}
