# 🛡️ HookShield — Webhook Reliability Platform

> **Production-grade webhook delivery engine featuring guaranteed at-least-once delivery, exponential backoff with jitter, cryptographic signature verification (HMAC-SHA256), envelope encryption (AES-256-GCM), SSRF defense-in-depth, and an ultra-responsive real-time monitoring dashboard.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- **Reliable At-Least-Once Delivery**: Events are durably persisted before fan-out. Delivery jobs are processed asynchronously by independent background workers.
- **Exponential Backoff with Full Jitter**: Intelligent retry engine (attempts 1–5) prevents the *thundering herd problem* against recovering destination servers.
- **Cryptographic Request Signing**: Every outgoing POST request is signed using HMAC-SHA256 (`t=...,v1=...`) with timestamp drift validation to protect against tampering and replay attacks.
- **Envelope Secret Encryption**: Endpoint signing secrets are encrypted at rest with **AES-256-GCM** using SHA-256 derived keys and per-record random initialization vectors.
- **SSRF Defense-in-Depth**: Strict URL validation, protocol whitelisting, DNS resolution checks, and automatic blocking of private IPv4/IPv6 subnets, loopbacks, and cloud metadata services (`169.254.169.254`).
- **Producer Idempotency**: Built-in support for `idempotencyKey` ensures duplicate event submissions within a window return the existing event without re-triggering duplicate deliveries.
- **Sleek Glassmorphic Dashboard**: Real-time observability dashboard built with React 19, Vite, TanStack Query v5, and Lucide Icons with live delivery attempt audits and manual one-click replays.
- **Built-in Receiver Simulator**: Includes a dedicated receiver demo server with configurable failure rates, response delays, and signature verification testing.

---

## 🏗️ Architecture

```
                                  ┌────────────────────────┐
                                  │   Producer / Client    │
                                  └───────────┬────────────┘
                                              │ POST /api/v1/events
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  HookShield API Server (Express + TypeScript, Port 5000)                     │
│  - Idempotency validation                                                    │
│  - Endpoint subscription matching                                            │
│  - Atomic delivery job creation                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Persists Event & Deliveries
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  MongoDB 7.0 Storage                                                         │
│  - Collections: Events, Endpoints, Deliveries, DeliveryAttempts              │
│  - Compound indexes on { status: 1, nextRetryAt: 1 } for zero-lock claiming  │
└──────────────────────────────────────▲───────────────────────────────────────┘
                                       │ Atomic findOneAndUpdate
                                       │ claim (status: 'delivering')
┌──────────────────────────────────────┴───────────────────────────────────────┐
│  HookShield Delivery Worker (Daemon Process)                                 │
│  - Pre-flight DNS resolution & SSRF IP blacklist check                       │
│  - Decrypts endpoint secret via AES-256-GCM                                  │
│  - Generates HMAC-SHA256 signature header (t=..., v1=...)                    │
│  - Bounded HTTP POST dispatch with 10s timeout                               │
│  - Calculates exponential backoff with +/-30% jitter                         │
│  - Records granular attempt audit logs                                       │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Signed HTTP POST
                                       ▼
                         ┌───────────────────────────┐
                         │ Destination Webhook URLs  │
                         │ (or Receiver Demo: 4000)  │
                         └───────────────────────────┘
```

For comprehensive architectural design, sequence diagrams, and deep dives, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

For technical interview answers, design trade-offs, and failure mode defenses, see [docs/INTERVIEW_DEFENSE.md](docs/INTERVIEW_DEFENSE.md).

---

## 🚀 Quick Start

### Option A: Using Docker Compose (Recommended)

Start the entire stack (MongoDB, API server, delivery worker, React dashboard, and receiver demo) with a single command:

```bash
docker-compose up --build
```

- **Dashboard UI**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:5000](http://localhost:5000)
- **Receiver Demo**: [http://localhost:4000](http://localhost:4000)

---

### Option B: Local Development Setup

#### 1. Prerequisites
- **Node.js** v20+ or v24+
- **MongoDB** (Local instance or MongoDB Atlas connection string)

#### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `WEBHOOK_SECRET_ENCRYPTION_KEY` is a secret string of at least 32 characters, and `MONGODB_URI` points to your MongoDB instance.

#### 3. Install Dependencies
```bash
# Server dependencies
cd server && npm install && cd ..

# Worker dependencies
cd worker && npm install && cd ..

# Client dependencies
cd client && npm install && cd ..

# Receiver demo dependencies
cd receiver-demo && npm install && cd ..
```

#### 4. Run the Core Verification Tests
Verify all cryptography, signatures, SSRF guards, and backoff calculations in isolation (no database required):
```bash
node tests/verify.js
```

#### 5. Start the Services

Open separate terminal windows:

```bash
# Terminal 1: Receiver Demo Server (Port 4000)
node receiver-demo/server.js

# Terminal 2: API Server (Port 5000)
npm run dev:server

# Terminal 3: Delivery Worker
npm run dev:worker

# Terminal 4: Frontend Dashboard (Port 5173)
npm run dev:client
```

---

## 📡 API Reference

### 1. Endpoints

#### Register an Endpoint
```http
POST /api/v1/endpoints
Content-Type: application/json

{
  "url": "http://localhost:4000/webhook",
  "description": "Payment webhook receiver",
  "subscribedEvents": ["payment.completed", "order.created"]
}
```
*Response (HTTP 201):*
```json
{
  "success": true,
  "data": {
    "id": "673f4b23...",
    "url": "http://localhost:4000/webhook",
    "description": "Payment webhook receiver",
    "subscribedEvents": ["payment.completed", "order.created"],
    "enabled": true,
    "createdAt": "2026-10-25T12:00:00.000Z"
  },
  "secret": "whsec_9a8f273b5c8e..." // Displayed ONCE upon creation
}
```

#### List Endpoints
```http
GET /api/v1/endpoints?page=1&limit=20
```

#### Toggle or Update Endpoint
```http
PATCH /api/v1/endpoints/:id
Content-Type: application/json

{
  "enabled": false,
  "description": "Disabled temporarily for maintenance"
}
```

---

### 2. Events

#### Publish an Event
```http
POST /api/v1/events
Content-Type: application/json

{
  "type": "payment.completed",
  "payload": {
    "orderId": "ord_99812",
    "amount": 25000,
    "currency": "USD",
    "customer": { "id": "cus_123", "email": "alex@example.com" }
  },
  "idempotencyKey": "req_unique_idem_key_001"
}
```
*Response (HTTP 201):*
```json
{
  "success": true,
  "duplicate": false,
  "deliveriesCreated": 1,
  "data": {
    "id": "673f4c12...",
    "eventId": "evt_4981a...",
    "type": "payment.completed",
    "payload": { "orderId": "ord_99812", "amount": 25000 },
    "createdAt": "2026-10-25T12:01:00.000Z"
  }
}
```

---

### 3. Deliveries & Audit Trail

#### List Deliveries
```http
GET /api/v1/deliveries?status=failed&page=1&limit=20
```
Status options: `pending` | `delivering` | `retrying` | `success` | `failed`

#### Get Delivery Details & Full Attempt History
```http
GET /api/v1/deliveries/:id
```
Returns delivery metadata along with array of all delivery attempts containing HTTP status codes, durations, error categories, and response snippets.

#### Manual Replay
```http
POST /api/v1/deliveries/:id/replay
```
Resets a failed or successful delivery back to `pending` with `nextRetryAt: new Date()`, triggering immediate dispatch by the next worker cycle.

---

## 🔒 Security & Verification

### Verifying Signatures in Node.js

When receiving a HookShield webhook, verify the `X-HookShield-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  const parts = signatureHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const signature = parts.find(p => p.startsWith('v1='))?.slice(3);

  if (!timestamp || !signature) return false;

  // Protect against replay attacks
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (age > toleranceSeconds) return false;

  // Compute expected HMAC-SHA256
  const payload = `${timestamp}.${rawBody}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}
```

---

## 🧪 Testing

Run the automated core unit and component test suite:
```bash
npm test
```

Test coverage includes:
- ✅ AES-256-GCM encryption & decryption
- ✅ GCM authentication tag tampering detection
- ✅ HMAC-SHA256 request signature verification
- ✅ Signature replay attack rejection based on timestamp drift
- ✅ SSRF blocking for private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- ✅ SSRF blocking for cloud metadata link-local (`169.254.169.254`)
- ✅ Exponential backoff delay calculation and 30% jitter boundaries
- ✅ Status code retry classification (4xx non-retryable vs 5xx / 429 retryable)

---

## 📄 License

MIT © HookShield Contributors
