import './campaign.css';
import {
  CAPITAL_KEYS,
  CAPITAL_LABEL,
  DEFAULT_VIEW,
  type CampaignMap,
  type CampaignRegion,
  type CapitalKey,
  type Point,
  type SeaLink,
  type SeaNode,
} from './types';
import { capitalMarkerSvg, villageMarkerSvg } from './settlementIcons';
import { listCampaignUnitAccess } from './units';
import {
  SNAP_PX,
  centroid,
  computeNeighbors,
  cutStaysInside,
  dist,
  findEdgeNear,
  findVertexIndex,
  insertVertexOnSharedEdge,
  moveSharedVertex,
  pointInPolygon,
  pointOnRingBoundary,
  pointStrictlyInside,
  removeVertexAtPoint,
  ringOverlapsAny,
  ringToPath,
  samePoint,
  snapToRegions,
  splitRingByCut,
} from './geometry';
import { loadCampaignMap, neutralizeOpenGround, newId, pushCampaignMap } from './store';

type Tool = 'pan' | 'select' | 'draw' | 'split' | 'sea-blue' | 'sea-red' | 'erase';
type Selection =
  | { kind: 'region'; id: string }
  | { kind: 'link'; id: string }
  | { kind: 'node'; id: string }
  | null;

type SeaDraft = {
  kind: 'blue' | 'red';
  nodeIds: string[];
  points: Point[];
};

type SplitDraft = {
  regionId: string;
  startIndex: number;
  /** Start vertex + optional interior mids. End vertex finishes the cut. */
  points: Point[];
};

export type CampaignEditorHandle = {
  isDirty: () => boolean;
  destroy: () => void;
};

let cssLinked = false;

function ensureCss(): void {
  if (cssLinked) return;
  cssLinked = true;
  // Vite CSS import handles injection; flag keeps API stable.
}

function factionColor(map: CampaignMap, ownerId: string | null): string {
  if (!ownerId) return '#5a6a7c';
  return map.factions.find((f) => f.id === ownerId)?.color ?? '#5a6a7c';
}

function usedCapitals(map: CampaignMap): Set<CapitalKey> {
  const set = new Set<CapitalKey>();
  for (const r of map.regions) {
    if (r.settlement.kind === 'capital') set.add(r.settlement.key);
  }
  return set;
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function findRegionAt(map: CampaignMap, p: Point): CampaignRegion | null {
  for (let i = map.regions.length - 1; i >= 0; i--) {
    if (pointInPolygon(p, map.regions[i].ring)) return map.regions[i];
  }
  return null;
}

function findNodeNear(map: CampaignMap, p: Point, r = 14): SeaNode | null {
  let best: SeaNode | null = null;
  let bestD = r;
  for (const n of map.seaNodes) {
    const d = Math.hypot(n.at.x - p.x, n.at.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function findLinkNear(map: CampaignMap, p: Point, r = 8): SeaLink | null {
  let best: SeaLink | null = null;
  let bestD = r;
  const byId = new Map(map.seaNodes.map((n) => [n.id, n]));
  for (const link of map.seaLinks) {
    const a = byId.get(link.a);
    const b = byId.get(link.b);
    if (!a || !b) continue;
    const dx = b.at.x - a.at.x;
    const dy = b.at.y - a.at.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 < 1e-9 ? 0 : ((p.x - a.at.x) * dx + (p.y - a.at.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = a.at.x + t * dx;
    const qy = a.at.y + t * dy;
    const d = Math.hypot(p.x - qx, p.y - qy);
    if (d <= bestD) {
      bestD = d;
      best = link;
    }
  }
  return best;
}

export async function mountCampaignEditor(
  host: HTMLElement,
  opts: { onBack: () => void },
): Promise<CampaignEditorHandle> {
  ensureCss();
  const map = await loadCampaignMap();
  let dirty = false;
  let tool: Tool = 'select';
  let selection: Selection = null;
  let drawPts: Point[] = [];
  let seaDraft: SeaDraft | null = null;
  let splitDraft: SplitDraft | null = null;
  let status = '';
  let view = { ...map.view };
  let spacePan = false;
  let panning = false;
  let panLast: Point | null = null;
  let drag:
    | { kind: 'vertex'; regionId: string; index: number; from: Point }
    | { kind: 'settlement'; regionId: string }
    | { kind: 'node'; id: string }
    | null = null;
  const undoStack: CampaignMap[] = [];
  const MAX_UNDO = 60;
  let dragUndoPushed = false;

  const root = document.createElement('div');
  root.className = 'campaign-root';
  host.replaceChildren(root);

  function cloneMapState(): CampaignMap {
    return JSON.parse(
      JSON.stringify({
        id: map.id,
        name: map.name,
        view: map.view,
        factions: map.factions,
        regions: map.regions,
        seaNodes: map.seaNodes,
        seaLinks: map.seaLinks,
        neighbors: map.neighbors,
      }),
    ) as CampaignMap;
  }

  function pushUndo(): void {
    undoStack.push(cloneMapState());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    paintChrome();
  }

  function undo(): void {
    const prev = undoStack.pop();
    if (!prev) {
      setStatus('Nothing to undo');
      return;
    }
    map.name = prev.name;
    map.view = prev.view;
    map.factions = prev.factions;
    map.regions = prev.regions;
    map.seaNodes = prev.seaNodes;
    map.seaLinks = prev.seaLinks;
    map.neighbors = prev.neighbors;
    selection = null;
    drawPts = [];
    seaDraft = null;
    splitDraft = null;
    drag = null;
    dirty = true;
    paintMap();
    paintInspector();
    paintCapitals();
    paintChrome();
    setStatus('Undone');
  }

  const markDirty = () => {
    dirty = true;
    paintChrome();
  };

  const setStatus = (s: string) => {
    status = s;
    paintChrome();
  };

  function paintChrome(): void {
    const dirtyEl = root.querySelector('.cm-dirty');
    const statusEl = root.querySelector('.cm-status');
    if (dirtyEl) dirtyEl.textContent = dirty ? 'Unsaved' : '';
    if (statusEl) statusEl.textContent = status;
    root.querySelectorAll<HTMLButtonElement>('.campaign-rail .tool').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    const undoBtn = root.querySelector<HTMLButtonElement>('[data-undo]');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    const nameInput = root.querySelector<HTMLInputElement>('.cm-name');
    if (nameInput && nameInput.value !== map.name) nameInput.value = map.name;
  }

  function paintInspector(): void {
    const panel = root.querySelector('.campaign-inspector');
    if (!panel) return;
    panel.innerHTML = renderInspector();
    bindInspector(panel);
  }

  function paintCapitals(): void {
    const box = root.querySelector('.campaign-capitals');
    if (!box) return;
    const used = usedCapitals(map);
    box.innerHTML = `
      <h2>Capitals</h2>
      <ul>
        ${CAPITAL_KEYS.map((k) => {
          const placed = used.has(k);
          return `<li class="${placed ? 'placed' : ''}"><span>${CAPITAL_LABEL[k]}</span><span>${placed ? 'placed' : '—'}</span></li>`;
        }).join('')}
      </ul>`;
  }

  function renderInspector(): string {
    const sel = selection;
    if (!sel) {
      return `
        <h2>Factions</h2>
        ${renderFactions()}
        <p class="empty">Select a region, sea route, or stop.</p>
        <div class="campaign-capitals"></div>`;
    }
    if (sel.kind === 'region') {
      const region = map.regions.find((r) => r.id === sel.id);
      if (!region) return `<p class="empty">Missing region.</p>`;
      const used = usedCapitals(map);
      const capitalOptions = CAPITAL_KEYS.map((k) => {
        const taken =
          used.has(k) &&
          !(region.settlement.kind === 'capital' && region.settlement.key === k);
        const sel =
          region.settlement.kind === 'capital' && region.settlement.key === k
            ? ' selected'
            : '';
        return `<option value="${k}"${sel}${taken ? ' disabled' : ''}>${CAPITAL_LABEL[k]}${taken ? ' (taken)' : ''}</option>`;
      }).join('');
      const unitChecks =
        region.settlement.kind === 'capital'
          ? listCampaignUnitAccess()
              .map((u) => {
                const checked =
                  region.settlement.kind === 'capital' &&
                  region.settlement.units.includes(u.id);
                return `<label><input type="checkbox" data-unit="${u.id}"${checked ? ' checked' : ''}/> ${escapeHtml(u.label)}</label>`;
              })
              .join('')
          : '';
      return `
        <h2>Region</h2>
        <label>Name<input type="text" data-field="name" value="${escapeAttr(region.name)}"/></label>
        <label>Owned by
          <select data-field="owner"${region.settlement.kind === 'none' ? ' disabled' : ''}>
            <option value="">Neutral</option>
            ${map.factions
              .map(
                (f) =>
                  `<option value="${escapeAttr(f.id)}"${region.ownerId === f.id ? ' selected' : ''}>${escapeHtml(f.name)}</option>`,
              )
              .join('')}
          </select>
        </label>
        ${
          region.settlement.kind === 'none'
            ? `<p class="cm-hint">Open ground is always neutral — add a village or capital to assign an owner.</p>`
            : ''
        }
        <h2>Settlement</h2>
        <div class="settlement-picks" role="group" aria-label="Settlement">
          <button type="button" data-settle="capital"${region.settlement.kind === 'capital' ? ' class="active"' : ''}>Capital</button>
          <button type="button" data-settle="village"${region.settlement.kind === 'village' ? ' class="active"' : ''}>Village</button>
          <button type="button" data-settle="none"${region.settlement.kind === 'none' ? ' class="active"' : ''}>None</button>
        </div>
        ${
          region.settlement.kind === 'capital'
            ? `<label>Capital<select data-field="capital-key">${capitalOptions}</select></label>
               <h2>Unit access</h2><div class="unit-list">${unitChecks}</div>`
            : region.settlement.kind === 'village'
              ? `<p class="cm-hint">Village pin — drag on the map.</p>`
              : `<p class="cm-hint">None — open ground. Armies can still move through.</p>`
        }
        <h2>Factions</h2>
        ${renderFactions()}
        <div class="campaign-capitals"></div>`;
    }
    if (sel.kind === 'link') {
      const link = map.seaLinks.find((l) => l.id === sel.id);
      if (!link) return `<p class="empty">Missing link.</p>`;
      return `
        <h2>Sea route</h2>
        <div class="settlement-picks">
          <button type="button" data-link-kind="blue"${link.kind === 'blue' ? ' class="active"' : ''}>Blue</button>
          <button type="button" data-link-kind="red"${link.kind === 'red' ? ' class="active"' : ''}>Red</button>
        </div>
        <p class="cm-hint">Blue = supply + land-like move. Red = one paid crossing unless both shores are yours.</p>
        <h2>Factions</h2>
        ${renderFactions()}
        <div class="campaign-capitals"></div>`;
    }
    const node = map.seaNodes.find((n) => n.id === sel.id);
    if (!node) return `<p class="empty">Missing node.</p>`;
    return `
      <h2>Sea ${node.kind}</h2>
      <p class="cm-hint">${node.kind === 'stop' ? 'Branch point — start another sea route here.' : 'Port on a region shore.'}</p>
      <h2>Factions</h2>
      ${renderFactions()}
      <div class="campaign-capitals"></div>`;
  }

  function renderFactions(): string {
    const rows = map.factions
      .map(
        (f) => `
      <div class="faction-row" data-faction="${escapeAttr(f.id)}">
        <input type="color" data-faction-color value="${escapeAttr(f.color)}"/>
        <input type="text" data-faction-name value="${escapeAttr(f.name)}"/>
        <button type="button" data-faction-del title="Delete">×</button>
      </div>`,
      )
      .join('');
    return `${rows}<button type="button" data-faction-add>Add faction</button>`;
  }

  function bindInspector(panel: Element): void {
    panel.querySelector<HTMLInputElement>('[data-field="name"]')?.addEventListener('change', (e) => {
      const region = selectedRegion();
      if (!region) return;
      pushUndo();
      region.name = (e.target as HTMLInputElement).value.trim() || region.name;
      markDirty();
      paintMap();
    });
    panel.querySelector<HTMLSelectElement>('[data-field="owner"]')?.addEventListener('change', (e) => {
      const region = selectedRegion();
      if (!region || region.settlement.kind === 'none') return;
      pushUndo();
      const v = (e.target as HTMLSelectElement).value;
      region.ownerId = v || null;
      neutralizeOpenGround(map.regions);
      markDirty();
      paintMap();
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-settle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const region = selectedRegion();
        if (!region) return;
        pushUndo();
        const kind = btn.dataset.settle as 'capital' | 'village' | 'none';
        setSettlement(region, kind);
        neutralizeOpenGround(map.regions);
        markDirty();
        paintMap();
        paintInspector();
        paintCapitals();
      });
    });
    panel.querySelector<HTMLSelectElement>('[data-field="capital-key"]')?.addEventListener('change', (e) => {
      const region = selectedRegion();
      if (!region || region.settlement.kind !== 'capital') return;
      const key = (e.target as HTMLSelectElement).value as CapitalKey;
      if (!CAPITAL_KEYS.includes(key)) return;
      const used = usedCapitals(map);
      if (used.has(key) && region.settlement.key !== key) return;
      pushUndo();
      region.settlement.key = key;
      markDirty();
      paintMap();
      paintCapitals();
    });
    panel.querySelectorAll<HTMLInputElement>('[data-unit]').forEach((box) => {
      box.addEventListener('change', () => {
        const region = selectedRegion();
        if (!region || region.settlement.kind !== 'capital') return;
        pushUndo();
        const id = box.dataset.unit!;
        if (box.checked) {
          if (!region.settlement.units.includes(id)) region.settlement.units.push(id);
        } else {
          region.settlement.units = region.settlement.units.filter((u) => u !== id);
        }
        markDirty();
      });
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-link-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cur = selection;
        if (!cur || cur.kind !== 'link') return;
        const link = map.seaLinks.find((l) => l.id === cur.id);
        if (!link) return;
        pushUndo();
        link.kind = btn.dataset.linkKind as 'blue' | 'red';
        markDirty();
        paintMap();
        paintInspector();
      });
    });
    panel.querySelector('[data-faction-add]')?.addEventListener('click', () => {
      pushUndo();
      map.factions.push({
        id: newId('fac'),
        name: `Faction ${map.factions.length + 1}`,
        color: pickFactionColor(map.factions.length),
      });
      markDirty();
      paintInspector();
      paintCapitals();
    });
    panel.querySelectorAll<HTMLElement>('[data-faction]').forEach((row) => {
      const id = row.dataset.faction!;
      row.querySelector<HTMLInputElement>('[data-faction-name]')?.addEventListener('change', (e) => {
        const f = map.factions.find((x) => x.id === id);
        if (!f) return;
        pushUndo();
        f.name = (e.target as HTMLInputElement).value.trim() || f.name;
        markDirty();
        paintInspector();
      });
      row.querySelector<HTMLInputElement>('[data-faction-color]')?.addEventListener('input', (e) => {
        const f = map.factions.find((x) => x.id === id);
        if (!f) return;
        if (!dragUndoPushed) {
          pushUndo();
          dragUndoPushed = true;
        }
        f.color = (e.target as HTMLInputElement).value;
        markDirty();
        paintMap();
      });
      row.querySelector<HTMLInputElement>('[data-faction-color]')?.addEventListener('change', () => {
        dragUndoPushed = false;
      });
      row.querySelector('[data-faction-del]')?.addEventListener('click', () => {
        pushUndo();
        map.factions = map.factions.filter((f) => f.id !== id);
        for (const r of map.regions) {
          if (r.ownerId === id) r.ownerId = null;
        }
        markDirty();
        paintMap();
        paintInspector();
      });
    });
  }

  function selectedRegion(): CampaignRegion | null {
    const sel = selection;
    if (!sel || sel.kind !== 'region') return null;
    return map.regions.find((r) => r.id === sel.id) ?? null;
  }

  function setSettlement(region: CampaignRegion, kind: 'capital' | 'village' | 'none'): void {
    const at =
      region.settlement.kind === 'none'
        ? centroid(region.ring)
        : { ...region.settlement.at };
    if (kind === 'none') {
      region.settlement = { kind: 'none' };
      region.ownerId = null;
      return;
    }
    if (kind === 'village') {
      region.settlement = { kind: 'village', at };
      return;
    }
    const used = usedCapitals(map);
    const keep =
      region.settlement.kind === 'capital' ? region.settlement.key : null;
    const key =
      keep && !used.has(keep)
        ? keep
        : CAPITAL_KEYS.find((k) => !used.has(k) || keep === k);
    if (!key) {
      setStatus('All capitals already placed');
      return;
    }
    const units =
      region.settlement.kind === 'capital' ? [...region.settlement.units] : [];
    region.settlement = { kind: 'capital', key, at, units };
  }

  function paintMap(): void {
    const svg = root.querySelector<SVGSVGElement>('.cm-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.classList.toggle('tool-pan', tool === 'pan' || spacePan);
    svg.classList.toggle('panning', panning);

    const regionsG = svg.querySelector('.cm-regions')!;
    const labelsG = svg.querySelector('.cm-labels')!;
    const vertsG = svg.querySelector('.cm-verts')!;
    const settlementsG = svg.querySelector('.cm-settlements')!;
    const linksG = svg.querySelector('.cm-links')!;
    const nodesG = svg.querySelector('.cm-nodes')!;
    const draftG = svg.querySelector('.cm-draft')!;

    regionsG.innerHTML = map.regions
      .map((r) => {
        const sel = selection?.kind === 'region' && selection.id === r.id ? ' selected' : '';
        const fill = factionColor(map, r.ownerId);
        const neut = r.ownerId ? '' : ' neutral';
        return `<path class="cm-region${sel}${neut}" data-region="${r.id}" d="${ringToPath(r.ring)}" fill="${fill}"/>`;
      })
      .join('');

    labelsG.innerHTML = map.regions
      .map((r) => {
        const c = centroid(r.ring);
        return `<text class="cm-label" x="${c.x}" y="${c.y}">${escapeHtml(r.name)}</text>`;
      })
      .join('');

    const selNow = selection;
    const selRegion =
      selNow?.kind === 'region'
        ? map.regions.find((r) => r.id === selNow.id)
        : null;
    if (tool === 'erase') {
      // Show every region vertex so erase-dot is obvious.
      vertsG.innerHTML = map.regions
        .flatMap((r) =>
          r.ring.map(
            (p, i) =>
              `<circle class="cm-vertex cm-erase-dot" data-region="${r.id}" data-vi="${i}" cx="${p.x}" cy="${p.y}" r="4.5"/>`,
          ),
        )
        .join('');
    } else if (tool === 'draw' || tool === 'split') {
      // Show every existing vertex so new borders can snap/connect easily.
      vertsG.innerHTML = map.regions
        .flatMap((r) =>
          r.ring.map(
            (p, i) =>
              `<circle class="cm-vertex cm-snap-dot" data-region="${r.id}" data-vi="${i}" cx="${p.x}" cy="${p.y}" r="4"/>`,
          ),
        )
        .join('');
    } else if (selRegion) {
      const edgeHandles = selRegion.ring
        .map((p, i) => {
          const q = selRegion.ring[(i + 1) % selRegion.ring.length];
          const mx = (p.x + q.x) / 2;
          const my = (p.y + q.y) / 2;
          return `<circle class="cm-edge-handle" data-region="${selRegion.id}" data-edge="${i}" cx="${mx}" cy="${my}" r="3.5"/>`;
        })
        .join('');
      const verts = selRegion.ring
        .map(
          (p, i) =>
            `<circle class="cm-vertex" data-region="${selRegion.id}" data-vi="${i}" cx="${p.x}" cy="${p.y}" r="4.5"/>`,
        )
        .join('');
      vertsG.innerHTML = edgeHandles + verts;
    } else {
      vertsG.innerHTML = '';
    }

    settlementsG.innerHTML = map.regions
      .map((r) => {
        if (r.settlement.kind === 'none') return '';
        const { at } = r.settlement;
        const attr = `data-settle="${r.id}"`;
        if (r.settlement.kind === 'village') {
          return villageMarkerSvg(at.x, at.y, attr);
        }
        return capitalMarkerSvg(at.x, at.y, CAPITAL_LABEL[r.settlement.key], attr);
      })
      .join('');

    const byId = new Map(map.seaNodes.map((n) => [n.id, n]));
    linksG.innerHTML = map.seaLinks
      .map((l) => {
        const a = byId.get(l.a);
        const b = byId.get(l.b);
        if (!a || !b) return '';
        const sel = selection?.kind === 'link' && selection.id === l.id ? ' selected' : '';
        return `<line class="cm-sea-link ${l.kind}${sel}" data-link="${l.id}" x1="${a.at.x}" y1="${a.at.y}" x2="${b.at.x}" y2="${b.at.y}"/>`;
      })
      .join('');

    nodesG.innerHTML = map.seaNodes
      .map((n) => {
        const sel = selection?.kind === 'node' && selection.id === n.id ? ' selected' : '';
        return `<circle class="cm-sea-node ${n.kind}${sel}" data-node="${n.id}" cx="${n.at.x}" cy="${n.at.y}" r="${n.kind === 'stop' ? 5.5 : 4.5}"/>`;
      })
      .join('');

    let draftHtml = '';
    if (drawPts.length) {
      const d = drawPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      draftHtml += `<path class="cm-draw-line" d="${d}"/>`;
      draftHtml += drawPts
        .map((p) => `<circle class="cm-draw-pts" cx="${p.x}" cy="${p.y}" r="3.5"/>`)
        .join('');
    }
    if (splitDraft && splitDraft.points.length) {
      const d = splitDraft.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
        .join(' ');
      draftHtml += `<path class="cm-draw-line" d="${d}"/>`;
      draftHtml += splitDraft.points
        .map((p) => `<circle class="cm-draw-pts" cx="${p.x}" cy="${p.y}" r="3.5"/>`)
        .join('');
    }
    if (seaDraft && seaDraft.points.length) {
      const d = seaDraft.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      draftHtml += `<path class="cm-sea-draft" d="${d}"/>`;
    }
    draftG.innerHTML = draftHtml;
  }

  function renderShell(): void {
    const base = `${import.meta.env.BASE_URL}campaign/europe.svg`;
    root.innerHTML = `
      <div class="campaign-top">
        <button type="button" data-back>Back</button>
        <h1>Total war editor</h1>
        <input class="cm-name" type="text" value="${escapeAttr(map.name)}" aria-label="Map name"/>
        <span class="cm-dirty"></span>
        <span class="cm-status"></span>
        <button type="button" data-undo title="Undo (Ctrl/⌘Z)" disabled>Undo</button>
        <button type="button" class="primary" data-save>Save</button>
      </div>
      <div class="campaign-body">
        <aside class="campaign-rail">
          <h2>Tools</h2>
          <button type="button" class="tool" data-tool="pan">Pan</button>
          <button type="button" class="tool" data-tool="select">Select</button>
          <button type="button" class="tool" data-tool="draw">Draw region</button>
          <button type="button" class="tool" data-tool="split">Split region</button>
          <button type="button" class="tool sea-blue" data-tool="sea-blue">Sea blue</button>
          <button type="button" class="tool sea-red" data-tool="sea-red">Sea red</button>
          <button type="button" class="tool" data-tool="erase">Erase</button>
          <p class="campaign-hint">Erase clicks a vertex to remove it · click inside a region to delete it (asks first) · Undo in the top bar</p>
        </aside>
        <div class="campaign-stage">
          <svg class="cm-svg" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" xmlns="http://www.w3.org/2000/svg">
            <image href="${base}" x="0" y="0" width="${DEFAULT_VIEW.w}" height="${DEFAULT_VIEW.h}" preserveAspectRatio="none" pointer-events="none"/>
            <g class="cm-regions"></g>
            <g class="cm-links"></g>
            <g class="cm-nodes"></g>
            <g class="cm-settlements"></g>
            <g class="cm-labels"></g>
            <g class="cm-verts"></g>
            <g class="cm-draft"></g>
          </svg>
          <div class="campaign-zoom">
            <button type="button" data-zoom="out">−</button>
            <button type="button" data-zoom="fit">Fit</button>
            <button type="button" data-zoom="in">+</button>
          </div>
        </div>
        <aside class="campaign-inspector"></aside>
      </div>`;
    paintInspector();
    paintCapitals();
    paintMap();
    paintChrome();
    bindShell();
  }

  function bindShell(): void {
    root.querySelector('[data-back]')?.addEventListener('click', () => {
      if (dirty && !confirm('Discard unsaved campaign map changes?')) return;
      opts.onBack();
    });
    root.querySelector('[data-undo]')?.addEventListener('click', () => undo());
    root.querySelector('[data-save]')?.addEventListener('click', async () => {
      map.neighbors = computeNeighbors(map.regions);
      setStatus('Saving…');
      const ok = await pushCampaignMap(map);
      dirty = !ok ? true : false;
      setStatus(ok ? 'Saved' : 'Save failed (kept in local buffer)');
      paintChrome();
    });
    root.querySelector<HTMLInputElement>('.cm-name')?.addEventListener('change', (e) => {
      pushUndo();
      map.name = (e.target as HTMLInputElement).value.trim() || map.name;
      markDirty();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tool = btn.dataset.tool as Tool;
        drawPts = [];
        seaDraft = null;
        splitDraft = null;
        paintChrome();
        paintMap();
        setStatus(toolHint(tool));
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const z = btn.dataset.zoom;
        if (z === 'fit') {
          view = { ...DEFAULT_VIEW };
        } else {
          zoomAt(view.x + view.w / 2, view.y + view.h / 2, z === 'in' ? 0.85 : 1.15);
        }
        paintMap();
      });
    });

    const svg = root.querySelector<SVGSVGElement>('.cm-svg')!;
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('dblclick', (e) => e.preventDefault());
  }

  function toolHint(t: Tool): string {
    switch (t) {
      case 'pan':
        return 'Drag to pan';
      case 'select':
        return 'Click region · drag vertices · click edge / mid-dot to add a vertex';
      case 'draw':
        return 'Existing dots shown — snap to them · click first point to close';
      case 'split':
        return 'Existing dots shown — start/end on a region vertex · optional interior cut points';
      case 'sea-blue':
        return 'Blue route: region → stops → region';
      case 'sea-red':
        return 'Red route: region → stops → region';
      case 'erase':
        return 'Click a vertex to erase it · click region fill to delete region (confirm) · sea nodes/links still delete';
    }
  }

  function zoomAt(sx: number, sy: number, factor: number): void {
    const nw = Math.min(DEFAULT_VIEW.w * 3, Math.max(120, view.w * factor));
    const nh = (nw / view.w) * view.h;
    const rx = (sx - view.x) / view.w;
    const ry = (sy - view.y) / view.h;
    view = {
      x: sx - rx * nw,
      y: sy - ry * nh,
      w: nw,
      h: nh,
    };
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const svg = e.currentTarget as SVGSVGElement;
    const p = clientToSvg(svg, e.clientX, e.clientY);
    zoomAt(p.x, p.y, e.deltaY < 0 ? 0.9 : 1.1);
    paintMap();
  }

  function beginPan(e: PointerEvent, svg: SVGSVGElement): void {
    panning = true;
    panLast = { x: e.clientX, y: e.clientY };
    svg.setPointerCapture(e.pointerId);
    paintMap();
  }

  function onPointerDown(e: PointerEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    const p = clientToSvg(svg, e.clientX, e.clientY);
    if (e.button === 1 || spacePan || tool === 'pan') {
      beginPan(e, svg);
      return;
    }
    if (e.button !== 0) return;

    if (tool === 'draw') {
      handleDrawClick(p);
      return;
    }
    if (tool === 'split') {
      handleSplitClick(p);
      return;
    }
    if (tool === 'sea-blue' || tool === 'sea-red') {
      handleSeaClick(p, tool === 'sea-blue' ? 'blue' : 'red');
      return;
    }
    if (tool === 'erase') {
      handleErase(p);
      return;
    }

    // select
    dragUndoPushed = false;
    const vert = (e.target as Element).closest?.('[data-vi]') as HTMLElement | null;
    if (vert?.dataset.region && vert.dataset.vi != null) {
      const region = map.regions.find((r) => r.id === vert.dataset.region);
      const index = Number(vert.dataset.vi);
      if (region && region.ring[index]) {
        selection = { kind: 'region', id: region.id };
        pushUndo();
        dragUndoPushed = true;
        drag = {
          kind: 'vertex',
          regionId: region.id,
          index,
          from: { ...region.ring[index] },
        };
        svg.setPointerCapture(e.pointerId);
        paintMap();
        paintInspector();
        paintCapitals();
        return;
      }
    }
    const edgeHandle = (e.target as Element).closest?.('[data-edge]') as HTMLElement | null;
    if (edgeHandle?.dataset.region && edgeHandle.dataset.edge != null) {
      if (tryInsertVertexOnEdge(p, edgeHandle.dataset.region, svg, e.pointerId)) return;
    }
    // Click near an edge of the already-selected region → insert a vertex.
    if (selection?.kind === 'region') {
      const edge = findEdgeNear(map.regions, p, SNAP_PX * 1.4, selection.id);
      if (
        edge &&
        edge.regionId === selection.id &&
        tryInsertVertexOnEdge(p, selection.id, svg, e.pointerId, edge)
      ) {
        return;
      }
    }
    const settleEl = (e.target as Element).closest?.('[data-settle]') as HTMLElement | null;
    if (settleEl?.dataset.settle) {
      selection = { kind: 'region', id: settleEl.dataset.settle };
      pushUndo();
      dragUndoPushed = true;
      drag = { kind: 'settlement', regionId: settleEl.dataset.settle };
      svg.setPointerCapture(e.pointerId);
      paintMap();
      paintInspector();
      paintCapitals();
      return;
    }
    const nodeEl = (e.target as Element).closest?.('[data-node]') as HTMLElement | null;
    if (nodeEl?.dataset.node) {
      selection = { kind: 'node', id: nodeEl.dataset.node };
      pushUndo();
      dragUndoPushed = true;
      drag = { kind: 'node', id: nodeEl.dataset.node };
      svg.setPointerCapture(e.pointerId);
      paintMap();
      paintInspector();
      paintCapitals();
      return;
    }
    const linkEl = (e.target as Element).closest?.('[data-link]') as HTMLElement | null;
    if (linkEl?.dataset.link) {
      selection = { kind: 'link', id: linkEl.dataset.link };
      paintMap();
      paintInspector();
      paintCapitals();
      return;
    }
    const region = findRegionAt(map, p);
    if (region) {
      selection = { kind: 'region', id: region.id };
    } else {
      const link = findLinkNear(map, p);
      if (link) selection = { kind: 'link', id: link.id };
      else {
        const node = findNodeNear(map, p);
        selection = node ? { kind: 'node', id: node.id } : null;
      }
    }
    paintMap();
    paintInspector();
    paintCapitals();
  }

  function onPointerMove(e: PointerEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    if (panning && panLast) {
      const dx = e.clientX - panLast.x;
      const dy = e.clientY - panLast.y;
      panLast = { x: e.clientX, y: e.clientY };
      const rect = svg.getBoundingClientRect();
      const sx = view.w / rect.width;
      const sy = view.h / rect.height;
      view.x -= dx * sx;
      view.y -= dy * sy;
      paintMap();
      return;
    }
    const d = drag;
    if (!d) return;
    const p = clientToSvg(svg, e.clientX, e.clientY);
    if (d.kind === 'vertex') {
      const region = map.regions.find((r) => r.id === d.regionId);
      if (!region) return;
      const snap = snapToRegions(
        p,
        map.regions.filter((r) => r.id !== region.id),
      );
      const to = snap?.point ?? p;
      moveSharedVertex(map.regions, d.from, to);
      d.from = { ...to };
      markDirty();
      paintMap();
      return;
    }
    if (d.kind === 'settlement') {
      const region = map.regions.find((r) => r.id === d.regionId);
      if (!region || region.settlement.kind === 'none') return;
      region.settlement.at = p;
      markDirty();
      paintMap();
      return;
    }
    const node = map.seaNodes.find((n) => n.id === d.id);
    if (!node) return;
    node.at = p;
    markDirty();
    paintMap();
  }

  function onPointerUp(e: PointerEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    if (panning) {
      panning = false;
      panLast = null;
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      paintMap();
      return;
    }
    if (drag) {
      drag = null;
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  function tryInsertVertexOnEdge(
    p: Point,
    regionId: string,
    svg: SVGSVGElement,
    pointerId: number,
    edgeHit?: ReturnType<typeof findEdgeNear>,
  ): boolean {
    const prefer = regionId;
    const edge =
      edgeHit ??
      findEdgeNear(map.regions, p, SNAP_PX * 1.6, prefer);
    if (!edge) return false;
    const point = edge.point;
    pushUndo();
    const idx = insertVertexOnSharedEdge(
      map.regions,
      edge.a,
      edge.b,
      point,
      edge.regionId,
    );
    if (idx == null) {
      undoStack.pop();
      paintChrome();
      return false;
    }
    selection = { kind: 'region', id: edge.regionId };
    dragUndoPushed = true;
    drag = {
      kind: 'vertex',
      regionId: edge.regionId,
      index: idx,
      from: { ...point },
    };
    markDirty();
    svg.setPointerCapture(pointerId);
    paintMap();
    paintInspector();
    paintCapitals();
    setStatus('Vertex added — drag to shape the border');
    return true;
  }

  function handleDrawClick(p: Point): void {
    const snap = snapToRegions(p, map.regions);
    const pt = snap?.point ?? p;

    // Free points must not land in another region's interior (border snap is OK).
    if (!snap) {
      for (const r of map.regions) {
        if (pointStrictlyInside(pt, r.ring)) {
          setStatus('Cannot draw inside another region — snap to its border instead');
          return;
        }
      }
    }

    if (drawPts.length >= 3 && samePoint(pt, drawPts[0], 10)) {
      const ring = drawPts.map((q) => ({ ...q }));
      if (ringOverlapsAny(ring, map.regions)) {
        setStatus('Region overlaps another — adjust the outline');
        return;
      }
      pushUndo();
      const id = newId('reg');
      map.regions.push({
        id,
        name: `Region ${map.regions.length + 1}`,
        ring,
        ownerId: null,
        settlement: { kind: 'none' },
      });
      drawPts = [];
      selection = { kind: 'region', id };
      markDirty();
      paintMap();
      paintInspector();
      paintCapitals();
      setStatus('Region closed');
      return;
    }
    drawPts.push(pt);
    paintMap();
  }

  function handleSplitClick(p: Point): void {
    if (!splitDraft) {
      // Must start on an existing vertex (prefer the selected region on shared corners).
      let hitRegion: CampaignRegion | null = null;
      let hitIndex = -1;
      const sel = selection;
      const preferred =
        sel?.kind === 'region'
          ? map.regions.find((r) => r.id === sel.id)
          : null;
      const order = preferred
        ? [preferred, ...map.regions.filter((r) => r.id !== preferred.id)]
        : map.regions;
      for (const r of order) {
        const vi = findVertexIndex(r.ring, p);
        if (vi >= 0) {
          hitRegion = r;
          hitIndex = vi;
          break;
        }
      }
      if (!hitRegion || hitIndex < 0) {
        setStatus('Split: click a region vertex to start the cut');
        return;
      }
      splitDraft = {
        regionId: hitRegion.id,
        startIndex: hitIndex,
        points: [{ ...hitRegion.ring[hitIndex] }],
      };
      selection = { kind: 'region', id: hitRegion.id };
      paintMap();
      paintInspector();
      setStatus('Split: add interior points, then click another vertex of this region');
      return;
    }

    const region = map.regions.find((r) => r.id === splitDraft!.regionId);
    if (!region) {
      splitDraft = null;
      setStatus('Region gone — split cancelled');
      paintMap();
      return;
    }

    const endIndex = findVertexIndex(region.ring, p);
    if (endIndex >= 0 && endIndex !== splitDraft.startIndex) {
      const mids = splitDraft.points.slice(1);
      if (!cutStaysInside(region.ring, region.ring[splitDraft.startIndex], region.ring[endIndex], mids)) {
        setStatus('Cut must stay inside the region');
        return;
      }
      const split = splitRingByCut(region.ring, splitDraft.startIndex, endIndex, mids);
      if (!split) {
        setStatus('Cut too short — need room for two regions (add a mid point if verts are adjacent)');
        return;
      }
      // New halves must not overlap other regions (shared cut edge with each other is fine).
      const others = map.regions.filter((r) => r.id !== region.id);
      if (ringOverlapsAny(split.ringA, others) || ringOverlapsAny(split.ringB, others)) {
        setStatus('Split would overlap a neighbor');
        return;
      }

      pushUndo();
      const idA = newId('reg');
      const idB = newId('reg');
      const baseName = region.name;
      const settlementA = placeSettlementOnRing(region, split.ringA);
      const settlementB =
        settlementA.kind === 'none'
          ? placeSettlementOnRing(region, split.ringB)
          : { kind: 'none' as const };

      const regionA: CampaignRegion = {
        id: idA,
        name: `${baseName} A`,
        ring: split.ringA,
        ownerId: region.ownerId,
        settlement: settlementA,
      };
      const regionB: CampaignRegion = {
        id: idB,
        name: `${baseName} B`,
        ring: split.ringB,
        ownerId: region.ownerId,
        settlement: settlementB,
      };

      // Rebind ports that belonged to the old region.
      for (const node of map.seaNodes) {
        if (node.kind !== 'port' || node.regionId !== region.id) continue;
        if (pointInPolygon(node.at, split.ringA) || pointOnRingBoundary(node.at, split.ringA)) {
          node.regionId = idA;
        } else {
          node.regionId = idB;
        }
      }

      map.regions = map.regions.filter((r) => r.id !== region.id);
      map.regions.push(regionA, regionB);
      splitDraft = null;
      selection = { kind: 'region', id: idA };
      markDirty();
      paintMap();
      paintInspector();
      paintCapitals();
      setStatus('Region split into two');
      return;
    }

    // Interior / free mid point on the cut.
    if (!pointInPolygon(p, region.ring) && !pointOnRingBoundary(p, region.ring)) {
      setStatus('Cut points must stay inside the region');
      return;
    }
    // Don't stack on the start vertex.
    if (samePoint(p, splitDraft.points[0], 8)) return;
    splitDraft.points.push({ ...p });
    paintMap();
    setStatus('Split: continue cut, then click another vertex');
  }

  function placeSettlementOnRing(
    source: CampaignRegion,
    ring: Point[],
  ): CampaignRegion['settlement'] {
    if (source.settlement.kind === 'none') return { kind: 'none' };
    const at = source.settlement.at;
    if (pointInPolygon(at, ring) || pointOnRingBoundary(at, ring)) {
      if (source.settlement.kind === 'village') {
        return { kind: 'village', at: { ...at } };
      }
      return {
        kind: 'capital',
        key: source.settlement.key,
        at: { ...at },
        units: [...source.settlement.units],
      };
    }
    return { kind: 'none' };
  }

  function ensurePort(region: CampaignRegion, at: Point): SeaNode {
    const existing = map.seaNodes.find(
      (n) => n.kind === 'port' && n.regionId === region.id,
    );
    if (existing) return existing;
    const node: SeaNode = {
      id: newId('port'),
      kind: 'port',
      at: { ...at },
      regionId: region.id,
    };
    map.seaNodes.push(node);
    return node;
  }

  function handleSeaClick(p: Point, kind: 'blue' | 'red'): void {
    const existingNode = findNodeNear(map, p, 12);
    const region = findRegionAt(map, p);

    if (!seaDraft) {
      if (existingNode) {
        seaDraft = {
          kind,
          nodeIds: [existingNode.id],
          points: [{ ...existingNode.at }],
        };
        setStatus(`Sea ${kind}: continue to stop or region`);
        paintMap();
        return;
      }
      if (!region) {
        setStatus('Start on a region or existing stop');
        return;
      }
      pushUndo();
      const port = ensurePort(region, p);
      seaDraft = { kind, nodeIds: [port.id], points: [{ ...port.at }] };
      markDirty();
      setStatus(`Sea ${kind}: add stops or finish on a region`);
      paintMap();
      return;
    }

    // continuing draft
    if (existingNode && !seaDraft.nodeIds.includes(existingNode.id)) {
      addSeaLink(seaDraft.nodeIds[seaDraft.nodeIds.length - 1], existingNode.id, kind);
      seaDraft.nodeIds.push(existingNode.id);
      seaDraft.points.push({ ...existingNode.at });
      // finish if landing on a port of another region, or keep going from stop
      if (existingNode.kind === 'port') {
        seaDraft = null;
        setStatus(`Sea ${kind} route finished`);
      } else {
        setStatus(`Sea ${kind}: branch/continue from stop`);
      }
      markDirty();
      paintMap();
      return;
    }

    if (region) {
      const lastId = seaDraft.nodeIds[seaDraft.nodeIds.length - 1];
      const last = map.seaNodes.find((n) => n.id === lastId);
      if (last?.kind === 'port' && last.regionId === region.id) {
        setStatus('Pick a different region to finish');
        return;
      }
      const port = ensurePort(region, p);
      if (port.id !== lastId) {
        addSeaLink(lastId, port.id, kind);
      }
      seaDraft = null;
      markDirty();
      setStatus(`Sea ${kind} route finished`);
      paintMap();
      return;
    }

    // new stop in the sea
    const stop: SeaNode = {
      id: newId('stop'),
      kind: 'stop',
      at: { ...p },
    };
    map.seaNodes.push(stop);
    addSeaLink(seaDraft.nodeIds[seaDraft.nodeIds.length - 1], stop.id, kind);
    seaDraft.nodeIds.push(stop.id);
    seaDraft.points.push({ ...stop.at });
    markDirty();
    setStatus(`Sea ${kind}: stop placed — continue or finish on a region`);
    paintMap();
  }

  function addSeaLink(a: string, b: string, kind: 'blue' | 'red'): void {
    if (a === b) return;
    const dup = map.seaLinks.some(
      (l) => (l.a === a && l.b === b) || (l.a === b && l.b === a),
    );
    if (dup) return;
    map.seaLinks.push({ id: newId('link'), kind, a, b });
  }

  function findNearestVertex(
    p: Point,
    radius = SNAP_PX * 1.5,
  ): { regionId: string; index: number; point: Point } | null {
    let best: { regionId: string; index: number; point: Point } | null = null;
    let bestD = radius;
    for (const region of map.regions) {
      for (let i = 0; i < region.ring.length; i++) {
        const d = dist(p, region.ring[i]);
        if (d <= bestD) {
          bestD = d;
          best = {
            regionId: region.id,
            index: i,
            point: { ...region.ring[i] },
          };
        }
      }
    }
    return best;
  }

  function deleteRegion(region: CampaignRegion): void {
    pushUndo();
    const ports = map.seaNodes.filter(
      (n) => n.kind === 'port' && n.regionId === region.id,
    );
    const portIds = new Set(ports.map((n) => n.id));
    map.seaNodes = map.seaNodes.filter((n) => !portIds.has(n.id));
    map.seaLinks = map.seaLinks.filter(
      (l) => !portIds.has(l.a) && !portIds.has(l.b),
    );
    map.regions = map.regions.filter((r) => r.id !== region.id);
    if (selection?.kind === 'region' && selection.id === region.id) selection = null;
    markDirty();
    paintMap();
    paintInspector();
    paintCapitals();
    setStatus(`Deleted region “${region.name}”`);
  }

  function handleErase(p: Point): void {
    // 1) Erase a vertex (dot) — including shared-border points.
    const vert = findNearestVertex(p);
    if (vert) {
      const region = map.regions.find((r) => r.id === vert.regionId);
      if (region && region.ring.length <= 3) {
        if (
          !confirm(
            `“${region.name}” only has 3 vertices. Delete the whole region instead?`,
          )
        ) {
          setStatus('Need at least 3 vertices — cancelled');
          return;
        }
        deleteRegion(region);
        return;
      }
      pushUndo();
      const { removed, blocked } = removeVertexAtPoint(map.regions, vert.point);
      if (!removed) {
        undoStack.pop();
        paintChrome();
        if (blocked.length) {
          setStatus('That vertex can’t be removed (region would go under 3 dots)');
        }
        return;
      }
      markDirty();
      paintMap();
      paintInspector();
      paintCapitals();
      setStatus(
        blocked.length
          ? `Vertex erased (skipped ${blocked.length} region(s) that need 3+ dots)`
          : 'Vertex erased',
      );
      return;
    }

    const node = findNodeNear(map, p, 12);
    if (node) {
      pushUndo();
      map.seaNodes = map.seaNodes.filter((n) => n.id !== node.id);
      map.seaLinks = map.seaLinks.filter((l) => l.a !== node.id && l.b !== node.id);
      if (selection?.kind === 'node' && selection.id === node.id) selection = null;
      markDirty();
      paintMap();
      paintInspector();
      setStatus('Deleted sea node');
      return;
    }
    const link = findLinkNear(map, p, 10);
    if (link) {
      pushUndo();
      map.seaLinks = map.seaLinks.filter((l) => l.id !== link.id);
      if (selection?.kind === 'link' && selection.id === link.id) selection = null;
      markDirty();
      paintMap();
      paintInspector();
      setStatus('Deleted sea link');
      return;
    }

    // 2) Click region fill → confirm, then delete whole region.
    const region = findRegionAt(map, p);
    if (region) {
      if (
        !confirm(
          `Delete region “${region.name}”?\n\nThis removes the whole region. Click a vertex instead to erase only a dot.`,
        )
      ) {
        setStatus('Region delete cancelled');
        return;
      }
      deleteRegion(region);
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
      if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) {
        undo();
        e.preventDefault();
        return;
      }
    }
    if (e.key === ' ' && !e.repeat) {
      spacePan = true;
      paintMap();
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      drawPts = [];
      seaDraft = null;
      splitDraft = null;
      paintMap();
      setStatus('Cancelled');
    }
    if (e.key === 'Backspace' && tool === 'draw' && drawPts.length) {
      drawPts.pop();
      paintMap();
      e.preventDefault();
    }
    if (e.key === 'Backspace' && tool === 'split' && splitDraft) {
      if (splitDraft.points.length <= 1) {
        splitDraft = null;
      } else {
        splitDraft.points.pop();
      }
      paintMap();
      e.preventDefault();
    }
    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      (tool === 'select' || tool === 'erase') &&
      selection &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLSelectElement)
    ) {
      if (selection.kind === 'region') {
        const region = map.regions.find((r) => r.id === selection!.id);
        if (region) {
          if (
            !confirm(
              `Delete region “${region.name}”?\n\nThis removes the whole region.`,
            )
          ) {
            setStatus('Region delete cancelled');
            e.preventDefault();
            return;
          }
          deleteRegion(region);
        }
      } else if (selection.kind === 'link') {
        const link = map.seaLinks.find((l) => l.id === selection!.id);
        if (link) {
          pushUndo();
          map.seaLinks = map.seaLinks.filter((l) => l.id !== link.id);
          selection = null;
          markDirty();
          paintMap();
          paintInspector();
          setStatus('Deleted sea link');
        }
      } else if (selection.kind === 'node') {
        const node = map.seaNodes.find((n) => n.id === selection!.id);
        if (node) {
          pushUndo();
          map.seaNodes = map.seaNodes.filter((n) => n.id !== node.id);
          map.seaLinks = map.seaLinks.filter(
            (l) => l.a !== node.id && l.b !== node.id,
          );
          selection = null;
          markDirty();
          paintMap();
          paintInspector();
          setStatus('Deleted sea node');
        }
      }
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') {
      spacePan = false;
      paintMap();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  renderShell();
  setStatus(toolHint(tool));

  return {
    isDirty: () => dirty,
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      root.remove();
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function pickFactionColor(i: number): string {
  const palette = [
    '#c0392b',
    '#2980b9',
    '#27ae60',
    '#8e44ad',
    '#d35400',
    '#16a085',
    '#f1c40f',
    '#7f8c8d',
  ];
  return palette[i % palette.length];
}
