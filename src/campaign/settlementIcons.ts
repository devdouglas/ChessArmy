/** Tiny map glyphs: house = village, temple = capital. Anchor is settlement.at. */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hitDisk(x: number, y: number): string {
  return `<circle class="cm-settle-hit" cx="${x}" cy="${y}" r="8"/>`;
}

/** Simple pitched-roof house, centered on (x, y). */
export function villageMarkerSvg(x: number, y: number, extraAttrs = ''): string {
  const walls = `M${x - 4} ${y - 0.5}h8v5.5h-8z`;
  const roof = `M${x - 5.2} ${y - 0.5}L${x} ${y - 6.5}L${x + 5.2} ${y - 0.5}Z`;
  const door = `M${x - 1.1} ${y + 1.8}h2.2v3.2h-2.2z`;
  return `<g class="cm-village" ${extraAttrs}>
    ${hitDisk(x, y)}
    <path class="cm-house-roof" d="${roof}"/>
    <path class="cm-house-walls" d="${walls}"/>
    <path class="cm-house-door" d="${door}"/>
  </g>`;
}

/** Classical temple: podium, columns, pediment. Centered on (x, y). */
export function capitalMarkerSvg(
  x: number,
  y: number,
  label: string,
  extraAttrs = '',
): string {
  const podium = `M${x - 6.5} ${y + 3.2}h13v1.6h-13z`;
  const entablature = `M${x - 5.5} ${y - 2.2}h11v1.4h-11z`;
  const pediment = `M${x - 6} ${y - 2.2}L${x} ${y - 7.2}L${x + 6} ${y - 2.2}Z`;
  const cols = [-3.4, 0, 3.4]
    .map(
      (dx) =>
        `<rect class="cm-temple-col" x="${x + dx - 0.7}" y="${y - 0.8}" width="1.4" height="4"/>`,
    )
    .join('');
  return `<g class="cm-capital" ${extraAttrs}>
    ${hitDisk(x, y)}
    <path class="cm-temple-pediment" d="${pediment}"/>
    <path class="cm-temple-entablature" d="${entablature}"/>
    ${cols}
    <path class="cm-temple-podium" d="${podium}"/>
    <text class="cm-label" x="${x}" y="${y - 10}">${esc(label)}</text>
  </g>`;
}
