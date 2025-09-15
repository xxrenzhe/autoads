#!/usr/bin/env node
// Minimal AdsCenter update executor over HTTP
// POST /update { link: string }

const http = require('http');
const { URL } = require('url');
const PORT = Number(process.env.ADSCENTER_EXECUTOR_PORT || 8082);
const MAX_CONCURRENCY = Number(process.env.ADSCENTER_MAX_CONCURRENCY || 5);
const RL_LIMIT = Number(process.env.ADSCENTER_RL_LIMIT || 120);
const RL_WINDOW_MS = Number(process.env.ADSCENTER_RL_WINDOW_MS || 60000);
const QUEUE_MAX = Number(process.env.ADSCENTER_QUEUE_MAX || 100);
const QUEUE_WAIT_TIMEOUT_MS = Number(process.env.ADSCENTER_QUEUE_WAIT_TIMEOUT_MS || 10000);
// circuit breaker
const CB_THRESHOLD = Number(process.env.ADSCENTER_CB_THRESHOLD || 50);
const CB_WINDOW_MS = Number(process.env.ADSCENTER_CB_WINDOW_MS || 60000);
const CB_COOLDOWN_MS = Number(process.env.ADSCENTER_CB_COOLDOWN_MS || 30000);

let inFlight = 0;
let rlCount = 0;
let rlWindowStart = Date.now();
let queue = [];
let cbFailures = 0;
let cbWindowStart = Date.now();
let circuitState = 'closed';
let circuitOpenUntil = 0;
// metrics
let total = 0, success = 0, failure = 0;
const classCounts = Object.create(null);
const lastLatencies = [];
const LAT_WIN = Number(process.env.ADSCENTER_METRICS_LAT_WIN || 200);
const HOST = '127.0.0.1';

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

async function handleUpdate(body) {
  const nowCircuit = Date.now();
  if (circuitState === 'open') {
    if (nowCircuit >= circuitOpenUntil) { circuitState = 'half_open'; } else {
      return { status: 503, json: { classification: 'circuit_open', message: 'executor circuit open' } };
    }
  }
  const now = Date.now();
  if (now - rlWindowStart >= RL_WINDOW_MS) { rlWindowStart = now; rlCount = 0; }
  if (rlCount >= RL_LIMIT) {
    const reset = Math.ceil((rlWindowStart + RL_WINDOW_MS - now) / 1000);
    return { status: 429, headers: {
      'x-ratelimit-limit': String(RL_LIMIT),
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor((rlWindowStart + RL_WINDOW_MS)/1000)),
      'retry-after': String(reset)
    }, json: { classification: 'rate_limited', message: 'Too many requests' } };
  }
  if (inFlight >= MAX_CONCURRENCY) {
    if (queue.length >= QUEUE_MAX) { return { status: 429, json: { classification: 'busy_queue', message: 'Executor queue full' } }; }
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => { const idx = queue.indexOf(resolve); if (idx>=0) queue.splice(idx,1); reject(new Error('queue timeout')); }, QUEUE_WAIT_TIMEOUT_MS);
      const wrapped = () => { clearTimeout(to); resolve(); };
      queue.push(wrapped);
    }).catch(() => ({ timeout: true }));
    if (inFlight >= MAX_CONCURRENCY) { return { status: 429, json: { classification: 'busy', message: 'Executor busy' } }; }
  }
  rlCount++; inFlight++;
  const link = body && body.link;
  if (!link) {
    inFlight--; return { status: 400, json: { classification: 'validation_error', message: 'link required' } };
  }
  try { new URL(link); } catch {
    inFlight--; return { status: 400, json: { classification: 'validation_error', message: 'invalid link' } };
  }
  // NOTE: Real implementation should call Ads APIs / proxies.
  // Here we simulate success fast; extend as needed.
  const t0 = Date.now();
  setTimeout(() => { inFlight--; const next=queue.shift(); if (next) setImmediate(next); }, 10);
  total++; success++; classCounts['success'] = (classCounts['success']||0)+1; lastLatencies.push(Date.now()-t0); if (lastLatencies.length>LAT_WIN) lastLatencies.shift();
  if (circuitState==='half_open') { circuitState='closed'; cbFailures=0; cbWindowStart=Date.now(); }
  return { status: 200, json: { classification: 'success' } };
}

function p95(arr) {
  if (!arr.length) return 0;
  const a = Array.from(arr).sort((a,b)=>a-b);
  const idx = Math.min(a.length-1, Math.floor(0.95 * a.length));
  return a[idx];
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  if (method === 'GET' && url === '/health') {
    const body = { status: 'ok', inFlight, queueLength: queue.length, circuit: circuitState };
    res.writeHead(circuitState === 'open' ? 503 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }
  if (method === 'POST' && url === '/update') {
    try {
      const body = await parseJSON(req);
      const result = await handleUpdate(body);
      const headers = Object.assign({ 'content-type': 'application/json' }, result.headers || {});
      res.writeHead(result.status, headers);
      res.end(JSON.stringify(result.json));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ classification: 'upstream_error', message: String(e && e.message || 'error') }));
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
  console.log(`[executor] AdsCenter update server listening on http://${HOST}:${PORT}`);
});
