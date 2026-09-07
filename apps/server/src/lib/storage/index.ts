import { env } from '../../config/env.js';
import { LocalDiskStorage } from './localDiskStorage.js';
import type { FileStorage } from './types.js';

export type { FileStorage, StoredFileRef } from './types.js';

function createStorage(): FileStorage {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalDiskStorage();
    case 's3':
      throw new Error('S3CompatibleStorage is not implemented yet. Set STORAGE_DRIVER=local.');
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${env.STORAGE_DRIVER}`);
  }
}

export const storage: FileStorage = createStorage();
