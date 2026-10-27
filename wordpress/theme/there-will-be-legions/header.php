<?php
if (!defined('ABSPATH')) {
    exit;
}
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<!--
THESIS: a war-table dispatch for playtesters, not a store page of feature cards.
OWN-WORLD: olive-black felt, stamped bronze aquila, hex tessellation, Big Shoulders Display + Castoro.
STORY: early prototype; play it; send a field report.
FIRST VIEWPORT: bronze hex lockup centered, one sentence, Play the prototype + Send a field report.
FORM: campaign table / field manual. Seed: brief-pinned hex/ancient/tactical.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->
<a class="skip" href="#main">Skip to content</a>
<header class="mast">
    <a class="mast-mark" href="<?php echo esc_url(home_url('/')); ?>">
        <img src="<?php echo esc_url(twbl_theme_uri('assets/img/twbl-mark.jpg')); ?>" alt="" width="48" height="48">
        <span>There Will Be Legions</span>
    </a>
    <nav class="mast-nav" aria-label="Primary">
        <?php
        $links = [
            ['Home', home_url('/')],
            ['Play', home_url('/play/')],
            ['Feedback', home_url('/feedback/')],
        ];
        foreach ($links as [$label, $url]) {
            $current = (is_front_page() && $label === 'Home')
                || (is_page('play') && $label === 'Play')
                || (is_page('feedback') && $label === 'Feedback');
            echo '<a href="' . esc_url($url) . '"' . ($current ? ' aria-current="page"' : '') . '>' . esc_html($label) . '</a>';
        }
        ?>
    </nav>
</header>
<main id="main">
