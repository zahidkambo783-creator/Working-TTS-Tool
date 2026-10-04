import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { WebSocket } from "ws";

// ──────────────────────────────────────────────────────────────
// Microsoft Edge TTS — complete working implementation with Clock Skew Fix
// ──────────────────────────────────────────────────────────────

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;

const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

const USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` +
  ` (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36` +
  ` Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`;

const WIN_EPOCH_S = 11644473600;
const BOUNDARY_TICKS = 3_000_000_000;

let clockSkewMs = 0;

/**
 * Sync clock with Microsoft to prevent 403 errors when local time is inaccurate.
 */
async function syncClock() {
  try {
    const res = await fetch(VOICE_LIST_URL, { method: "HEAD" });
    const serverDate = res.headers.get("date");
    if (serverDate) {
      const serverMs = new Date(serverDate).getTime();
      const localMs = Date.now();
      clockSkewMs = serverMs - localMs;
    }
  } catch (err) {
    // Ignore fetch errors, fallback to 0 skew
  }
}

/** Generate the Sec-MS-GEC anti-abuse token with adjusted server time */
function generateSecMsGec(): string {
  const adjustedNowS = Math.floor((Date.now() + clockSkewMs) / 1000);
  const ticksS = (adjustedNowS + WIN_EPOCH_S) * 10_000_000;
  const rounded = Math.floor(ticksS / BOUNDARY_TICKS) * BOUNDARY_TICKS;

  const input = `${rounded}${TRUSTED_CLIENT_TOKEN}`;
  return createHash("sha256").update(input).digest("hex").toUpperCase();
}

function uuid() {
  return crypto.randomUUID().replaceAll("-", "");
}

function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export interface TtsOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
}

export async function fetchVoices(): Promise<unknown[]> {
  await syncClock();
  
  const secMsGec = generateSecMsGec();
  const url = `${VOICE_LIST_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
  
  const resp = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!resp.ok) throw new Error(`Voice list fetch failed with status: ${resp.status}`);
  return resp.json();
}

export async function synthesize(text: string, opts: TtsOptions = {}): Promise<Buffer> {
  // Sync clock just before websocket generation
  await syncClock();

  const {
    voice = "en-US-AriaNeural",
    rate = "+0%",
    pitch = "+0Hz",
    volume = "+0%",
  } = opts;

  return new Promise<Buffer>((resolve, reject) => {
    const connectionId = uuid();
    const secMsGec = generateSecMsGec();

    // Microsoft recently moved the Sec-MS-GEC token to the Query String!
    const wsUrl = `${WSS_URL}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const audioChunks: Buffer[] = [];
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        reject(err);
      } else {
        resolve(Buffer.concat(audioChunks));
      }
    };

    timer = setTimeout(() => {
      ws.terminate();
      done(new Error("TTS request timed out (30s)"));
    }, 30_000);

    ws.on("open", () => {
      const speechConfig = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: false,
                wordBoundaryEnabled: false,
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      });

      const ts = new Date().toISOString();
      const configMsg =
        `X-Timestamp:${ts}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n${speechConfig}`;

      ws.send(configMsg, (configErr) => {
        if (configErr) return done(configErr);

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
          `${escapeXml(text)}` +
          `</prosody></voice></speak>`;

        const ssmlTs = new Date().toISOString();
        const ssmlMsg =
          `X-RequestId:${uuid()}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${ssmlTs}Z\r\n` +
          `Path:ssml\r\n\r\n${ssml}`;

        ws.send(ssmlMsg, (ssmlErr) => {
          if (ssmlErr) return done(ssmlErr);
        });
      });
    });

    ws.on("message", (rawData, isBinary) => {
      if (isBinary) {
        const buf = rawData as Buffer;
        const separator = Buffer.from("Path:audio\r\n");
        const idx = buf.indexOf(separator);
        if (idx !== -1) {
          audioChunks.push(buf.subarray(idx + separator.length));
        }
      } else {
        const msg = rawData.toString("utf8");
        if (msg.includes("Path:turn.end")) {
          ws.close(1000);
          done();
        }
      }
    });

    ws.on("error", (err) => done(err));

    ws.on("close", (code) => {
      if (!settled && code !== 1000) {
        done(new Error(`WebSocket closed unexpectedly with code ${code}`));
      }
    });
  });
}
