# ADR 0004: DVLA VES retention

<table>
<tr>
<td><strong>Date</strong></td><td>2026-08-16</td>
</tr>
<tr>
<td><strong>Status</strong></td><td>

[![Accepted](https://img.shields.io/badge/status-accepted-1F6F63?style=flat-square)](#)

</td>
</tr>
<tr>
<td><strong>Spec</strong></td><td>§8.3, §13 `POST /v1/vehicles/resolve`</td>
</tr>
</table>

> [!IMPORTANT]
> A registration mark is personal data under UK GDPR when linkable to an individual. DVLA VES terms constrain use and caching. This ADR is the retention record required before P9.

## Context

Brim joins DVLA VES (`make`, fuel, capacity, CO₂, year, `euroStatus`) to the ingested VCA catalogue because VES has no model. The API key lives only on the Worker. The current VCA rows have **no model year**, so a registration-year window cannot be a join key yet.

## Decision

1. **On-demand lookup only.** `POST /v1/vehicles/resolve` with `{ vrm }` in the body. No VRM-keyed cache of VES payloads. No bulk scrape.
2. **Derived fields only.** Persist make, year, propulsion, cc, CO₂, euro status, and confirmed `vcaMatchId`. Never store the raw VES JSON.
3. **Year comes from VES, not VCA.** Join on make + fuel + cc ±50 + CO₂ ±5. Copy `yearOfManufacture` onto the vehicle profile. Revisit the year window when the catalogue has years.
4. **Encrypted VRM only on a signed-in save.** HMAC-SHA256 `vrm_hash` and AES-256-GCM `vrm_encrypted` using `VRM_ENCRYPTION_KEY`. Anonymous resolve discards the plate. Missing key: save the profile without VRM columns.
5. **Delete with the vehicle or account.** List/GET never include `vrm_hash` or `vrm_encrypted`. Signed-in owner list/create/patch may include decrypted `vrm`. Anonymous responses never include `vrm`.
6. **No logs.** The redacting logger treats `vrm`, `reg`, `registration`, `plate`, `registrationNumber`, and `registration_number`. Resolve does not log the request body.

## Consequences

Forked PRs and `BRIM_FIXTURES=1` use dummy plates and recorded VES bodies. A later VCA dataset must not silently replace a saved `vcaMatchId`. Showing a decrypted plate in the garage is in for P12; ciphertext never leaves the API.
