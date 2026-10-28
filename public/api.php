<?php
/**
 * Warchess shared store.
 * GET returns the assembled catalog. POST merges by id (newer updatedAt wins)
 * into per-level files under data/levels/<id>.json. Missing-from-POST maps
 * are kept. Deletes need a newer tombstone in deletedLevels.
 * Optional $SAVE_KEY: send the same value as header X-Warchess-Key.
 */
declare(strict_types=1);

$SAVE_KEY = 'warchess-oneshot';
$DATA_FILE = __DIR__ . '/data.json';
$DATA_DIR = __DIR__ . '/data';
$LEVELS_DIR = $DATA_DIR . '/levels';
$UNITS_FILE = $DATA_DIR . '/units.json';
$FORMS_FILE = $DATA_DIR . '/formations.json';
$META_FILE = $DATA_DIR . '/meta.json';
$LOCK_FILE = $DATA_DIR . '/.lock';
$MAX_BYTES = 2000000;
$MAX_LEVELS = 80;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    header('Allow: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

function fail(int $code, string $error): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_SLASHES);
    exit;
}

function empty_store(): array {
    return [
        'units' => null,
        'aiChecklist' => null,
        'levels' => [],
        'defaultLevelId' => null,
        'formations' => [],
        'defaultFormationId' => null,
        'deletedLevels' => [],
        'deletedFormations' => [],
    ];
}

function safe_item_id(string $id): bool {
    return (bool) preg_match('/^[a-zA-Z0-9._-]{1,80}$/', $id);
}

function decode_json_file(string $file): mixed {
    if (!is_file($file)) {
        return null;
    }
    $raw = file_get_contents($file);
    if ($raw === false || $raw === '') {
        return null;
    }
    return json_decode($raw, true);
}

function read_legacy_store(string $file): array {
    $data = decode_json_file($file);
    if (!is_array($data)) {
        return empty_store();
    }
    return sanitize_store($data);
}

function read_store(string $file): array {
    return read_legacy_store($file);
}

function sanitize_store(array $data): array {
    $units = $data['units'] ?? null;
    if (!is_array($units)) {
        $units = null;
    }

    $levels = [];
    if (isset($data['levels']) && is_array($data['levels'])) {
        foreach (array_slice($data['levels'], 0, 80) as $level) {
            $clean = sanitize_level($level);
            if ($clean !== null) {
                $levels[] = $clean;
            }
        }
    }

    $default = $data['defaultLevelId'] ?? null;
    if (!is_string($default) || $default === '') {
        $default = null;
    }

    $formations = [];
    if (isset($data['formations']) && is_array($data['formations'])) {
        foreach (array_slice($data['formations'], 0, 80) as $form) {
            $clean = sanitize_formation($form);
            if ($clean !== null) {
                $formations[] = $clean;
            }
        }
    }

    $defaultForm = $data['defaultFormationId'] ?? null;
    if (!is_string($defaultForm) || $defaultForm === '' || $defaultForm === 'stock') {
        $defaultForm = null;
    }

    return [
        'units' => $units,
        'aiChecklist' => sanitize_ai_checklist($data['aiChecklist'] ?? null),
        'levels' => $levels,
        'defaultLevelId' => $default,
        'formations' => $formations,
        'defaultFormationId' => $defaultForm,
        'deletedLevels' => sanitize_deleted($data['deletedLevels'] ?? null),
        'deletedFormations' => sanitize_deleted($data['deletedFormations'] ?? null),
    ];
}

function sanitize_deleted(mixed $raw): array {
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    $n = 0;
    foreach ($raw as $id => $ts) {
        if ($n >= 200) {
            break;
        }
        if (!is_string($id) || !safe_item_id($id)) {
            continue;
        }
        if (!is_numeric($ts)) {
            continue;
        }
        $t = (int) $ts;
        if ($t <= 0) {
            continue;
        }
        $out[$id] = $t;
        $n++;
    }
    return $out;
}

function allowed_unit(mixed $type): bool {
    static $ok = [
        'soldier' => true,
        'scout' => true,
        'bazooka' => true,
        'sniper' => true,
        'archer' => true,
        'javelin' => true,
        'horsearcher' => true,
        'chariotarcher' => true,
        'cohort' => true,
        'hoplite' => true,
        'elephant' => true,
        'barbarian' => true,
        'catapult' => true,
        'tank' => true,
        'general' => true,
        'tower' => true,
        'dummy' => true,
        'peasant' => true,
        'dude' => true,
        'wolf' => true,
        'fighter' => true,
        'gunship' => true,
        'bomber' => true,
        'frigate' => true,
        'cruiser' => true,
        'dreadnought' => true,
    ];
    if (!is_string($type) || strlen($type) > 40) {
        return false;
    }
    if (isset($ok[$type])) {
        return true;
    }
    return (bool) preg_match('/^u-[a-z0-9]+$/', $type);
}

function sanitize_facing(mixed $raw): ?int {
    if (!is_numeric($raw)) {
        return null;
    }
    $n = (int) $raw;
    if ($n < 0 || $n > 5) {
        return null;
    }
    return $n;
}

function sanitize_unit_tokens(mixed $raw): array {
    if (!is_array($raw)) {
        return [];
    }
    $ok = ['general' => true, 'hidden' => true, 'exhausted' => true, 'neutral' => true, 'sleep' => true, 'story' => true];
    $out = [];
    $seen = [];
    foreach ($raw as $item) {
        if (!is_string($item) || !isset($ok[$item]) || isset($seen[$item])) {
            continue;
        }
        $seen[$item] = true;
        $out[] = $item;
    }
    return $out;
}

function sanitize_story(mixed $raw): ?array {
    if (!is_array($raw)) {
        return null;
    }
    $text = sanitize_level_text($raw['text'] ?? '', 280);
    if ($text === '') {
        return null;
    }
    $when = (($raw['when'] ?? '') === 'touch') ? 'touch' : 'kill';
    return ['text' => $text, 'when' => $when];
}

/** Attach story copy, and the story token when that copy exists. */
function merge_story_tokens(array $unitTokens, mixed $rawStory): array {
    $story = sanitize_story($rawStory);
    if ($story && !in_array('story', $unitTokens, true)) {
        $unitTokens[] = 'story';
    }
    return [$unitTokens, $story];
}

function sanitize_armies(mixed $raw, int $cols, int $rows): array {
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    $seen = [];
    foreach (array_slice($raw, 0, 128) as $piece) {
        if (!is_array($piece) || !allowed_unit($piece['type'] ?? null)) {
            continue;
        }
        $side = $piece['side'] ?? '';
        if (
            $side !== 'red' &&
            $side !== 'blue' &&
            $side !== 'yellow' &&
            $side !== 'purple' &&
            $side !== 'neutral'
        ) {
            continue;
        }
        $col = isset($piece['col']) && is_numeric($piece['col']) ? (int) $piece['col'] : -1;
        $row = isset($piece['row']) && is_numeric($piece['row']) ? (int) $piece['row'] : -1;
        if ($col < 0 || $col >= $cols || $row < 0 || $row >= $rows) {
            continue;
        }
        $k = $col . ',' . $row;
        if (isset($seen[$k])) {
            continue;
        }
        $seen[$k] = true;
        $rowOut = [
            'type' => $piece['type'],
            'col' => $col,
            'row' => $row,
            'side' => $side,
        ];
        [$unitTokens, $story] = merge_story_tokens(
            sanitize_unit_tokens($piece['unitTokens'] ?? null),
            $piece['story'] ?? null,
        );
        if ($unitTokens) {
            $rowOut['unitTokens'] = $unitTokens;
        }
        if ($story) {
            $rowOut['story'] = $story;
        }
        $facing = sanitize_facing($piece['facing'] ?? null);
        if ($facing !== null) {
            $rowOut['facing'] = $facing;
        }
        $out[] = $rowOut;
    }
    return $out;
}

function sanitize_tokens(mixed $raw, int $cols, int $rows): array {
    if (!is_array($raw)) {
        return [];
    }
    $ok = [
        'pikes' => true,
        'wall' => true,
        'house' => true,
        'palisade' => true,
        'tree' => true,
        'forest' => true,
        'flag' => true,
        'board' => true,
        'notouch' => true,
    ];
    $woodHp = ['palisade' => true, 'tree' => true, 'forest' => true];
    $out = [];
    $seen = [];
    $cap = max(0, $cols * $rows * 9);
    foreach (array_slice($raw, 0, $cap) as $token) {
        if (!is_array($token)) {
            continue;
        }
        $type = $token['type'] ?? '';
        if (!isset($ok[$type])) {
            continue;
        }
        $col = isset($token['col']) && is_numeric($token['col']) ? (int) $token['col'] : -1;
        $row = isset($token['row']) && is_numeric($token['row']) ? (int) $token['row'] : -1;
        if ($col < 0 || $col >= $cols || $row < 0 || $row >= $rows) {
            continue;
        }
        $k = $col . ',' . $row . ',' . $type;
        if (isset($seen[$k])) {
            continue;
        }
        $seen[$k] = true;
        $rowOut = [
            'type' => $type,
            'col' => $col,
            'row' => $row,
        ];
        if ($type === 'flag') {
            $owner = $token['owner'] ?? '';
            if ($owner === 'red' || $owner === 'blue' || $owner === 'yellow' || $owner === 'purple') {
                $rowOut['owner'] = $owner;
            }
        }
        if ($type === 'board') {
            $text = sanitize_level_text($token['text'] ?? '', 280);
            if ($text !== '') {
                $rowOut['text'] = $text;
            }
        }
        if (isset($woodHp[$type])) {
            $hp = isset($token['hp']) && is_numeric($token['hp']) ? (int) $token['hp'] : 3;
            // Old cap was 2 (always written for fresh tokens). Keep 1 as damaged.
            if ($hp === 1) {
                $rowOut['hp'] = 1;
            }
        }
        if (!empty($token['noTouch'])) {
            $rowOut['noTouch'] = true;
        }
        $out[] = $rowOut;
    }
    return $out;
}

function sanitize_ai_styles(mixed $raw): array {
    $defaults = [
        'red' => 'aggressive',
        'blue' => 'aggressive',
        'yellow' => 'aggressive',
        'purple' => 'aggressive',
    ];
    $ok = ['aggressive' => true, 'defensive' => true, 'advance' => true];
    $src = is_array($raw) ? $raw : [];
    $out = $defaults;
    foreach ($defaults as $side => $fallback) {
        $v = $src[$side] ?? '';
        $out[$side] = isset($ok[$v]) ? $v : $fallback;
    }
    return $out;
}

function sanitize_ai_checklist(mixed $raw): ?array {
    if (!is_array($raw)) {
        return null;
    }
    $out = [];
    foreach (['aggressive', 'defensive', 'advance'] as $style) {
        $col = is_array($raw[$style] ?? null) ? $raw[$style] : [];
        $clean = [];
        foreach ($col as $id => $on) {
            if (!is_string($id) || !preg_match('/^[a-z0-9-]{1,48}$/', $id)) {
                continue;
            }
            $clean[$id] = (bool) $on;
        }
        if (!array_key_exists('shoot-first', $clean) && array_key_exists('prefer-attacks', $clean)) {
            $clean['shoot-first'] = $clean['prefer-attacks'];
        }
        unset($clean['prefer-attacks']);
        if (!array_key_exists('strongest-first', $clean) && array_key_exists('prefer-general-kills', $clean)) {
            $clean['strongest-first'] = $clean['prefer-general-kills'];
        }
        unset($clean['prefer-general-kills']);
        $out[$style] = $clean;
    }
    return $out;
}

function sanitize_army_controls(mixed $raw): array {
    $defaults = [
        'red' => 'player',
        'blue' => 'ai-enemy',
        'yellow' => 'ai-enemy',
        'purple' => 'ai-enemy',
    ];
    $ok = ['player' => true, 'ai-enemy' => true, 'ai-ally' => true];
    $src = is_array($raw) ? $raw : [];
    $out = $defaults;
    foreach ($defaults as $side => $fallback) {
        $v = $src[$side] ?? '';
        $out[$side] = isset($ok[$v]) ? $v : $fallback;
    }
    return $out;
}

function sanitize_formation(mixed $form): ?array {
    if (!is_array($form)) {
        return null;
    }
    $id = isset($form['id']) && is_string($form['id']) ? substr($form['id'], 0, 80) : '';
    $name = isset($form['name']) && is_string($form['name']) ? substr(trim($form['name']), 0, 48) : '';
    if ($id === '' || $id === 'stock' || $name === '') {
        return null;
    }
    $cols = isset($form['cols']) && is_numeric($form['cols']) ? (int) $form['cols'] : 11;
    $cols = max(1, min(32, $cols));
    $slots = [];
    $rawSlots = is_array($form['slots'] ?? null) ? $form['slots'] : [];
    foreach (array_slice($rawSlots, 0, 48) as $slot) {
        if (!is_array($slot) || !allowed_unit($slot['type'] ?? null)) {
            continue;
        }
        $col = isset($slot['col']) && is_numeric($slot['col']) ? (int) $slot['col'] : -1;
        $fromBack = isset($slot['fromBack']) && is_numeric($slot['fromBack']) ? (int) $slot['fromBack'] : -1;
        if ($col < 0 || $col > 32 || $fromBack < 0 || $fromBack > 32) {
            continue;
        }
        $slotOut = [
            'type' => $slot['type'],
            'col' => $col,
            'fromBack' => $fromBack,
        ];
        [$unitTokens, $story] = merge_story_tokens(
            sanitize_unit_tokens($slot['unitTokens'] ?? null),
            $slot['story'] ?? null,
        );
        if ($unitTokens) {
            $slotOut['unitTokens'] = $unitTokens;
        }
        if ($story) {
            $slotOut['story'] = $story;
        }
        $facing = sanitize_facing($slot['facing'] ?? null);
        if ($facing !== null) {
            $slotOut['facing'] = $facing;
        }
        $slots[] = $slotOut;
    }
    $updated = isset($form['updatedAt']) && is_numeric($form['updatedAt'])
        ? (int) $form['updatedAt']
        : time() * 1000;
    $out = [
        'id' => $id,
        'name' => $name,
        'cols' => $cols,
        'slots' => $slots,
        'updatedAt' => $updated,
    ];
    $period = $form['period'] ?? '';
    if ($period === 'ancient' || $period === 'modern' || $period === 'futuristic') {
        $out['period'] = $period;
    }
    return $out;
}

function sanitize_star_rule(mixed $raw, array $fallback): array {
    $src = is_array($raw) ? $raw : $fallback;
    $metricRaw = $src['metric'] ?? null;
    if ($metricRaw === 'casualties' || $metricRaw === 'turns') {
        $metric = $metricRaw;
    } else {
        $metric = ($fallback['metric'] ?? 'turns') === 'casualties' ? 'casualties' : 'turns';
    }
    $op = $src['op'] ?? '';
    if ($op !== 'lte' && $op !== 'eq' && $op !== 'lt') {
        $op = ($fallback['op'] ?? 'lt');
        if ($op !== 'lte' && $op !== 'eq' && $op !== 'lt') {
            $op = 'lt';
        }
    }
    $value = isset($src['value']) && is_numeric($src['value']) ? (int) $src['value'] : (int) ($fallback['value'] ?? 0);
    if ($value < 0) {
        $value = 0;
    }
    if ($value > 99) {
        $value = 99;
    }
    return ['metric' => $metric, 'op' => $op, 'value' => $value];
}

function sanitize_level_text(mixed $raw, int $max = 2500): string {
    if (!is_string($raw)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', str_replace("\r\n", "\n", $raw));
    if (!is_string($text)) {
        return '';
    }
    if ($max < 1) {
        $max = 2500;
    }
    return substr(trim($text), 0, $max);
}

function sanitize_level(mixed $level): ?array {
    if (!is_array($level)) {
        return null;
    }
    $id = isset($level['id']) && is_string($level['id']) ? substr($level['id'], 0, 80) : '';
    $name = isset($level['name']) && is_string($level['name']) ? substr(trim($level['name']), 0, 48) : '';
    $terrain = $level['terrain'] ?? null;
    if ($id === '' || $name === '' || !is_array($terrain) || $terrain === []) {
        return null;
    }
    $rows = min(21, count($terrain));
    $cols = min(21, is_array($terrain[0] ?? null) ? count($terrain[0]) : 0);
    if ($rows < 1 || $cols < 1) {
        return null;
    }
    $grid = [];
    $allowed = ['land' => true, 'water' => true, 'rock' => true, 'wall' => true, 'high' => true, 'plateau' => true];
    for ($r = 0; $r < $rows; $r++) {
        $row = [];
        for ($c = 0; $c < $cols; $c++) {
            $cell = $terrain[$r][$c] ?? 'land';
            $row[] = isset($allowed[$cell]) ? $cell : 'land';
        }
        $grid[] = $row;
    }
    $ori = ($level['orientation'] ?? '') === 'flat' ? 'flat' : 'pointy';
    $updated = isset($level['updatedAt']) && is_numeric($level['updatedAt'])
        ? (int) $level['updatedAt']
        : time() * 1000;
    $cat = $level['category'] ?? 'historical';
    if ($cat === 'free') {
        $cat = 'historical';
    }
    if ($cat !== 'campaign' && $cat !== 'tutorial' && $cat !== 'historical' && $cat !== 'skirmish') {
        $cat = 'historical';
    }
    $period = $level['period'] ?? 'modern';
    if ($period !== 'ancient' && $period !== 'modern' && $period !== 'futuristic') {
        $period = 'modern';
    }
    $unitsPerTurn = isset($level['unitsPerTurn']) ? (int) $level['unitsPerTurn'] : 1;
    if ($unitsPerTurn < 1) {
        $unitsPerTurn = 1;
    }
    if ($unitsPerTurn > 12) {
        $unitsPerTurn = 12;
    }
    $maxTurns = isset($level['maxTurns']) && is_numeric($level['maxTurns'])
        ? (int) $level['maxTurns']
        : 0;
    if ($maxTurns < 0) {
        $maxTurns = 0;
    }
    if ($maxTurns > 99) {
        $maxTurns = 99;
    }

    $out = [
        'id' => $id,
        'name' => $name,
        'cols' => $cols,
        'rows' => $rows,
        'orientation' => $ori,
        'terrain' => $grid,
        'category' => $cat,
        'period' => $period,
        'unitsPerTurn' => $unitsPerTurn,
        'maxTurns' => $maxTurns,
        'teaserText' => sanitize_level_text($level['teaserText'] ?? '', 120),
        'startText' => sanitize_level_text($level['startText'] ?? ''),
        'winText' => sanitize_level_text($level['winText'] ?? ''),
        'loseText' => sanitize_level_text($level['loseText'] ?? ''),
        'star2' => sanitize_star_rule($level['star2'] ?? null, ['metric' => 'turns', 'op' => 'lt', 'value' => 6]),
        'star3' => sanitize_star_rule($level['star3'] ?? null, ['metric' => 'casualties', 'op' => 'eq', 'value' => 0]),
        'armyControls' => sanitize_army_controls($level['armyControls'] ?? null),
        'aiStyles' => sanitize_ai_styles($level['aiStyles'] ?? null),
        'tokens' => sanitize_tokens($level['tokens'] ?? null, $cols, $rows),
        'sort' => isset($level['sort']) && is_numeric($level['sort']) ? (int) $level['sort'] : 0,
        'updatedAt' => $updated,
    ];
    $kept = $out['tokens'];
    $hasWall = [];
    foreach ($kept as $tok) {
        if (($tok['type'] ?? '') === 'wall') {
            $hasWall[$tok['col'] . ',' . $tok['row']] = true;
        }
    }
    for ($r = 0; $r < $rows; $r++) {
        for ($c = 0; $c < $cols; $c++) {
            if ($grid[$r][$c] !== 'wall') {
                continue;
            }
            $grid[$r][$c] = 'land';
            $k = $c . ',' . $r;
            if (isset($hasWall[$k])) {
                continue;
            }
            $hasWall[$k] = true;
            $kept[] = ['type' => 'wall', 'col' => $c, 'row' => $r];
        }
    }
    $out['tokens'] = $kept;
    $out['terrain'] = $grid;
    if (array_key_exists('armies', $level)) {
        $out['armies'] = sanitize_armies($level['armies'], $cols, $rows);
    }
    return $out;
}

function ensure_dir(string $dir): void {
    if (is_dir($dir)) {
        return;
    }
    if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
        fail(500, 'cannot create data dir');
    }
    @chmod($dir, 0775);
}

function split_initialized(): bool {
    global $META_FILE, $LEVELS_DIR;
    if (is_file($META_FILE)) {
        return true;
    }
    if (!is_dir($LEVELS_DIR)) {
        return false;
    }
    $files = glob($LEVELS_DIR . '/*.json') ?: [];
    return $files !== [];
}

function newest_cap(array $items, int $max): array {
    if (count($items) <= $max) {
        return array_values($items);
    }
    usort($items, static function (array $a, array $b): int {
        return ((int) ($b['updatedAt'] ?? 0)) <=> ((int) ($a['updatedAt'] ?? 0));
    });
    return array_slice($items, 0, $max);
}

function merge_deleted(array $a, array $b): array {
    $out = $a;
    foreach ($b as $id => $ts) {
        $out[$id] = max((int) ($out[$id] ?? 0), (int) $ts);
    }
    return $out;
}

function merge_items(array $a, array $b, array $deleted): array {
    $map = [];
    foreach (array_merge($a, $b) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = $item['id'] ?? '';
        if (!is_string($id) || $id === '') {
            continue;
        }
        $updated = (int) ($item['updatedAt'] ?? 0);
        if (((int) ($deleted[$id] ?? 0)) >= $updated) {
            continue;
        }
        $prev = $map[$id] ?? null;
        if ($prev === null || $updated >= (int) ($prev['updatedAt'] ?? 0)) {
            $map[$id] = $item;
        }
    }
    return array_values($map);
}

function prune_deleted(array $deleted, array $items): array {
    foreach ($items as $item) {
        $id = $item['id'] ?? '';
        if (!is_string($id) || $id === '') {
            continue;
        }
        if (((int) ($deleted[$id] ?? 0)) < (int) ($item['updatedAt'] ?? 0)) {
            unset($deleted[$id]);
        }
    }
    return $deleted;
}

function merge_store(array $existing, array $incoming): array {
    global $MAX_LEVELS;
    $deletedLevels = merge_deleted(
        $existing['deletedLevels'] ?? [],
        $incoming['deletedLevels'] ?? [],
    );
    $deletedForms = merge_deleted(
        $existing['deletedFormations'] ?? [],
        $incoming['deletedFormations'] ?? [],
    );
    $levels = newest_cap(
        merge_items($existing['levels'] ?? [], $incoming['levels'] ?? [], $deletedLevels),
        $MAX_LEVELS,
    );
    $formations = newest_cap(
        merge_items($existing['formations'] ?? [], $incoming['formations'] ?? [], $deletedForms),
        $MAX_LEVELS,
    );
    $deletedLevels = prune_deleted($deletedLevels, $levels);
    $deletedForms = prune_deleted($deletedForms, $formations);
    $units = $incoming['units'] ?? null;
    if (!is_array($units)) {
        $units = $existing['units'] ?? null;
    }
    $aiChecklist = $incoming['aiChecklist'] ?? null;
    if (!is_array($aiChecklist)) {
        $aiChecklist = $existing['aiChecklist'] ?? null;
    }
    $defaultLevel = $incoming['defaultLevelId'] ?? null;
    if (!is_string($defaultLevel) || $defaultLevel === '') {
        $defaultLevel = $existing['defaultLevelId'] ?? null;
    }
    $defaultForm = $incoming['defaultFormationId'] ?? null;
    if (!is_string($defaultForm) || $defaultForm === '' || $defaultForm === 'stock') {
        $defaultForm = $existing['defaultFormationId'] ?? null;
    }
    return [
        'units' => is_array($units) ? $units : null,
        'aiChecklist' => is_array($aiChecklist) ? $aiChecklist : null,
        'levels' => $levels,
        'defaultLevelId' => is_string($defaultLevel) && $defaultLevel !== '' ? $defaultLevel : null,
        'formations' => $formations,
        'defaultFormationId' => is_string($defaultForm) && $defaultForm !== '' && $defaultForm !== 'stock'
            ? $defaultForm
            : null,
        'deletedLevels' => $deletedLevels,
        'deletedFormations' => $deletedForms,
    ];
}

function assemble_split_store(): array {
    global $LEVELS_DIR, $UNITS_FILE, $FORMS_FILE, $META_FILE;
    $meta = decode_json_file($META_FILE);
    if (!is_array($meta)) {
        $meta = [];
    }
    $units = decode_json_file($UNITS_FILE);
    $forms = decode_json_file($FORMS_FILE);
    $levels = [];
    if (is_dir($LEVELS_DIR)) {
        foreach (glob($LEVELS_DIR . '/*.json') ?: [] as $file) {
            $id = basename($file, '.json');
            if (!safe_item_id($id)) {
                continue;
            }
            $row = decode_json_file($file);
            if (is_array($row)) {
                $levels[] = $row;
            }
        }
    }
    usort($levels, static function (array $a, array $b): int {
        return ((int) ($b['updatedAt'] ?? 0)) <=> ((int) ($a['updatedAt'] ?? 0));
    });
    return sanitize_store([
        'units' => is_array($units) ? $units : null,
        'aiChecklist' => $meta['aiChecklist'] ?? null,
        'levels' => $levels,
        'defaultLevelId' => $meta['defaultLevelId'] ?? null,
        'formations' => is_array($forms) ? $forms : [],
        'defaultFormationId' => $meta['defaultFormationId'] ?? null,
        'deletedLevels' => $meta['deletedLevels'] ?? [],
        'deletedFormations' => $meta['deletedFormations'] ?? [],
    ]);
}

function read_live_store(): array {
    global $DATA_FILE;
    if (split_initialized()) {
        return assemble_split_store();
    }
    return read_legacy_store($DATA_FILE);
}

function as_json_map(array $map): array|object {
    return $map === [] ? new stdClass() : $map;
}

function store_for_json(array $store): array {
    $store['deletedLevels'] = as_json_map($store['deletedLevels'] ?? []);
    $store['deletedFormations'] = as_json_map($store['deletedFormations'] ?? []);
    return $store;
}

function write_json_file(string $file, mixed $data): void {
    $json = json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT,
    );
    if ($json === false) {
        fail(500, 'encode failed');
    }
    $dir = dirname($file);
    ensure_dir($dir);
    $tmp = $file . '.tmp';
    if (file_put_contents($tmp, $json) === false) {
        fail(500, 'write failed');
    }
    if (!rename($tmp, $file)) {
        @unlink($tmp);
        fail(500, 'write failed');
    }
    @chmod($file, 0664);
}

function write_split_store(array $store): void {
    global $DATA_DIR, $LEVELS_DIR, $UNITS_FILE, $FORMS_FILE, $META_FILE;
    ensure_dir($DATA_DIR);
    ensure_dir($LEVELS_DIR);
    foreach ($store['levels'] as $level) {
        $id = $level['id'] ?? '';
        if (!is_string($id) || !safe_item_id($id)) {
            continue;
        }
        write_json_file($LEVELS_DIR . '/' . $id . '.json', $level);
    }
    foreach ($store['deletedLevels'] as $id => $_ts) {
        if (!is_string($id) || !safe_item_id($id)) {
            continue;
        }
        $path = $LEVELS_DIR . '/' . $id . '.json';
        if (is_file($path)) {
            @unlink($path);
        }
    }
    write_json_file($UNITS_FILE, $store['units']);
    write_json_file($FORMS_FILE, $store['formations']);
    write_json_file($META_FILE, [
        'defaultLevelId' => $store['defaultLevelId'],
        'defaultFormationId' => $store['defaultFormationId'],
        'deletedLevels' => as_json_map($store['deletedLevels']),
        'deletedFormations' => as_json_map($store['deletedFormations']),
        'aiChecklist' => $store['aiChecklist'],
    ]);
}

function with_store_lock(int $mode, callable $fn): mixed {
    global $DATA_DIR, $LOCK_FILE;
    ensure_dir($DATA_DIR);
    $fp = fopen($LOCK_FILE, 'c+');
    if ($fp === false) {
        fail(500, 'cannot open store lock');
    }
    if (!flock($fp, $mode)) {
        fclose($fp);
        fail(500, 'lock failed');
    }
    try {
        return $fn();
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

if ($method === 'GET') {
    $store = with_store_lock(LOCK_SH, static function () {
        return split_initialized() ? assemble_split_store() : null;
    });
    if ($store === null) {
        $store = with_store_lock(LOCK_EX, static function () {
            global $DATA_FILE;
            if (split_initialized()) {
                return assemble_split_store();
            }
            $legacy = read_legacy_store($DATA_FILE);
            write_split_store($legacy);
            return $legacy;
        });
    }
    echo json_encode(store_for_json($store), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    fail(405, 'use GET or POST');
}

if ($SAVE_KEY !== '') {
    $got = $_SERVER['HTTP_X_WARCHESS_KEY'] ?? '';
    if (!hash_equals($SAVE_KEY, $got)) {
        fail(403, 'bad key');
    }
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > $MAX_BYTES) {
    fail(413, 'payload too large');
}

$incoming = json_decode($raw, true);
if (!is_array($incoming)) {
    fail(400, 'invalid json');
}

$store = with_store_lock(LOCK_EX, static function () use ($incoming, $DATA_FILE) {
    $existing = split_initialized() ? assemble_split_store() : read_legacy_store($DATA_FILE);
    $merged = merge_store($existing, sanitize_store($incoming));
    write_split_store($merged);
    return $merged;
});

echo json_encode(['ok' => true, 'store' => store_for_json($store)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
