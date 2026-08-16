# Security

<p align="center">
  <img src="https://img.shields.io/badge/VRM-personal_data-C4472F?style=flat-square" alt="VRM is personal data"/>
  <img src="https://img.shields.io/badge/public_repo-no_secrets_in_git-14171A?style=flat-square" alt="No secrets in git"/>
</p>

> [!CAUTION]
> If you find a vulnerability, **do not open a public issue.**

## Reporting

Use **GitHub Private vulnerability reporting** on this repository (Security → Report a vulnerability), or email the address on the GitHub profile of the owner.

Please include:

1. A description of the issue
2. Steps to reproduce
3. Impact — especially anything involving vehicle registration marks, location history, or credentials

We will acknowledge within **7 days** and aim to ship a fix before any disclosure.

---

## Registration marks

A UK vehicle registration mark is personal data under UK GDPR when linkable to an individual.

A report that a VRM leaked into a **URL**, **log**, **analytics event**, or **error** is treated as a **privacy incident**.

| Never | Instead |
|---|---|
| Path or query string | `POST /v1/vehicles/resolve` with `{ vrm }` in the **body** |
| `console.log` of objects typed with `vrm` | Redacting logger only |
| Stored for anonymous users | Resolve and discard |
| Required to estimate | Make/model is a first-class path |

---

## Secrets

Never commit API keys, Wrangler secrets, or `.dev.vars`.

| Live credentials live in | Forked PRs |
|---|---|
| Wrangler secrets · GitHub environments | Fixtures only (`BRIM_FIXTURES=1`) |

```diff
- FUEL_FINDER_CLIENT_SECRET=real-value
+ # Wrangler secret / GitHub environment — never the tree
```

---

## Scope we care about most

- Auth cookie theft or session fixation
- RLS bypass on Neon
- VRM or location leaking off-box
- Secrets in client bundles (`apps/web`, `apps/extension`)
