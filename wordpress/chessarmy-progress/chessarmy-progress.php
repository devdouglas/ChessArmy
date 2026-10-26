<?php
/**
 * Plugin Name: There Will Be Legions
 * Description: Hosts There Will Be Legions and saves campaign/tutorial progress on the WordPress user profile. Guests keep using the browser.
 * Version: 1.1.0
 * Author: Fiction Industries
 * Requires at least: 6.4
 * Requires PHP: 8.1
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const CHESSARMY_PROGRESS_META = '_chessarmy_progress';
const CHESSARMY_PROGRESS_MAX_MAPS = 200;
const CHESSARMY_PROGRESS_MAX_BYTES = 100000;

function chessarmy_empty_progress(): array {
    return [
        'stars' => [],
        'labels' => [],
        'updatedAt' => 0,
    ];
}

function chessarmy_safe_id(string $id): bool {
    return (bool) preg_match('/^[a-zA-Z0-9._-]{1,80}$/', $id);
}

function chessarmy_sanitize_stars(mixed $raw): array {
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    $n = 0;
    foreach ($raw as $id => $stars) {
        if ($n >= CHESSARMY_PROGRESS_MAX_MAPS) {
            break;
        }
        if (!is_string($id) || !chessarmy_safe_id($id)) {
            continue;
        }
        if (!is_numeric($stars)) {
            continue;
        }
        $s = (int) $stars;
        if ($s < 1 || $s > 3) {
            continue;
        }
        $out[$id] = $s;
        $n++;
    }
    return $out;
}

function chessarmy_sanitize_labels(mixed $raw, array $stars): array {
    if (!is_array($raw) || $stars === []) {
        return [];
    }
    $out = [];
    foreach ($stars as $id => $_s) {
        $label = $raw[$id] ?? null;
        if (!is_string($label)) {
            continue;
        }
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $label);
        if (!is_string($text)) {
            continue;
        }
        $text = substr(trim($text), 0, 48);
        if ($text === '') {
            continue;
        }
        $out[$id] = $text;
    }
    return $out;
}

function chessarmy_sanitize_progress(mixed $raw): array {
    $src = is_array($raw) ? $raw : [];
    $stars = chessarmy_sanitize_stars($src['stars'] ?? null);
    $updated = isset($src['updatedAt']) && is_numeric($src['updatedAt'])
        ? (int) $src['updatedAt']
        : 0;
    if ($updated < 0) {
        $updated = 0;
    }
    return [
        'stars' => $stars,
        'labels' => chessarmy_sanitize_labels($src['labels'] ?? null, $stars),
        'updatedAt' => $updated,
    ];
}

function chessarmy_get_progress(int $user_id): array {
    if ($user_id < 1) {
        return chessarmy_empty_progress();
    }
    $stored = get_user_meta($user_id, CHESSARMY_PROGRESS_META, true);
    return chessarmy_sanitize_progress($stored);
}

function chessarmy_save_progress(int $user_id, array $progress): array {
    $clean = chessarmy_sanitize_progress($progress);
    $clean['updatedAt'] = time();
    update_user_meta($user_id, CHESSARMY_PROGRESS_META, $clean);
    return $clean;
}

function chessarmy_json_progress(array $progress): array {
    $progress['stars'] = $progress['stars'] === [] ? new stdClass() : $progress['stars'];
    $progress['labels'] = $progress['labels'] === [] ? new stdClass() : $progress['labels'];
    return $progress;
}

function chessarmy_nocache_json(): void {
    nocache_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
}

function chessarmy_game_url(): string {
    return home_url('/warchess/');
}

function chessarmy_game_dir(): string {
    return __DIR__ . '/game';
}

function chessarmy_public_game_dir(): string {
    return rtrim(ABSPATH, '/\\') . '/warchess';
}

function chessarmy_game_ready(): bool {
    return is_file(chessarmy_game_dir() . '/index.html');
}

function chessarmy_copy_dir(string $src, string $dest): void {
    if (!is_dir($dest) && !mkdir($dest, 0775, true) && !is_dir($dest)) {
        return;
    }
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST,
    );
    foreach ($it as $file) {
        /** @var SplFileInfo $file */
        $to = $dest . substr($file->getPathname(), strlen($src));
        if ($file->isDir()) {
            if (!is_dir($to)) {
                mkdir($to, 0775, true);
            }
            continue;
        }
        $name = $file->getFilename();
        if ($name === '.gitignore' || $name === '.lock' || str_ends_with($name, '.tmp')) {
            continue;
        }
        copy($file->getPathname(), $to);
        @chmod($to, 0664);
    }
}

function chessarmy_publish_game(): bool {
    $src = realpath(chessarmy_game_dir());
    if ($src === false || !is_file($src . '/index.html')) {
        return false;
    }
    $dest = chessarmy_public_game_dir();
    chessarmy_copy_dir($src, $dest);
    return is_file($dest . '/index.html');
}

register_activation_hook(__FILE__, static function (): void {
    chessarmy_publish_game();
});

function chessarmy_request_path(): string {
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return '/';
    }
    $home = parse_url(home_url('/'), PHP_URL_PATH);
    if (is_string($home) && $home !== '/' && $home !== '') {
        $prefix = rtrim($home, '/');
        if (str_starts_with($path, $prefix)) {
            $path = substr($path, strlen($prefix)) ?: '/';
        }
    }
    return rawurldecode($path);
}

function chessarmy_game_rel(string $path): ?string {
    if (preg_match('#^/(wp-|xmlrpc\.php)#', $path)) {
        return null;
    }
    if (str_contains($path, '..') || str_contains($path, "\0")) {
        return null;
    }
    if (preg_match('#^/warchess/?$#', $path) || $path === '/warchess/index.html') {
        return 'index.html';
    }
    if (preg_match('#^/warchess/(.+)$#', $path, $m)) {
        return str_replace('\\', '/', $m[1]);
    }
    return null;
}

function chessarmy_game_mime(string $file): string {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    return match ($ext) {
        'html' => 'text/html; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'map' => 'application/json',
        'png' => 'image/png',
        'ico' => 'image/x-icon',
        'txt' => 'text/plain; charset=utf-8',
        default => 'application/octet-stream',
    };
}

function chessarmy_maybe_serve_game(): void {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (!chessarmy_game_ready()) {
        return;
    }
    $path = chessarmy_request_path();
    if (($path === '/' || $path === '') && get_option('chessarmy_serve_front')) {
        wp_safe_redirect(chessarmy_game_url(), 302);
        exit;
    }
    $rel = chessarmy_game_rel($path);
    if ($rel === null || $rel === '' || str_ends_with($rel, '/')) {
        return;
    }
    $root = realpath(chessarmy_game_dir());
    if ($root === false) {
        return;
    }
    $full = realpath($root . '/' . $rel);
    if ($full === false || !is_file($full)) {
        return;
    }
    if ($full !== $root && !str_starts_with($full, $root . DIRECTORY_SEPARATOR)) {
        return;
    }
    if (str_ends_with(strtolower($full), '.php')) {
        if (basename($full) !== 'api.php') {
            return;
        }
        status_header(200);
        require $full;
        exit;
    }
    $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
    $allowed = ['html' => true, 'js' => true, 'css' => true, 'json' => true, 'svg' => true, 'map' => true, 'png' => true, 'ico' => true, 'txt' => true];
    if (!isset($allowed[$ext])) {
        return;
    }
    status_header(200);
    header('Content-Type: ' . chessarmy_game_mime($full));
    header('X-Content-Type-Options: nosniff');
    if ($ext === 'html' || $ext === 'json') {
        header('Cache-Control: no-store, no-cache, must-revalidate');
    } else {
        header('Cache-Control: public, max-age=86400');
    }
    readfile($full);
    exit;
}

add_action('template_redirect', 'chessarmy_maybe_serve_game', 0);

function chessarmy_session_payload(): array {
    $user = wp_get_current_user();
    if (!$user instanceof WP_User || $user->ID < 1) {
        $out = [
            'loggedIn' => false,
            'admin' => false,
            'loginUrl' => wp_login_url(chessarmy_game_url()),
            'registerUrl' => null,
        ];
        if (get_option('users_can_register')) {
            $out['registerUrl'] = wp_registration_url();
        }
        return $out;
    }
    return [
        'loggedIn' => true,
        'admin' => user_can($user, 'manage_options'),
        'nonce' => wp_create_nonce('wp_rest'),
        'ajaxNonce' => wp_create_nonce('chessarmy_progress'),
        'rest' => rest_url('chessarmy/v1/progress'),
        'user' => [
            'id' => $user->ID,
            'name' => $user->display_name,
            'login' => $user->user_login,
        ],
        'profileUrl' => get_edit_profile_url($user->ID),
        'logoutUrl' => wp_logout_url(chessarmy_game_url()),
        'progress' => chessarmy_json_progress(chessarmy_get_progress($user->ID)),
    ];
}

function chessarmy_ajax_session(): void {
    chessarmy_nocache_json();
    echo wp_json_encode(chessarmy_session_payload(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    wp_die();
}

function chessarmy_read_posted_progress(): array {
    $stars = $_POST['stars'] ?? null;
    $labels = $_POST['labels'] ?? null;
    if (is_string($stars)) {
        $decoded = json_decode(wp_unslash($stars), true);
        $stars = is_array($decoded) ? $decoded : [];
    }
    if (is_string($labels)) {
        $decoded = json_decode(wp_unslash($labels), true);
        $labels = is_array($decoded) ? $decoded : [];
    }
    return [
        'stars' => is_array($stars) ? $stars : [],
        'labels' => is_array($labels) ? $labels : [],
    ];
}

function chessarmy_posted_too_large(): bool {
    $stars = $_POST['stars'] ?? '';
    $labels = $_POST['labels'] ?? '';
    $n = (is_string($stars) ? strlen($stars) : 0) + (is_string($labels) ? strlen($labels) : 0);
    return $n > CHESSARMY_PROGRESS_MAX_BYTES;
}

function chessarmy_ajax_save_progress(): void {
    chessarmy_nocache_json();
    if (!is_user_logged_in()) {
        status_header(401);
        echo wp_json_encode(['ok' => false, 'error' => 'login required'], JSON_UNESCAPED_SLASHES);
        wp_die();
    }
    check_ajax_referer('chessarmy_progress', 'nonce');
    if (chessarmy_posted_too_large()) {
        status_header(413);
        echo wp_json_encode(['ok' => false, 'error' => 'payload too large'], JSON_UNESCAPED_SLASHES);
        wp_die();
    }
    $user_id = get_current_user_id();
    $saved = chessarmy_save_progress($user_id, chessarmy_read_posted_progress());
    echo wp_json_encode(
        ['ok' => true, 'progress' => chessarmy_json_progress($saved)],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
    );
    wp_die();
}

add_action('wp_ajax_chessarmy_session', 'chessarmy_ajax_session');
add_action('wp_ajax_nopriv_chessarmy_session', 'chessarmy_ajax_session');
add_action('wp_ajax_chessarmy_save_progress', 'chessarmy_ajax_save_progress');

function chessarmy_rest_permission(): bool {
    return is_user_logged_in();
}

function chessarmy_rest_get(WP_REST_Request $request): WP_REST_Response {
    unset($request);
    $progress = chessarmy_get_progress(get_current_user_id());
    return new WP_REST_Response(chessarmy_json_progress($progress), 200);
}

function chessarmy_rest_save(WP_REST_Request $request): WP_REST_Response {
    $raw = $request->get_json_params();
    if (!is_array($raw)) {
        $raw = $request->get_body_params();
    }
    $saved = chessarmy_save_progress(get_current_user_id(), is_array($raw) ? $raw : []);
    return new WP_REST_Response(
        ['ok' => true, 'progress' => chessarmy_json_progress($saved)],
        200,
    );
}

add_action('rest_api_init', static function (): void {
    register_rest_route('chessarmy/v1', '/progress', [
        [
            'methods' => 'GET',
            'callback' => 'chessarmy_rest_get',
            'permission_callback' => 'chessarmy_rest_permission',
        ],
        [
            'methods' => 'POST',
            'callback' => 'chessarmy_rest_save',
            'permission_callback' => 'chessarmy_rest_permission',
        ],
    ]);
});

function chessarmy_can_edit_progress(int $user_id): bool {
    return current_user_can('edit_user', $user_id);
}

function chessarmy_handle_profile_reset(int $user_id): void {
    if (!isset($_POST['chessarmy_reset_progress'])) {
        return;
    }
    if ($user_id < 1 || !chessarmy_can_edit_progress($user_id)) {
        return;
    }
    check_admin_referer('chessarmy_reset_progress_' . $user_id, 'chessarmy_reset_nonce');
    delete_user_meta($user_id, CHESSARMY_PROGRESS_META);
    add_action('admin_notices', static function (): void {
        echo '<div class="notice notice-success is-dismissible"><p>ChessArmy progress reset.</p></div>';
    });
}

add_action('personal_options_update', 'chessarmy_handle_profile_reset');
add_action('edit_user_profile_update', 'chessarmy_handle_profile_reset');

function chessarmy_render_profile_section(WP_User $user): void {
    if (!chessarmy_can_edit_progress($user->ID)) {
        return;
    }
    $progress = chessarmy_get_progress($user->ID);
    $stars = $progress['stars'];
    $labels = $progress['labels'];
    $cleared = count($stars);
    $total = array_sum($stars);
    echo '<h2>There Will Be Legions</h2>';
    echo '<p class="description">Campaign and tutorial progress for this account. Guests still save in the browser.</p>';
    echo '<table class="form-table" role="presentation"><tbody>';
    echo '<tr><th>Progress</th><td>';
    if ($cleared === 0) {
        echo '<p>No maps cleared yet.</p>';
    } else {
        echo '<p><strong>' . esc_html((string) $cleared) . '</strong> map'
            . ($cleared === 1 ? '' : 's')
            . ' cleared · <strong>' . esc_html((string) $total) . '</strong> star'
            . ($total === 1 ? '' : 's')
            . '</p>';
        echo '<table class="widefat striped" style="max-width:36rem"><thead><tr>';
        echo '<th>Map</th><th>Best</th></tr></thead><tbody>';
        foreach ($stars as $id => $n) {
            $name = $labels[$id] ?? $id;
            $filled = str_repeat('★', $n) . str_repeat('☆', 3 - $n);
            echo '<tr><td>' . esc_html($name) . '</td><td>' . esc_html($filled) . '</td></tr>';
        }
        echo '</tbody></table>';
        echo '<p class="submit" style="margin-top:1rem">';
        wp_nonce_field('chessarmy_reset_progress_' . $user->ID, 'chessarmy_reset_nonce');
        echo '<button type="submit" name="chessarmy_reset_progress" value="1" class="button" onclick="return confirm(\'Reset all saved ChessArmy progress for this account?\');">Reset progress</button>';
        echo '</p>';
    }
    echo '</td></tr></tbody></table>';
}

add_action('show_user_profile', 'chessarmy_render_profile_section');
add_action('edit_user_profile', 'chessarmy_render_profile_section');
