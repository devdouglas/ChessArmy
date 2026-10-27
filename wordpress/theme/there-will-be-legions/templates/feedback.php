<?php
/**
 * Template Name: Feedback
 */
get_header();

$sent = isset($_GET['sent']);
$flash = twbl_take_flash();
$errors = $flash['errors'] ?? [];
$old = $flash['data'] ?? [];
$art = twbl_artstyle_choices();
$dirs = twbl_direction_choices();
?>
<article class="sheet report-sheet">
    <h1>Field report</h1>
    <?php if ($sent) : ?>
        <p class="notice notice-ok">Received. Thank you — this is exactly what the prototype is for. Back to the <a href="<?php echo esc_url(twbl_game_url()); ?>">game</a> if you want another pass.</p>
    <?php else : ?>
        <p class="lede">After-action notes from the prototype. Stars, taste, confusion, missing pieces, and which campaign you want this to become.</p>
        <?php if ($errors !== []) : ?>
            <div class="notice notice-bad" role="alert">
                <p>Could not send the report:</p>
                <ul>
                    <?php foreach ($errors as $err) : ?>
                        <li><?php echo esc_html($err); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
        <?php if (isset($_GET['err']) && $_GET['err'] === 'save') : ?>
            <p class="notice notice-bad" role="alert">Could not save the report. Try again in a minute.</p>
        <?php endif; ?>

        <form class="report" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" novalidate>
            <input type="hidden" name="action" value="twbl_feedback">
            <?php wp_nonce_field('twbl_feedback', 'twbl_nonce'); ?>
            <p class="hp" aria-hidden="true">
                <label>Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label>
            </p>

            <section>
                <h2>Rating</h2>
                <?php twbl_stars('overall', twbl_old($old, 'overall'), 'Overall'); ?>
                <p>
                    <label for="player_name">Name</label>
                    <input id="player_name" name="player_name" type="text" required maxlength="80" value="<?php echo esc_attr(twbl_old($old, 'player_name')); ?>">
                </p>
                <p>
                    <label for="player_email">Email</label>
                    <input id="player_email" name="player_email" type="email" required maxlength="120" value="<?php echo esc_attr(twbl_old($old, 'player_email')); ?>">
                </p>
                <?php
                twbl_scale('boardgames', twbl_old($old, 'boardgames'), 'How do you like boardgames?', 'not at all', 'a lot');
                twbl_scale('wargames', twbl_old($old, 'wargames'), 'How much do you like wargames?', 'not at all', 'a lot');
                twbl_scale('tutorial_ease', twbl_old($old, 'tutorial_ease'), 'How easy was it to do the tutorial?', 'very hard', 'very easy');
                twbl_stars('like_it', twbl_old($old, 'like_it'), 'How much do you like it?');
                ?>
            </section>

            <section>
                <h2>The build so far</h2>
                <p>
                    <label for="missing">As this is an early version, what do you feel it is missing?</label>
                    <textarea id="missing" name="missing" rows="5"><?php echo esc_textarea(twbl_old($old, 'missing')); ?></textarea>
                </p>
                <p>
                    <label for="liked">What did you like?</label>
                    <textarea id="liked" name="liked" rows="4"><?php echo esc_textarea(twbl_old($old, 'liked')); ?></textarea>
                </p>
                <p>
                    <label for="disliked">What did you not like?</label>
                    <textarea id="disliked" name="disliked" rows="4"><?php echo esc_textarea(twbl_old($old, 'disliked')); ?></textarea>
                </p>
                <p>
                    <label for="confusing">What was confusing?</label>
                    <textarea id="confusing" name="confusing" rows="4"><?php echo esc_textarea(twbl_old($old, 'confusing')); ?></textarea>
                </p>
            </section>

            <section>
                <h2>Next steps</h2>
                <fieldset class="art-pick">
                    <legend>What art style do you like?</legend>
                    <div class="art-grid">
                        <?php
                        $art_files = [
                            'hex-tokens' => ['file' => 'artstyle-hex-tokens.jpg', 'alt' => 'Top-down hex battlefield with red and blue token units'],
                            'cartoon' => ['file' => 'artstyle-cartoon.jpg', 'alt' => 'Cartoon hex battlefield with red and blue token units'],
                            'comic-300' => ['file' => 'artstyle-comic-300.jpg', 'alt' => 'High-contrast 300-style comic hex board with red and blue tokens'],
                            'boardgame' => ['file' => 'artstyle-boardgame.jpg', 'alt' => 'Physical tabletop hex board with cardboard tiles and tokens'],
                            'oil-painting' => ['file' => 'artstyle-oil-painting.jpg', 'alt' => 'Oil painting of two ancient armies meeting at dusk'],
                            'mosaic' => ['file' => 'artstyle-mosaic.jpg', 'alt' => 'Late-Roman mosaic of soldiers clashing under an eagle standard'],
                            'woodcut' => ['file' => 'artstyle-woodcut.jpg', 'alt' => 'Woodcut engraving of a legion advancing on a hex-shield wall'],
                        ];
                        $sel_art = twbl_old($old, 'artstyle');
                        foreach ($art as $key => $label) {
                            $id = 'art-' . $key;
                            $check = $sel_art === $key ? ' checked' : '';
                            $src = twbl_theme_uri('assets/img/' . $art_files[$key]['file']);
                            echo '<label class="art-card" for="' . esc_attr($id) . '">';
                            echo '<input type="radio" id="' . esc_attr($id) . '" name="artstyle" value="' . esc_attr($key) . '"' . $check . '>';
                            echo '<img src="' . esc_url($src) . '" alt="' . esc_attr($art_files[$key]['alt']) . '" width="640" height="480">';
                            echo '<span>' . esc_html($label) . '</span>';
                            echo '</label>';
                        }
                        ?>
                    </div>
                </fieldset>
                <p>
                    <label for="story">How did you like the story so far?</label>
                    <textarea id="story" name="story" rows="4"><?php echo esc_textarea(twbl_old($old, 'story')); ?></textarea>
                </p>
                <p>
                    <label for="tone">How did you like the tone of voice?</label>
                    <textarea id="tone" name="tone" rows="4"><?php echo esc_textarea(twbl_old($old, 'tone')); ?></textarea>
                </p>
                <fieldset class="dir-pick">
                    <legend>What direction should it take?</legend>
                    <?php
                    $sel_dir = twbl_old($old, 'direction');
                    $titles = [
                        'story' => 'Story driven',
                        'campaign' => 'War campaign driven',
                        'hero' => "Hero's journey",
                    ];
                    foreach ($dirs as $key => $text) {
                        $id = 'dir-' . $key;
                        $check = $sel_dir === $key ? ' checked' : '';
                        echo '<label class="dir-card" for="' . esc_attr($id) . '">';
                        echo '<input type="radio" id="' . esc_attr($id) . '" name="direction" value="' . esc_attr($key) . '"' . $check . '>';
                        echo '<strong>' . esc_html($titles[$key]) . '</strong>';
                        echo '<span>' . esc_html($text) . '</span>';
                        echo '</label>';
                    }
                    ?>
                </fieldset>
                <p>
                    <label for="other">Other feedback</label>
                    <textarea id="other" name="other" rows="5"><?php echo esc_textarea(twbl_old($old, 'other')); ?></textarea>
                </p>
            </section>

            <p class="acts">
                <button class="btn" type="submit">Send field report</button>
            </p>
        </form>
    <?php endif; ?>
</article>
<?php
get_footer();
