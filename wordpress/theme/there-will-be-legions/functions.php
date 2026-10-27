<?php
/**
 * There Will Be Legions theme.
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('TWBL_VERSION', '1.0.0');

function twbl_theme_file(string $rel): string
{
    return get_template_directory() . '/' . ltrim($rel, '/');
}

function twbl_theme_uri(string $rel): string
{
    return get_template_directory_uri() . '/' . ltrim($rel, '/');
}

function twbl_game_url(): string
{
    if (function_exists('chessarmy_game_url')) {
        return chessarmy_game_url();
    }
    return home_url('/warchess/');
}

function twbl_setup(): void
{
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script']);
    add_theme_support('custom-logo', [
        'height' => 120,
        'width' => 120,
        'flex-height' => true,
        'flex-width' => true,
    ]);
    register_nav_menus([
        'primary' => 'Primary',
    ]);
}
add_action('after_setup_theme', 'twbl_setup');

function twbl_enqueue(): void
{
    wp_enqueue_style(
        'twbl-fonts',
        'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Castoro:ital@0;1&display=swap',
        [],
        null,
    );
    wp_enqueue_style(
        'twbl',
        twbl_theme_uri('assets/css/main.css'),
        ['twbl-fonts'],
        TWBL_VERSION,
    );
    if (is_page_template('templates/feedback.php')) {
        wp_enqueue_script(
            'twbl-form',
            twbl_theme_uri('assets/js/form.js'),
            [],
            TWBL_VERSION,
            true,
        );
    }
}
add_action('wp_enqueue_scripts', 'twbl_enqueue');

function twbl_site_icon_fallback(): void
{
    if (has_site_icon()) {
        return;
    }
    $mark = twbl_theme_uri('assets/img/twbl-mark.jpg');
    echo '<link rel="icon" href="' . esc_url($mark) . '">' . "\n";
    echo '<link rel="apple-touch-icon" href="' . esc_url($mark) . '">' . "\n";
}
add_action('wp_head', 'twbl_site_icon_fallback', 2);

function twbl_login_logo_url(): string
{
    return home_url('/');
}
add_filter('login_headerurl', 'twbl_login_logo_url');

function twbl_login_logo_text(): string
{
    return get_bloginfo('name', 'display');
}
add_filter('login_headertext', 'twbl_login_logo_text');

function twbl_login_logo(): void
{
    $mark = twbl_theme_uri('assets/img/twbl-mark.jpg');
    ?>
    <style>
        body.login {
            background: #121612;
        }
        body.login #login h1 a {
            background-image: url("<?php echo esc_url($mark); ?>");
            background-size: contain;
            background-position: center;
            background-repeat: no-repeat;
            width: 220px;
            height: 220px;
            margin-bottom: 12px;
        }
        body.login #loginform,
        body.login #lostpasswordform,
        body.login #registerform {
            background: #1a2018;
            border: 1px solid #8a7348;
            box-shadow: none;
            color: #e8e0c8;
        }
        body.login label,
        body.login .privacy-policy-page-link a,
        body.login #nav a,
        body.login #backtoblog a {
            color: #c4a46a;
        }
        body.login #nav a:hover,
        body.login #backtoblog a:hover {
            color: #e8e0c8;
        }
        body.login .button-primary {
            background: #c4a46a;
            border-color: #c4a46a;
            color: #2a2618;
            text-shadow: none;
            box-shadow: none;
        }
        body.login .button-primary:hover,
        body.login .button-primary:focus {
            background: #e8e0c8;
            border-color: #e8e0c8;
            color: #2a2618;
        }
        body.login input[type="text"],
        body.login input[type="password"],
        body.login input[type="email"] {
            background: #121612;
            border-color: #8a7348;
            color: #e8e0c8;
        }
    </style>
    <?php
}
add_action('login_enqueue_scripts', 'twbl_login_logo');

function twbl_register_feedback_cpt(): void
{
    register_post_type('twbl_feedback', [
        'labels' => [
            'name' => 'Playtest reports',
            'singular_name' => 'Playtest report',
            'add_new_item' => 'Add report',
            'edit_item' => 'View report',
            'search_items' => 'Search reports',
            'not_found' => 'No reports yet.',
        ],
        'public' => false,
        'show_ui' => true,
        'show_in_menu' => true,
        'menu_icon' => 'dashicons-flag',
        'supports' => ['title'],
        'capability_type' => 'post',
        'map_meta_cap' => true,
    ]);
}
add_action('init', 'twbl_register_feedback_cpt');

/**
 * @return array<string, array{label: string, type: string}>
 */
function twbl_feedback_fields(): array
{
    return [
        'overall' => ['label' => 'Overall rating', 'type' => 'stars'],
        'player_name' => ['label' => 'Name', 'type' => 'text'],
        'player_email' => ['label' => 'Email', 'type' => 'email'],
        'boardgames' => ['label' => 'How do you like boardgames?', 'type' => 'scale'],
        'wargames' => ['label' => 'How much do you like wargames?', 'type' => 'scale'],
        'tutorial_ease' => ['label' => 'How easy was the tutorial?', 'type' => 'scale'],
        'like_it' => ['label' => 'How much do you like it?', 'type' => 'stars'],
        'missing' => ['label' => 'As this is an early version, what do you feel it is missing?', 'type' => 'textarea'],
        'liked' => ['label' => 'What did you like?', 'type' => 'textarea'],
        'disliked' => ['label' => 'What did you not like?', 'type' => 'textarea'],
        'confusing' => ['label' => 'What was confusing?', 'type' => 'textarea'],
        'artstyle' => ['label' => 'What art style do you like?', 'type' => 'choice'],
        'story' => ['label' => 'How did you like the story so far?', 'type' => 'textarea'],
        'tone' => ['label' => 'How did you like the tone of voice?', 'type' => 'textarea'],
        'direction' => ['label' => 'What direction should it take?', 'type' => 'choice'],
        'other' => ['label' => 'Other feedback', 'type' => 'textarea'],
    ];
}

/**
 * @return array<string, string>
 */
function twbl_artstyle_choices(): array
{
    return [
        'hex-tokens' => 'Hex tokens — the current prototype look',
        'cartoon' => 'Cartoon hex board',
        'comic-300' => '300 comic / graphic novel',
        'boardgame' => 'Tabletop boardgame',
        'oil-painting' => 'Historical oil painting',
        'mosaic' => 'Roman mosaic',
        'woodcut' => 'Woodcut print',
    ];
}

/**
 * @return array<string, string>
 */
function twbl_direction_choices(): array
{
    return [
        'story' => 'Story driven. Anthony as a single unit working his way through special levels. In massive battles he is just a very small part — the goal is to tip the battle in your advantage. The story branches from your decisions.',
        'campaign' => 'War campaign driven. Anthony quickly becomes general, manages resources, and moves and fights with a complete army, with full control over the campaign map.',
        'hero' => "Hero's journey. Still story driven, but linear. Anthony becomes stronger and more powerful.",
    ];
}

function twbl_feedback_page_url(): string
{
    $page = get_page_by_path('feedback');
    return $page instanceof WP_Post ? get_permalink($page) : home_url('/feedback/');
}

/**
 * @return array<string, string>
 */
function twbl_sanitize_feedback(array $raw): array
{
    $out = [];
    $out['overall'] = twbl_sanitize_stars($raw['overall'] ?? '');
    $out['player_name'] = sanitize_text_field((string) ($raw['player_name'] ?? ''));
    $out['player_email'] = sanitize_email((string) ($raw['player_email'] ?? ''));
    $out['boardgames'] = twbl_sanitize_scale($raw['boardgames'] ?? '');
    $out['wargames'] = twbl_sanitize_scale($raw['wargames'] ?? '');
    $out['tutorial_ease'] = twbl_sanitize_scale($raw['tutorial_ease'] ?? '');
    $out['like_it'] = twbl_sanitize_stars($raw['like_it'] ?? '');
    $out['missing'] = sanitize_textarea_field((string) ($raw['missing'] ?? ''));
    $out['liked'] = sanitize_textarea_field((string) ($raw['liked'] ?? ''));
    $out['disliked'] = sanitize_textarea_field((string) ($raw['disliked'] ?? ''));
    $out['confusing'] = sanitize_textarea_field((string) ($raw['confusing'] ?? ''));
    $art = (string) ($raw['artstyle'] ?? '');
    $out['artstyle'] = array_key_exists($art, twbl_artstyle_choices()) ? $art : '';
    $out['story'] = sanitize_textarea_field((string) ($raw['story'] ?? ''));
    $out['tone'] = sanitize_textarea_field((string) ($raw['tone'] ?? ''));
    $dir = (string) ($raw['direction'] ?? '');
    $out['direction'] = array_key_exists($dir, twbl_direction_choices()) ? $dir : '';
    $out['other'] = sanitize_textarea_field((string) ($raw['other'] ?? ''));
    return $out;
}

function twbl_sanitize_stars(mixed $v): string
{
    $n = (int) $v;
    return ($n >= 1 && $n <= 5) ? (string) $n : '';
}

function twbl_sanitize_scale(mixed $v): string
{
    return twbl_sanitize_stars($v);
}

/**
 * @param array<string, string> $data
 * @return string[]
 */
function twbl_feedback_errors(array $data): array
{
    $errors = [];
    if ($data['overall'] === '') {
        $errors[] = 'Give it an overall rating.';
    }
    if ($data['player_name'] === '') {
        $errors[] = 'Name is required.';
    }
    if ($data['player_email'] === '' || !is_email($data['player_email'])) {
        $errors[] = 'A valid email is required.';
    }
    if ($data['boardgames'] === '') {
        $errors[] = 'How do you like boardgames?';
    }
    if ($data['wargames'] === '') {
        $errors[] = 'How much do you like wargames?';
    }
    if ($data['tutorial_ease'] === '') {
        $errors[] = 'How easy was the tutorial?';
    }
    if ($data['like_it'] === '') {
        $errors[] = 'How much do you like it?';
    }
    return $errors;
}

function twbl_handle_feedback(): void
{
    $back = twbl_feedback_page_url();
    if (!isset($_POST['twbl_nonce']) || !wp_verify_nonce(sanitize_text_field((string) $_POST['twbl_nonce']), 'twbl_feedback')) {
        wp_safe_redirect(add_query_arg('err', 'nonce', $back));
        exit;
    }
    if (!empty($_POST['company_website'])) {
        wp_safe_redirect(add_query_arg('sent', '1', $back));
        exit;
    }

    $data = twbl_sanitize_feedback($_POST);
    $errors = twbl_feedback_errors($data);
    if ($errors !== []) {
        set_transient('twbl_feedback_flash_' . twbl_flash_key(), [
            'errors' => $errors,
            'data' => $data,
        ], 10 * MINUTE_IN_SECONDS);
        wp_safe_redirect(add_query_arg('err', 'fields', $back));
        exit;
    }

    $title = $data['player_name'] . ' · ' . $data['overall'] . '/5 · ' . wp_date('Y-m-d H:i');
    $post_id = wp_insert_post([
        'post_type' => 'twbl_feedback',
        'post_status' => 'private',
        'post_title' => $title,
        'post_content' => '',
    ], true);

    if (is_wp_error($post_id)) {
        wp_safe_redirect(add_query_arg('err', 'save', $back));
        exit;
    }

    foreach ($data as $key => $value) {
        update_post_meta((int) $post_id, '_twbl_' . $key, $value);
    }

    twbl_mail_feedback($data, (int) $post_id);

    wp_safe_redirect(add_query_arg('sent', '1', $back));
    exit;
}
add_action('admin_post_nopriv_twbl_feedback', 'twbl_handle_feedback');
add_action('admin_post_twbl_feedback', 'twbl_handle_feedback');

function twbl_flash_key(): string
{
    return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . wp_salt('nonce')), 0, 16);
}

/**
 * @return array{errors: string[], data: array<string, string>}|null
 */
function twbl_take_flash(): ?array
{
    $key = 'twbl_feedback_flash_' . twbl_flash_key();
    $flash = get_transient($key);
    if (!is_array($flash)) {
        return null;
    }
    delete_transient($key);
    return [
        'errors' => is_array($flash['errors'] ?? null) ? array_map('strval', $flash['errors']) : [],
        'data' => is_array($flash['data'] ?? null) ? $flash['data'] : [],
    ];
}

/**
 * @param array<string, string> $data
 */
function twbl_mail_feedback(array $data, int $post_id): void
{
    $to = get_option('admin_email');
    if (!is_string($to) || $to === '') {
        return;
    }
    $fields = twbl_feedback_fields();
    $art = twbl_artstyle_choices();
    $dir = twbl_direction_choices();
    $lines = [];
    $lines[] = 'Playtest report #' . $post_id;
    $lines[] = '';
    foreach ($fields as $key => $meta) {
        $value = $data[$key] ?? '';
        if ($key === 'artstyle') {
            $value = $art[$value] ?? $value;
        }
        if ($key === 'direction') {
            $value = $dir[$value] ?? $value;
        }
        $lines[] = $meta['label'];
        $lines[] = $value === '' ? '—' : $value;
        $lines[] = '';
    }
    $body = implode("\n", $lines);
    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        'Reply-To: ' . $data['player_name'] . ' <' . $data['player_email'] . '>',
    ];
    wp_mail($to, '[TWBL] ' . $data['player_name'] . ' rated ' . $data['overall'] . '/5', $body, $headers);
}

function twbl_feedback_meta_boxes(): void
{
    add_meta_box(
        'twbl_feedback_body',
        'Report',
        'twbl_render_feedback_meta_box',
        'twbl_feedback',
        'normal',
        'high',
    );
}
add_action('add_meta_boxes', 'twbl_feedback_meta_boxes');

function twbl_render_feedback_meta_box(WP_Post $post): void
{
    $fields = twbl_feedback_fields();
    $art = twbl_artstyle_choices();
    $dir = twbl_direction_choices();
    echo '<table class="widefat striped"><tbody>';
    foreach ($fields as $key => $meta) {
        $value = (string) get_post_meta($post->ID, '_twbl_' . $key, true);
        if ($key === 'artstyle') {
            $value = $art[$value] ?? $value;
        }
        if ($key === 'direction') {
            $value = $dir[$value] ?? $value;
        }
        echo '<tr><th style="width:16rem">' . esc_html($meta['label']) . '</th>';
        echo '<td>' . nl2br(esc_html($value === '' ? '—' : $value)) . '</td></tr>';
    }
    echo '</tbody></table>';
}

/**
 * @param array<int, string> $columns
 * @return array<int, string>
 */
function twbl_feedback_columns(array $columns): array
{
    return [
        'cb' => $columns['cb'] ?? '',
        'title' => 'Report',
        'overall' => 'Overall',
        'player' => 'From',
        'direction' => 'Direction',
        'date' => 'Date',
    ];
}
add_filter('manage_twbl_feedback_posts_columns', 'twbl_feedback_columns');

function twbl_feedback_column(string $column, int $post_id): void
{
    if ($column === 'overall') {
        $n = (int) get_post_meta($post_id, '_twbl_overall', true);
        echo $n > 0 ? esc_html((string) $n) . '/5' : '—';
        return;
    }
    if ($column === 'player') {
        echo esc_html((string) get_post_meta($post_id, '_twbl_player_name', true));
        echo '<br><span style="opacity:.7">' . esc_html((string) get_post_meta($post_id, '_twbl_player_email', true)) . '</span>';
        return;
    }
    if ($column === 'direction') {
        $key = (string) get_post_meta($post_id, '_twbl_direction', true);
        $map = ['story' => 'Story', 'campaign' => 'Campaign', 'hero' => 'Hero'];
        echo esc_html($map[$key] ?? '—');
    }
}
add_action('manage_twbl_feedback_posts_custom_column', 'twbl_feedback_column', 10, 2);

function twbl_body_class(array $classes): array
{
    $classes[] = 'twbl';
    return $classes;
}
add_filter('body_class', 'twbl_body_class');

function twbl_old(array $old, string $key, string $fallback = ''): string
{
    $v = $old[$key] ?? $fallback;
    return is_string($v) ? $v : $fallback;
}

function twbl_stars(string $name, string $selected, string $legend): void
{
    echo '<fieldset class="stars">';
    echo '<legend>' . esc_html($legend) . '</legend>';
    echo '<div class="star-row">';
    for ($n = 5; $n >= 1; $n--) {
        $id = $name . '-' . $n;
        $check = ((string) $n === $selected) ? ' checked' : '';
        echo '<input type="radio" id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" value="' . $n . '" required' . $check . '>';
        echo '<label for="' . esc_attr($id) . '" title="' . $n . ' out of 5"><span class="vh">' . $n . '</span></label>';
    }
    echo '</div>';
    echo '<p class="star-cap"><span>1 poor</span><span>5 excellent</span></p>';
    echo '</fieldset>';
}

function twbl_scale(string $name, string $selected, string $legend, string $lo, string $hi): void
{
    echo '<fieldset class="scale">';
    echo '<legend>' . esc_html($legend) . '</legend>';
    echo '<div class="scale-row">';
    for ($n = 1; $n <= 5; $n++) {
        $id = $name . '-' . $n;
        $check = ((string) $n === $selected) ? ' checked' : '';
        echo '<input type="radio" id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" value="' . $n . '" required' . $check . '>';
        echo '<label for="' . esc_attr($id) . '">' . $n . '</label>';
    }
    echo '</div>';
    echo '<p class="star-cap"><span>' . esc_html($lo) . '</span><span>' . esc_html($hi) . '</span></p>';
    echo '</fieldset>';
}
