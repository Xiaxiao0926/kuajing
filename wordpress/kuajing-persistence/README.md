# FYZSXNB Kuajing Dashboard WordPress plugin

This plugin mounts the built React dashboard at a WordPress page with the
`[kuajing_dashboard]` shortcode and adds authenticated persistence endpoints.

## Runtime storage

- Small dashboard state: `${table_prefix}kuajing_state` in WordPress MySQL.
- Uploaded source files: `kuajing-private-data` beside `public_html` when writable.
- Browser `localStorage` and IndexedDB remain an offline fallback.

Only users with `manage_options` can read or write server data. Public visitors
can open the dashboard, but their state stays in their own browser.

## Deployment

Copy this directory to `wp-content/plugins/kuajing-persistence`, place the Vite
build in its `dist` directory, activate the plugin, and visit `/kuajing/`.
