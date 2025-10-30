import { useState } from 'react';

interface EmotionReactionMap {
  [emotion: string]: string;
}

interface EmotionResult {
  emotions: string[];
  reactions: EmotionReactionMap;
  raw?: any;
}

export function useEmotionAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmotionResult | null>(null);

  const analyzeText = async (text: string) => {
    if (!text?.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer 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`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          input: `
You are an emotional analysis assistant.  
Analyze this text and return a **JSON object** with:
{
  "feelings": [list of distinct emotions],
  "reactions": { each feeling: best short reaction or phrase to say }
}
Text: """${text}"""
Make sure the output is valid JSON only — no explanations or markdown.`,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      const rawText =
        json?.output?.[0]?.content?.[0]?.text?.trim() ||
        json?.output_text?.trim() ||
        '';

      // Parse the JSON text safely
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('Invalid JSON response');
      }

      const emotions = parsed.feelings || [];
      const reactions = parsed.reactions || {};

      const resultObj = { emotions, reactions, raw: json };
      setResult(resultObj);
      return resultObj;
    } catch (err: any) {
      console.error('Emotion analysis error:', err.message);
      setError(err.message || 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { analyzeText, loading, error, result };
}
