<?php
get_header();
if (have_posts()) {
    while (have_posts()) {
        the_post();
        echo '<article class="sheet">';
        echo '<h1>' . esc_html(get_the_title()) . '</h1>';
        the_content();
        echo '</article>';
    }
} else {
    echo '<article class="sheet"><h1>Nothing here.</h1></article>';
}
get_footer();
