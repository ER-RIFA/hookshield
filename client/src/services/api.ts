import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Owner-Id': 'demo-user', // For demo — replace with real auth
  },
});

// Receiver demo direct/proxied client
const receiverClient = axios.create({
  baseURL: '/receiver-api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error normalization
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Unknown error';
    return Promise.reject(new Error(message));
  }
);

receiverClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Receiver connection error';
    return Promise.reject(new Error(message));
  }
);

// ── Endpoints ────────────────────────────────────────────────
export const endpointApi = {
  list: (page = 1, limit = 20) =>
    api.get('/endpoints', { params: { page, limit } }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/endpoints/${id}`).then((r) => r.data),

  create: (data: { url: string; subscribedEvents: string[]; description?: string; secret?: string }) =>
    api.post('/endpoints', data).then((r) => r.data),

  update: (id: string, data: { enabled?: boolean; subscribedEvents?: string[]; description?: string; url?: string }) =>
    api.patch(`/endpoints/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/endpoints/${id}`).then((r) => r.data),

  getSecret: (id: string) =>
    api.get(`/endpoints/${id}/secret`).then((r) => r.data),

  rotateSecret: (id: string) =>
    api.post(`/endpoints/${id}/rotate-secret`).then((r) => r.data),

  test: (id: string) =>
    api.post(`/endpoints/${id}/test`).then((r) => r.data),
};

// ── Events ───────────────────────────────────────────────────
export const eventApi = {
  list: (page = 1, limit = 20) =>
    api.get('/events', { params: { page, limit } }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/events/${id}`).then((r) => r.data),

  create: (data: { type: string; payload: Record<string, unknown>; idempotencyKey?: string }) =>
    api.post('/events', data).then((r) => r.data),
};

// ── Deliveries ───────────────────────────────────────────────
export const deliveryApi = {
  list: (params?: { page?: number; limit?: number; status?: string; endpointId?: string; eventId?: string }) =>
    api.get('/deliveries', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/deliveries/${id}`).then((r) => r.data),

  replay: (id: string) =>
    api.post(`/deliveries/${id}/replay`).then((r) => r.data),

  replayAllFailed: () =>
    api.post('/deliveries/replay-all-failed').then((r) => r.data),

  stats: () =>
    api.get('/deliveries/stats').then((r) => r.data),
};

// ── Receiver Simulator Client ────────────────────────────────
export const receiverApi = {
  health: () =>
    receiverClient.get('/health').then((r) => r.data),

  getConfig: () =>
    receiverClient.get('/config').then((r) => r.data),

  updateConfig: (data: { forceStatus?: number; delayMs?: number; failCount?: number; resetCount?: boolean }) =>
    receiverClient.post('/config', data).then((r) => r.data),

  getLogs: () =>
    receiverClient.get('/logs').then((r) => r.data),

  clearLogs: () =>
    receiverClient.delete('/logs').then((r) => r.data),
};

// ── Health ───────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health').then((r) => r.data),
};

export default api;
