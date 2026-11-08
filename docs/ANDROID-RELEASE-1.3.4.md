# Android release 1.3.4 (build 22)

Both native Android apps use the live BEMS service at https://bemserp.work.

- Staff Portal: personal wallet, bank verification, approved withdrawals, requests and staff services.
- GMD AI Cockpit: executive wallet and release operations, AI access, and the owner-authorized temporary Super Admin access. Server authorization remains authoritative.

The APKs are signed with the BEMS production release certificate, not the previous Android Debug certificate. Signing material is private and excluded from Git. Keep a separate secure backup of the release keystore and its credentials; future updates must use the same key.

Old debug-signed installations may need uninstalling before installing this release. This clears local app preferences and sessions; company records remain on the server. Users sign in again. Existing minimum versions and force-update settings are preserved during publication.

The owner-authorized wallet activation is separate from building the apps. A successful installation does not enable server payment switches or unpause the funding pool.

Install from https://bemserp.work/download on an Android phone. The download buttons resolve the active release; versioned files are retained for rollback.
