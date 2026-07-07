import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

export async function synthesizeBriefWithTimestamps(fullText) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

  if (!apiKey || !voiceId) {
    throw new Error('ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID mangler i .env');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text: fullText,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const audioBuffer = Buffer.from(json.audio_base64, 'base64');
  const filename = `brief-${Date.now()}.mp3`;
  await writeFile(path.join(AUDIO_DIR, filename), audioBuffer);

  return {
    audioUrl: `/audio/${filename}`,
    alignment: json.alignment,
  };
}
