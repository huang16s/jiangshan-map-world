const COLORS = [
  '#b57d48', '#919162', '#7d928a', '#ab705f', '#8f81a3', '#b39d59',
  '#718fa0', '#a27a9a', '#9a9b63', '#b58b71', '#82966d', '#c4886c',
  '#908777', '#8797ad', '#ab8b4f', '#ad7b85', '#76928f', '#bc9a73',
];

const ERAS = [
  [-3400, '早期文明', 'Early Civilizations', -2600, '#8c603d', '两河、尼罗河、印度河与安第斯一带发展出早期城市和社会组织。'],
  [-1200, '古典时代', 'Classical Antiquity', -480, '#996745', '地中海、西亚、南亚和东亚的政权扩大，跨区域交通与交流逐渐增多。'],
  [1, '古典晚期', 'Late Antiquity', 330, '#996855', '罗马帝国东移，非洲、亚洲和美洲发展出各自的城市、贸易和文化网络。'],
  [500, '中古前期', 'Early Middle Ages', 800, '#877a58', '横跨欧亚的陆路与海域交通扩大，美洲和太平洋的社会也各自演进。'],
  [1000, '中古后期', 'Late Middle Ages', 1250, '#747e60', '非洲商贸城市、蒙古扩张及印度洋航路推动跨区域联系。'],
  [1450, '全球航路', 'Global Encounters', 1500, '#8a623e', '远洋航路把各大陆联系起来，贸易和迁移扩大的同时也带来殖民与强迫迁徙。'],
  [1750, '革命与变革', 'Age of Revolutions', 1789, '#986146', '革命、独立运动和工业化改变了各地的社会与政治结构。'],
  [1914, '世界大战', 'World Wars', 1939, '#865a4c', '两次世界大战和战间期的变化重塑了全球政治秩序。'],
  [1945, '战后世界', 'Postwar World', 1960, '#637d78', '联合国成立，非殖民化和冷战影响了各地。'],
  [1991, '当代世界', 'Contemporary World', 2024, '#696d83', '国际组织、数字通信和全球性公共议题愈发影响日常生活。'],
];

export async function json(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`${path} (${response.status})`);
  return response.json();
}

export function polygons(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function featureColor(name) {
  let hash = 0;
  for (const letter of name) hash = (Math.imul(hash, 31) + letter.codePointAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function eventRecord([id, year, region, category, headline, site, lon, lat, summary, source, approximate = false], sources) {
  return {id, year, region, category, headline, site, coord: [lon, lat], summary, source: sources[source], approximate};
}

export function createAtlasData(index, database, translations) {
  const events = database.events.map(row => eventRecord(row, database.sources)).sort((a, b) => a.year - b.year);
  const catalog = new Map(Object.entries(index.polities).map(([name, dates]) => [name, {
    name, title: translations[name] || name, dates,
  }]));
  const changes = new Set();
  for (const {dates} of catalog.values()) {
    for (const [start, end] of dates) {
      changes.add(start);
      changes.add(end === -1 ? 1 : end + 1);
    }
  }

  const eraNames = {};
  const eras = ERAS.map(([fromYear, title, name, focusYear, tint, summary], idx) => {
    const key = `world-${idx}`;
    const until = ERAS[idx + 1]?.[0] || 2025;
    const toYear = until === 1 ? -1 : until - 1;
    const starts = [fromYear, ...[...changes].filter(year => year > fromYear && year <= toYear).sort((a, b) => a - b)];
    // The shared legend has one focusable button per phase. Keep those jumps
    // legible while still resolving every documented boundary change on scrub.
    const step = Math.ceil(starts.length / 12);
    const jumps = starts.filter((_, i) => i % step === 0);
    const phases = jumps.map((start, i) => ({snap: `y${start}`, until: jumps[i + 1] || toYear + 1}));
    const milestones = events.filter(event => event.year >= fromYear && event.year <= toYear);
    const settlements = milestones.map(event => ({
      ancient: event.site.split('（')[0], modern: event.site, coord: event.coord,
      appear: event.year, vanish: event.year === -1 ? 1 : event.year + 1,
      tier: 2, remark: event.headline,
    }));
    eraNames[key] = {name, short: name, capital: '', desc: summary};
    return {key, title, badge: title, fromYear, toYear, focusYear, tint, seat: '', summary, starts, phases, milestones, settlements};
  });

  const periods = new Map();
  const snapshots = Object.create(null);
  const recent = new Set();
  const pinned = new Set();

  function remember(key, snapshot) {
    snapshots[key] = snapshot;
    recent.delete(key);
    if (!pinned.has(key)) recent.add(key);
    if (recent.size > 20) {
      const oldest = recent.values().next().value;
      recent.delete(oldest);
      delete snapshots[oldest];
    }
    return snapshot;
  }

  function loadPeriod(year) {
    const period = index.periods.find(item => item.from <= year && year <= item.to);
    const file = period.file;
    const request = periods.get(file) || json(`./maps/${file}`).then(({features}) => features.map(({geometry, properties}) => {
      const {name, from, to, point, area} = properties;
      return {
        title: catalog.get(name).title, name, shape: geometry, anchor: point, from, to, area,
        role: 'main', tint: featureColor(name),
      };
    })).catch(error => {
      if (periods.get(file) === request) periods.delete(file);
      throw error;
    });
    periods.delete(file);
    periods.set(file, request);
    if (periods.size > 5) periods.delete(periods.keys().next().value);
    return request;
  }

  async function loadSnapshot(key) {
    if (snapshots[key]) return remember(key, snapshots[key]);
    const year = Number(key.slice(1));
    const records = await loadPeriod(year);
    if (snapshots[key]) return remember(key, snapshots[key]);
    const polities = records.filter(record => record.from <= year && year <= record.to);
    return remember(key, {polities, prefectures: [], regions: [], note: '', caption: ''});
  }

  async function loadGenealogySample(controller) {
    // The shared place card shows one representative year per era. Pin those
    // snapshots for subsequent place queries without retaining every year.
    const keys = eras.map(era => controller._resolveSnapKey(era, era.focusYear));
    for (const key of keys) {
      pinned.add(key);
      await loadSnapshot(key);
    }
  }

  return {events, eras, eraNames, catalog, snapshots, loadSnapshot, loadGenealogySample};
}

function rank(feature) {
  return Math.min(5, Math.max(1, Number(feature.properties.scalerank) || 2));
}

export function mapContext(land, modern, water) {
  const provinces = modern.features.map(({geometry, properties}) => ({
    code: properties.ADM0_A3, title: properties.NAME_ZH || properties.NAME_EN,
    english: properties.NAME_EN, hub: [properties.LABEL_X, properties.LABEL_Y], rings: polygons(geometry),
  }));
  const hydro = {
    lakes: water.lakes.features.map(feature => ({rank: rank(feature), rings: polygons(feature.geometry).flat()})),
    rivers: water.rivers.features.map(feature => ({
      rank: rank(feature), lines: feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates,
    })),
  };
  return {land: land.features.map(feature => feature.geometry), provinces, hydro};
}
