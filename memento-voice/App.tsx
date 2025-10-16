import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, Button, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import RecordScreen from './features/sentimensRecognitions/recordAudioSentiments';
import useRecordAudio from './features/sentimensRecognitions/useRecordAudio';
import { toAnalysis } from './utils/formatter';
import { useOpenAIEmotions } from './utils/useOpenAIEmotions';
import { useEmotionAnalysis } from './utils/useSetimentsDetectionByText';
import { stopRecording } from './features/sentimensRecognitions/audio';
import { delay } from 'react-native/types_generated/Libraries/Animated/AnimatedExports';
const ROSTER = [
  { personId: '1', name: 'Sebastian', relationship: 'Your grandson, you love him' },
/*   { personId: '2', name: 'Emilia', relationship: "sebastian's girlfriend" },
  { personId: '3', name: 'JP Morgan', relationship: 'friend' }, */
];

type IdentifyResult = { name: string; relationship: string; confidence: number } | null;
function speak(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', pitch: 1.0, rate: 0.98 });
}

export default function App() {
  // Camera permission hook (Expo SDK 54/55+)
  const [camPerm, requestCamPerm] = useCameraPermissions();


 
  // Mic permission hook (expo-av 14+)
  const [micPerm, requestMicPerm] = Audio.usePermissions();
  const [busy, setBusy] = useState(false);
  const camRef = useRef<CameraView>(null);
  const [hasMicPerm, setHasMicPerm] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'capturing' | 'identifying' | 'speaking' | 'cooldown'>('idle');
  const statusText = useMemo(() => {
    switch (status) {
      case 'idle': return 'Idle';
      case 'listening': return 'Listening…';
      case 'capturing': return 'Capturing…';
      case 'identifying': return 'Identifying…';
      case 'speaking': return 'Speaking…';
      case 'cooldown': return 'Please wait…';
    }
  }, [status]);

  //Record Audio
  const { 
    onUpload,
    onStopAndUpload,
    onStart,
    loading,
    transcript,
    sentiments,
    uri,
    recording,
  } = useRecordAudio();

  const analysis = useMemo(()=> toAnalysis(sentiments), [sentiments]);
  const [ textAnalysis, setTextAnalysis] = useState<{ emotions: any; reactions: any; raw: any } | null>(null);
  const { analyzeText, loading: aiLoading, error: aiError } =
  useEmotionAnalysis();

  // wherever you finish recording and obtain `transcript`:
  async function onTextReady(transcript: string) {
    const out = await analyzeText(transcript);
    console.log('Text analysis output:', out);
    if (out) setTextAnalysis(out);
  }

  const dominant = useMemo(() => {
    if (!analysis?.sentiments?.length) return null;
    return [...analysis.sentiments].sort((a, b) => b.score - a.score)[0];
  }, [analysis]);

  useEffect(() => {
    speak("Hi, I'm Memento. Tap the button and say something to get started.");
    (async () => {
      const mic = await Audio.requestPermissionsAsync();
      setHasMicPerm(mic.status === 'granted');
    })();
  }, []);
  
  async function identify(_photoUri: string): Promise<IdentifyResult> {
    // TODO: replace with a real call. For now, randomly pick a known person with a confidence.
    await new Promise((r) => setTimeout(r, 600));
    const pick = ROSTER[Math.floor(Math.random() * ROSTER.length)];
    const confidence = 0.72 + Math.random() * 0.25; // 0.72–0.97
    return { name: pick.name, relationship: pick.relationship, confidence };
  }


  const handleStopRecording = async () => {
    await onStopAndUpload((text)=>onTextReady(text));
  };

  
  const handleWhoAreYou = useCallback(async () => {
    setBusy(true);
    try {
      setStatus('listening');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // In this starter we skip ASR and go straight to capture + identify.
      setStatus('capturing');
      if (!camRef.current) {
        throw new Error('Camera is not ready.');
      }
      const photo = await camRef.current.takePictureAsync({ quality: 0.5, base64: false, skipProcessing: true });

      setStatus('identifying');
      const result = await identify(photo.uri);

      setStatus('speaking');
      if (!result) {
        speak("I'm not sure yet. Do you want to save this person?");
      } else if (result.confidence > 0.9) {
        speak(`This is ${result.name}, your ${result.relationship}.`);
      } else if (result.confidence > 0.75) {
        speak(`I think this is ${result.name}, your ${result.relationship}.`);
      } else {
        speak("I'm not sure yet. Do you want to save this person?");
      }

      setStatus('cooldown');
      await new Promise((r) => setTimeout(r, 1200));
      setStatus('idle');
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Oops', e?.message ?? 'Something went wrong capturing/identifying.');
      setStatus('idle');
    } finally {
      setBusy(false);
    }
  }, [ busy]);


  // 1) Hooks not ready yet? Show a spinner ONCE, don't request here.
  if (!camPerm || !micPerm) {
    return (
      <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator />
        <Text>Checking permissions…</Text>
      </SafeAreaView>
    );
  }

  // 2) Camera not granted → ask with a button (no loops)
  if (!camPerm.granted) {
    return (
      <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24}}>
        <Text style={{textAlign: 'center', marginBottom: 12}}>
          Memento needs camera access to recognize faces.
        </Text>
        <Button title="Enable Camera" onPress={requestCamPerm} />
        {!camPerm.canAskAgain && (
          <Text style={{marginTop: 10, textAlign: 'center'}}>
            Permission is blocked. Enable it in Settings.
          </Text>
        )}
      </SafeAreaView>
    );
  }

  // 3) Mic not granted → ask with a button (no loops)
  if (!micPerm.granted) {
    return (
      <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24}}>
        <Text style={{textAlign: 'center', marginBottom: 12}}>
          Memento needs microphone access for voice prompts.
        </Text>
        <Button title="Enable Microphone" onPress={requestMicPerm} />
        {!micPerm.canAskAgain && (
          <Text style={{marginTop: 10, textAlign: 'center'}}>
            Permission is blocked. Enable it in Settings.
          </Text>
        )}
      </SafeAreaView>
    );
  }


  // 4) Both granted → render the app
  return (
    <SafeAreaView style={styles.container}>
     
      <View style={styles.header}>
        <Text style={styles.title}>Memento</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{statusText}</Text></View>
      </View>
      <View style={styles.cameraWrap}>
        <View style={styles.cameraInner}>
          <CameraView ref={camRef} style={styles.camera} facing="back" />
          {/* Framing corners overlay */}
          <View pointerEvents="none" style={styles.overlay}>
            <Corner style={{ top: 16, left: 16, transform: [{ rotate: '0deg' }] }} />
            <Corner style={{ top: 16, right: 16, transform: [{ rotate: '90deg' }] }} />
            <Corner style={{ bottom: 16, left: 16, transform: [{ rotate: '-90deg' }] }} />
            <Corner style={{ bottom: 16, right: 16, transform: [{ rotate: '180deg' }] }} />
          </View>
        </View>
      </View>
      {/* Sentiment Panel (visible after analysis) */}
      {analysis?.sentiments?.length ? (
        <View style={styles.panel}>
          {dominant && (
            <View style={styles.dominantRow}>
              <Text style={styles.dominantEmoji}>{emojiFor(dominant.label)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dominantLabel}>{dominant.label}</Text>
                <Text style={styles.dominantConf}>{Math.round(dominant.score * 100)}% confidence</Text>
              </View>
            </View>
          )}

          <View style={styles.bars}>
            {analysis.sentiments.slice(0, 5).map((s) => (
              <Bar key={s.label} label={s.label} value={s.score} />
            ))}
          </View>

          {!!textAnalysis && (
            <Text style={styles.summary} numberOfLines={2}>
              {textAnalysis.emotions.map((e: any) => `${emojiFor(e)} ${e})`).join(' · ')}
            </Text>
          )}
        </View>
      ) : (
          <Text style={{ color: '#FFB4C0', textAlign: 'center' }}>
            No speech detected. Try speaking closer to the mic.
          </Text>
      )}
      <View style={styles.footer}>
       {
       !recording && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.talkBtn, busy && { opacity: 0.6 }]}
            onPress={onStart}
            disabled={busy}
          >
            <Text style={styles.talkLabel}>{busy || loading ? 'Working…' : 'Speak'}</Text>
          </TouchableOpacity>
        )
       }
       {
        recording && 
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.talkBtn, busy && { opacity: 0.6 }]}
            onPress={handleStopRecording}
            disabled={busy}
          >
            <Text style={styles.talkLabel}>{busy ? 'Working…' : 'Stop record'}</Text>
          </TouchableOpacity>
       }
        <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.talkBtn, busy && { opacity: 0.6 }]}
            onPress={handleStopRecording}
            disabled={busy}
          >
        <Text style={styles.hint}>Point the camera at a person.</Text>
        </TouchableOpacity>
      </View> 
    </SafeAreaView>
  );
}



function emojiFor(label: string) {
  if (!label) return '';
  console.log('Mapping label to emoji:', label);
  const k = label?.toLowerCase();
  if (k.includes('joy') || k.includes('happy') || k.includes('calm') ||  k.includes('positive')) return '🙂';
  if (k.includes('love')) return '🥰';
  if (k.includes('surprise')) return '😮';
  if (k.includes('anger') || k.includes('angry')) return '😠';
  if (k.includes('fear') || k.includes('anxiety') ||  k.includes('negative')) return '😟';
  if (k.includes('sad')) return '😢';
  if (k.includes('confus')) return '😕';
  return '🧠';
}

function hueFor(label: string) {
  // Stable hue mapping by label
  const h = Math.abs([...label].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  return `hsl(${h} 70% 55%)`;
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: hueFor(label) }]} />
      </View>
      <Text style={styles.barPct}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function Corner({ style }: { style?: any }) {
  return <View style={[styles.corner, style]} />;
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: 'white', fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  cameraWrap: { flex: 1, marginHorizontal: 16, marginBottom: 12 },
  cameraInner: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#050A16' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'space-between',
  },

  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFFFFF55',
  },

  panel: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0E1A33',
    borderWidth: 1,
    borderColor: '#1E2B4D',
  },

  dominantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dominantEmoji: { fontSize: 26 },
  dominantLabel: { color: 'white', fontSize: 16, fontWeight: '700' },
  dominantConf: { color: '#A9B8DA', fontSize: 12, marginTop: 2 },

  bars: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { color: '#D7E1FF', width: 88, fontSize: 12 },
  barTrack: { flex: 1, height: 10, backgroundColor: '#14254A', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },

  barPct: { color: '#9FB4FF', width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },

  summary: { color: '#BFD0FF', marginTop: 10, fontSize: 12 },

  footer: { padding: 20, gap: 10 },
  talkBtn: {
    backgroundColor: '#3461FF',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  talkLabel: { color: 'white', fontSize: 18, fontWeight: '700' },

  stopBtn: {
    backgroundColor: '#ED3B58',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  stopLabel: { color: 'white', fontSize: 18, fontWeight: '700' },

  hint: { color: '#B7C1D9', textAlign: 'center' },
});