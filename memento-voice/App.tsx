import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, Button, ActivityIndicator, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { Gyroscope } from 'expo-sensors';
import useRecordAudio from './features/sentimensRecognitions/useRecordAudio';
import { toAnalysis } from './utils/formatter';

import { useEmotionAnalysis } from './utils/useSetimentsDetectionByText';
import ArCameraScreen, { IdentifyResult } from './features/ar/ArCameraScreen';

const ROSTER = [
  { personId: '1', name: 'Sebastian', relationship: 'Your grandson, you love him' },
];

const NEGATIVE_LABELS = [
  'negative', 'anger', 'angry', 'sad', 'sadness', 'fear', 'anxiety', 'worry', 'stress', 'frustrat', 'depress'
];
const NEGATIVE_THRESHOLD = 0.6; 
const COOLDOWN_MS = 15_000; 

export default function App() {
  useKeepAwake();
  // Camera permission hook (Expo SDK 54/55+)
  const [camPerm, requestCamPerm] = useCameraPermissions();

  const [ready, setReady] = useState(false);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      // 1) Make sure iOS speaks even if the phone is on silent
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      // 2) Pick a concrete voice if available (prefer en-US)
      const voices = await Speech.getAvailableVoicesAsync();
      // console.log('voices', voices);
      const en = voices?.find(v => v.language?.startsWith('en-US')) 
              || voices?.find(v => v.language?.startsWith('en'));
      console.log('Selected TTS voice:', en);
      setVoiceId(en?.identifier);
      setReady(true);
    })();
  }, []);

  const speak = (text: string=  'Hello! Text-to-speech is working now.') => {
    Speech.stop(); // stop any previous utterance
    Speech.speak(text, {
      language: 'en-US',
      voice: voiceId,           // force a real voice
      pitch: 1.0,
      rate: 0.98,               // try 0.9 if it sounds too fast
      onDone: () => console.log('TTS done'),
      onStopped: () => console.log('TTS stopped'),
      onError: (e) => console.warn('TTS error', e),
    });
  };

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

  const analysis = useMemo(() => (sentiments ? toAnalysis(sentiments) : null), [sentiments]);
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


  const scheduleSpeakIntro = async () => {
    await new Promise((r) => setTimeout(r, 500));
    speak("Hi, I'm Memento. Tap the button and say something to get started.");
  }

  useEffect(() => {
    speak("Hi, I'm Memento. Tap the button and say something to get started.");
    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (error) {
        console.warn('Failed to lock orientation', error);
      }
      const mic = await Audio.requestPermissionsAsync();
      console.log('Mic permission:', mic);
      setHasMicPerm(mic.status === 'granted');
    })();
    Gyroscope.setUpdateInterval(150);
    const gyroSub = Gyroscope.addListener(({ x, y, z }) => {
      setTilt({ x, y, z });
    });
    scheduleSpeakIntro();
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      gyroSub.remove();
    };
  }, []);
  
  async function identify(_photoUri: string): Promise<IdentifyResult> {
    // TODO: replace with a real call. For now, randomly pick a known person with a confidence.
    await new Promise((r) => setTimeout(r, 200));
    return { name: 'Sebastian', relationship: 'Your grandson', confidence: 0.95};
  }


  const handleStopRecording = async () => {
    await onStopAndUpload((text)=>onTextReady(text));
  };

  const [personName, setPersonName] = useState<string>('');
  const [personRelationShip, setPersonRelationShip] = useState<string>('');
  const [showArScreen, setShowArScreen] = useState(false);
  const [tilt, setTilt] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const alignmentHint = useMemo(() => {
    const threshold = 0.18;
    if (Math.abs(tilt.y) > Math.abs(tilt.x) && Math.abs(tilt.y) > threshold) {
      return tilt.y > 0 ? 'Tilt Down Slightly' : 'Tilt Up Slightly';
    }
    if (Math.abs(tilt.x) > threshold) {
      return tilt.x > 0 ? 'Tilt Left Slightly' : 'Tilt Right Slightly';
    }
    return 'Hold Steady';
  }, [tilt]);
  
  const handleWhoAreYou = async () => {
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
      const result = await identify('');

      setStatus('speaking');
      if (!result) {
  
      } else if (result.confidence > 0.9) {
        setPersonName(result.name);
        setPersonRelationShip(result.relationship);
        speak(`This is ${result.name}, your ${result.relationship}.`);
      } else if (result.confidence > 0.75) {
        speak(`I think this is ${result.name}, your ${result.relationship}.`);
      }

      setStatus('cooldown');
      await new Promise((r) => setTimeout(r, 200));
     
      setStatus('idle');
    } catch (e: any) {
      console.warn(e);

      setStatus('idle');
    } finally {
      setBusy(false);
    }
  };

  const negativeCooldownRef = useRef<number>(0);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!ready || !dominant) return;

      const label = (dominant.label || '').toLowerCase();
      const score = dominant.score ?? 0;
      const isNegative = NEGATIVE_LABELS.some(k => label.includes(k));

      if (!isNegative || score < NEGATIVE_THRESHOLD) return;

      const now = Date.now();
      if (now - (negativeCooldownRef.current || 0) < COOLDOWN_MS) return;

      const speaking = await Speech.isSpeakingAsync();
      if (cancelled || speaking) return;

      negativeCooldownRef.current = now;
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}

      speak(supportiveMessageFor(label));
    })();

    return () => { cancelled = true; };
  }, [dominant, ready, voiceId]);

  function supportiveMessageFor(label: string) {
    const k = (label || '').toLowerCase();
    if (k.includes('anger') || k.includes('angry') || k.includes('frustrat')) {
      return "I hear frustration in your voice. Let's slow down together. Would you like a short breathing exercise?";
    }
    if (k.includes('sad') || k.includes('depress')) {
      return "I'm sorry you're feeling down. You're not alone—I'm here. Want to take a short break together?";
    }
    if (k.includes('fear') || k.includes('anxiety') || k.includes('worry') || k.includes('stress')) {
      return "It sounds like you're feeling anxious. Try a deep breath with me: in for 4, hold 4, out for 6.";
    }
    return "I'm hearing some tough feelings. I'm here with you. Would you like some help or a quick breathing exercise?";
  }

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
    <>
      <Modal visible={showArScreen} animationType="slide" presentationStyle="fullScreen">
        <ArCameraScreen
          onClose={() => setShowArScreen(false)}
          identify={identify}
        />
      </Modal>
      <SafeAreaView style={styles.container}>
     
      <View style={styles.header}>
        <Text style={styles.title}>Memento</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowArScreen(true)}
            style={styles.arBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.arBtnLabel}>AR mode</Text>
          </TouchableOpacity>
          <View style={styles.badge}><Text style={styles.badgeText}>{statusText}</Text></View>
        </View>
      </View>
      <View style={styles.cameraWrap}>
        <View style={styles.cameraInner}>
          <CameraView ref={camRef} style={{ flex: 1 }} facing="front" />
          {/* Framing corners overlay */}
          <View pointerEvents="none" style={styles.overlay}>
            <Corner style={{ top: 16, left: 16, transform: [{ rotate: '0deg' }] }} />
            <Corner style={{ top: 16, right: 16, transform: [{ rotate: '90deg' }] }} />
            <Corner style={{ bottom: 16, left: 16, transform: [{ rotate: '-90deg' }] }} />
            <Corner style={{ bottom: 16, right: 16, transform: [{ rotate: '180deg' }] }} />
          </View>
         { '' !== personName && '' !== personRelationShip && <View pointerEvents="none" style={styles.overlay}>
            <Corner style={{ color: 'yellow', top: 150, left: 150, transform: [{ rotate: '0deg' }] }} />
            <Corner style={{ color: 'yellow', top: 150, right: 100, transform: [{ rotate: '90deg' }] }} />
            <Corner style={{ color: 'yellow', bottom: 150, left: 150, transform: [{ rotate: '-90deg' }] }} />
            <Corner style={{ color: 'yellow', bottom: 150, right: 100, transform: [{ rotate: '180deg' }] }} />
          </View>}
          <View pointerEvents="none" style={styles.infoOverlay}>
            <View style={styles.crosshair}>
              <View style={styles.crosshairLineVertical} />
              <View style={styles.crosshairLineHorizontal} />
            </View>
            <Text style={styles.alignmentHint}>{alignmentHint}</Text>
            {'' !== personName && <Text style={styles.cameraText}>{personName}</Text>}
            {'' !== personRelationShip && <Text style={styles.cameraTextSecondary}>{personRelationShip}</Text>}
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
      <View style={styles.footerSpacer} />
    </SafeAreaView>
    </>
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    arBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#1E2B4D',
    },
    arBtnLabel: { color: '#B7C1D9', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
    badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    badgeText: { fontSize: 12, fontWeight: '600', color: 'white' },

    cameraWrap: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
    cameraInner: { flex: 1, borderRadius: 0, overflow: 'hidden', backgroundColor: '#050A16' },
    camera: { flex: 1 },
    overlay: {
      position: 'absolute',
      inset: 0,
      justifyContent: 'space-between',
    },
    infoOverlay: {
      position: 'absolute',
      top: '30%',
      left: 0,
      right: 0,
      alignItems: 'center',
      gap: 18,
    },
    crosshair: {
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 1,
      borderColor: '#FFFFFF33',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    crosshairLineVertical: {
      position: 'absolute',
      width: 2,
      height: '70%',
      backgroundColor: '#FFFFFF55',
    },
    crosshairLineHorizontal: {
      position: 'absolute',
      height: 2,
      width: '70%',
      backgroundColor: '#FFFFFF55',
    },
    alignmentHint: {
      color: '#D5E1FF',
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
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

    cameraText:  {
      backgroundColor: "rgba(0,0,0,0.55)",
      color: "white",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cameraTextSecondary: {
      backgroundColor: "rgba(0,0,0,0.45)",
      color: "#F1F5FF",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      fontSize: 20,
      fontWeight: '600',
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

    footerSpacer: { height: 12 },
    hint: { color: '#B7C1D9', textAlign: 'center' },
  });
