# Security

## Reporting

If you find a vulnerability, **do not open a public issue**.

Email the maintainer privately (open a GitHub security advisory on this repository
once it is public, or email the address listed on the GitHub profile of the owner).

Please include:

- a description of the issue
- steps to reproduce
- impact (especially anything involving vehicle registration marks, location history, or credentials)

We will acknowledge within 7 days and aim to ship a fix before any disclosure.

## Registration marks

A UK vehicle registration mark is personal data. A report that a VRM leaked into a URL, log, analytics event, or error is treated as a privacy incident.

## Secrets

Never commit API keys, Wrangler secrets, or `.dev.vars`. Forked PRs run against fixtures only.
