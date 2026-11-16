<?php
/**
 * Campaign map store (Europe strategic map).
 * GET returns { ok, map }. POST body { map } replaces data/campaign/europe.json.
 * Optional $SAVE_KEY: send the same value as header X-Warchess-Key.
 */
declare(strict_types=1);

$SAVE_KEY = 'warchess-oneshot';
$DATA_DIR = __DIR__ . '/data/campaign';
$MAP_FILE = $DATA_DIR . '/europe.json';
$LOCK_FILE = $DATA_DIR . '/.lock';
$MAX_BYTES = 4000000;

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

function empty_map(): array {
    return [
        'id' => 'europe',
        'name' => 'Europe',
        'view' => ['x' => 0, 'y' => 0, 'w' => 1400, 'h' => 900],
        'factions' => [
            ['id' => 'barbarians', 'name' => 'Barbarians', 'color' => '#6b5b4b'],
            ['id' => 'gaule', 'name' => 'Gaule', 'color' => '#2e7d32'],
            ['id' => 'spain', 'name' => 'Spain', 'color' => '#c62828'],
            ['id' => 'caragheu', 'name' => 'Caragheu', 'color' => '#f9a825'],
            ['id' => 'rome', 'name' => 'Rome', 'color' => '#b71c1c'],
            ['id' => 'egypt', 'name' => 'Egypt', 'color' => '#f4d03f'],
        ],
        'regions' => [],
        'seaNodes' => [],
        'seaLinks' => [],
        'neighbors' => new stdClass(),
    ];
}

function require_key(string $save_key): void {
    if ($save_key === '') return;
    $got = $_SERVER['HTTP_X_WARCHESS_KEY'] ?? '';
    if (!is_string($got) || !hash_equals($save_key, $got)) {
        fail(401, 'unauthorized');
    }
}

function ensure_dir(string $dir): void {
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        fail(500, 'cannot create data dir');
    }
}

function read_map(string $file): array {
    if (!is_file($file)) return empty_map();
    $raw = file_get_contents($file);
    if ($raw === false || $raw === '') return empty_map();
    $data = json_decode($raw, true);
    if (!is_array($data)) return empty_map();
    return $data;
}

function shape_ok(array $map): bool {
    if (($map['id'] ?? null) !== 'europe') return false;
    if (!isset($map['name']) || !is_string($map['name'])) return false;
    if (!isset($map['view']) || !is_array($map['view'])) return false;
    foreach (['factions', 'regions', 'seaNodes', 'seaLinks'] as $k) {
        if (!isset($map[$k]) || !is_array($map[$k])) return false;
    }
    if (!array_key_exists('neighbors', $map)) return false;
    if (!is_array($map['neighbors']) && !($map['neighbors'] instanceof stdClass)) {
        return false;
    }
    return true;
}

require_key($SAVE_KEY);
ensure_dir($DATA_DIR);

if ($method === 'GET') {
    $map = read_map($MAP_FILE);
    if (!isset($map['neighbors']) || $map['neighbors'] === [] || $map['neighbors'] === null) {
        $map['neighbors'] = new stdClass();
    }
    echo json_encode(['ok' => true, 'map' => $map], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method !== 'POST') {
    fail(405, 'method not allowed');
}

$raw = file_get_contents('php://input');
if ($raw === false) fail(400, 'empty body');
if (strlen($raw) > $MAX_BYTES) fail(413, 'payload too large');

$body = json_decode($raw, true);
if (!is_array($body)) fail(400, 'invalid json');
$map = $body['map'] ?? $body;
if (!is_array($map)) fail(400, 'missing map');
if (!shape_ok($map)) fail(400, 'invalid map shape');

$map['id'] = 'europe';
if (!isset($map['neighbors']) || !is_array($map['neighbors'])) {
    $map['neighbors'] = new stdClass();
}

$fp = fopen($LOCK_FILE, 'c+');
if ($fp === false) fail(500, 'cannot lock');
if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    fail(500, 'cannot lock');
}

$json = json_encode($map, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if ($json === false) {
    flock($fp, LOCK_UN);
    fclose($fp);
    fail(500, 'encode failed');
}

$tmp = $MAP_FILE . '.tmp';
if (file_put_contents($tmp, $json . "\n") === false) {
    flock($fp, LOCK_UN);
    fclose($fp);
    fail(500, 'write failed');
}
if (!rename($tmp, $MAP_FILE)) {
    @unlink($tmp);
    flock($fp, LOCK_UN);
    fclose($fp);
    fail(500, 'rename failed');
}

flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['ok' => true, 'map' => $map], JSON_UNESCAPED_SLASHES);
