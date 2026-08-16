# Changesets

Versioning via [Changesets](https://github.com/changesets/changesets).

```bash
npx changeset
```

> [!NOTE]
> Add a changeset for **user-facing** changes (API, engine behaviour, UI copy). Skip for docs-only or internal refactors unless they change a published contract.

| Command | When |
|---|---|
| <kbd>npx changeset</kbd> | After the work, before merge |
| Commit `.changeset/*.md` | With the feature |

This folder's generated `README.md` is the human note; do not put secrets in changeset files.

[Docs hub](../docs/README.md)
