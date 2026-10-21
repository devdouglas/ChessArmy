<?php
/**
 * Warchess shared store. GET reads data.json, POST overwrites it.
 * Optional $SAVE_KEY: send the same value as header X-Warchess-Key.
 */
declare(strict_types=1);

$SAVE_KEY = 'warchess-oneshot';
$DATA_FILE = __DIR__ . '/data.json';
$MAX_BYTES = 2000000;

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
        'levels' => [],
        'defaultLevelId' => null,
        'formations' => [],
        'defaultFormationId' => null,
    ];
}

function read_store(string $file): array {
    if (!is_file($file)) {
        return empty_store();
    }
    $raw = file_get_contents($file);
    if ($raw === false || $raw === '') {
        return empty_store();
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return empty_store();
    }
    return sanitize_store($data);
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
        'levels' => $levels,
        'defaultLevelId' => $default,
        'formations' => $formations,
        'defaultFormationId' => $defaultForm,
    ];
}

function allowed_unit(mixed $type): bool {
    static $ok = [
        'soldier' => true,
        'scout' => true,
        'bazooka' => true,
        'sniper' => true,
        'archer' => true,
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
    ];
    if (!is_string($type) || strlen($type) > 40) {
        return false;
    }
    if (isset($ok[$type])) {
        return true;
    }
    return (bool) preg_match('/^u-[a-z0-9]+$/', $type);
}

function sanitize_armies(mixed $raw, int $cols, int $rows): array {
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    $seen = [];
    foreach (array_slice($raw, 0, 64) as $piece) {
        if (!is_array($piece) || !allowed_unit($piece['type'] ?? null)) {
            continue;
        }
        $side = $piece['side'] ?? '';
        if ($side !== 'red' && $side !== 'blue') {
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
        $out[] = [
            'type' => $piece['type'],
            'col' => $col,
            'row' => $row,
            'side' => $side,
        ];
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
        $slots[] = [
            'type' => $slot['type'],
            'col' => $col,
            'fromBack' => $fromBack,
        ];
    }
    $updated = isset($form['updatedAt']) && is_numeric($form['updatedAt'])
        ? (int) $form['updatedAt']
        : time() * 1000;
    return [
        'id' => $id,
        'name' => $name,
        'cols' => $cols,
        'slots' => $slots,
        'updatedAt' => $updated,
    ];
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

function sanitize_level_text(mixed $raw): string {
    if (!is_string($raw)) {
        return '';
    }
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', str_replace("\r\n", "\n", $raw));
    if (!is_string($text)) {
        return '';
    }
    return substr(trim($text), 0, 280);
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
    if ($cat !== 'campaign' && $cat !== 'tutorial' && $cat !== 'historical') {
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
        'startText' => sanitize_level_text($level['startText'] ?? ''),
        'winText' => sanitize_level_text($level['winText'] ?? ''),
        'loseText' => sanitize_level_text($level['loseText'] ?? ''),
        'star2' => sanitize_star_rule($level['star2'] ?? null, ['metric' => 'turns', 'op' => 'lt', 'value' => 6]),
        'star3' => sanitize_star_rule($level['star3'] ?? null, ['metric' => 'casualties', 'op' => 'eq', 'value' => 0]),
        'updatedAt' => $updated,
    ];
    if (array_key_exists('armies', $level)) {
        $out['armies'] = sanitize_armies($level['armies'], $cols, $rows);
    }
    return $out;
}

if ($method === 'GET') {
    echo json_encode(read_store($DATA_FILE), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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

$store = sanitize_store($incoming);
$json = json_encode($store, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($json === false) {
    fail(500, 'encode failed');
}

$fp = fopen($DATA_FILE, 'c+');
if ($fp === false) {
    fail(500, 'cannot open data.json (php write permissions?)');
}

if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    fail(500, 'lock failed');
}

ftruncate($fp, 0);
rewind($fp);
$ok = fwrite($fp, $json) !== false;
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

if (!$ok) {
    fail(500, 'write failed');
}

@chmod($DATA_FILE, 0664);

echo json_encode(['ok' => true, 'store' => $store], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
