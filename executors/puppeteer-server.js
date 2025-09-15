#!/usr/bin/env node
// Minimal Playwright-based HTTP executor for URL visit
// POST /visit { url: string, timeoutMs?: number }

const http = require('http');
const { URL } = require('url');
let playwright;

const PORT = Number(process.env.PUPPETEER_EXECUTOR_PORT || process.env.PW_EXECUTOR_PORT || 8081);
const MAX_CONCURRENCY = Number(process.env.PUPPETEER_MAX_CONCURRENCY || 3);
const RL_LIMIT = Number(process.env.PUPPETEER_RL_LIMIT || 60); // requests per window
const RL_WINDOW_MS = Number(process.env.PUPPETEER_RL_WINDOW_MS || 60000);
const QUEUE_MAX = Number(process.env.PUPPETEER_QUEUE_MAX || 50);
const QUEUE_WAIT_TIMEOUT_MS = Number(process.env.PUPPETEER_QUEUE_WAIT_TIMEOUT_MS || 10000);
// circuit breaker
const CB_THRESHOLD = Number(process.env.PUPPETEER_CB_THRESHOLD || 20);
const CB_WINDOW_MS = Number(process.env.PUPPETEER_CB_WINDOW_MS || 60000);
const CB_COOLDOWN_MS = Number(process.env.PUPPETEER_CB_COOLDOWN_MS || 30000);

let inFlight = 0;
let rlCount = 0;
let rlWindowStart = Date.now();
let queue = [];
let cbFailures = 0;
let cbWindowStart = Date.now();
let circuitState = 'closed'; // 'closed' | 'open' | 'half_open'
let circuitOpenUntil = 0;
// metrics
let total = 0, success = 0, failure = 0;
const classCounts = Object.create(null);
const lastLatencies = [];
const LAT_WIN = Number(process.env.PUPPETEER_METRICS_LAT_WIN || 200);
const HOST = '127.0.0.1';

async function ensurePlaywright() {
  if (!playwright) {
    try {
      playwright = require('playwright');
    } catch (e) {
      console.error('[executor] Failed to load playwright:', e && e.message);
      throw e;
    }
  }
}

function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function handleVisit(body) {
  // circuit breaker
  const nowCircuit = Date.now();
  if (circuitState === 'open') {
    if (nowCircuit >= circuitOpenUntil) {
      circuitState = 'half_open';
    } else {
      return { status: 503, json: { classification: 'circuit_open', message: 'executor circuit open' } };
    }
  }
  // rate limit (fixed window)
  const now = Date.now();
  if (now - rlWindowStart >= RL_WINDOW_MS) {
    rlWindowStart = now; rlCount = 0;
  }
  if (rlCount >= RL_LIMIT) {
    const reset = Math.ceil((rlWindowStart + RL_WINDOW_MS - now) / 1000);
    return { status: 429, headers: {
      'x-ratelimit-limit': String(RL_LIMIT),
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor((rlWindowStart + RL_WINDOW_MS)/1000)),
      'retry-after': String(reset)
    }, json: { classification: 'rate_limited', message: 'Too many requests' } };
  }
  // concurrency guard with simple queue
  if (inFlight >= MAX_CONCURRENCY) {
    if (queue.length >= QUEUE_MAX) {
      return { status: 429, json: { classification: 'busy_queue', message: 'Executor queue full' } };
    }
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        const idx = queue.indexOf(resolve);
        if (idx >= 0) queue.splice(idx, 1);
        reject(new Error('queue timeout'));
      }, QUEUE_WAIT_TIMEOUT_MS);
      const wrapped = () => { clearTimeout(to); resolve(); };
      queue.push(wrapped);
    }).catch(() => ({ timeout: true }));
    if (inFlight >= MAX_CONCURRENCY) {
      return { status: 429, json: { classification: 'busy', message: 'Executor busy' } };
    }
  }
  rlCount++;
  inFlight++;
  await ensurePlaywright();
  const url = body && body.url;
  const timeoutMs = Math.max(1000, Math.min(60000, Number(body && body.timeoutMs) || 15000));
  if (!url) {
    return { status: 400, json: { classification: 'validation_error', message: 'url required' } };
  }
  try {
    new URL(url);
  } catch {
    return { status: 400, json: { classification: 'validation_error', message: 'invalid url' } };
  }
  let browser; let context; let page;
  const t0 = Date.now();
  try {
    browser = await playwright.chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    const title = await page.title().catch(() => '');
    const dur = Date.now() - t0;
    recordMetrics(true, 'success', dur);
    if (circuitState === 'half_open') { circuitState = 'closed'; cbFailures = 0; cbWindowStart = Date.now(); }
    return { status: 200, json: { classification: 'success', title, durationMs: dur } };
  } catch (e) {
    const msg = String(e && e.message || 'error');
    const classification = /timeout/i.test(msg) ? 'timeout' : 'upstream_error';
    recordMetrics(false, classification, Date.now() - t0);
    onFailureForCircuit();
    return { status: 502, json: { classification, message: msg } };
  } finally {
    inFlight--;
    const next = queue.shift();
    if (next) setImmediate(next);
    try { if (page) await page.close(); } catch {}
    try { if (context) await context.close(); } catch {}
    try { if (browser) await browser.close(); } catch {}
  }
}

function recordMetrics(ok, cls, latency) {
  total++; if (ok) success++; else failure++;
  classCounts[cls] = (classCounts[cls] || 0) + 1;
  lastLatencies.push(latency);
  if (lastLatencies.length > LAT_WIN) lastLatencies.shift();
}

function p95(arr) {
  if (!arr.length) return 0;
  const a = Array.from(arr).sort((a,b)=>a-b);
  const idx = Math.min(a.length-1, Math.floor(0.95 * a.length));
  return a[idx];
}

function onFailureForCircuit() {
  const now = Date.now();
  if (now - cbWindowStart >= CB_WINDOW_MS) { cbWindowStart = now; cbFailures = 0; }
  cbFailures++;
  if (circuitState === 'closed' && cbFailures >= CB_THRESHOLD) {
    circuitState = 'open';
    circuitOpenUntil = now + CB_COOLDOWN_MS;
    console.error(JSON.stringify({ type: 'circuit', state: 'open', failures: cbFailures, ts: now }));
  } else if (circuitState === 'half_open') {
    circuitState = 'open';
    circuitOpenUntil = now + CB_COOLDOWN_MS;
    console.error(JSON.stringify({ type: 'circuit', state: 'reopen', ts: now }));
  }
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  if (method === 'GET' && url === '/health') {
    const body = { status: 'ok', inFlight, queueLength: queue.length, circuit: circuitState };
    res.writeHead(circuitState === 'open' ? 503 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }
  if (method === 'POST' && url === '/visit') {
    try {
      const body = await parseJSON(req);
      const result = await handleVisit(body);
      const headers = Object.assign({ 'content-type': 'application/json' }, result.headers || {});
      res.writeHead(result.status, headers);
      res.end(JSON.stringify(result.json));
    } catch (e) {
      const msg = String(e && e.message || 'internal error');
      const classification = /timeout/i.test(msg) ? 'timeout' : 'network_error';
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ classification, message: msg }));
    }
    return;
  }
  if (method === 'GET' && url === '/metrics') {
    const body = { total, success, failure, classifications: classCounts, p95: p95(lastLatencies), inFlight, queueLength: queue.length };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: 'not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[executor] Playwright server listening on http://${HOST}:${PORT} (concurrency=${MAX_CONCURRENCY}, rl=${RL_LIMIT}/${RL_WINDOW_MS}ms)`);
});
