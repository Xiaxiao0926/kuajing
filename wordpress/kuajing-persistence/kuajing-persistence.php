<?php
/**
 * Plugin Name: FYZSXNB Kuajing Dashboard
 * Description: Serves the Kuajing React dashboard and stores shared dashboard data on the WordPress server.
 * Version: 0.2.5
 * Author: FYZSXNB
 */

if (!defined('ABSPATH')) {
    exit;
}

final class FYZSXNB_Kuajing_Dashboard {
    private const VERSION = '0.2.5';
    private const TABLE_SUFFIX = 'kuajing_state';
    private const VERSION_OPTION = 'fyzsxnb_kuajing_version';
    private const SECRET_OPTION = 'fyzsxnb_kuajing_access_secret';
    private const ACCESS_COOKIE = 'fyzsxnb_kuajing_access';
    private const ACCESS_PASSWORD_HASH = 'b0646924cb4681e592a0e05068dfaeb40d0807466087c6c1ad5a1ac52d439e54';
    private const SESSION_TTL = 604800;
    private const MAX_FILE_SIZE = 52428800;
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
            PRIMARY KEY  (user_id, state_key)
        ) {$charset_collate};";
        dbDelta($sql);

        self::ensure_access_secret();
        self::ensure_private_root();
        self::ensure_dashboard_page();
        self::migrate_shared_state();
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

    private static function migrate_shared_state() {
        global $wpdb;
        $rows = $wpdb->get_results(
            'SELECT state_key, state_value, updated_at_ms, updated_at FROM ' . self::table_name() . ' WHERE user_id <> 0 ORDER BY updated_at_ms ASC',
            ARRAY_A
        );
        foreach ((array) $rows as $row) {
            $existing = $wpdb->get_var($wpdb->prepare(
                'SELECT updated_at_ms FROM ' . self::table_name() . ' WHERE user_id = 0 AND state_key = %s',
                $row['state_key']
            ));
            if (null !== $existing && (int) $existing > (int) $row['updated_at_ms']) {
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
                ),
                array('%d', '%s', '%s', '%d', '%s')
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

        $manifest_path = plugin_dir_path(__FILE__) . 'dist/.vite/manifest.json';
        if (!file_exists($manifest_path)) {
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

    public static function get_state() {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                'SELECT state_key, state_value, updated_at_ms FROM ' . self::table_name() . ' WHERE user_id = %d',
                0
            ),
            ARRAY_A
        );
        $result = array();
        foreach ($rows as $row) {
            $result[$row['state_key']] = array(
                'value' => json_decode($row['state_value'], true),
                'updatedAt' => (int) $row['updated_at_ms'],
            );
        }
        return rest_ensure_response($result);
    }

    public static function save_state(WP_REST_Request $request) {
        global $wpdb;
        $body = $request->get_json_params();
        $entries = isset($body['entries']) && is_array($body['entries'])
            ? $body['entries']
            : array(($body['key'] ?? '') => array('value' => $body['value'] ?? null));
        $saved = 0;

        foreach ($entries as $key => $entry) {
            $key = sanitize_text_field((string) $key);
            if (!$key || strlen($key) > 191) {
                continue;
            }
            $value = is_array($entry) && array_key_exists('value', $entry) ? $entry['value'] : $entry;
            $updated_at_ms = (int) floor(microtime(true) * 1000);
            $wpdb->replace(
                self::table_name(),
                array(
                    'user_id' => 0,
                    'state_key' => $key,
                    'state_value' => wp_json_encode($value),
                    'updated_at_ms' => $updated_at_ms,
                    'updated_at' => current_time('mysql', true),
                ),
                array('%d', '%s', '%s', '%d', '%s')
            );
            $saved++;
        }

        return rest_ensure_response(array('success' => true, 'saved' => $saved));
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
            unlink($path);
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
