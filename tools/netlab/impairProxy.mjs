#!/usr/bin/env node
/**
 * TCP impairing proxy for Socket.IO (ordered, reliable).
 *
 * Each direction is ONE FIFO queue drained by a single timer. Chunks are never
 * scheduled with independent setTimeouts — that reorders equal-deadline bytes
 * and produces seq gaps a real TCP path cannot.
 *
 * "Loss" is an extra stall on that chunk, not a drop (TCP does not drop bytes
 * and continue; a loss-like event is head-of-line delay).
 *
 * Usage:
 *   node tools/netlab/impairProxy.mjs --listen 3999 --target 3001 \
 *     --delay 60 --jitter 20 --stall-every 5000 --stall 250 --loss 0
 *
 * --delay / --jitter are one-way milliseconds. Symmetric RTT ≈ 2 * delay.
 */

import net from "node:net";

export function parseProxyArgs(argv = process.argv.slice(2)) {
  const opts = {
    listen: 3999,
    targetHost: "127.0.0.1",
    targetPort: 3001,
    delay: 0,
    jitter: 0,
    stallEvery: 0,
    stall: 0,
    loss: 0,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--listen") opts.listen = Number(next);
    else if (a === "--target") {
      const t = String(next);
      if (t.includes(":")) {
        const [h, p] = t.split(":");
        opts.targetHost = h || "127.0.0.1";
        opts.targetPort = Number(p);
      } else {
        opts.targetPort = Number(t);
      }
    } else if (a === "--delay") opts.delay = Number(next);
    else if (a === "--jitter") opts.jitter = Number(next);
    else if (a === "--stall-every") opts.stallEvery = Number(next);
    else if (a === "--stall") opts.stall = Number(next);
    else if (a === "--loss") opts.loss = Number(next);
    else continue;
    i++;
  }
  return opts;
}

/**
 * Monotonic FIFO: one queue, one drain timer, deadlines never go backwards.
 */
export class FifoPipe {
  constructor({ delay = 0, jitter = 0, stallEvery = 0, stall = 0, loss = 0, write, jitterPhase }) {
    this.delay = Math.max(0, delay);
    this.jitter = Math.max(0, jitter);
    this.stallEvery = Math.max(0, stallEvery);
    this.stall = Math.max(0, stall);
    this.loss = Math.max(0, Math.min(1, loss));
    this.write = write;
    this.queue = [];
    this.timer = null;
    this.lastDue = 0;
    this.stallUntil = 0;
    this.nextStallAt = this.stallEvery > 0 ? Date.now() + this.stallEvery : Infinity;
    this.closed = false;
    this.bytesIn = 0;
    this.bytesOut = 0;
    // Time-correlated zero-mean jitter. Independent per-chunk random + FIFO
    // clamp ratchets delay without bound (many tiny Socket.IO writes). A sine
    // keeps neighboring chunks together. Negative half-cycles accrue credit
    // that pays back later positives so median one-way stays ≈ --delay
    // (TCP cannot deliver early, so a clamped sine otherwise has a DC offset).
    this.jitterPhase = jitterPhase != null ? jitterPhase : Math.random() * Math.PI * 2;
    this.credit = 0;
  }

  _jitterAt(now) {
    if (this.jitter <= 0) return 0;
    return Math.sin(now / 90 + this.jitterPhase) * this.jitter;
  }

  enqueue(buf) {
    if (this.closed || !buf || buf.length === 0) return;
    this.bytesIn += buf.length;
    const now = Date.now();
    let extra = 0;
    if (this.loss > 0 && Math.random() < this.loss) {
      extra += this.stall > 0 ? this.stall : 80;
    }
    const signed = this.delay + this._jitterAt(now);
    let wait;
    if (signed >= 0) {
      const repaid = Math.min(this.credit, signed);
      this.credit -= repaid;
      wait = signed - repaid + extra;
    } else {
      this.credit += -signed;
      wait = extra;
    }
    const due = Math.max(now + Math.max(0, wait), this.lastDue);
    this.lastDue = due;
    this.queue.push({ buf, due });
    this.schedule();
  }

  _maybeBeginStall(now) {
    if (this.stallEvery <= 0 || this.stall <= 0) return;
    if (now >= this.nextStallAt) {
      this.stallUntil = now + this.stall;
      this.nextStallAt = now + this.stallEvery;
    }
  }

  schedule() {
    if (this.timer || this.closed || this.queue.length === 0) return;
    const now = Date.now();
    this._maybeBeginStall(now);
    const holdUntil = Math.max(this.queue[0].due, this.stallUntil);
    const wait = Math.max(0, holdUntil - now);
    this.timer = setTimeout(() => this.drain(), wait);
  }

  drain() {
    this.timer = null;
    if (this.closed) return;
    const now = Date.now();
    this._maybeBeginStall(now);
    if (now < this.stallUntil) {
      this.schedule();
      return;
    }
    while (this.queue.length && this.queue[0].due <= now && now >= this.stallUntil) {
      const item = this.queue.shift();
      try {
        this.write(item.buf);
        this.bytesOut += item.buf.length;
      } catch {
        /* peer gone */
      }
    }
    this.schedule();
  }

  flushSoon() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.drain();
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
  }
}

export function startImpairProxy(opts) {
  const listen = opts.listen ?? 0;
  const targetHost = opts.targetHost || "127.0.0.1";
  const targetPort = Number(opts.targetPort);
  const impair = {
    delay: opts.delay || 0,
    jitter: opts.jitter || 0,
    stallEvery: opts.stallEvery || 0,
    stall: opts.stall || 0,
    loss: opts.loss || 0,
  };

  return new Promise((resolve, reject) => {
    const pipes = new Set();
    const server = net.createServer((client) => {
      const upstream = net.connect({ host: targetHost, port: targetPort });
      // Same phase on both legs: RTT median stays ≈ 2 * delay. Opposite
      // phases made every RTT pay |sin|*jitter, so input→ack p50 sat on
      // the RTT+40 line at delay 0 (40.5 vs 40 at jitter 30).
      const jitterPhase = Math.random() * Math.PI * 2;
      const up = new FifoPipe({
        ...impair,
        jitterPhase,
        write: (b) => {
          if (!upstream.destroyed) upstream.write(b);
        },
      });
      const down = new FifoPipe({
        ...impair,
        jitterPhase,
        write: (b) => {
          if (!client.destroyed) client.write(b);
        },
      });
      pipes.add(up);
      pipes.add(down);

      client.on("data", (buf) => up.enqueue(buf));
      upstream.on("data", (buf) => down.enqueue(buf));

      const closeBoth = () => {
        up.close();
        down.close();
        pipes.delete(up);
        pipes.delete(down);
        if (!client.destroyed) client.destroy();
        if (!upstream.destroyed) upstream.destroy();
      };
      client.on("error", closeBoth);
      upstream.on("error", closeBoth);
      client.on("close", closeBoth);
      upstream.on("close", closeBoth);
    });

    server.on("error", reject);
    server.listen(listen, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        host: "127.0.0.1",
        close: () =>
          new Promise((res) => {
            for (const p of pipes) p.close();
            pipes.clear();
            server.close(() => res());
          }),
      });
    });
  });
}

function isMain() {
  const here = new URL(import.meta.url).pathname;
  const entry = process.argv[1] ? String(process.argv[1]).replaceAll("\\", "/") : "";
  return entry.endsWith("impairProxy.mjs") || here.endsWith(entry);
}

if (isMain()) {
  const opts = parseProxyArgs();
  const proxy = await startImpairProxy(opts);
  console.log(
    `[impairProxy] 127.0.0.1:${proxy.port} → ${opts.targetHost}:${opts.targetPort}` +
      ` delay=${opts.delay} jitter=${opts.jitter}` +
      ` stall=${opts.stall}@${opts.stallEvery} loss=${opts.loss}`
  );
}
