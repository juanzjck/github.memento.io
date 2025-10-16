// features/sentimensRecognitions/useRecordAudio.ts
import { useRef, useState } from "react";
import { askMicPermission, startRecording, stopRecording } from "./audio";
import { transcribeLocalFile } from "./deepgramClient";

type DGSentimentAvg = { sentiment: 'negative'|'neutral'|'positive'; sentiment_score: number }; // -1..1
type DGResponse = {
  results: {
    channels: Array<{ alternatives: Array<{ transcript: string; confidence: number; words: any[] }> }>;
    sentiments: { segments: any[]; average: DGSentimentAvg };
  };
};

export default function useRecordAudio() {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [sentiments, setSentiments] = useState<DGResponse | null>(null);
  const [recording, setRecording] = useState<boolean>(false);

  // guard against concurrent stop/upload
  const uploadingRef = useRef(false);

  const onStart = async () => {
    await askMicPermission();
    setTranscript(null);
    setSentiments(null);
    setRecording(true);
    await startRecording();
  };

  const onStop = async () => {
    const u = await stopRecording();
    setUri(u);
    setRecording(false);
    return u;
  };

  /** Convenience: stop the recorder and immediately upload+transcribe. */
  const onStopAndUpload = async (callback?: (text: string) => void) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    try {
      const localUri = await onStop(); // stops & sets uri/recording
      if (!localUri) return;

      setLoading(true);
      const data: DGResponse = await transcribeLocalFile(localUri);
      const alt = data?.results?.channels?.[0]?.alternatives?.[0];
      const text = alt?.transcript?.trim() ?? '';

      setTranscript(text || null);
      setSentiments(data);

      if (callback) callback(text);
      return { text, data };
    } catch (e) {
      console.warn('onStopAndUpload error', e);
    } finally {
      setLoading(false);
      uploadingRef.current = false;
    }
  };

  /** Raw upload when you already have a `uri` captured. */
  const onUpload = async (callback?: (text: string) => void) => {
    if (uploadingRef.current || !uri) return;
    uploadingRef.current = true;
    try {
      setLoading(true);
      const data: DGResponse = await transcribeLocalFile(uri);
      const alt = data?.results?.channels?.[0]?.alternatives?.[0];
      const text = alt?.transcript?.trim() ?? '';

      setTranscript(text || null);
      setSentiments(data);
      if (callback) callback(text);
      return { text, data };
    } catch (e) {
      console.warn('onUpload error', e);
    } finally {
      setLoading(false);
      uploadingRef.current = false;
    }
  };

  return {
    // actions
    onStart,
    onStop,
    onStopAndUpload,
    onUpload,

    // state
    loading,
    transcript,
    sentiments,
    uri,
    recording,
  };
}
