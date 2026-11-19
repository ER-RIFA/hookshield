# 🛡️ HookShield — Webhook Reliability Platform

> **Enterprise-grade, distributed webhook delivery engine featuring guaranteed at-least-once delivery, exponential backoff with full jitter, cryptographic HMAC-SHA256 request signing, AES-256-GCM envelope secret encryption, defense-in-depth SSRF protection, worker lease management with automatic zombie/orphan job sweeper, and a real-time glassmorphic observability dashboard.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Project Introduction

In modern microservice architectures, SaaS platforms must notify third-party consumers of mission-critical events (payment completions, order fulfillments, security alerts) via HTTP webhooks. However, third-party receiving endpoints are inherently unreliable: they experience temporary server downtime, database connection pool exhaustion, network timeouts, and sudden traffic spikes.

**HookShield** is a dedicated, production-grade Webhook Reliability Platform designed to decouple webhook ingestion from transmission, providing durable persistence, zero-data-loss retries, and complete cryptographic verifiability.

---

## 2. Problem Statement

Synchronous webhook dispatch directly from core application handlers causes severe architectural problems:
* **Cascading Latency & Thread Exhaustion**: Sluggish third-party endpoints hold open server sockets, consuming worker threads and starving customer-facing transactions.
* **Data Loss on Failures**: If destination servers return HTTP 500 or timeout, simple HTTP calls discard the payload or fail the original client request.
* **The Thundering Herd Problem**: When a recovering recipient comes back online, deterministic retries (e.g. exactly every 60 seconds) bombard the destination simultaneously, knocking it offline again.
* **Security Exploits (SSRF & Replay)**: Naive webhook dispatchers can be tricked into scanning internal VPC IP addresses (such as AWS/GCP cloud metadata `169.254.169.254`), or eavesdroppers can capture and replay valid webhook requests.

HookShield solves these vulnerabilities through a decoupled architecture with strict security boundaries.

---

## 3. Key Features

- **Guaranteed At-Least-Once Delivery**: Events and delivery intents are durably persisted to disk before any network transmission begins.
- **Producer Idempotency**: Atomic reservation on `idempotencyKey` guarantees that duplicate submissions return the original event with zero duplicate deliveries.
- **Exponential Backoff with Full Jitter**: 5-attempt retry engine with randomized $\pm 30\%$ jitter prevents destination server overloading.
- **HMAC-SHA256 Request Signing**: Every outgoing request includes `X-HookShield-Signature: t={timestamp},v1={hash}` with timestamp drift validation against replay attacks.
- **AES-256-GCM Envelope Encryption**: Signing secrets are encrypted at rest with AES-256-GCM and SHA-256 derived keys, verified with an authentication tag on every read.
- **Defense-in-Depth SSRF Firewall**: Validates URLs upfront and pre-dispatch; blocks loopback (`127.0.0.0/8`, `::1`), private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/cloud metadata (`169.254.0.0/16`), CGNAT, and HTTP redirects (3xx).
- **Worker Leasing & Orphan Recovery**: Atomic `findOneAndUpdate` job claiming with lease timeouts and an automated sweeper that recovers crashed worker jobs.
- **One-Click Replay & Batch Replay**: Instant manual retry for individual failed deliveries or one-click batch recovery for all exhausted jobs.
- **Interactive Receiver Simulator**: Built-in receiver server (Port 4000) with dynamic failure injection (HTTP 500, 429, timeouts) and real-time signature inspection.
- **Real-Time Observability Dashboard**: Built with React 19, Vite, TanStack Query v5, and Lucide Icons with live delivery attempt audits and response body inspection.

---

## 4. Technology Stack

* **API Server**: Node.js, Express, TypeScript, Zod, Helmet, Express Rate Limit
* **Storage Layer**: MongoDB 7.0 / MongoDB Atlas, Mongoose ODM with compound indexes
* **Worker Daemon**: Node.js background process, atomic document locking, DNS resolution
* **Security / Cryptography**: Built-in `crypto` (AES-256-GCM, HMAC-SHA256, timing-safe equality)
* **Frontend UI**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query v5, Lucide Icons, Date-fns
* **Receiver Demo**: Express with configurable dynamic fault injection

---

## 5. System Architecture

```
                                  ┌────────────────────────┐
                                  │   Producer / Client    │
                                  └───────────┬────────────┘
                                              │ POST /api/events
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  HookShield API Server (Express + TypeScript, Port 5000)                     │
│  - Idempotency validation with atomic pre-reservation                        │
│  - Endpoint subscription matching                                            │
│  - Atomic delivery job creation                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Persists Event & Deliveries
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  MongoDB Storage                                                             │
│  - Collections: Events, Endpoints, Deliveries, DeliveryAttempts              │
│  - Compound indexes on { status: 1, nextAttemptAt: 1 } for zero-lock claims  │
└──────────────────────────────────────▲───────────────────────────────────────┘
                                       │ Atomic findOneAndUpdate
                                       │ claim (status: 'delivering', leaseUntil)
┌──────────────────────────────────────┴───────────────────────────────────────┐
│  HookShield Delivery Worker (Daemon Process)                                 │
│  - Pre-flight DNS resolution & SSRF IP range validation                      │
│  - Decrypts endpoint secret via AES-256-GCM                                  │
│  - Generates HMAC-SHA256 signature header (t=..., v1=...)                    │
│  - Bounded HTTP POST dispatch with 10s socket timeout                        │
│  - Captures responseBody & calculates exponential backoff + jitter           │
│  - Zombie/orphan lease recovery sweeper                                      │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Signed HTTP POST (No redirects)
                                       ▼
                         ┌───────────────────────────┐
                         │ Destination Webhook URLs  │
                         │ (or Receiver Demo: 4000)  │
                         └───────────────────────────┘
```

---

## 6. How Webhook Delivery Works

1. **Ingress**: An application calls `POST /api/events` with an event `type`, JSON `payload`, and optional `idempotencyKey`.
2. **Deduplication**: If the `idempotencyKey` was already processed, HookShield returns the existing event with `duplicate: true`.
3. **Fan-Out**: HookShield matches active `Endpoints` subscribed to that event type and atomically inserts a `Delivery` record for each matching destination (`status: 'pending'`).
4. **Worker Claim**: Background worker instances continuously query for eligible jobs using MongoDB's atomic `findOneAndUpdate`.
5. **SSRF Guard**: Pre-flight DNS resolution validates that the hostname does not resolve to private or cloud-metadata IP addresses.
6. **Signing**: The worker decrypts the endpoint's secret and constructs an `X-HookShield-Signature` header.
7. **HTTP POST**: The payload is dispatched with a strict 10-second timeout. HTTP redirects are rejected.
8. **Audit Trail**: The response status code, round-trip duration, response body, and error categories are logged into `DeliveryAttempts`.

---

## 7. HMAC Signing & Verification

Every outgoing request includes the header:
```http
X-HookShield-Signature: t=1700000000,v1=5d41402abc4b2a76b9719d911017c592
X-HookShield-Event: payment.completed
X-HookShield-Delivery: 673f4c12...
```

### Signature Generation:
$$\text{payload} = \text{timestamp} \mathbin{\Vert} \text{"."} \mathbin{\Vert} \text{rawJsonBody}$$
$$\text{signature} = \text{HMAC-SHA256}(\text{payload}, \text{secret})$$

### Receiver Verification Implementation:
```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, signatureHeader, secret, toleranceSec = 300) {
  const parts = signatureHeader.split(',');
  const t = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!t || !v1) return false;

  // Replay protection: verify drift is within tolerance window (5 mins)
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10));
  if (age > toleranceSec) return false;

  // Compute expected HMAC
  const expectedPayload = `${t}.${rawBody}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(expectedPayload, 'utf8').digest('hex');

  // Constant-time comparison prevents timing attacks
  const v1Buf = Buffer.from(v1, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  return v1Buf.length === expBuf.length && crypto.timingSafeEqual(v1Buf, expBuf);
}
```

---

## 8. Retry Mechanism & Exponential Backoff

When an endpoint fails with a transient error (HTTP 500, 502, 503, 504, 429, or network timeout), HookShield recalculates the retry schedule:

$$T_{\text{nominal}} = \min(B \times 2^{\text{attempt}}, T_{\max})$$
$$\text{delay} = T_{\text{nominal}} \times (1 \pm J)$$

* $B = 30,000\text{ ms}$ (30 seconds base delay)
* $T_{\max} = 3,600,000\text{ ms}$ (1 hour cap)
* $J = 0.3$ ($\pm 30\%$ full jitter)
* $\text{Max Attempts} = 5$

### HTTP Status Code Classification:
* **HTTP 2xx**: Success (no retry).
* **HTTP 3xx**: Redirects rejected (non-retryable SSRF guard).
* **HTTP 400, 401, 403, 404, 410, 422**: Permanent client errors (non-retryable).
* **HTTP 429**: Rate-limited (retries with exponential backoff).
* **HTTP 5xx / Network Timeout**: Transient server error (retries with exponential backoff).

---

## 9. Worker Leasing & Orphan Recovery

To safely scale across multiple concurrent worker instances without external locking mechanisms:
1. **Atomic Document Lock**: Workers claim jobs using `findOneAndUpdate` with `status: 'delivering'` and `leaseUntil = now + 30s`.
2. **Orphan Sweeper**: If a worker node crashes mid-flight, the sweeper query (`status: 'delivering', leaseUntil: { $lte: now }`) automatically resets abandoned jobs back to `retrying` with immediate retry eligibility.

---

## 10. Idempotency

HookShield provides atomic idempotency reservation:
* The `IdempotencyKey` collection enforces `{ ownerId: 1, key: 1 }` as a unique compound index with a 24-hour TTL index.
* When concurrent duplicate requests arrive simultaneously, exactly one request successfully claims the key; all concurrent threads detect the unique collision and cleanly receive the winner's event without generating duplicate deliveries.

---

## 11. Security Mechanisms

1. **Envelope Encryption**: Webhook secrets are encrypted at rest with AES-256-GCM using unique per-record 16-byte IVs and authenticated data tags.
2. **SSRF Defense**: Validates URL format, resolves DNS IPv4 and IPv6 records, and checks against private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.0/8`, `::1`, `fc00::/7`).
3. **Redirect Protection**: Automatic redirects are disabled. Any 3xx redirect status code is treated as a terminal failure to prevent redirect-based SSRF bypasses.
4. **Multi-Tenant Context**: Queries strictly filter by `ownerId` across all models (Endpoints, Events, Deliveries).

---

## 12. API Documentation & Examples

### Endpoints
* `POST /api/endpoints`: Register destination URL & subscribed events (returns generated signing secret once).
* `GET /api/endpoints`: List registered endpoints (paginated).
* `GET /api/endpoints/:id`: Get endpoint details.
* `PATCH /api/endpoints/:id`: Enable/disable or update description/events.
* `DELETE /api/endpoints/:id`: Delete endpoint and cancel pending jobs.
* `GET /api/endpoints/:id/secret`: Reveal signing secret.
* `POST /api/endpoints/:id/rotate-secret`: Generate and re-encrypt new signing secret.
* `POST /api/endpoints/:id/test`: Send immediate test ping (`hookshield.test_ping`) to measure latency and status.

### Events
* `POST /api/events`: Ingest an event with optional `idempotencyKey`.
* `GET /api/events`: List events with pagination.
* `GET /api/events/:id`: View event details and all associated delivery records.

### Deliveries
* `GET /api/deliveries`: List delivery jobs with filters (`status`, `endpointId`, `eventId`).
* `GET /api/deliveries/:id`: Get full delivery metadata and attempt audit log with response bodies.
* `POST /api/deliveries/:id/replay`: Replay a specific delivery.
* `POST /api/deliveries/replay-all-failed`: Replay all failed deliveries in a single batch.
* `GET /api/deliveries/stats`: Aggregated mission control statistics.

### Receiver Simulator (Port 4000)
* `POST /webhook`: Webhook receiver destination.
* `GET /health`: Receiver status.
* `GET /config`: Current simulation mode.
* `POST /config`: Set `forceStatus`, `delayMs`, or `failCount`.
* `GET /logs`: Inspect received webhooks with parsed HMAC headers.
* `DELETE /logs`: Clear captured logs.

---

## 13. Environment Variables

Configure in `.env`:

```ini
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hookshield
CLIENT_URL=http://localhost:5173
WEBHOOK_SECRET_ENCRYPTION_KEY=your-random-32-plus-character-secret-key-here
NODE_ENV=development
WORKER_POLL_INTERVAL_MS=5000
DELIVERY_TIMEOUT_MS=10000
MAX_RETRY_ATTEMPTS=5
```

---

## 14. Local Installation Instructions

### Prerequisites
* Node.js v20+ or v24+
* MongoDB running locally or on MongoDB Atlas

### Clone & Install:
```bash
git clone https://github.com/ER-RIFA/hookshield.git
cd hookshield

# Install subproject dependencies
npm --prefix server install
npm --prefix worker install
npm --prefix client install
npm --prefix receiver-demo install
```

---

## 15. How to Run Services

Open separate terminal windows:

```bash
# Terminal 1: Receiver Simulator (Port 4000)
node receiver-demo/server.js

# Terminal 2: HookShield API Server (Port 5000)
npm run dev:server

# Terminal 3: Delivery Worker
npm run dev:worker

# Terminal 4: Frontend Observability Dashboard (Port 5173)
npm run dev:client
```

Or start the complete Dockerized stack:
```bash
docker-compose up --build
```

---

## 16. Testing Instructions

Run the 20-requirement test suite and socket-level network tests:
```bash
npm test
```

Test coverage includes:
- ✅ HTTP 200 delivery success transition
- ✅ HTTP 500 transient failure backoff scheduling
- ✅ HTTP 429 rate limit backoff retry
- ✅ Receiver timeout handling
- ✅ 5-attempt retry exhaustion
- ✅ Exponential backoff and $\pm 30\%$ jitter boundaries
- ✅ Idempotent event deduplication
- ✅ Concurrent duplicate race condition safety
- ✅ Atomic `findOneAndUpdate` worker concurrency claiming
- ✅ Crashed worker orphan recovery
- ✅ Individual delivery replay
- ✅ Batch replay of all failed deliveries
- ✅ HMAC-SHA256 signature verification
- ✅ Signature tampering and timestamp drift rejection
- ✅ AES-256-GCM envelope secret encryption and rotation
- ✅ SSRF loopback, private IP, and cloud metadata filtering
- ✅ HTTP 3xx redirect rejection
- ✅ Multi-tenant context and cross-user authorization
- ✅ Database model persistence with `responseBody` capture
- ✅ Event type subscription matching and fan-out
- ✅ Live socket-level HTTP POST dispatch & signature check
- ✅ Live HTTP 500 transient failure response
- ✅ Live socket client timeout enforcement

---

## 17. UI Overview & Dashboards

The React 19 glassmorphic dashboard provides:
* **Mission Control**: Live delivery status counters, success rate gauge, and delivery stream.
* **Interactive Webhook Simulator**: 1-click event dispatch with Stripe, Shopify, GitHub, and Auth0 presets.
* **Pipeline Visualizer**: Real-time status of Ingress -> AES Encryption -> HMAC Signing -> SSRF Filter -> Worker Poller -> Delivery.
* **Endpoints Management**: Register destinations, view/rotate AES-encrypted secrets, and run live ping tests.
* **Delivery Deep Dive Modal**: Inspect request payloads, outgoing headers (`X-HookShield-*`), and granular attempt logs with receiver responses.
* **Receiver Console**: Live receiver telemetry, interactive failure mode toggles (HTTP 500, 429, timeouts), and live captured request inspection.

---

## 18. Future Improvements

* **Distributed Queue Layer**: Migration path to Apache Kafka or Redis Streams for scaling beyond 50,000,000 deliveries/day.
* **Cold Storage Archiving**: Automated archiving of successful delivery attempts older than 30 days to S3/Parquet for long-term compliance queries.
* **Fine-Grained Role-Based Access Control (RBAC)**: Support for team roles (Admin, Developer, Auditor) with scoped API keys.

---

## 📄 License

MIT © HookShield Contributors
