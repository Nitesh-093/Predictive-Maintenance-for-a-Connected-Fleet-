/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { spawn, ChildProcess } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config();
// Ensure Vite HMR is disabled in dev server to avoid broken WebSocket attempts in iframe/Cloud Run
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;
const PYTHON_PORT = Number(process.env.PYTHON_PORT) || 5001;

app.use(express.json({ limit: '20mb' }));

// Shared Gemini client for Live WebSocket bridge
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ==========================================
// Python Backend Process Lifecycle Manager
// ==========================================
let pythonProcess: ChildProcess | null = null;
let isShuttingDown = false;

function startPythonBackend() {
  if (isShuttingDown) return;

  const pythonScript = path.resolve(__dirname, 'backend', 'server.py');
  console.log(`[PythonHost] Launching Python 3 Backend: ${pythonScript} (port: ${PYTHON_PORT})...`);

  pythonProcess = spawn('python3', [pythonScript, '--port', String(PYTHON_PORT)], {
    env: {
      ...process.env,
      PYTHON_PORT: String(PYTHON_PORT),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProcess.stdout?.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[PythonOut] ${text}`);
  });

  pythonProcess.stderr?.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.error(`[PythonErr] ${text}`);
  });

  pythonProcess.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    console.warn(`[PythonHost] Python backend exited (code=${code}, signal=${signal}). Restarting in 2s...`);
    pythonProcess = null;
    setTimeout(startPythonBackend, 2000);
  });

  pythonProcess.on('error', (err) => {
    console.error('[PythonHost] Failed to start Python backend process:', err);
  });
}

// Start Python backend on boot
startPythonBackend();

function cleanupPython() {
  isShuttingDown = true;
  if (pythonProcess) {
    console.log('[PythonHost] Terminating Python backend process...');
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
}

process.on('exit', cleanupPython);
process.on('SIGINT', () => {
  cleanupPython();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupPython();
  process.exit(0);
});

// ==========================================
// HTTP Proxy to Python Backend Services
// ==========================================
app.use('/api', (req, res) => {
  const targetPath = req.originalUrl || req.url;
  const isPostOrPut = ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase());
  const bodyData = isPostOrPut && req.body ? JSON.stringify(req.body) : null;

  const headers: Record<string, string> = {
    'host': `127.0.0.1:${PYTHON_PORT}`,
    'accept': 'application/json, text/plain, */*',
  };

  if (bodyData) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(bodyData).toString();
  }

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: PYTHON_PORT,
      path: targetPath,
      method: req.method,
      headers,
      timeout: 30000,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.warn(`[ProxyWarn] Forwarding ${req.method} ${targetPath} to Python backend failed:`, err.message);
    res.status(503).json({
      error: 'Python backend initializing or unavailable',
      pythonPort: PYTHON_PORT,
      details: err.message,
    });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Gateway timeout waiting for Python backend response' });
  });

  if (bodyData) {
    proxyReq.write(bodyData);
  }
  proxyReq.end();
});

// ==========================================
// WebSocket Bridges
// ==========================================
const wss = new WebSocketServer({ noServer: true });
const viteHmrWss = new WebSocketServer({ noServer: true });

viteHmrWss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({ type: 'connected' }));
  } catch {
    // client disconnected before initial payload
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // ignore
    }
  });

  ws.on('error', () => {
    // silent
  });
});

server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
  if (pathname === '/api/live' || pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    viteHmrWss.handleUpgrade(request, socket, head, (ws) => {
      viteHmrWss.emit('connection', ws, request);
    });
  }
});

wss.on('connection', async (clientWs: WebSocket) => {
  let liveSession: any = null;

  try {
    liveSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are the voice assistant for the Connected Fleet Predictive Maintenance platform.
You analyze connected heavy haul trucks, transit buses, and industrial compressors streaming vibration, temperature, motor current, pressure, and RPM.
Answer questions about machine health, remaining useful life, and work orders in a concise, conversational manner.`,
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text);
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio, text: textPart?.text }));
          }
          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      },
    });

    clientWs.on('message', (data: Buffer | string) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
        if (parsed.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: parsed.text,
          });
        }
      } catch (err) {
        console.error('Error forwarding message to Live API:', err);
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // session closed
        }
      }
    });
  } catch (err: any) {
    console.error('Failed to connect to gemini-3.8-live:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err.message || 'Live session initialization failed' }));
      clientWs.close();
    }
  }
});

// ==========================================
// Vite / Static Server Mount
// ==========================================
async function setupServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Predictive Maintenance Fleet Server listening on http://0.0.0.0:${PORT}`);
    console.log(`Backend APIs powered by Python 3.10 microservice on http://127.0.0.1:${PYTHON_PORT}`);
  });
}

setupServer();
