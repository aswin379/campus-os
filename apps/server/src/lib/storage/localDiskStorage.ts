import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import type { FileStorage, StoredFileRef } from './types.js';

/**
 * Keys are storage-driver-agnostic relative paths (e.g. "students/{id}/photo.jpg").
 * Never expose STORAGE_LOCAL_PATH or absolute paths outside this module — callers
 * only ever deal with keys, so swapping to S3CompatibleStorage later needs no
 * data migration.
 */
export class LocalDiskStorage implements FileStorage {
  private readonly basePath = path.resolve(env.STORAGE_LOCAL_PATH);

  private resolve(key: string): string {
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return resolved;
  }

  async save(key: string, data: Buffer): Promise<StoredFileRef> {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return { key };
  }

  async getUrl(key: string): Promise<string> {
    // Local driver has no public URL; files are served through an authenticated
    // download endpoint that resolves the key via `read()`, not a static mount.
    return `${env.APP_BASE_URL}/api/v1/files/${encodeURIComponent(key)}`;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
