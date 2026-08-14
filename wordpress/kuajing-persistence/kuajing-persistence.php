<?php
/**
 * Plugin Name: FYZSXNB Kuajing Dashboard
 * Description: Serves the Kuajing React dashboard and stores authenticated dashboard data on the WordPress server.
 * Version: 0.1.0
 * Author: FYZSXNB
 */

if (!defined('ABSPATH')) {
    exit;
}

final class FYZSXNB_Kuajing_Dashboard {
    private const VERSION = '0.1.0';
    private const TABLE_SUFFIX = 'kuajing_state';
    private const MAX_FILE_SIZE = 52428800;
    private const ALLOWED_EXTENSIONS = array('xlsx', 'xls', 'csv', 'json', 'html', 'htm', 'doc', 'docx');

    public static function init() {
        add_shortcode('kuajing_dashboard', array(__CLASS__, 'render_dashboard'));
        add_action('rest_api_init', array(__CLASS__, 'register_routes'));
        add_filter('script_loader_tag', array(__CLASS__, 'module_script_tag'), 10, 3);
        add_action('template_redirect', array(__CLASS__, 'serve_private_file'));
    }

    public static function activate() {
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

        self::ensure_private_root();
        self::ensure_dashboard_page();
    }

    private static function table_name() {
        global $wpdb;
        return $wpdb->prefix . self::TABLE_SUFFIX;
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

    private static function user_namespace_dir($namespace) {
        $namespace = sanitize_key($namespace);
        if (!$namespace) {
            return new WP_Error('invalid_namespace', 'Invalid file namespace.', array('status' => 400));
        }
        $directory = trailingslashit(self::ensure_private_root()) . get_current_user_id() . '/' . $namespace;
        if (!wp_mkdir_p($directory)) {
            return new WP_Error('storage_unavailable', 'Unable to create private storage.', array('status' => 500));
        }
        return $directory;
    }

    public static function render_dashboard() {
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
        if ($authorized && !defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }

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
        wp_add_inline_script(
            $handle,
            'window.KUAJING_CONFIG=' . wp_json_encode(array(
                'apiBase' => esc_url_raw(rest_url('kuajing/v1')),
                'assetBase' => esc_url_raw(plugins_url('dist/', __FILE__)),
                'authorized' => $authorized,
                'nonce' => $authorized ? wp_create_nonce('wp_rest') : '',
            )) . ';',
            'before'
        );

        return '<div id="root" class="fyzsxnb-kuajing-root"></div>';
    }

    public static function module_script_tag($tag, $handle, $src) {
        if ('fyzsxnb-kuajing-app' !== $handle) {
            return $tag;
        }
        return '<script type="module" src="' . esc_url($src) . '"></script>';
    }

    public static function register_routes() {
        register_rest_route('kuajing/v1', '/state', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'get_state'),
                'permission_callback' => array(__CLASS__, 'can_manage'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'save_state'),
                'permission_callback' => array(__CLASS__, 'can_manage'),
            ),
        ));

        register_rest_route('kuajing/v1', '/files/(?P<namespace>[a-z0-9_-]+)', array(
            array(
                'methods' => WP_REST_Server::READABLE,
                'callback' => array(__CLASS__, 'list_files'),
                'permission_callback' => array(__CLASS__, 'can_manage'),
            ),
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(__CLASS__, 'upload_file'),
                'permission_callback' => array(__CLASS__, 'can_manage'),
            ),
            array(
                'methods' => WP_REST_Server::DELETABLE,
                'callback' => array(__CLASS__, 'delete_file'),
                'permission_callback' => array(__CLASS__, 'can_manage'),
            ),
        ));
    }

    public static function can_manage() {
        return current_user_can('manage_options');
    }

    public static function get_state() {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                'SELECT state_key, state_value, updated_at_ms FROM ' . self::table_name() . ' WHERE user_id = %d',
                get_current_user_id()
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
                    'user_id' => get_current_user_id(),
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
            'downloadUrl' => wp_nonce_url(
                add_query_arg(array(
                    'kuajing_file' => 1,
                    'namespace' => $namespace,
                    'name' => $name,
                ), home_url('/')),
                'kuajing_file'
            ),
        );
    }

    public static function list_files(WP_REST_Request $request) {
        $namespace = sanitize_key($request['namespace']);
        $directory = self::user_namespace_dir($namespace);
        if (is_wp_error($directory)) {
            return $directory;
        }
        $files = array();
        foreach ((array) glob(trailingslashit($directory) . '*') as $path) {
            if (!is_file($path)) {
                continue;
            }
            $files[] = self::file_response($namespace, $path);
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
        $directory = self::user_namespace_dir($namespace);
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
        $directory = self::user_namespace_dir($namespace);
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
        if (!current_user_can('manage_options') || !wp_verify_nonce($_GET['_wpnonce'] ?? '', 'kuajing_file')) {
            status_header(403);
            exit;
        }

        $namespace = sanitize_key(wp_unslash($_GET['namespace'] ?? ''));
        $name = sanitize_file_name(wp_unslash($_GET['name'] ?? ''));
        $directory = self::user_namespace_dir($namespace);
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
