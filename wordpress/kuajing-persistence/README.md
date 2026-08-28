# FYZSXNB Kuajing Dashboard WordPress plugin

This plugin mounts the built React dashboard at a WordPress page with the
`[kuajing_dashboard]` shortcode and adds authenticated persistence endpoints.

## Runtime storage

- Small dashboard state: `${table_prefix}kuajing_state` in WordPress MySQL.
- State writes use additive per-key revisions. Clients send `baseRevision` and
  `deviceId`; stale writes return HTTP 409 instead of overwriting newer data.
- Full state versions are kept in `${table_prefix}kuajing_state_versions` and
  CREATE/UPDATE/RESTORE audit events in `${table_prefix}kuajing_audit_events`.
- Uploaded source files: `kuajing-private-data` beside `public_html` when writable.
- Browser `localStorage` and IndexedDB remain an offline fallback.

Only users with `manage_options` can read or write server data. Public visitors
can open the dashboard, but their state stays in their own browser.

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

The local browser creates a stable device ID in `localStorage`. A compatible
client and server bundle must be switched together; production migration and
native schema verification are separately gated by KJ-01B.

## Deployment

Copy this directory to `wp-content/plugins/kuajing-persistence`, place the Vite
build in its `dist` directory, activate the plugin, and visit `/kuajing/`.
