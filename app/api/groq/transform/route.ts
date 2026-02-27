import { type NextRequest, NextResponse } from "next/server"

// Groq free models — using Meta Llama 3.3 70B (best multilingual quality on Groq free tier)
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions"
const MODEL    = "llama-3.3-70b-versatile"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lines, mode, targetLanguage, apiKey } = body as {
      lines:          string[]
      mode:           "transliterate" | "translate"
      targetLanguage: string
      apiKey:         string
    }

    if (!apiKey)         return NextResponse.json({ error: "No API key provided" }, { status: 400 })
    if (!lines?.length)  return NextResponse.json({ error: "No lyrics provided" },  { status: 400 })

    const lang   = targetLanguage || "English"
    const lyrics = lines.join("\n")

    const systemPrompt = mode === "transliterate"
      ? `You are a TRANSLITERATOR — your ONLY job is phonetic romanization. You MUST NOT translate meaning.

TASK: Convert each lyric line into its phonetic pronunciation written in Latin/Roman alphabet.
TARGET SCRIPT: ${lang === "English" ? "Latin/Roman alphabet" : lang}

STRICT RULES:
1. TRANSLITERATION ONLY — write how words SOUND, not what they MEAN.
   Example: Hindi "मेरा दिल" → "mera dil" (NOT "my heart")
   Example: Korean "사랑해" → "saranghae" (NOT "I love you")
   Example: Arabic "أنا أحبك" → "ana uhibbak" (NOT "I love you")
2. If a line is already in Roman/Latin script, keep it exactly as-is.
3. Output ONLY the romanized lines — one line per input line.
4. Same number of output lines as input lines. Empty input lines → empty output lines.
5. NO translations, NO explanations, NO notes, NO line numbers.`
      : `You are a TRANSLATOR — your ONLY job is to translate meaning into ${lang}.

TASK: Translate each lyric line into natural, fluent ${lang}.

STRICT RULES:
1. TRANSLATE MEANING — convey what the words mean in ${lang}.
   Example: Hindi "मेरा दिल" → "my heart"
   Example: Korean "사랑해" → "I love you"
2. If a line is already in ${lang}, keep it as-is.
3. Preserve the emotional and poetic feel of the song.
4. Output ONLY the translated lines — one line per input line.
5. Same number of output lines as input lines. Empty input lines → empty output lines.
6. NO transliteration, NO explanations, NO notes, NO line numbers.`

    const res = await fetch(GROQ_API, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        temperature: 0.1,
        max_tokens:  4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: lyrics },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = (err as any)?.error?.message || `Groq API error ${res.status}`
      return NextResponse.json({ error: msg }, { status: res.status })
    }

    const data   = await res.json()
    const text   = data.choices?.[0]?.message?.content?.trim() || ""
    const result = text.split("\n")

    // Align to input length
    while (result.length < lines.length) result.push("")
    result.length = lines.length

    return NextResponse.json({ lines: result, model: MODEL })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 })
  }
}
