type DGSentimentAvg = { sentiment: 'negative'|'neutral'|'positive'; sentiment_score: number }; // -1..1
type DGResponse = {
  results: {
    channels: Array<{ alternatives: Array<{ transcript: string; confidence: number; words: any[] }> }>;
    sentiments: { segments: any[]; average: DGSentimentAvg };
  };
};

type SentimentItem = { label: string; score: number }; // 0..1
type Analysis = { sentiments: SentimentItem[]; summary?: string };

export function toAnalysis(dg: DGResponse): Analysis | null {
  const alt = dg?.results?.channels?.[0]?.alternatives?.[0];
  const avg = dg?.results?.sentiments?.average;

  // 1) No speech / empty result guard
  const saidSomething = !!alt?.transcript?.trim();
  if (!avg || (!saidSomething && avg.sentiment_score === 0 && avg.sentiment === 'neutral')) {
    // Nothing meaningful detected – return a minimal neutral panel or null (your choice)
    return {
      sentiments: [
        { label: 'Negative', score: 0 },
        { label: 'Neutral',  score: 1 },
        { label: 'Positive', score: 0 },
      ],
      summary: 'No speech detected or too little audio to analyze.',
    };
  }

  // 2) Map Deepgram-style average (−1..1) to three confidences in 0..1
  const s = Math.max(-1, Math.min(1, avg.sentiment_score)); // clamp
  const neg = Math.max(0, -s);
  const pos = Math.max(0,  s);
  const neu = 1 - Math.abs(s);

  // Normalize to sum = 1 (nice for percentages)
  const sum = neg + neu + pos || 1;
  const nNeg = neg / sum, nNeu = neu / sum, nPos = pos / sum;

  const sentiments: SentimentItem[] = [
    { label: 'Negative', score: nNeg },
    { label: 'Neutral',  score: nNeu },
    { label: 'Positive', score: nPos },
  ].sort((a,b) => b.score - a.score); // highest first for the panel

  const transcript = alt?.transcript?.trim();
  const summary = transcript
    ? `Detected ${sentiments[0].label.toLowerCase()} tone.`
    : 'Detected tone from audio (no transcript).';

  return { sentiments, summary };
}
