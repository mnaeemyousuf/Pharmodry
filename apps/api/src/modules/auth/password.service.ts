import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, ScryptOptions } from 'node:crypto';

const scrypt = (pwd: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pwd, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))));

const N = 1 << 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Memory-hard password hashing with Node's built-in scrypt. Format: scrypt$N$r$p$salt$hash */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
    return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
    if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  }

  /** Basic policy: ≥ 10 chars with upper, lower, digit. */
  validatePolicy(password: string): string | null {
    if (password.length < 10) return 'Password must be at least 10 characters';
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return 'Password must contain upper-case, lower-case and a digit';
    }
    return null;
  }
}
