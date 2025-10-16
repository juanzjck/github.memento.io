import * as FileSystem from "expo-file-system/legacy";

// Adjust the URL for your Deepgram endpoint and params
const DEEPGRAM_URL =
  "https://api.deepgram.com/v1/listen?sentiment=true&language=en&model=nova-3";
const DEEPGRAM_TOKEN = "acbc56a6a7ddf95f9cfc9ddc5717ddc7082eea00";

/**
 * Upload and transcribe a local audio file stored on the device
 * @param fileUri e.g. `${FileSystem.documentDirectory}recording.wav`
 */
export async function transcribeLocalFile(fileUri: string) {
  try {
    // ensure file exists
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      throw new Error("Audio file not found: " + fileUri);
    }

    // build multipart/form-data body
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: "recording.wav",
      type: "audio/wav",
    } as any);

    // call Deepgram
    const response = await fetch(DEEPGRAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_TOKEN}`,
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    // parse result
    const result = await response.json();

    console.log("Transcription result:", result);
    return result;
  } catch (err) {
    console.error("transcribeLocalFile error:", err);
    throw err;
  }
}
