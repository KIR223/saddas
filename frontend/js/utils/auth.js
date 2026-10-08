/**
 * Вход в админку: PBKDF2-SHA256 (crypto.subtle) + JS fallback SHA-256
 * Это защита от случайного входа, не настоящая безопасность.
 */

import { AUTH } from '../config.js';

/**
 * @param {string} b64
 * @returns {Uint8Array}
 */
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @param {ArrayBuffer|Uint8Array} buf
 * @returns {string}
 */
function bytesToB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * SHA-256 одной порции (fallback)
 * @param {Uint8Array} data
 */
async function sha256(data) {
  if (globalThis.crypto?.subtle) {
    const dig = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(dig);
  }
  return sha256Js(data);
}

/** Минимальный SHA-256 на чистом JS (fallback) */
function sha256Js(bytes) {
  // Компактная реализация SHA-256
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padLen = (withOne % 64 <= 56) ? 56 - (withOne % 64) : 120 - (withOne % 64);
  const msg = new Uint8Array(withOne + padLen + 8);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(msg.length - 4, bitLen >>> 0, false);
  view.setUint32(msg.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let i = 0; i < msg.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
      const s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) dv.setUint32(i * 4, H[i], false);
  return out;
}

/**
 * PBKDF2-HMAC-SHA256
 * @param {string} password
 * @param {string} saltB64
 * @param {number} iterations
 */
export async function pbkdf2Hash(password, saltB64, iterations = AUTH.iterations) {
  const enc = new TextEncoder();
  const salt = b64ToBytes(saltB64);
  const passBytes = enc.encode(password);

  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey('raw', passBytes, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256
    );
    return bytesToB64(bits);
  }

  // Fallback: HMAC-SHA256 PBKDF2 вручную
  return pbkdf2Fallback(passBytes, salt, iterations);
}

/**
 * @param {Uint8Array} password
 * @param {Uint8Array} salt
 * @param {number} iterations
 */
async function pbkdf2Fallback(password, salt, iterations) {
  const block = await hmacSha256(password, concat(salt, u32be(1)));
  let u = block;
  const result = new Uint8Array(block);
  for (let i = 1; i < iterations; i++) {
    u = await hmacSha256(password, u);
    for (let j = 0; j < 32; j++) result[j] ^= u[j];
  }
  return bytesToB64(result);
}

/**
 * @param {Uint8Array} key
 * @param {Uint8Array} data
 */
async function hmacSha256(key, data) {
  let k = key;
  if (k.length > 64) k = await sha256(k);
  const kk = new Uint8Array(64);
  kk.set(k);
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = kk[i] ^ 0x36;
    opad[i] = kk[i] ^ 0x5c;
  }
  const inner = await sha256(concat(ipad, data));
  return sha256(concat(opad, inner));
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function u32be(n) {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function loadLockState() {
  try {
    const raw = localStorage.getItem(AUTH.storageKey);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: 0 };
}

function saveLockState(state) {
  try {
    localStorage.setItem(AUTH.storageKey, JSON.stringify(state));
  } catch { /* ignore */ }
}

/**
 * @returns {{ locked: boolean, remainingMs: number, attemptsLeft: number }}
 */
export function getAuthLockStatus() {
  const st = loadLockState();
  const now = Date.now();
  if (st.lockedUntil && st.lockedUntil > now) {
    return { locked: true, remainingMs: st.lockedUntil - now, attemptsLeft: 0 };
  }
  return {
    locked: false,
    remainingMs: 0,
    attemptsLeft: Math.max(0, AUTH.maxAttempts - (st.attempts || 0)),
  };
}

/**
 * @param {string} login
 * @param {string} password
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function tryLogin(login, password) {
  const status = getAuthLockStatus();
  if (status.locked) {
    const mins = Math.ceil(status.remainingMs / 60000);
    return { ok: false, error: `Слишком много попыток. Подождите ${mins} мин.` };
  }

  const loginHash = await pbkdf2Hash(login.trim(), AUTH.loginSalt);
  const passHash = await pbkdf2Hash(password, AUTH.passSalt);
  const ok = timingSafeEqual(loginHash, AUTH.loginHash) && timingSafeEqual(passHash, AUTH.passHash);

  if (!ok) {
    const st = loadLockState();
    st.attempts = (st.attempts || 0) + 1;
    if (st.attempts >= AUTH.maxAttempts) {
      st.lockedUntil = Date.now() + AUTH.lockMinutes * 60 * 1000;
      st.attempts = 0;
      saveLockState(st);
      return { ok: false, error: `Блокировка на ${AUTH.lockMinutes} минут` };
    }
    saveLockState(st);
    const left = AUTH.maxAttempts - st.attempts;
    return { ok: false, error: `Неверный логин или пароль (осталось ${left})` };
  }

  saveLockState({ attempts: 0, lockedUntil: 0 });
  const session = {
    ok: true,
    at: Date.now(),
    lastActive: Date.now(),
  };
  try {
    sessionStorage.setItem(AUTH.sessionKey, JSON.stringify(session));
  } catch { /* ignore */ }
  return { ok: true };
}

export function logout() {
  try {
    sessionStorage.removeItem(AUTH.sessionKey);
  } catch { /* ignore */ }
}

/**
 * @returns {boolean}
 */
export function isLoggedIn() {
  try {
    const raw = sessionStorage.getItem(AUTH.sessionKey);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.ok) return false;
    if (Date.now() - (s.lastActive || s.at) > AUTH.sessionIdleMs) {
      logout();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Обновить активность сессии */
export function touchSession() {
  try {
    const raw = sessionStorage.getItem(AUTH.sessionKey);
    if (!raw) return;
    const s = JSON.parse(raw);
    s.lastActive = Date.now();
    sessionStorage.setItem(AUTH.sessionKey, JSON.stringify(s));
  } catch { /* ignore */ }
}

/**
 * Сгенерировать хэш для README (утилита)
 * @param {string} value
 * @param {string} [saltB64]
 */
export async function generateHashPair(value, saltB64) {
  let salt = saltB64;
  if (!salt) {
    const bytes = new Uint8Array(16);
    if (crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    salt = bytesToB64(bytes);
  }
  const hash = await pbkdf2Hash(value, salt);
  return { salt, hash };
}
