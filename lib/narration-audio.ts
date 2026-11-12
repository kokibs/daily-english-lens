import WebSocket from "ws";
import { textForNarration } from "./narration-text";

const SAMPLE_RATE = 24_000;
const MAX_AUDIO_BYTES = 4_000_000;
const MODEL = "gpt-realtime-2.1-mini";
const VOICE = "marin";

export function pcmToWav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function generateNarrationAudio(text: string, apiKey: string, safetyId: string, signal?: AbortSignal) {
  return new Promise<Buffer>((resolve, reject) => {
    const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": safetyId,
      },
    });
    const chunks: Buffer[] = [];
    let audioBytes = 0;
    let requested = false;
    let settled = false;
    const timeout = setTimeout(() => finish(new Error("音声の生成がタイムアウトしました。")), 50_000);

    function finish(error?: Error, audio?: Buffer) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      if (socket.readyState === WebSocket.CONNECTING) socket.terminate();
      else if (socket.readyState === WebSocket.OPEN) socket.close();
      if (error) reject(error);
      else if (audio) resolve(audio);
      else reject(new Error("音声を生成できませんでした。"));
    }

    function onAbort() {
      finish(new Error("音声の生成が中断されました。"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();

    socket.on("open", () => {
      if (settled) return;
      socket.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          model: MODEL,
          instructions: "Read the supplied English diary aloud exactly as written. Do not add, omit, or paraphrase words. Speak naturally and calmly in American English.",
          output_modalities: ["audio"],
          audio: { output: { format: { type: "audio/pcm", rate: SAMPLE_RATE }, voice: VOICE, speed: 0.95 } },
        },
      }));
    });

    socket.on("message", (raw) => {
      if (settled) return;
      let event: { type?: string; delta?: string; transcript?: string; error?: { message?: string }; response?: { status?: string; status_details?: { error?: { message?: string } } } };
      try {
        event = JSON.parse(raw.toString());
      } catch {
        finish(new Error("音声の応答を読み取れませんでした。"));
        return;
      }
      if (event.type === "session.updated" && !requested) {
        requested = true;
        socket.send(JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            input: [{ type: "message", role: "user", content: [{ type: "input_text", text: textForNarration(text) }] }],
            output_modalities: ["audio"],
            instructions: "Read only the English text in the user message, word for word. Do not explain, summarize, or change it.",
          },
        }));
      } else if (event.type === "response.output_audio.delta" && event.delta) {
        const chunk = Buffer.from(event.delta, "base64");
        audioBytes += chunk.length;
        if (audioBytes > MAX_AUDIO_BYTES) {
          finish(new Error("音声が長すぎます。"));
          return;
        }
        chunks.push(chunk);
      } else if (event.type === "response.done") {
        if (event.response?.status !== "completed" || audioBytes === 0) {
          finish(new Error(event.response?.status_details?.error?.message ?? "音声を生成できませんでした。"));
          return;
        }
        finish(undefined, pcmToWav(Buffer.concat(chunks, audioBytes)));
      } else if (event.type === "error") {
        finish(new Error(event.error?.message ?? "音声を生成できませんでした。"));
      }
    });

    socket.on("error", () => finish(new Error("音声サービスに接続できませんでした。")));
    socket.on("close", () => {
      if (!settled) finish(new Error("音声サービスとの接続が切れました。"));
    });
  });
}
