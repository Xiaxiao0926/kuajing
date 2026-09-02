# FYZSXNB Kuajing Dashboard WordPress plugin

This plugin mounts the built React dashboard at a WordPress page with the
`[kuajing_dashboard]` shortcode and adds authenticated persistence endpoints.

## Runtime storage

- Small dashboard state: `${table_prefix}kuajing_state` in WordPress MySQL.
- State writes use additive per-key revisions. Clients send `baseRevision` and
  `deviceId`; stale writes return HTTP 409 instead of overwriting newer data.
- Full state versions are kept in `${table_prefix}kuajing_state_versions` and
  CREATE/UPDATE/RESTORE audit events in `${table_prefix}kuajing_audit_events`.
- Rejected concurrent edits and local-newer snapshots are stored separately in
  `${table_prefix}kuajing_state_backups`, so a conflict never destroys either
  the accepted server value or the other endpoint's content. The latest 100
  snapshots per state key are retained.
- Uploaded source files: `kuajing-private-data` beside `public_html` when writable.
- Replacing or deleting a source file first creates a server-side snapshot; the
  latest 20 snapshots are retained for each namespace and filename.
- Browser `localStorage` and IndexedDB remain an offline fallback. Failed source
  file uploads stay in a durable IndexedDB queue and retry after login or when
  connectivity returns.

WordPress administrators and visitors with a valid Kuajing password session can
read and write the shared server data. Browser storage is only an offline cache.

## State API

- `GET /wp-json/kuajing/v1/state` returns each value with `revision`,
  `updatedAt` and `updatedByDevice`.
- `POST /wp-json/kuajing/v1/state` accepts
  `entries[key] = { value, baseRevision, deviceId }` and commits the whole
  request atomically. A stale base returns HTTP 409 with the server revision
  and value.
- `GET /wp-json/kuajing/v1/state/history?key=...` reads full versions.
- `POST /wp-json/kuajing/v1/state/restore` restores a history revision as a
  new, conflict-protected revision.
- `POST /wp-json/kuajing/v1/state/backup` appends a lossless snapshot of a
  rejected or locally newer edit without changing the accepted state.
- `GET /wp-json/kuajing/v1/state/backups?key=...` lists recoverable conflict
  snapshots.

The local browser creates a stable device ID in `localStorage`. A compatible
client and server bundle must be switched together; production migration and
native schema verification are separately gated by KJ-01B.

## Deployment

Copy this directory to `wp-content/plugins/kuajing-persistence`, place the Vite
build in its `dist` directory, activate the plugin, and visit `/kuajing/`.
