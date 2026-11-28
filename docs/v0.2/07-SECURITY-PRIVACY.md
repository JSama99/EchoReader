# Security and privacy assessment

## Threats addressed in v0.2

| Threat | Control | Evidence |
|---|---|---|
| Zip bomb in a CBZ | Ratio check on declared sizes before inflating; streaming inflate stops at the declared size; per-page, total, entry-count and page-count limits | `import-test`: bomb, lying header |
| Path traversal / absolute paths in archives | Archive rejected if any entry name is unsafe; entry names are never used as file paths (pages are written as `page-0001.jpg`) | `import-test` (5 variants) and browser QA |
| Tampered or truncated archive entries | CRC-32 of every inflated page must match the central directory | `import-test` |
| Disguised files (wrong extension) | Type detected by magic bytes; non-images inside archives are skipped | `import-test` |
| Decoder memory exhaustion | Pixel dimensions read from headers; pages over 60 MP rejected before display; PDF pages rendered at ≤ 2048 px and ≤ 8 MP | `import-test`; PDF untested on device |
| Encrypted archives / PDFs | Rejected with a clear message | `import-test` (ZIP); PDF unverified |
| ComicInfo.xml entity expansion | 64 KB cap, `<!ENTITY` refused, only five plain fields read | `import-test` |
| Forged or altered catalog | ed25519 signature over canonical JSON; issuer bound to publisher; version monotonic; dev key untrusted in release builds for remote content | `catalog-test` |
| Paid content leaking via public bundles/manifests | Validator forbids public assets on paid pages past preview and on unpublished pages; server issues 5-minute signed URLs only after `authorizePages()` | `catalog-test`, `server-access-test` |
| Client granting itself access | Production trust ignores sandbox/local entitlements; on the server, entitlements, purchases and collectibles have no client write policy | `commerce-test`, `test-db` |
| Ember inflation | Append-only log with idempotency keys; server awards only via `award_reward()` with rule-defined amounts and caps; direct inserts denied | `commerce-test`, `test-db` |
| Fake "verified" collectibles | `isVerifiedOwnership()` requires a complete chain record in production; DB CHECK constraint enforces the same (a NULL-unsafe version was caught by the tests and fixed) | `commerce-test`, `test-db` |
| Supply overselling | `allocate_serial()` under an advisory lock, bounded by supply, service role only | `test-db` |
| Spam / abuse in community | Posting has no insert policy at the database and no composer in the app | `test-db`, UI |

## Privacy

- **Imported comics never leave the device.** No upload path exists. The backend schema rejects `local:*` progress keys, so even a future sync can't carry them.
- **Analytics are off by default.** When enabled, there are no account or device ids (random per-launch session id only). Imported comics are reported only as format plus a page-count bucket, never title, file name or id. Durations are capped. The reader can inspect the queue in Profile. No transport is configured, so nothing is sent in this build.
- **Synthetic data is flagged**: development and sandbox events carry `synthetic: true`.
- **Erase**: Profile → "Erase all EchoReader data" deletes imported files and all state on the device. Server-side account deletion cascades in the schema; the app endpoint is part of the accounts work.
- **No secrets in the app bundle.** `EXPO_PUBLIC_*` values are public by design. The committed signing key is a declared development key, untrusted in release builds for remote manifests.

## Integrity is not ownership

POW hashes and manifest signatures prove that files match what the publisher recorded and that the record came from a trusted key. They do not prove copyright ownership, authorship or blockchain ownership. The UI says this in the Vault and in the editions copy; collectibles are labeled Sandbox, Reserved or Awaiting verification until a verified chain record exists.

## Residual risks (open)

- PDF rendering runs platform engines on untrusted files. PDFKit and PdfRenderer are system components, but malformed-file behavior is unverified on device.
- On-device entitlements can be edited by a user with a rooted or jailbroken device. That only affects pages already on the device; paid pages are never on the device without a server grant once remote delivery ships.
- The development signing key is public. Release builds must ship with a production key before remote manifests are enabled.
- No rate limiting exists yet on the (undeployed) edge function.
