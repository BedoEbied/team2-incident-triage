# Verification notes

No Expo device or simulator was attached to this shell, so two native observations could not be
performed by tapping through the app:

- inspecting the device keychain immediately after Sign out;
- launching the terminated app from an OS-level `triage://incident/<id>` URL.

The closest automated verification is committed and passing:

- `tokenStore.test.ts` proves the JWT is read, written, and deleted through the same SecureStore
  key used by `AuthContext.logout`;
- `pollController.test.ts` proves a missing token schedules nothing, replacement clears the old
  interval, and unmount cleanup is idempotent;
- `links.test.ts` proves generated notification paths resolve to `/incident/<id>`, rejects
  untrusted destinations, and normalizes cold-start route parameters;
- the root navigator now mounts before asynchronous SecureStore restoration, so Expo Router can
  retain its initial native URL while the protected layout waits for the session.

Both production and development Android bundles completed successfully.
