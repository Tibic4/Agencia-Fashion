# Android App Links — `assetlinks.json`

Para que `https://crialook.com.br/campaign/<uuid>` abra direto no app (sem prompt de
"abrir com…"), o domínio precisa servir `https://crialook.com.br/.well-known/assetlinks.json`
público (HTTP 200, sem redirect, content-type `application/json`).

## Como obter o SHA-256

Após o primeiro `eas build -p android --profile production`:

```bash
eas credentials -p android
# Selecione: production -> Keystore: Show keystore credentials
# Copie a "SHA-256 Fingerprint"
```

OU via Play Console > Setup > App integrity > App signing > "Copy SHA-256
certificate fingerprint" (use o de **App signing key**, não upload key).

## Conteúdo final

Substitua `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` em `assetlinks.json` pelo
fingerprint formato `AB:CD:EF:...:12` (64 caracteres hex separados por `:`).

Você pode listar múltiplos fingerprints (debug + release) no array.

## Deploy

Servir esse arquivo em:
```
https://crialook.com.br/.well-known/assetlinks.json
```

Validar com:
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://crialook.com.br&relation=delegate_permission/common.handle_all_urls
```

Sem isso, `autoVerify: true` em `app.json:33` fica em estado "verification failed"
e o sistema só usa o fallback de scheme `crialook://`.

## Sync (source-of-truth)

Authoritative copy: `crialook-app/store-assets/assetlinks.json` (this directory).
Deploy copy:        `campanha-ia/public/.well-known/assetlinks.json` (served by Next.js).

Workflow after replacing `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`:

```bash
cd crialook-app
npm run assetlinks:sync   # copy authoritative -> deploy target
npm run assetlinks:check  # CI-friendly drift check, exits 1 on diff
```

Then deploy `campanha-ia/` so the file is served at
`https://crialook.com.br/.well-known/assetlinks.json` and validate with the
Google API URL above.
