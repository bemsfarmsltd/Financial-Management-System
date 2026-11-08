# BEMS Group organization identity

The project owner confirmed that BEMS Group is the single parent organization. There is no separate HQ company or HQ-only workspace. Subsidiaries sit beneath BEMS Group.

The existing BEMS-GROUP organization ID is preserved. Migration 20261108000000 links orphan subsidiary records to that parent, preserves financial and employment references, and normalizes legacy employee location tokens. A private rollback snapshot records the prior hierarchy. Multiple parent groups cause the migration to stop for review.

Database IDs, BEMS-GROUP and historical HQ identifiers resolve through the same parent lookup. Old tokens are compatibility inputs only. Group views include the parent and its linked subsidiaries; staff authorization still intersects this selection with active employee assignments. Invalid identifiers remain empty scopes. Names containing the words BEMS Group do not confer parent status.

Dashboard and AI subsidiary creation attach the canonical parent and reject a second GROUP. Organization edits cannot rename, recode or demote BEMS Group, or promote a subsidiary into another GROUP. Wallet selections recognize the group as consolidated; mobile workstations show one BEMS Group entry and filter subsidiaries by their actual codes.

Existing historical audit text, station identifiers and metadata keys remain compatible; they are not additional organizations. Physical operating-location metadata remains available.

Validation: disposable-schema migration and alias resolution, all five subsidiaries, staff isolation, invalid-scope denial, protected identity changes, idempotent migration, web security/architecture checks, native analysis/tests and signed Android releases.

The embedded Staff web release uses `/staff-app-v1.3.5-r2/` so its index and assets are fetched together for that release. The unversioned compatibility copy is retained.

The web artifact was rebuilt without stale Flutter web compilation caches and smoke-tested in Chrome, including secure web-storage plugin registration.
