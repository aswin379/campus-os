import { getInstanceId } from '../lib/license/instanceId.js';

// Diagnostic only — the vendor no longer needs to collect this upfront
// (see apps/license-server/README.md: issuing a license just needs a client
// name, not this id). Useful for confirming which instance is checking in
// against the license server's admin listing (last_seen_instance_id).
console.log(getInstanceId());
