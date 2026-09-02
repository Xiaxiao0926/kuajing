<?php
/**
 * Plugin Name: FYZSXNB Kuajing Dashboard
 * Description: Serves the Kuajing React dashboard and stores shared dashboard data on the WordPress server.
 * Version: 0.3.3
 * Author: FYZSXNB
 */

if (!defined('ABSPATH')) {
    exit;
}

final class FYZSXNB_Kuajing_Dashboard {
    private const VERSION = '0.3.3';
    private const TABLE_SUFFIX = 'kuajing_state';
    private const STATE_VERSIONS_SUFFIX = 'kuajing_state_versions';
    private const STATE_BACKUPS_SUFFIX = 'kuajing_state_backups';
    private const AUDIT_EVENTS_SUFFIX = 'kuajing_audit_events';
    private const VERSION_OPTION = 'fyzsxnb_kuajing_version';
    private const SECRET_OPTION = 'fyzsxnb_kuajing_access_secret';
    private const ACCESS_COOKIE = 'fyzsxnb_kuajing_access';
    private const ACCESS_PASSWORD_HASH = 'b0646924cb4681e592a0e05068dfaeb40d0807466087c6c1ad5a1ac52d439e54';
    private const SESSION_TTL = 604800;
    private const MAX_FILE_SIZE = 52428800;
    private const MAX_BACKUPS_PER_KEY = 100;
    private const MAX_FILE_BACKUPS_PER_NAME = 20;
    private const ALLOWED_EXTENSIONS = array('xlsx', 'xls', 'csv', 'json', 'html', 'htm', 'doc', 'docx');

    public static function init() {
        add_action('init', array(__CLASS__, 'maybe_upgrade'));
        add_shortcode('kuajing_dashboard', array(__CLASS__, 'render_dashboard'));
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_filter('rest_post_dispatch', array(__CLASS__, 'prevent_rest_cache'), 10, 3);
        add_filter('script_loader_tag', array(__CLASS__, 'module_script_tag'), 10, 3);
        add_action('template_redirect', array(__CLASS__, 'serve_private_file'));
        // T5-1：给 /kuajing/ 页面加 body class，供 Workspace 全出血样式 scope（不影响其他页面）
        add_filter('body_class', array(__CLASS__, 'add_dashboard_body_class'));
    }

    public static function add_dashboard_body_class($classes) {
        if (is_page('kuajing')) {
            $classes[] = 'fyzsxnb-kuajing-page';
        }
        return $classes;
    }

    public static function activate() {
        self::install_or_upgrade();
    }

    public static function maybe_upgrade() {
        if (get_option(self::VERSION_OPTION) !== self::VERSION) {
            self::install_or_upgrade();
        }
    }

    private static function install_or_upgrade() {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table_name();
        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE {$table} (
            user_id bigint(20) unsigned NOT NULL,
            state_key varchar(191) NOT NULL,
            state_value longtext NULL,
            updated_at_ms bigint(20) unsigned NOT NULL,
            updated_at datetime NOT NULL,
            revision bigint(20) unsigned NOT NULL DEFAULT 1,
            updated_by_device varchar(191) NOT NULL DEFAULT '',
            PRIMARY KEY  (user_id, state_key)
        ) {$charset_collate};";
        dbDelta($sql);

        $versions_table = self::state_versions_table_name();
        $versions_sql = "CREATE TABLE {$versions_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            state_key varchar(191) NOT NULL,
            revision bigint(20) unsigned NOT NULL,
            payload longtext NULL,
            created_at datetime NOT NULL,
            device_id varchar(191) NOT NULL DEFAULT '',
            PRIMARY KEY  (id),
            UNIQUE KEY state_revision (user_id, state_key, revision),
            KEY state_lookup (user_id, state_key, revision)
        ) {$charset_collate};";
        dbDelta($versions_sql);

        $backups_table = self::state_backups_table_name();
        $backups_sql = "CREATE TABLE {$backups_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            state_key varchar(191) NOT NULL,
            payload longtext NULL,
            base_revision bigint(20) unsigned NOT NULL DEFAULT 0,
            server_revision bigint(20) unsigned NOT NULL DEFAULT 0,
            client_updated_at_ms bigint(20) unsigned NOT NULL DEFAULT 0,
            device_id varchar(191) NOT NULL DEFAULT '',
            reason varchar(32) NOT NULL DEFAULT 'revision_conflict',
            snapshot_hash char(64) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY snapshot_hash (snapshot_hash),
            KEY backup_lookup (user_id, state_key, created_at)
        ) {$charset_collate};";
        dbDelta($backups_sql);

        $audit_table = self::audit_events_table_name();
        $audit_sql = "CREATE TABLE {$audit_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            entity_type varchar(64) NOT NULL,
            entity_id varchar(191) NOT NULL,
            action varchar(32) NOT NULL,
            from_revision bigint(20) unsigned NOT NULL DEFAULT 0,
            to_revision bigint(20) unsigned NOT NULL,
            device_id varchar(191) NOT NULL DEFAULT '',
            created_at datetime NOT NULL,
            metadata longtext NULL,
            PRIMARY KEY  (id),
            KEY audit_entity (user_id, entity_type, entity_id, created_at),
            KEY audit_action (action, created_at)
        ) {$charset_collate};";
        dbDelta($audit_sql);

        self::ensure_access_secret();
        self::ensure_private_root();
        self::ensure_dashboard_page();
        self::migrate_shared_state();
        self::backfill_state_safety_columns();
        self::seed_state_history();
        self::migrate_shared_files();
        update_option(self::VERSION_OPTION, self::VERSION, false);
        do_action('litespeed_purge_url', rest_url('kuajing/v1/session'));
        do_action('litespeed_purge_url', rest_url('kuajing/v1/state'));
        do_action('litespeed_purge_all');
        wp_cache_flush();
    }

    private static function table_name() {
        global $wpdb;
        return $wpdb->prefix . self::TABLE_SUFFIX;
    }

    private static function state_versions_table_name() {
        global $wpdb;
        return $wpdb->prefix . self::STATE_VERSIONS_SUFFIX;
    }

    private static function state_backups_table_name() {
        global $wpdb;
        return $wpdb->prefix . self::STATE_BACKUPS_SUFFIX;
    }

    private static function audit_events_table_name() {
        global $wpdb;
        return $wpdb->prefix . self::AUDIT_EVENTS_SUFFIX;
    }

    private static function backfill_state_safety_columns() {
        global $wpdb;
        $wpdb->query('UPDATE ' . self::table_name() . ' SET revision = 1 WHERE revision IS NULL OR revision < 1');
        $wpdb->query("UPDATE " . self::table_name() . " SET updated_by_device = '' WHERE updated_by_device IS NULL");
    }

    private static function seed_state_history() {
        global $wpdb;
        $rows = $wpdb->get_results(
            'SELECT state_key, state_value, revision, updated_at FROM ' . self::table_name() . ' WHERE user_id = 0',
            ARRAY_A
        );
        foreach ((array) $rows as $row) {
            $revision = max(1, (int) ($row['revision'] ?? 1));
            $key = (string) $row['state_key'];
            $history_id = $wpdb->get_var($wpdb->prepare(
                'SELECT id FROM ' . self::state_versions_table_name() . ' WHERE user_id = %d AND state_key = %s AND revision = %d',
                0,
                $key,
                $revision
            ));
            if (null === $history_id) {
                $wpdb->insert(
                    self::state_versions_table_name(),
                    array(
                        'user_id' => 0,
                        'state_key' => $key,
                        'revision' => $revision,
                        'payload' => (string) $row['state_value'],
                        'created_at' => $row['updated_at'],
                        'device_id' => '',
                    ),
                    array('%d', '%s', '%d', '%s', '%s', '%s')
                );
            }

            $audit_id = $wpdb->get_var($wpdb->prepare(
                'SELECT id FROM ' . self::audit_events_table_name() . ' WHERE user_id = %d AND entity_type = %s AND entity_id = %s AND action = %s AND to_revision = %d LIMIT 1',
                0,
                'state',
                $key,
                'CREATE',
                $revision
            ));
            if (null === $audit_id) {
                $wpdb->insert(
                    self::audit_events_table_name(),
                    array(
                        'user_id' => 0,
                        'entity_type' => 'state',
                        'entity_id' => $key,
                        'action' => 'CREATE',
                        'from_revision' => 0,
                        'to_revision' => $revision,
                        'device_id' => '',
                        'created_at' => $row['updated_at'],
                        'metadata' => wp_json_encode(array('source' => 'migration')),
                    ),
                    array('%d', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s')
                );
            }
        }
    }

    private static function ensure_access_secret() {
        $secret = get_option(self::SECRET_OPTION);
        if (!is_string($secret) || strlen($secret) < 32) {
            update_option(self::SECRET_OPTION, wp_generate_password(64, true, true), false);
        }
    }

    private static function access_secret() {
        self::ensure_access_secret();
        return (string) get_option(self::SECRET_OPTION);
    }

    private static function ensure_dashboard_page() {
        $existing = get_page_by_path('kuajing');
        if ($existing instanceof WP_Post) {
            return;
        }

        wp_insert_post(array(
            'post_title' => '跨境运营工具',
            'post_name' => 'kuajing',
            'post_content' => '[kuajing_dashboard]',
            'post_status' => 'publish',
            'post_type' => 'page',
        ));
    }

    private static function private_root() {
        $outside_web_root = trailingslashit(dirname(ABSPATH)) . 'kuajing-private-data';
        if (is_dir($outside_web_root) || wp_mkdir_p($outside_web_root)) {
            return $outside_web_root;
        }
        return trailingslashit(WP_CONTENT_DIR) . 'kuajing-private-data';
    }

    private static function ensure_private_root() {
        $root = self::private_root();
        wp_mkdir_p($root);
        if (strpos($root, WP_CONTENT_DIR) === 0) {
            $rules = "Require all denied\nDeny from all\n";
            if (!file_exists(trailingslashit($root) . '.htaccess')) {
                file_put_contents(trailingslashit($root) . '.htaccess', $rules);
            }
            if (!file_exists(trailingslashit($root) . 'index.php')) {
                file_put_contents(trailingslashit($root) . 'index.php', "<?php\n// Silence is golden.\n");
            }
        }
        return $root;
    }

    private static function shared_namespace_dir($namespace) {
        $namespace = sanitize_key($namespace);
        if (!$namespace) {
            return new WP_Error('invalid_namespace', 'Invalid file namespace.', array('status' => 400));
        }
        $directory = trailingslashit(self::ensure_private_root()) . 'shared/' . $namespace;
        if (!wp_mkdir_p($directory)) {
            return new WP_Error('storage_unavailable', 'Unable to create private storage.', array('status' => 500));
        }
        return $directory;
    }

    private static function backup_existing_file($namespace, $path, $reason) {
        if (!is_file($path)) {
            return true;
        }
        $name = basename($path);
        $directory = trailingslashit(self::ensure_private_root()) . 'file-backups/' . sanitize_key($namespace);
        if (!wp_mkdir_p($directory)) {
            return false;
        }
        $now = microtime(true);
        $microseconds = (int) floor(($now - floor($now)) * 1000000);
        $snapshot = sprintf(
            '%s-%06d--%s--%s--%s',
            gmdate('Ymd-His', (int) $now),
            $microseconds,
            substr(hash_file('sha256', $path), 0, 16),
            sanitize_key($reason),
            $name
        );
        if (!copy($path, trailingslashit($directory) . $snapshot)) {
            return false;
        }
        @chmod(trailingslashit($directory) . $snapshot, 0640);

        $suffix = '--' . $name;
        $backups = array_values(array_filter((array) scandir($directory), static function($entry) use ($suffix) {
            return strlen($entry) > strlen($suffix) && substr($entry, -strlen($suffix)) === $suffix;
        }));
        rsort($backups, SORT_STRING);
        foreach (array_slice($backups, self::MAX_FILE_BACKUPS_PER_NAME) as $old_backup) {
            @unlink(trailingslashit($directory) . $old_backup);
        }
        return true;
    }

    private static function migrate_shared_state() {
        global $wpdb;
        $rows = $wpdb->get_results(
            'SELECT state_key, state_value, updated_at_ms, updated_at, revision, updated_by_device FROM ' . self::table_name() . ' WHERE user_id <> 0 ORDER BY updated_at_ms ASC',
            ARRAY_A
        );
        foreach ((array) $rows as $row) {
            $existing = $wpdb->get_row($wpdb->prepare(
                'SELECT updated_at_ms, revision, updated_by_device FROM ' . self::table_name() . ' WHERE user_id = 0 AND state_key = %s',
                $row['state_key']
            ), ARRAY_A);
            if (null !== $existing && (int) $existing['updated_at_ms'] >= (int) $row['updated_at_ms']) {
                continue;
            }
            $wpdb->replace(
                self::table_name(),
                array(
                    'user_id' => 0,
                    'state_key' => $row['state_key'],
                    'state_value' => $row['state_value'],
                    'updated_at_ms' => (int) $row['updated_at_ms'],
                    'updated_at' => $row['updated_at'],
                    'revision' => max(1, (int) ($row['revision'] ?? 1)),
                    'updated_by_device' => sanitize_text_field((string) ($row['updated_by_device'] ?? '')),
                ),
                array('%d', '%s', '%s', '%d', '%s', '%d', '%s')
            );
        }
    }

    private static function migrate_shared_files() {
        $root = self::ensure_private_root();
        $shared = trailingslashit($root) . 'shared';
        wp_mkdir_p($shared);
        foreach ((array) glob(trailingslashit($root) . '*', GLOB_ONLYDIR) as $user_dir) {
            if (!ctype_digit(basename($user_dir))) {
                continue;
            }
            self::copy_directory($user_dir, $shared);
        }
    }

    private static function copy_directory($source, $destination) {
        foreach ((array) scandir($source) as $entry) {
            if ('.' === $entry || '..' === $entry) {
                continue;
            }
            $source_path = trailingslashit($source) . $entry;
            $destination_path = trailingslashit($destination) . $entry;
            if (is_dir($source_path)) {
                wp_mkdir_p($destination_path);
                self::copy_directory($source_path, $destination_path);
                continue;
            }
            if (!is_file($source_path)) {
                continue;
            }
            if (!file_exists($destination_path) || filemtime($source_path) > filemtime($destination_path)) {
                copy($source_path, $destination_path);
                @chmod($destination_path, 0640);
            }
        }
    }

    private static function cookie_options($expires) {
        return array(
            'expires' => $expires,
            'path' => '/',
            'domain' => defined('COOKIE_DOMAIN') && COOKIE_DOMAIN ? COOKIE_DOMAIN : '',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        );
    }

    private static function create_access_token($expires) {
        $signature = hash_hmac('sha256', (string) $expires, self::access_secret());
        return $expires . '.' . $signature;
    }

    private static function has_valid_access_cookie() {
        $token = isset($_COOKIE[self::ACCESS_COOKIE]) ? wp_unslash($_COOKIE[self::ACCESS_COOKIE]) : '';
        if (!is_string($token) || !preg_match('/^(\d+)\.([a-f0-9]{64})$/', $token, $matches)) {
            return false;
        }
        $expires = (int) $matches[1];
        if ($expires <= time()) {
            return false;
        }
        $expected = hash_hmac('sha256', (string) $expires, self::access_secret());
        return hash_equals($expected, $matches[2]);
    }

    private static function rate_limit_key() {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
        return 'fyzsxnb_kuajing_login_' . md5($ip);
    }

    public static function can_access() {
        self::send_private_cache_headers();
        return current_user_can('manage_options') || self::has_valid_access_cookie();
    }

    private static function send_private_cache_headers() {
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        do_action('litespeed_control_set_nocache', 'Kuajing private REST response');
        nocache_headers();
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private', true);
        header('X-LiteSpeed-Cache-Control: no-cache', true);
        header('Vary: Cookie', false);
    }

    public static function prevent_rest_cache($response, $server, $request) {
        if (0 !== strpos($request->get_route(), '/kuajing/v1/')) {
            return $response;
        }
        $response = rest_ensure_response($response);
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        $response->header('X-LiteSpeed-Cache-Control', 'no-cache');
        $response->header('Pragma', 'no-cache');
        $response->header('Vary', 'Cookie');
        return $response;
    }

    public static function get_session() {
        self::send_private_cache_headers();
        return rest_ensure_response(array('authorized' => self::can_access()));
    }

    public static function create_session(WP_REST_Request $request) {
        self::send_private_cache_headers();
        $rate_key = self::rate_limit_key();
        $attempts = (int) get_transient($rate_key);
        if ($attempts >= 10) {
            return new WP_Error('too_many_attempts', 'Too many failed attempts. Try again later.', array('status' => 429));
        }

        $body = $request->get_json_params();
        $password = isset($body['password']) ? (string) $body['password'] : '';
        if (!hash_equals(self::ACCESS_PASSWORD_HASH, hash('sha256', $password))) {
            set_transient($rate_key, $attempts + 1, 10 * MINUTE_IN_SECONDS);
            return new WP_Error('invalid_password', 'Invalid access password.', array('status' => 401));
        }

        delete_transient($rate_key);
        $expires = time() + self::SESSION_TTL;
        setcookie(self::ACCESS_COOKIE, self::create_access_token($expires), self::cookie_options($expires));
        return rest_ensure_response(array(
            'authorized' => true,
            'expiresAt' => gmdate('c', $expires),
        ));
    }

    public static function delete_session() {
        self::send_private_cache_headers();
        setcookie(self::ACCESS_COOKIE, '', self::cookie_options(time() - HOUR_IN_SECONDS));
        return rest_ensure_response(array('authorized' => false));
    }

    public static function render_dashboard() {
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }

        $manifest_path = null;
        foreach (array('dist/manifest.json', 'dist/.vite/manifest.json') as $relative_path) {
            $candidate = plugin_dir_path(__FILE__) . $relative_path;
            if (file_exists($candidate)) {
                $manifest_path = $candidate;
                break;
            }
        }
        if (!$manifest_path) {
            return '<p>Kuajing dashboard assets are not deployed.</p>';
        }

        $manifest = json_decode(file_get_contents($manifest_path), true);
        $entry = isset($manifest['index.html'])
            ? $manifest['index.html']
            : ($manifest['src/main.jsx'] ?? null);
        if (!$entry || empty($entry['file'])) {
            return '<p>Kuajing dashboard manifest is invalid.</p>';
        }

        $authorized = current_user_can('manage_options');
        $handle = 'fyzsxnb-kuajing-app';
        foreach ((array) ($entry['css'] ?? array()) as $index => $css_file) {
            wp_enqueue_style(
                $handle . '-style-' . $index,
                plugins_url('dist/' . $css_file, __FILE__),
                array(),
                self::VERSION
            );
        }

        wp_enqueue_script(
            $handle,
            plugins_url('dist/' . $entry['file'], __FILE__),
            array(),
            self::VERSION,
            true
        );
        $config = wp_json_encode(array(
            'apiBase' => esc_url_raw(rest_url('kuajing/v1')),
            'assetBase' => esc_url_raw(plugins_url('dist/', __FILE__)),
            'dataBase' => 'https://raw.githubusercontent.com/Xiaxiao0926/kuajing/main/ozon-react/public/data/',
            'authorized' => $authorized,
            'sessionRequired' => true,
            'nonce' => $authorized ? wp_create_nonce('wp_rest') : '',
        ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

        return '<style id="fyzsxnb-kuajing-workspace-css">'
            // T5-1：全出血 Workspace（scope 到 /kuajing/ 页 body class，禁止全局选择器）
            . 'body.fyzsxnb-kuajing-page{overflow-x:clip;}'
            . 'body.fyzsxnb-kuajing-page .fyzsxnb-kuajing-root{width:100vw;margin-left:calc(50% - 50vw);}'
            // T5-3：压缩 WordPress 页面标题的 Hero 感（仅 kuajing 页；标题 28-32px，区域约 64-80px）
            . 'body.fyzsxnb-kuajing-page .entry-title,'
            . 'body.fyzsxnb-kuajing-page .page-title,'
            . 'body.fyzsxnb-kuajing-page article h1,'
            . 'body.fyzsxnb-kuajing-page .entry-content>h1,'
            . 'body.fyzsxnb-kuajing-page h1.entry-title{font-size:28px!important;font-weight:650!important;line-height:1.25!important;margin:0 0 4px!important;padding:0!important;letter-spacing:-0.01em!important;}'
            . 'body.fyzsxnb-kuajing-page .entry-content,'
            . 'body.fyzsxnb-kuajing-page article .entry-content{padding-top:12px!important;}'
            // T5-3：Workspace 主区域 min-height，避免 1080p 下 WP Footer 紧贴工作台
            . 'body.fyzsxnb-kuajing-page .fyzsxnb-workspace{min-height:calc(100vh - 240px);}'
            . '</style>'
            . '<script type="application/json" id="fyzsxnb-kuajing-config">' . $config . '</script>'
            . '<div id="root" class="fyzsxnb-kuajing-root"></div>';
    }

    public static function module_script_tag($tag, $handle, $src) {
        if ('fyzsxnb-kuajing-app' !== $handle) {
            return $tag;
        }
        return '<script type="module" src="' . esc_url($src) . '"></script>';
    }

    public static function register_routes() {
        register_rest_route('kuajing/v1', '/session', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_session'),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'create_session'),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => array(__CLASS__, 'delete_session'),
                'permission_callback' => '__return_true',
            ),
        ));

        register_rest_route('kuajing/v1', '/state', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_state'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'save_state'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
        ));

        register_rest_route('kuajing/v1', '/state/history', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_state_history'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
        ));

        register_rest_route('kuajing/v1', '/state/backup', array(
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'backup_state'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
        ));

        register_rest_route('kuajing/v1', '/state/backups', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_state_backups'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
        ));

        register_rest_route('kuajing/v1', '/state/restore', array(
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'restore_state'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
        ));

        register_rest_route('kuajing/v1', '/files/(?P<namespace>[a-z0-9_-]+)', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'list_files'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'upload_file'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
            array(
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => array(__CLASS__, 'delete_file'),
                'permission_callback' => array(__CLASS__, 'can_access'),
            ),
        ));
    }

    private static function normalize_device_id($device_id) {
        $device_id = sanitize_text_field((string) $device_id);
        if (strlen($device_id) > 191) {
            $device_id = substr($device_id, 0, 191);
        }
        return $device_id ?: 'unknown-device';
    }

    private static function decode_state_value($encoded) {
        $value = json_decode((string) $encoded, true);
        return JSON_ERROR_NONE === json_last_error() ? $value : null;
    }

    private static function current_state_row($key, $for_update = false) {
        global $wpdb;
        $sql = 'SELECT state_key, state_value, updated_at_ms, updated_at, revision, updated_by_device FROM ' . self::table_name() . ' WHERE user_id = %d AND state_key = %s';
        if ($for_update) {
            $sql .= ' FOR UPDATE';
        }
        return $wpdb->get_row($wpdb->prepare($sql, 0, $key), ARRAY_A);
    }

    private static function state_entry_from_row($row) {
        return array(
            'key' => (string) $row['state_key'],
            'value' => self::decode_state_value($row['state_value']),
            'revision' => max(1, (int) ($row['revision'] ?? 1)),
            'updatedAt' => (int) ($row['updated_at_ms'] ?? 0),
            'updatedByDevice' => (string) ($row['updated_by_device'] ?? ''),
        );
    }

    private static function revision_conflict($key, $base_revision, $row) {
        $server_revision = $row ? max(1, (int) ($row['revision'] ?? 1)) : 0;
        return new WP_Error(
            'revision_conflict',
            'State changed on the server. Reload before saving again.',
            array(
                'status' => 409,
                'key' => $key,
                'clientRevision' => (int) $base_revision,
                'serverRevision' => $server_revision,
                'serverValue' => $row ? self::decode_state_value($row['state_value']) : null,
                'serverUpdatedAt' => $row ? (int) ($row['updated_at_ms'] ?? 0) : 0,
                'serverUpdatedByDevice' => $row ? (string) ($row['updated_by_device'] ?? '') : '',
            )
        );
    }

    private static function database_failure() {
        return new WP_Error('state_storage_error', 'State storage failed. No changes were committed.', array('status' => 500));
    }

    private static function write_state_row($key, $value, $revision, $updated_at_ms, $updated_at, $device_id, $current_row) {
        global $wpdb;
        $data = array(
            'user_id' => 0,
            'state_key' => $key,
            'state_value' => wp_json_encode($value),
            'updated_at_ms' => (int) $updated_at_ms,
            'updated_at' => $updated_at,
            'revision' => (int) $revision,
            'updated_by_device' => $device_id,
        );
        if ($current_row) {
            return false !== $wpdb->update(
                self::table_name(),
                array(
                    'state_value' => $data['state_value'],
                    'updated_at_ms' => $data['updated_at_ms'],
                    'updated_at' => $data['updated_at'],
                    'revision' => $data['revision'],
                    'updated_by_device' => $data['updated_by_device'],
                ),
                array('user_id' => 0, 'state_key' => $key),
                array('%s', '%d', '%s', '%d', '%s'),
                array('%d', '%s')
            );
        }
        return false !== $wpdb->insert(
            self::table_name(),
            $data,
            array('%d', '%s', '%s', '%d', '%s', '%d', '%s')
        );
    }

    private static function record_state_version($key, $value, $revision, $created_at, $device_id) {
        global $wpdb;
        return false !== $wpdb->insert(
            self::state_versions_table_name(),
            array(
                'user_id' => 0,
                'state_key' => $key,
                'revision' => (int) $revision,
                'payload' => wp_json_encode($value),
                'created_at' => $created_at,
                'device_id' => $device_id,
            ),
            array('%d', '%s', '%d', '%s', '%s', '%s')
        );
    }

    private static function record_audit_event($key, $action, $from_revision, $to_revision, $device_id, $metadata = array()) {
        global $wpdb;
        return false !== $wpdb->insert(
            self::audit_events_table_name(),
            array(
                'user_id' => 0,
                'entity_type' => 'state',
                'entity_id' => $key,
                'action' => $action,
                'from_revision' => (int) $from_revision,
                'to_revision' => (int) $to_revision,
                'device_id' => $device_id,
                'created_at' => current_time('mysql', true),
                'metadata' => wp_json_encode($metadata),
            ),
            array('%d', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s')
        );
    }

    public static function get_state() {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                'SELECT state_key, state_value, updated_at_ms, updated_at, revision, updated_by_device FROM ' . self::table_name() . ' WHERE user_id = %d',
                0
            ),
            ARRAY_A
        );
        $result = array();
        foreach ($rows as $row) {
            $result[$row['state_key']] = self::state_entry_from_row($row);
        }
        return rest_ensure_response($result);
    }

    public static function save_state(WP_REST_Request $request) {
        global $wpdb;
        $body = $request->get_json_params();
        $body = is_array($body) ? $body : array();
        $entries = isset($body['entries']) && is_array($body['entries'])
            ? $body['entries']
            : (array_key_exists('key', $body)
                ? array((string) $body['key'] => array(
                    'value' => array_key_exists('value', $body) ? $body['value'] : null,
                    'baseRevision' => $body['baseRevision'] ?? null,
                    'deviceId' => $body['deviceId'] ?? '',
                ))
                : array());

        $operations = array();
        $seen_keys = array();
        foreach ($entries as $raw_key => $entry) {
            $key = sanitize_text_field((string) $raw_key);
            if (!$key || strlen($key) > 191) {
                return new WP_Error('invalid_state_key', 'State key is invalid.', array('status' => 400));
            }
            if (isset($seen_keys[$key])) {
                return new WP_Error('duplicate_state_key', 'Each state key may appear only once per request.', array('status' => 400, 'key' => $key));
            }
            $seen_keys[$key] = true;
            if (!is_array($entry) || !array_key_exists('value', $entry) || !array_key_exists('baseRevision', $entry)) {
                return new WP_Error('revision_required', 'baseRevision is required for every state write.', array('status' => 400, 'key' => $key));
            }
            $base_revision = (string) $entry['baseRevision'];
            if (!preg_match('/^\d+$/', $base_revision)) {
                return new WP_Error('invalid_revision', 'baseRevision must be a non-negative integer.', array('status' => 400, 'key' => $key));
            }
            $operations[] = array(
                'key' => $key,
                'value' => $entry['value'],
                'baseRevision' => (int) $base_revision,
                'deviceId' => self::normalize_device_id($entry['deviceId'] ?? ''),
            );
        }

        if (count($operations) > 100) {
            return new WP_Error('too_many_state_entries', 'Too many state entries in one request.', array('status' => 413));
        }
        if (!$operations) {
            return rest_ensure_response(array('success' => true, 'saved' => array()));
        }

        if (false === $wpdb->query('START TRANSACTION')) {
            return self::database_failure();
        }

        $current_rows = array();
        foreach ($operations as $operation) {
            $key = $operation['key'];
            $current_rows[$key] = self::current_state_row($key, true);
            $current_revision = $current_rows[$key]
                ? max(1, (int) ($current_rows[$key]['revision'] ?? 1))
                : 0;
            if ($operation['baseRevision'] !== $current_revision) {
                $wpdb->query('ROLLBACK');
                return self::revision_conflict($key, $operation['baseRevision'], $current_rows[$key]);
            }
        }

        $saved = array();
        $now_ms = (int) floor(microtime(true) * 1000);
        $now_mysql = current_time('mysql', true);

        foreach ($operations as $operation) {
            $key = $operation['key'];
            $current = $current_rows[$key];
            $current_revision = $current ? max(1, (int) ($current['revision'] ?? 1)) : 0;
            $revision = $current_revision + 1;
            $updated_at_ms = $current
                ? max($now_ms, ((int) ($current['updated_at_ms'] ?? 0)) + 1)
                : $now_ms;
            if (!self::write_state_row($key, $operation['value'], $revision, $updated_at_ms, $now_mysql, $operation['deviceId'], $current)) {
                $wpdb->query('ROLLBACK');
                return self::database_failure();
            }
            if (!self::record_state_version($key, $operation['value'], $revision, $now_mysql, $operation['deviceId'])) {
                $wpdb->query('ROLLBACK');
                return self::database_failure();
            }
            if (!self::record_audit_event(
                $key,
                $current ? 'UPDATE' : 'CREATE',
                $current_revision,
                $revision,
                $operation['deviceId']
            )) {
                $wpdb->query('ROLLBACK');
                return self::database_failure();
            }
            $saved[$key] = array(
                'key' => $key,
                'value' => $operation['value'],
                'revision' => $revision,
                'updatedAt' => $updated_at_ms,
                'updatedByDevice' => $operation['deviceId'],
            );
        }

        if (false === $wpdb->query('COMMIT')) {
            $wpdb->query('ROLLBACK');
            return self::database_failure();
        }

        return rest_ensure_response(array('success' => true, 'saved' => $saved));
    }

    public static function backup_state(WP_REST_Request $request) {
        global $wpdb;
        $body = $request->get_json_params();
        $body = is_array($body) ? $body : array();
        $key = sanitize_text_field((string) ($body['key'] ?? ''));
        if (!$key || strlen($key) > 191 || !array_key_exists('value', $body)) {
            return new WP_Error('invalid_backup', 'A valid key and value are required.', array('status' => 400));
        }
        $base_revision = (string) ($body['baseRevision'] ?? '0');
        $client_updated_at = (string) ($body['clientUpdatedAt'] ?? '0');
        if (!preg_match('/^\d+$/', $base_revision) || !preg_match('/^\d+$/', $client_updated_at)) {
            return new WP_Error('invalid_backup_revision', 'Backup revisions and timestamps must be non-negative integers.', array('status' => 400));
        }
        $device_id = self::normalize_device_id($body['deviceId'] ?? '');
        $allowed_reasons = array('revision_conflict', 'local_newer', 'conflict_edit');
        $reason = sanitize_key((string) ($body['reason'] ?? 'revision_conflict'));
        if (!in_array($reason, $allowed_reasons, true)) {
            $reason = 'revision_conflict';
        }
        $payload = wp_json_encode($body['value']);
        if (false === $payload) {
            return new WP_Error('invalid_backup_payload', 'Backup value could not be encoded.', array('status' => 400));
        }
        $current = self::current_state_row($key, false);
        $server_revision = $current ? max(1, (int) ($current['revision'] ?? 1)) : 0;
        $snapshot_hash = hash('sha256', implode('|', array(
            '0',
            $key,
            $payload,
            (string) ((int) $base_revision),
            (string) ((int) $client_updated_at),
            $device_id,
            $reason,
        )));
        $table = self::state_backups_table_name();
        $sql = $wpdb->prepare(
            "INSERT IGNORE INTO {$table} (user_id, state_key, payload, base_revision, server_revision, client_updated_at_ms, device_id, reason, snapshot_hash, created_at) VALUES (%d, %s, %s, %d, %d, %d, %s, %s, %s, %s)",
            0,
            $key,
            $payload,
            (int) $base_revision,
            $server_revision,
            (int) $client_updated_at,
            $device_id,
            $reason,
            $snapshot_hash,
            current_time('mysql', true)
        );
        $inserted = $wpdb->query($sql);
        if (false === $inserted) {
            return self::database_failure();
        }
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT id, state_key, base_revision, server_revision, client_updated_at_ms, device_id, reason, created_at FROM {$table} WHERE snapshot_hash = %s",
            $snapshot_hash
        ), ARRAY_A);
        if (!$row) {
            return self::database_failure();
        }
        if (1 === (int) $inserted) {
            self::record_audit_event($key, 'BACKUP', (int) $base_revision, $server_revision, $device_id, array(
                'backupId' => (int) $row['id'],
                'reason' => $reason,
            ));
            $cutoff_id = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM {$table} WHERE user_id = %d AND state_key = %s ORDER BY id DESC LIMIT 1 OFFSET %d",
                0,
                $key,
                self::MAX_BACKUPS_PER_KEY - 1
            ));
            if ($cutoff_id) {
                $wpdb->query($wpdb->prepare(
                    "DELETE FROM {$table} WHERE user_id = %d AND state_key = %s AND id < %d",
                    0,
                    $key,
                    (int) $cutoff_id
                ));
            }
        }
        return rest_ensure_response(array(
            'success' => true,
            'backup' => array(
                'id' => (int) $row['id'],
                'key' => (string) $row['state_key'],
                'baseRevision' => (int) $row['base_revision'],
                'serverRevision' => (int) $row['server_revision'],
                'clientUpdatedAt' => (int) $row['client_updated_at_ms'],
                'deviceId' => (string) $row['device_id'],
                'reason' => (string) $row['reason'],
                'createdAt' => (string) $row['created_at'],
            ),
        ));
    }

    public static function get_state_backups(WP_REST_Request $request) {
        global $wpdb;
        $key = sanitize_text_field((string) $request->get_param('key'));
        $limit = (int) $request->get_param('limit');
        $limit = $limit > 0 ? min($limit, 200) : 100;
        $table = self::state_backups_table_name();
        if ($key) {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, state_key, payload, base_revision, server_revision, client_updated_at_ms, device_id, reason, created_at FROM {$table} WHERE user_id = %d AND state_key = %s ORDER BY id DESC LIMIT %d",
                0,
                $key,
                $limit
            ), ARRAY_A);
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, state_key, payload, base_revision, server_revision, client_updated_at_ms, device_id, reason, created_at FROM {$table} WHERE user_id = %d ORDER BY id DESC LIMIT %d",
                0,
                $limit
            ), ARRAY_A);
        }
        $backups = array();
        foreach ((array) $rows as $row) {
            $backups[] = array(
                'id' => (int) $row['id'],
                'key' => (string) $row['state_key'],
                'value' => self::decode_state_value($row['payload']),
                'baseRevision' => (int) $row['base_revision'],
                'serverRevision' => (int) $row['server_revision'],
                'clientUpdatedAt' => (int) $row['client_updated_at_ms'],
                'deviceId' => (string) $row['device_id'],
                'reason' => (string) $row['reason'],
                'createdAt' => (string) $row['created_at'],
            );
        }
        return rest_ensure_response(array('backups' => $backups));
    }

    public static function get_state_history(WP_REST_Request $request) {
        global $wpdb;
        $key = sanitize_text_field((string) $request->get_param('key'));
        $limit = (int) $request->get_param('limit');
        $limit = $limit > 0 ? min($limit, 200) : 100;
        if ($key) {
            $rows = $wpdb->get_results($wpdb->prepare(
                'SELECT state_key, revision, payload, created_at, device_id FROM ' . self::state_versions_table_name() . ' WHERE user_id = %d AND state_key = %s ORDER BY revision ASC LIMIT %d',
                0,
                $key,
                $limit
            ), ARRAY_A);
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                'SELECT state_key, revision, payload, created_at, device_id FROM ' . self::state_versions_table_name() . ' WHERE user_id = %d ORDER BY state_key ASC, revision ASC LIMIT %d',
                0,
                $limit
            ), ARRAY_A);
        }
        $history = array();
        foreach ((array) $rows as $row) {
            $history[] = array(
                'key' => (string) $row['state_key'],
                'revision' => (int) $row['revision'],
                'value' => self::decode_state_value($row['payload']),
                'createdAt' => (string) $row['created_at'],
                'deviceId' => (string) $row['device_id'],
            );
        }
        return rest_ensure_response(array('history' => $history));
    }

    public static function restore_state(WP_REST_Request $request) {
        global $wpdb;
        $body = $request->get_json_params();
        $body = is_array($body) ? $body : array();
        $key = sanitize_text_field((string) ($body['key'] ?? ''));
        if (!$key || strlen($key) > 191) {
            return new WP_Error('invalid_state_key', 'State key is invalid.', array('status' => 400));
        }
        if (!array_key_exists('revision', $body) || !array_key_exists('baseRevision', $body)) {
            return new WP_Error('revision_required', 'revision and baseRevision are required for restore.', array('status' => 400, 'key' => $key));
        }
        $target_revision = (string) $body['revision'];
        $base_revision = (string) $body['baseRevision'];
        if (!preg_match('/^\d+$/', $target_revision) || (int) $target_revision < 1 || !preg_match('/^\d+$/', $base_revision)) {
            return new WP_Error('invalid_revision', 'revision and baseRevision must be non-negative integers.', array('status' => 400, 'key' => $key));
        }
        $device_id = self::normalize_device_id($body['deviceId'] ?? '');

        if (false === $wpdb->query('START TRANSACTION')) {
            return self::database_failure();
        }
        $current = self::current_state_row($key, true);
        $current_revision = $current ? max(1, (int) ($current['revision'] ?? 1)) : 0;
        if ((int) $base_revision !== $current_revision) {
            $wpdb->query('ROLLBACK');
            return self::revision_conflict($key, (int) $base_revision, $current);
        }

        $version = $wpdb->get_row($wpdb->prepare(
            'SELECT payload FROM ' . self::state_versions_table_name() . ' WHERE user_id = %d AND state_key = %s AND revision = %d',
            0,
            $key,
            (int) $target_revision
        ), ARRAY_A);
        if (!$version) {
            $wpdb->query('ROLLBACK');
            return new WP_Error('history_not_found', 'Requested state history revision was not found.', array('status' => 404, 'key' => $key, 'revision' => (int) $target_revision));
        }
        $value = self::decode_state_value($version['payload']);
        $new_revision = $current_revision + 1;
        $now_ms = $current ? max((int) floor(microtime(true) * 1000), ((int) ($current['updated_at_ms'] ?? 0)) + 1) : (int) floor(microtime(true) * 1000);
        $now_mysql = current_time('mysql', true);
        if (!self::write_state_row($key, $value, $new_revision, $now_ms, $now_mysql, $device_id, $current)
            || !self::record_state_version($key, $value, $new_revision, $now_mysql, $device_id)
            || !self::record_audit_event($key, 'RESTORE', $current_revision, $new_revision, $device_id, array('restoredRevision' => (int) $target_revision))) {
            $wpdb->query('ROLLBACK');
            return self::database_failure();
        }
        if (false === $wpdb->query('COMMIT')) {
            $wpdb->query('ROLLBACK');
            return self::database_failure();
        }

        return rest_ensure_response(array(
            'success' => true,
            'restored' => array(
                'key' => $key,
                'value' => $value,
                'revision' => $new_revision,
                'updatedAt' => $now_ms,
                'updatedByDevice' => $device_id,
            ),
            'historyRevision' => (int) $target_revision,
        ));
    }

    private static function file_response($namespace, $path) {
        $name = basename($path);
        return array(
            'name' => $name,
            'size' => filesize($path),
            'type' => wp_check_filetype($name)['type'] ?: 'application/octet-stream',
            'date' => gmdate('Y-m-d', filemtime($path)),
            'updatedAt' => filemtime($path) * 1000,
            'downloadUrl' => add_query_arg(array(
                'kuajing_file' => 1,
                'namespace' => $namespace,
                'name' => $name,
            ), home_url('/')),
        );
    }

    public static function list_files(WP_REST_Request $request) {
        $namespace = sanitize_key($request['namespace']);
        $directory = self::shared_namespace_dir($namespace);
        if (is_wp_error($directory)) {
            return $directory;
        }
        $files = array();
        foreach ((array) glob(trailingslashit($directory) . '*') as $path) {
            if (is_file($path)) {
                $files[] = self::file_response($namespace, $path);
            }
        }
        usort($files, static function($a, $b) {
            return $b['updatedAt'] <=> $a['updatedAt'];
        });
        return rest_ensure_response(array('files' => $files));
    }

    public static function upload_file(WP_REST_Request $request) {
        $files = $request->get_file_params();
        if (empty($files['file']) || UPLOAD_ERR_OK !== (int) $files['file']['error']) {
            return new WP_Error('invalid_upload', 'A valid file is required.', array('status' => 400));
        }
        if ((int) $files['file']['size'] > self::MAX_FILE_SIZE) {
            return new WP_Error('file_too_large', 'File exceeds the 50 MB limit.', array('status' => 413));
        }

        $name = sanitize_file_name($files['file']['name']);
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!$name || !in_array($extension, self::ALLOWED_EXTENSIONS, true)) {
            return new WP_Error('invalid_file_type', 'File type is not allowed.', array('status' => 415));
        }

        $namespace = sanitize_key($request['namespace']);
        $directory = self::shared_namespace_dir($namespace);
        if (is_wp_error($directory)) {
            return $directory;
        }
        $target = trailingslashit($directory) . $name;
        if (is_file($target)
            && hash_file('sha256', $target) !== hash_file('sha256', $files['file']['tmp_name'])
            && !self::backup_existing_file($namespace, $target, 'overwrite')) {
            return new WP_Error('backup_failed', 'Unable to preserve the existing file before replacement.', array('status' => 500));
        }
        if (!move_uploaded_file($files['file']['tmp_name'], $target)) {
            return new WP_Error('upload_failed', 'Unable to store the uploaded file.', array('status' => 500));
        }
        @chmod($target, 0640);

        return rest_ensure_response(array('success' => true, 'file' => self::file_response($namespace, $target)));
    }

    public static function delete_file(WP_REST_Request $request) {
        $namespace = sanitize_key($request['namespace']);
        $name = sanitize_file_name((string) $request->get_param('name'));
        $directory = self::shared_namespace_dir($namespace);
        if (is_wp_error($directory)) {
            return $directory;
        }
        $path = trailingslashit($directory) . $name;
        if ($name && is_file($path)) {
            if (!self::backup_existing_file($namespace, $path, 'delete')) {
                return new WP_Error('backup_failed', 'Unable to preserve the file before deletion.', array('status' => 500));
            }
            if (!unlink($path)) {
                return new WP_Error('delete_failed', 'Unable to delete the stored file.', array('status' => 500));
            }
        }
        return rest_ensure_response(array('success' => true));
    }

    public static function serve_private_file() {
        if (empty($_GET['kuajing_file'])) {
            return;
        }
        if (!self::can_access()) {
            status_header(403);
            exit;
        }

        $namespace = sanitize_key(wp_unslash($_GET['namespace'] ?? ''));
        $name = sanitize_file_name(wp_unslash($_GET['name'] ?? ''));
        $directory = self::shared_namespace_dir($namespace);
        if (is_wp_error($directory)) {
            status_header(400);
            exit;
        }
        $path = trailingslashit($directory) . $name;
        if (!$name || !is_file($path)) {
            status_header(404);
            exit;
        }

        nocache_headers();
        header('Content-Type: ' . (wp_check_filetype($name)['type'] ?: 'application/octet-stream'));
        header('Content-Length: ' . filesize($path));
        header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($name));
        readfile($path);
        exit;
    }
}

register_activation_hook(__FILE__, array('FYZSXNB_Kuajing_Dashboard', 'activate'));
FYZSXNB_Kuajing_Dashboard::init();
