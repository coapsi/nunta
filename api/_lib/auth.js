import crypto from 'node:crypto';

const COOKIE = 'nunta_s';
const MAX_AGE = 60 * 60 * 24 * 60; // 60 de zile

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET lipseste');
  return s;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function sessionCookie(memberId) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const value = `${memberId}.${exp}`;
  return `${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSession(req) {
  const raw = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [memberId, exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!memberId || !exp || !sig) return null;
  const expected = sign(`${memberId}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return memberId;
}

export function newCode() {
  return crypto.randomBytes(12).toString('base64url');
}
