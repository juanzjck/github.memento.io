import { useState, useCallback } from 'react';

export type SentimentItem = { label: string; score: number }; // 0..1
export type Analysis = { sentiments: SentimentItem[]; summary?: string };

type OAIErr = { message?: string };

export function useOpenAIEmotions(apiKey: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const analyze = useCallback(async (text: string): Promise<Analysis | null> => {
    if (!text?.trim()) {
      return {
        sentiments: [
          { label: 'Negative', score: 0 },
          { label: 'Neutral',  score: 1 },
          { label: 'Positive', score: 0 },
        ],
        summary: 'No speech detected or empty input.',
      };
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // fast & cheap; change if you want
          input: [
            `You are an emotion analysis helper.`,
            `Return STRICT JSON with fields:`,
            `overall: {label: "Negative|Neutral|Positive", score: number 0..1},`,
            `emotions: array of up to 5 items {label: string, score: number 0..1},`,
            `summary: short one-line description.`,
            `Text: """${text}"""`,
            `JSON ONLY. No prose.`,
          ].join('\n'),
          temperature: 0,
          max_output_tokens: 300,
        }),
      });

      if (!resp.ok) {
        const msg = `HTTP ${resp.status}`;
        throw new Error(msg);
      }

      const json = await resp.json();

      // Responses API can put text in either output_text or content blocks.
      const rawText =
        json?.output_text?.trim() ||
        json?.output?.[0]?.content?.[0]?.text?.trim() ||
        '';

      // Parse the model's JSON
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Fallback: very defensive – default to neutral if parsing fails
        return {
          sentiments: [
            { label: 'Negative', score: 0 },
            { label: 'Neutral',  score: 1 },
            { label: 'Positive', score: 0 },
          ],
          summary: 'Could not parse model output; defaulting to neutral.',
        };
      }

      // Map to your UI’s Analysis type
      const emotions: SentimentItem[] = Array.isArray(parsed?.emotions)
        ? parsed.emotions
            .map((e: any) => ({
              label: String(e?.label ?? 'Unknown'),
              score: Math.max(0, Math.min(1, Number(e?.score ?? 0))),
            }))
            .slice(0, 5)
        : [];

      // If overall present, ensure N/P/Neu bars exist too
      const overallLabel = String(parsed?.overall?.label ?? '').toLowerCase();
      const overallScore = Math.max(0, Math.min(1, Number(parsed?.overall?.score ?? 0)));

      // Build classic 3-bar sentiment (Negative/Neutral/Positive) from overall label
      let base: SentimentItem[] = [
        { label: 'Negative', score: 0 },
        { label: 'Neutral',  score: 0 },
        { label: 'Positive', score: 0 },
      ];
      const idx =
        overallLabel.includes('neg') ? 0 :
        overallLabel.includes('pos') ? 2 :
        1;
      base[idx].score = overallScore || 0.6; // if score missing, assume medium

      // Normalize base to sum=1
      const sum = base.reduce((a, b) => a + b.score, 0) || 1;
      base = base.map(b => ({ ...b, score: b.score / sum }));

      // Merge: show detailed emotions first (for your top 5 bars), then the 3-bar fallback if no details
      const sentiments = emotions.length ? emotions : base;

      return {
        sentiments,
        summary: String(parsed?.summary ?? `Detected ${overallLabel || 'neutral'} tone.`),
      };
    } catch (e: any) {
      const msg = (e as OAIErr)?.message || 'Unknown error';
      setError(msg);
      return {
        sentiments: [
          { label: 'Negative', score: 0 },
          { label: 'Neutral',  score: 1 },
          { label: 'Positive', score: 0 },
        ],
        summary: 'Error contacting analysis service; defaulting to neutral.',
      };
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  return { analyze, loading, error };
}
