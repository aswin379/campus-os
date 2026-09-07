import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';

/**
 * Docker abstracts away real hardware, so there's no reliable MAC
 * address/machine-id to fingerprint from inside the container. Instead, a
 * random id is generated once and persisted inside the same volume already
 * used for uploaded files (see Dockerfile's VOLUME ["/repo/data/uploads"]),
 * so it survives container restarts/rebuilds but does NOT travel with a copy
 * of just the application image — a fresh, separate deployment gets a new
 * id, which is exactly the "different install" a license shouldn't match.
 */
export function getInstanceId(): string {
  const idPath = path.resolve(env.LICENSE_INSTANCE_ID_PATH);
  try {
    return fs.readFileSync(idPath, 'utf8').trim();
  } catch {
    const id = randomUUID();
    fs.mkdirSync(path.dirname(idPath), { recursive: true });
    fs.writeFileSync(idPath, id, 'utf8');
    return id;
  }
}
