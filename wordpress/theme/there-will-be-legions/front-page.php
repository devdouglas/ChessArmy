<?php
get_header();
$game = twbl_game_url();
$feedback = home_url('/feedback/');
$play = home_url('/play/');
?>
<section class="hero">
    <img class="hero-lockup" src="<?php echo esc_url(twbl_theme_uri('assets/img/twbl-logo.jpg')); ?>" width="720" height="720" alt="There Will Be Legions — bronze eagle in a hex">
    <h1>There Will Be Legions</h1>
    <p class="lede">A turn-based hybrid of board game, deckbuilder, wargame, chess and RTS. Two maps. One war. Different speeds.</p>
    <p class="acts">
        <a class="btn" href="<?php echo esc_url($play); ?>">Play the prototype</a>
        <a class="btn btn-ghost" href="<?php echo esc_url($feedback); ?>">Send a field report</a>
    </p>
</section>

<section class="dispatch">
    <h2>This is a prototype.</h2>
    <p>Very early. The point of this build is not polish — it is to <strong>playtest and collect feedback</strong>. Play it. Break it. Tell us what was confusing, what you wanted, and which way the campaign should go.</p>
</section>

<section class="speeds">
    <div class="speed">
        <h2>Campaign map</h2>
        <p>The slow clock. Main story, resource management, army movements, exploration, reinforcements. You plan the war from the table.</p>
    </div>
    <div class="speed-hex" aria-hidden="true"></div>
    <div class="speed">
        <h2>Battle map</h2>
        <p>The fast clock. Same turn-based rules, hex by hex. Units with multiple modes, facing, terrain, stamina, shot and melee. The fight in detail.</p>
    </div>
</section>

<section class="brief">
    <h2>On the field</h2>
    <ul>
        <li>Hex battles with height, cover, water and armor facing</li>
        <li>Units that switch modes instead of being one-trick counters</li>
        <li>AI you can actually lose to — aggressive, defensive, advance</li>
        <li>Skirmish, historical battles, tutorial, campaign</li>
        <li>Hotseat up to four colours</li>
        <li>A complete level editor: maps, units, stars, AI checklists</li>
    </ul>
    <p class="acts">
        <a class="btn" href="<?php echo esc_url($game); ?>">Enter the game</a>
        <a class="btn btn-ghost" href="<?php echo esc_url($feedback); ?>">After-action report</a>
    </p>
</section>
<?php
get_footer();
