<?php
/**
 * Template Name: Play
 */
get_header();
$game = twbl_game_url();
?>
<article class="sheet play-sheet">
    <h1>Enter the field</h1>
    <p class="lede">The game lives at its own table. Tutorial first — campaign, skirmish, historical battles and the editor unlock from there. Logged-in WordPress accounts keep stars on the profile; guests save in the browser.</p>
    <p class="acts">
        <a class="btn" href="<?php echo esc_url($game); ?>">Play There Will Be Legions</a>
        <a class="btn btn-ghost" href="<?php echo esc_url(home_url('/feedback/')); ?>">Send a field report</a>
    </p>
    <ol class="steps">
        <li>Finish the tutorial. That is the on-ramp.</li>
        <li>Try a historical battle or a skirmish once you have the rules in your hands.</li>
        <li>Come back here and tell us what broke, what sang, and which campaign direction you want.</li>
    </ol>
</article>
<?php
get_footer();
