// RecordScreen.tsx
import React, { useState } from "react";
import { View, Text, Button, ActivityIndicator } from "react-native";
import { askMicPermission, startRecording, stopRecording  } from "./audio";
import { transcribeLocalFile } from "./deepgramClient";

export default function RecordScreen() {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [sentiments, setSentiments] = useState<any>(null);

  const onStart = async () => {
    await askMicPermission();
    await startRecording();
    setTranscript(null);
    setSentiments(null);
  };

  const onStop = async () => {
    const u = await stopRecording();
    setUri(u);
  };

  const onUpload = async () => {
    if (!uri) return;
    setLoading(true);
    try {
      const data = await transcribeLocalFile(uri);
      console.log('data get', JSON.stringify(data, null, 2));
      const alt = data?.results?.channels?.[0]?.alternatives?.[0];
      setTranscript(alt?.transcript ?? null);
      setSentiments(data?.results?.sentiments.average ?? null);
    } catch (e: any) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Button title="Start recording" onPress={onStart} />
      <Button title="Stop recording" onPress={onStop} />
      <Text  style={{ color: 'white' }}  selectable>File: {uri ?? "—"}</Text>
      <Button title="Upload to Deepgram" disabled={!uri || loading} onPress={onUpload} />
      {loading && <ActivityIndicator />}
      {transcript && (
        <>
          <Text style={{ fontWeight: "bold", color: 'white' }}>Transcript</Text>
          <Text style={{ color: 'white' }}  selectable>{transcript}</Text>
        </>
      )}
      {sentiments && (
        <>
          <Text style={{ fontWeight: "bold", color: 'white' }}>Sentiments</Text>
          <Text  style={{ color: 'white' }} selectable>{JSON.stringify(sentiments, null, 2)}</Text>
        </>
      )}
    </View>
  );
}
