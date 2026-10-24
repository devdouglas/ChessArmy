import { copyGlyphGroups, formatCopyHtml } from '../src/copy';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const html = formatCopyHtml('hold with [hoplite]');
  assert(html.includes('piece-icon'), `hoplite icon, got ${html}`);
  assert(html.includes('aria-label="Hoplite"'), 'hoplite labelled');
  assert(!html.includes('[hoplite]'), 'bracket eaten');
}

{
  const html = formatCopyHtml('watch [pikes] and [Horse archer]');
  assert(html.includes('token-pikes'), 'pikes glyph');
  assert(html.includes('aria-label="Pikes"'), 'pikes labelled');
  assert(html.includes('aria-label="Horse archer"'), 'name match');
}

{
  const html = formatCopyHtml('a < b and [nope]');
  assert(html.includes('a &lt; b and [nope]'), `escape unknown, got ${html}`);
}

{
  const html = formatCopyHtml('[Do not touch] near [board]');
  assert(html.includes('token-notouch'), 'notouch glyph');
  assert(html.includes('token-board'), 'board glyph');
}

{
  const html = formatCopyHtml('[ palisade ] [Flag] [house] [tree]');
  assert(html.includes('token-palisade'), 'trimmed palisade');
  assert(html.includes('token-flag'), 'flag label');
  assert(html.includes('token-house'), 'house glyph');
  assert(html.includes('token-tree'), 'tree glyph');
}

{
  const html = formatCopyHtml('[energy] [stamina] [hp] [units] [arrow] [shot]');
  assert(html.includes('copy-icon hud energy'), `energy bolt, got ${html}`);
  assert(html.includes('aria-label="HP"'), 'hp pip');
  assert(html.includes('aria-label="Units"'), 'units pip');
  assert(html.includes('copy-icon hud arrow'), 'arrow');
  assert(!html.includes('[energy]'), 'hud tags eaten');
}

{
  const groups = copyGlyphGroups();
  const tags = groups.flatMap((g) => g.glyphs.map((x) => x.tag));
  assert(groups.some((g) => g.id === 'hud'), 'hud group');
  assert(groups.some((g) => g.id === 'tokens'), 'tokens group');
  assert(tags.includes('energy'), 'energy in catalog');
  assert(tags.includes('hp'), 'hp in catalog');
  assert(tags.includes('units'), 'units in catalog');
  assert(tags.includes('arrow'), 'arrow in catalog');
  assert(tags.includes('Hoplite'), 'hoplite in catalog');
  assert(tags.includes('Pikes'), 'pikes in catalog');
  assert(tags.includes('House'), 'house in catalog');
  assert(tags.includes('Tree'), 'tree in catalog');
  assert(tags.includes('Board'), 'board in catalog');
}

console.log('copy: [name] swaps to unit/token icons; unknown stays text');
