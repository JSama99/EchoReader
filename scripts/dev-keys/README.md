# Development signing key: PUBLIC, NOT A SECRET

`talonsight-dev-1.pem` signs the bundled manifests during development, so
anyone (CI, contributors, coding agents) can rebuild them.

It is **deliberately committed** and is therefore **not trusted by production
builds**. In a release build, manifests signed with it show as
"Signed with a development key".

To sign for production:

```bash
npm run keygen -- ~/.talonsight/echoreader-prod-1.pem   # keep this file private, never commit it
# add the printed public key to src/content/trust.ts with environment: 'production'
npm run build-manifests -- --key ~/.talonsight/echoreader-prod-1.pem --key-id talonsight-prod-1
```
