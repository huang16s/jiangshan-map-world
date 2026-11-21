import {createAtlasData, json, mapContext} from './atlas-data.js';
import {corridors, journeys, people} from './lore.js';

const Controller = window.HistoricalAtlasController;
const MAP_WIDTH = 1000;
const MAP_CENTER = [500, 350];
const DEG = Math.PI / 180;
const MAP_NOTE = '历史疆域来自 Cliopatria，海岸线、水系与现代参照来自 Natural Earth。历史边界为示意，数据覆盖因时期而异。';

class WorldProjector extends window.MercatorProjector {
  constructor() {
    super(1000, 700, {west: -180, east: 180, south: -80, north: 80});
    this.scale = MAP_WIDTH / 360;
  }

  toScreen(lon, lat) {
    const miller = Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * DEG)) / (0.8 * DEG);
    return [MAP_CENTER[0] + lon * this.scale, MAP_CENTER[1] - miller * this.scale];
  }

  toGeo(x, y) {
    const miller = (MAP_CENTER[1] - y) * 0.8 * DEG / this.scale;
    const lat = (Math.atan(Math.exp(miller)) - Math.PI / 4) / (0.4 * DEG);
    return [(x - MAP_CENTER[0]) / this.scale, lat];
  }

  ringToSvgPath(ring) {
    return ring.map(([lon, lat], i) => {
      const [x, y] = this.toScreen(lon, lat);
      return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join('') + 'Z';
  }

  shapeToSvgPath(shape) {
    // Draw the finer source vertices instead of rounding and curving them
    // independently on opposite sides of a shared border.
    return super.shapeToSvgPath(shape, false);
  }
}

const LABELS = {
  brand_sub: ['世界历史地图', 'World History Atlas'],
  toggle_modern: ['现代参考界线', 'Modern reference borders'],
  toggle_modern_labels: ['现代地区名称', 'Modern place names'],
  toggle_prefectures: ['历史政区', 'Historical subdivisions'],
  capital_k: ['资料', 'Data'],
  tick_now: ['2024', '2024'],
  disclaimer: [MAP_NOTE, 'Cliopatria historical borders are approximate. Land, waterways and modern reference layers are from Natural Earth.'],
};

function citation(source, text) {
  const link = document.createElement('a');
  link.href = source[1];
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text || source[0];
  return link;
}

function showStatus(message) {
  const status = document.getElementById('world-load-status');
  status.textContent = message;
  status.hidden = !message;
}

function configureShell() {
  document.querySelector('#lbl-prefectures').textContent = '历史政区';
  document.querySelector('#chk-prefectures').disabled = true;
  document.querySelector('#chk-prefectures').title = '当前世界疆域资料以政权为单位';
  document.querySelector('#chk-prefectures').checked = false;
  document.querySelector('#chk-provinces').checked = false;
  document.querySelector('#grp-provinces').classList.add('is-hidden');
  document.querySelector('#grp-prefectures').classList.add('is-hidden');
  const input = document.getElementById('inp-year');
  input.min = -3400;
  input.max = 2024;
  input.value = 1500;

  const share = document.createElement('button');
  share.id = 'world-share';
  share.type = 'button';
  share.className = 'more-pop-link';
  share.setAttribute('role', 'menuitem');
  share.textContent = '复制当前视图链接';
  share.addEventListener('click', async event => {
    event.stopPropagation();
    const app = window.atlasApp;
    try {
      await navigator.clipboard.writeText(location.href);
      share.textContent = app.locale === 'en' ? 'Link copied' : app._zh('链接已复制');
    } catch {
      window.prompt(app.locale === 'en' ? 'Copy this link' : app._zh('复制当前视图链接'), location.href);
    }
  });
  document.getElementById('more-popover').prepend(share);
}

function layoutPolityNames(controller) {
  const labels = controller.grpPolityLabels;
  if (!labels || !controller.lastRenderedSnap) return;
  const {x, y, w, h} = controller.camera;
  const view = controller.svg.getBoundingClientRect();
  const scale = Math.min(view.width / w, view.height / h);
  if (!scale) return;
  const nodes = new Map([...labels.querySelectorAll('.polity-caption')].map(node => [node.dataset.polityTitle, node]));
  const occupied = [];
  const zoom = MAP_WIDTH / w;
  const fontSize = view.width < 600 ? 11 : 13;
  const polities = controller.lastRenderedSnap.polities;
  const areaLimit = Math.min(310000 / zoom ** 2, (polities[0]?.area || 0) / 4);
  for (const polity of polities) {
    const node = nodes.get(polity.title);
    if (!node) continue;
    const [cx, cy] = controller.projector.toScreen(...polity.anchor);
    const halfWidth = (controller._estimateLocalTextWidth(node.textContent, fontSize, .3) / 2 + 4) / scale;
    const halfHeight = (fontSize / 2 + 4) / scale;
    const box = {left: cx - halfWidth, right: cx + halfWidth, top: cy - halfHeight, bottom: cy + halfHeight};
    const inside = box.right > x && box.left < x + w && box.bottom > y && box.top < y + h;
    const collides = occupied.some(other => box.right > other.left && box.left < other.right && box.bottom > other.top && box.top < other.bottom);
    const visible = inside && polity.area >= areaLimit && !polity.name.startsWith('(') && !collides;
    node.classList.toggle('world-label-hidden', !visible);
    if (!visible) continue;
    node.classList.remove('is-crowded-hidden');
    node.setAttribute('transform', `translate(${cx} ${cy}) scale(${1 / scale})`);
    node.dataset.x = cx;
    node.dataset.y = cy;
    occupied.push(box);
  }
}

function adaptAtlas(data, context) {
  const prototype = Controller.prototype;
  const shared = {
    applyLocale: prototype.applyLocale, uiStr: prototype.uiStr, trTerm: prototype.trTerm,
    linkedBootYear: prototype._linkedBootYear, openMilestone: prototype.openMilestoneBalloon,
    openGenealogy: prototype.openGenealogyAt, restoreFromQuery: prototype._restoreFromQuery,
    chronicle: prototype._renderChroniclePane, clearPreviewGhost: prototype._clearPreviewGhost,
    rescaleTypography: prototype._rescaleSvgTypography,
    searchIndex: prototype._ensureSearchIndex,
    syncAutoMilestone: prototype._syncAutoMilestoneBalloon,
  };
  const englishNames = new Map([...data.catalog.values()].map(({title, name}) => [title, name]));
  for (const item of context.provinces) englishNames.set(item.title, item.english);
  const profileByKey = new Map();

  const profiles = [...data.catalog.values()].map(({name, title, dates}) => {
    const from = Math.min(...dates.map(([start]) => start));
    const to = Math.max(...dates.map(([, end]) => end));
    const key = name.toLowerCase();
    const profile = {key, zh: title, en: name, titles: [title], aliases: [name], from, to, dates,
      seatZh: 'Cliopatria', seatEn: 'Cliopatria',
      summaryZh: '地图上的范围来自 Cliopatria 的历史疆域重建。具体位置和年代可能存在不同研究解释。',
      summaryEn: 'Territory is drawn from Cliopatria’s historical reconstruction. Coverage and boundaries are approximate.',
    };
    profileByKey.set(key, profile);
    return profile;
  });

  window.DYNASTY_DATA = data.eras;
  window.ATLAS_SNAPSHOTS = data.snapshots;
  window.ATLAS_FULL_SNAPSHOTS_LOADED = true;
  window.PROVINCE_OUTLINES = context.provinces;
  window.HYDRO_DATA = context.hydro;
  window.CORRIDOR_DATA = corridors;
  window.ATLAS_LORE_DETAIL_LOADED = true;
  const tracks = window.ATLAS_LORE_DATA.GUQIN_TRACKS;
  window.ATLAS_LORE_DATA = {
    CHINESE_ERA_SPANS: [], POLITY_PROFILES: profiles, GUQIN_TRACKS: tracks,
    PERSON_PROFILES: people, HISTORICAL_JOURNEYS: journeys,
  };
  window.ATLAS_EVENT_PINYIN = {};

  let genealogySample;
  let english;
  const enrichedSearchIndexes = new WeakSet();
  Controller._extendPrototype({
    _getDefaultCamera() {
      if (!(this.projector instanceof WorldProjector)) this.projector = new WorldProjector();
      const aspect = this._getViewportAspect();
      const w = Math.max(1030, 690 / aspect);
      const h = w * aspect;
      return {x: 500 - w / 2, y: 350 - h / 2, w, h, zoom: 1000 / w};
    },

    _resolveSnapKey(era, year) {
      const start = era.starts[era.starts.findLastIndex(value => value <= year)] ?? era.fromYear;
      return `y${start}`;
    },

    _fetchSnapshot(key) {
      return data.loadSnapshot(key);
    },

    _withSnapshot(key, callback) {
      if (data.snapshots[key]) {
        callback(data.snapshots[key]);
        return;
      }
      this._fetchSnapshot(key).then(snapshot => {
        if (this.activeSnapKey === key) showStatus('');
        callback(snapshot);
      }).catch(error => {
        if (this.activeSnapKey === key) showStatus('这个年份的疆域加载失败，可切换年份重试。');
        console.error(error);
      });
    },

    _ensureFullSnapshots() {
      return Promise.resolve(data.snapshots);
    },

    _updateTerrainTiles() {},
    _syncDocumentSeoMeta() {},
    _syncSeoDirectoryLocale() {},
    _maybeShowStartGuide() {},
    _registerWebMcpTools() {},
    _resolveEraSpan() { return null; },

    _linkedBootYear() {
      return shared.linkedBootYear.call(this) ?? 1500;
    },

    _ensureEnglishLocale() {
      if (!english) english = this._loadScriptOnce(this._lazyAssetUrl('js/i18n_dict.js', 'vI18n')).then(() => {
        const locale = {...window.EN_LOCALE, dynasties: data.eraNames, milestones: {}};
        this._setEnglishLocale(locale);
        this.searchIndex = null;
        return locale;
      });
      return english;
    },

    uiStr(key, fallback) {
      const label = LABELS[key];
      return label ? this.locale === 'en' ? label[1] : this._zh(label[0]) : shared.uiStr.call(this, key, fallback);
    },

    trTerm(text) {
      const name = this.locale === 'en' && englishNames.get(text);
      return name || shared.trTerm.call(this, text);
    },

    applyLocale(options) {
      shared.applyLocale.call(this, options);
      const suffix = this.locale === 'en' ? '?lang=en' : this.locale === 'zh-tw' ? '?lang=zh-tw' : '';
      this._id('act-home').href = `world/${suffix}`;
      const target = this._id('switch-china');
      target.href = `./${suffix}`;
      target.textContent = this.locale === 'en' ? 'China History' : this._zh('中国历史');
      this._id('lbl-prefectures').textContent = this.locale === 'en' ? 'Historical subdivisions' : this._zh('历史政区');
      const search = this._id('inp-map-search');
      search.placeholder = this.locale === 'en' ? 'Search places, polities or events' : this._zh('搜地点 / 政权 / 大事');
      this._id('txt-disclaimer').textContent = this.uiStr('disclaimer', MAP_NOTE);
      this._id('world-share').textContent = this.locale === 'en' ? 'Copy map link' : this._zh('复制当前视图链接');
    },

    formatEraLabel(year, era) {
      return this.dynastyName(era || this.dynasties[this._findDynastyIndex(year)]);
    },

    _ensureSearchIndex() {
      const index = shared.searchIndex.call(this);
      if (enrichedSearchIndexes.has(index)) return index;
      for (const entry of index) {
        const event = entry.milestone;
        if (event?.region) entry.keywords += ` ${event.region} ${event.category} ${event.summary}`;
      }
      enrichedSearchIndexes.add(index);
      return index;
    },

    _eventEraLabel(era, event) {
      return [event.approximate ? (this.locale === 'en' ? 'Approx.' : '约年') : '', this._zh(event.region || ''), this._zh(event.category || '')].filter(Boolean).join(' · ');
    },

    _buildNeighborCountries() {
      const path = context.land.map(land => this.projector.shapeToSvgPath(land)).join('');
      this._svgNode('path', {d: path, class: 'world-land', 'fill-rule': 'nonzero'}, this.grpNeighbors);
    },

    _rescaleSvgTypography(...args) {
      shared.rescaleTypography.apply(this, args);
      this.svg.classList.toggle('world-overview', this.camera.w >= 700);
      layoutPolityNames(this);
    },

    _buildModernProvinces() {
      for (const country of this.provinces) {
        const d = this.projector.multiRingsToSvgPath(country.rings);
        const path = this._svgNode('path', {d, class: 'province-shape world-modern-outline'}, this.grpProvinces);
        path.dataset.provTitle = country.title;
        if (!country.hub.every(Number.isFinite)) continue;
        const [x, y] = this.projector.toScreen(...country.hub);
        const label = this._svgNode('text', {x, y, class: 'province-caption'}, this.grpProvNames);
        label.dataset.rawName = country.title;
        label.textContent = country.title;
      }
    },

    _renderChroniclePane(era) {
      shared.chronicle.call(this, era);
      const guide = this._id('lnk-dynasty-topic');
      if (guide) {
        guide.href = 'world/README.md';
        guide.textContent = this.locale === 'en' ? 'Sources' : this._zh('出处');
        guide.title = this.locale === 'en' ? 'World atlas data and sources' : this._zh('世界地图数据与来源');
      }
      if (!this.activePolity) this._id('dynasty-seat').textContent = this._zh(MAP_NOTE);
    },

    _syncMilestoneSource(era) {
      const list = this._id('milestone-list');
      list.querySelectorAll('.ev-src').forEach(node => node.remove());
      if (this.activePolity || !era) return;
      const index = this._activeMilestoneIndex(era);
      const event = era.milestones[index];
      if (!list.children[index] || !event?.source) return;
      const line = document.createElement('div');
      line.className = 'ev-src';
      line.append(citation(event.source));
      line.addEventListener('click', e => e.stopPropagation());
      list.children[index].append(line);
    },

    _syncAutoMilestoneBalloon(era) {
      // On the opening world view, an adjacent-date callout can cover almost
      // the whole map on a phone. Exact-date links and playback still show it.
      if (!this._bootDone && !era.milestones.some(event => event.year === this.year)) return;
      return shared.syncAutoMilestone.call(this, era);
    },

    openMilestoneBalloon(era, event, options) {
      shared.openMilestone.call(this, era, event, options);
      if (this.milestoneBalloon.classList.contains('is-hidden')) return;
      const text = this.milestoneBalloon.querySelector('.ep-text');
      if (!text || !event.source) return;
      const body = document.createElement('div');
      body.className = 'world-event-detail';
      body.textContent = this._zh(event.summary);
      body.append(citation(event.source));
      text.after(body);
      this._milestoneBalloonSize.h = this.milestoneBalloon.offsetHeight || this._milestoneBalloonSize.h;
      this._positionMilestoneBalloon();
    },

    openGenealogyAt(lon, lat, label, options) {
      const key = this._resolveSnapKey(this.dynasties[this.dynastyIdx], this.year);
      const needsRefresh = !this._worldGenealogyReady || !data.snapshots[key];
      const result = shared.openGenealogy.call(this, lon, lat, label, options);
      if (!needsRefresh) return result;
      if (!genealogySample) genealogySample = data.loadGenealogySample(this).catch(error => {
        genealogySample = null;
        throw error;
      });
      Promise.all([genealogySample, data.loadSnapshot(key)]).then(() => {
        this._worldGenealogyReady = true;
        if (this.activeTrace?.[0] === lon && this.activeTrace?.[1] === lat && this.activeSnapKey === key) {
          shared.openGenealogy.call(this, lon, lat, label, {...options, fromYearSync: true, preserveScroll: true});
        }
      }).catch(error => console.error(error));
      return result;
    },

    async openPolityByKey(key) {
      const profile = profileByKey.get(String(key).toLowerCase()) || profiles.find(item => item.zh === key);
      if (!profile) return null;
      const year = profile.dates.reduce((nearest, [from, to]) => {
        const candidate = Math.max(from, Math.min(to, this.year));
        return nearest === null || Math.abs(candidate - this.year) < Math.abs(nearest - this.year) ? candidate : nearest;
      }, null);
      this.jumpToYear(year);
      const snapKey = this._resolveSnapKey(this.dynasties[this.dynastyIdx], year);
      try {
        await data.loadSnapshot(snapKey);
        return this.year === year ? this.openPolity(profile.zh) : null;
      } catch (error) {
        showStatus('政权疆域暂时无法加载。');
        console.error(error);
        return null;
      }
    },

    _polityInRange(description, year) {
      return description?.dates?.some(([from, to]) => year >= from && year <= to) ?? false;
    },

    _polityStages(description) {
      return (description.dates || []).map(([from, to]) => ({
        from, to, snapKey: this._resolveSnapKey(this.dynasties[this._findDynastyIndex(from)], from), caption: description.zh,
      }));
    },

    _previewStageGhost(key) {
      this._worldPreview = key;
      this._fetchSnapshot(key).then(snapshot => {
        if (this._worldPreview === key) this._renderGhostDiff(snapshot, 'preview');
      }).catch(() => {});
    },

    _clearPreviewGhost() {
      this._worldPreview = null;
      return shared.clearPreviewGhost.call(this);
    },

    _restoreFromQuery(options) {
      const params = new URLSearchParams(location.search);
      const oldEvent = data.events.find(event => event.id === params.get('event'));
      if (oldEvent) {
        this.jumpToYear(oldEvent.year);
        this.openMilestoneBalloon(this.dynasties[this.dynastyIdx], oldEvent);
        return;
      }
      const point = params.get('at')?.split(',').map(Number);
      if (point?.length === 2 && point.every(Number.isFinite)) {
        this.openGenealogyAt(...point);
        return;
      }
      return shared.restoreFromQuery.call(this, options);
    },
  });

  window.EN_LOCALE = {strings: {}, dynasties: data.eraNames, milestones: {}, corridors: {}, dict: {}};
}

async function start() {
  const [index, events, names, land, modern, water] = await Promise.all([
    json('./maps/index.json'), json('./events.json'), json('./polity-names.json'),
    json('./maps/land.geojson'), json('./maps/modern.geojson'), json('./maps/water.json'),
  ]);
  configureShell();
  adaptAtlas(createAtlasData(index, events, names), mapContext(land, modern, water));
  Controller._bootOnce();
  document.documentElement.classList.add('world-ready');
  showStatus('');
}

start().catch(error => {
  showStatus('世界历史地图加载失败，请刷新重试。');
  console.error(error);
});
