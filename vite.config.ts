import { spawn } from 'node:child_process';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const PHP_CGI = 'php-cgi';

function stripBase(pathname: string, base: string): string {
  const prefix = base.replace(/\/$/, '');
  if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return pathname.slice(prefix.length) || '/';
  }
  return pathname;
}

function createPhpMiddleware(docRoot: string, base: string) {
  const root = path.resolve(docRoot);

  return function phpMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): void {
    const rawUrl = req.url ?? '/';
    const parsed = new URL(rawUrl, 'http://127.0.0.1');
    const pathname = stripBase(decodeURIComponent(parsed.pathname), base);
    if (!pathname.endsWith('.php')) {
      next();
      return;
    }

    const rel = pathname.replace(/^\/+/, '');
    if (!rel || rel.split('/').some((part) => part === '..')) {
      next();
      return;
    }

    const script = path.resolve(root, rel);
    const relToRoot = path.relative(root, script);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot) || !fs.existsSync(script)) {
      next();
      return;
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      REDIRECT_STATUS: '200',
      GATEWAY_INTERFACE: 'CGI/1.1',
      SCRIPT_FILENAME: script,
      SCRIPT_NAME: pathname,
      PATH_INFO: '',
      REQUEST_METHOD: req.method ?? 'GET',
      QUERY_STRING: parsed.search.replace(/^\?/, ''),
      CONTENT_TYPE: String(req.headers['content-type'] ?? ''),
      CONTENT_LENGTH: String(req.headers['content-length'] ?? '0'),
      REQUEST_URI: rawUrl,
      DOCUMENT_ROOT: root,
      SERVER_PROTOCOL: 'HTTP/1.1',
      SERVER_SOFTWARE: 'vite-php-cgi',
      SERVER_NAME: '127.0.0.1',
      SERVER_PORT: String(req.socket.localPort ?? 5174),
      REMOTE_ADDR: req.socket.remoteAddress ?? '127.0.0.1',
      REMOTE_PORT: String(req.socket.remotePort ?? ''),
    };

    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      const header = Array.isArray(value) ? value.join(', ') : String(value);
      env[`HTTP_${key.toUpperCase().replace(/-/g, '_')}`] = header;
    }

    const php = spawn(PHP_CGI, [
      '-d', 'cgi.force_redirect=0',
      '-d', 'upload_max_filesize=16M',
      '-d', 'post_max_size=16M',
      '-f', script,
    ], {
      env,
      windowsHide: true,
    });

    let stdout = Buffer.alloc(0);
    let stderr = '';
    let settled = false;

    const fail = (code: number, message: string) => {
      if (settled || res.writableEnded) return;
      settled = true;
      res.statusCode = code;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(message);
    };

    php.stdout.on('data', (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
    });
    php.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    php.on('error', (err) => {
      fail(502, `php-cgi failed to start (${err.message}). Is PHP installed?`);
    });
    php.on('close', (code) => {
      if (settled || res.writableEnded) return;
      settled = true;
      if (code !== 0 && stdout.length === 0) {
        fail(502, stderr || `php-cgi exited ${code}`);
        return;
      }

      const text = stdout.toString('binary');
      const split = text.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
      const idx = text.indexOf(split);
      const head = idx === -1 ? '' : text.slice(0, idx);
      const body = Buffer.from(idx === -1 ? text : text.slice(idx + split.length), 'binary');

      let status = 200;
      for (const line of head.split(/\r?\n/)) {
        if (!line) continue;
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const name = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (name.toLowerCase() === 'status') {
          status = parseInt(value, 10) || status;
          continue;
        }
        if (name) res.setHeader(name, value);
      }
      res.statusCode = status;
      res.end(body);
    });

    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      req.pipe(php.stdin);
    } else {
      php.stdin.end();
    }
  };
}

function phpServer(): Plugin {
  return {
    name: 'php-cgi',
    configureServer(server) {
      server.middlewares.use(
        createPhpMiddleware(path.resolve(server.config.root, 'public'), server.config.base),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createPhpMiddleware(path.resolve(server.config.root, 'dist'), server.config.base),
      );
    },
  };
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function elevenLabsTts(apiKey: string): Plugin {
  const mount = (base: string, middlewares: { use: (fn: (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => void) => void }) => {
    middlewares.use(async (req, res, next) => {
      const rawUrl = req.url ?? '/';
      const parsed = new URL(rawUrl, 'http://127.0.0.1');
      const pathname = stripBase(decodeURIComponent(parsed.pathname), base);
      if (!pathname.startsWith('/api/tts/')) {
        next();
        return;
      }

      if (!apiKey) {
        sendJson(res, 503, { ok: false, error: 'ELEVENLABS_API_KEY missing (check .env.local)' });
        return;
      }

      const client = new ElevenLabsClient({ apiKey });
      const method = (req.method ?? 'GET').toUpperCase();

      try {
        if (method === 'GET' && pathname === '/api/tts/voices') {
          const page = await client.voices.getAll();
          const voices = (page.voices ?? [])
            .map((v) => ({
              id: String(v.voiceId ?? ''),
              name: String(v.name ?? '').trim() || String(v.voiceId ?? ''),
            }))
            .filter((v) => v.id)
            .sort((a, b) => a.name.localeCompare(b.name));
          sendJson(res, 200, { ok: true, voices });
          return;
        }

        if (method === 'POST' && pathname === '/api/tts/generate') {
          const raw = await readRequestBody(req);
          let payload: { text?: unknown; voiceId?: unknown } = {};
          try {
            payload = JSON.parse(raw.toString('utf8')) as typeof payload;
          } catch {
            sendJson(res, 400, { ok: false, error: 'invalid json' });
            return;
          }
          const text = typeof payload.text === 'string' ? payload.text.trim() : '';
          const voiceId = typeof payload.voiceId === 'string' ? payload.voiceId.trim() : '';
          if (!text) {
            sendJson(res, 400, { ok: false, error: 'text required' });
            return;
          }
          if (!voiceId || !/^[A-Za-z0-9]{10,64}$/.test(voiceId)) {
            sendJson(res, 400, { ok: false, error: 'voiceId required' });
            return;
          }
          if (text.length > 5000) {
            sendJson(res, 400, { ok: false, error: 'text too long' });
            return;
          }

          const stream = await client.textToSpeech.convert(voiceId, {
            text,
            modelId: 'eleven_v4',
          });
          const nodeStream = Readable.fromWeb(stream as import('node:stream/web').ReadableStream);
          const chunks: Buffer[] = [];
          for await (const chunk of nodeStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const audio = Buffer.concat(chunks);
          if (!audio.length) {
            sendJson(res, 502, { ok: false, error: 'empty audio' });
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Content-Length', String(audio.length));
          res.end(audio);
          return;
        }

        sendJson(res, 404, { ok: false, error: 'not found' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'tts failed';
        sendJson(res, 502, { ok: false, error: message });
      }
    });
  };

  return {
    name: 'elevenlabs-tts',
    configureServer(server) {
      mount(server.config.base, server.middlewares);
    },
    configurePreviewServer(server) {
      mount(server.config.base, server.middlewares);
    },
  };
}

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.ELEVENLABS_API_KEY ?? '';

  return {
    base: '/warchess/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [elevenLabsTts(apiKey), phpServer()],
    build: {
      sourcemap: false,
    },
    server: {
      port: 5174,
      strictPort: true,
    },
  };
});
