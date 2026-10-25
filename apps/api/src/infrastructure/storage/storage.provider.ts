import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { loadConfig } from '../../config/env';

/**
 * Object storage abstraction. LocalStorageProvider ships with the MVP; S3-compatible and
 * Azure Blob providers implement the same interface (see docs/ARCHITECTURE.md §8).
 */
export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly root = resolve(loadConfig().storageLocalDir);

  private path(key: string) {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return p;
  }

  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data, { flag: 'wx' });
  }

  get(key: string) {
    return readFile(this.path(key));
  }
}

export const STORAGE = Symbol('STORAGE');
