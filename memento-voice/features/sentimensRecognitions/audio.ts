// audio.ts
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export async function askMicPermission() {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== "granted") throw new Error("Microphone permission not granted");
}

// audio.ts (continued)
let recording: Audio.Recording | null = null;

export async function startRecording() {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY // produces .m4a on iOS/Android
  );
  await recording.startAsync();
}

export async function stopRecording(): Promise<string> {
  let uri =''
  if (!recording) throw new Error("No active recording");
  await recording.stopAndUnloadAsync();
  const maybeUri = recording.getURI(); // e.g. "file:///…/recording.m4a"
  recording = null;
  if (!maybeUri) throw new Error("No recording URI");
  uri = maybeUri;
  console.log("Recording stopped and stored at", uri);
  return uri;
}
