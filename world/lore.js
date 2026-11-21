const MET = 'https://www.metmuseum.org/pt/essays/art-of-the-hellenistic-age-and-the-hellenistic-tradition';
const LOC = 'https://www.loc.gov/exhibits/1492/';

export const people = [
  {key: 'alexander', zh: '亚历山大大帝', en: 'Alexander the Great', courtesyZh: '马其顿国王', courtesyEn: 'King of Macedon', aliases: ['亚历山大三世', '亚历山大'], span: [-356, -323], journeyKey: 'alexander'},
  {key: 'columbus', zh: '克里斯托弗·哥伦布', en: 'Christopher Columbus', courtesyZh: '跨大西洋航行', courtesyEn: 'Transatlantic voyages', aliases: ['哥伦布', 'Columbus'], span: [1451, 1506], journeyKey: 'columbus'},
];

const itineraries = [
  {
    key: 'alexander', titleZh: '亚历山大东征', titleEn: 'Alexander’s Campaign', color: '#a83b24',
    spanZh: '前334年—前323年', spanEn: '334–323 BCE',
    source: ['大都会艺术博物馆 · 希腊化时代', MET],
    stops: [
      [-334, 27.3, 40.3, '格拉尼库斯河', 'Granicus River', '渡海进入小亚细亚', 'Crossing into Asia Minor', '马其顿军队向波斯帝国发起进攻，此处为河谷示意点。', 'The Macedonian invasion of the Persian Empire began in Asia Minor. This marker represents the river valley.'],
      [-332, 29.92, 31.2, '埃及亚历山大城', 'Alexandria, Egypt', '进入埃及', 'Entering Egypt', '亚历山大进入埃及。此地随后在他的名义下建立亚历山大城。', 'Alexander entered Egypt. Alexandria was founded nearby in his name shortly afterward.'],
      [-331, 43.34, 36.53, '高加米拉', 'Gaugamela', '击败大流士三世', 'Defeating Darius III', '马其顿军队在高加米拉获胜，标点为战场区域示意。', 'The Macedonian army won at Gaugamela. The marker is an approximate location.'],
      [-323, 44.42, 32.54, '巴比伦', 'Babylon', '在巴比伦去世', 'Death in Babylon', '亚历山大在巴比伦去世，帝国随后由继业者争夺。', 'Alexander died in Babylon. His successors then contested control of the empire.'],
    ],
  },
  {
    key: 'columbus', titleZh: '哥伦布首次跨大西洋航行', titleEn: 'Columbus’s First Atlantic Voyage', color: '#537f84',
    spanZh: '1492年—1493年', spanEn: '1492–1493',
    source: ['美国国会图书馆 · 1492 年的美洲航行', LOC],
    stops: [
      [1492, -6.89, 37.23, '帕洛斯港', 'Palos de la Frontera', '离开伊比利亚半岛', 'Departure from Iberia', '船队自西班牙帕洛斯港出航，向西横渡大西洋。', 'The fleet departed Palos and crossed the Atlantic westward.'],
      [1492, -74.49, 24.06, '巴哈马群岛', 'The Bahamas', '抵达加勒比海', 'Arrival in the Caribbean', '船队于十月抵达加勒比海，首次登陆的具体岛屿仍有争议。', 'The fleet reached the Caribbean in October. The identity of the first landing island remains disputed.'],
      [1492, -71.84, 19.76, '伊斯帕尼奥拉岛', 'Hispaniola', '在岛屿北岸停留', 'A stop on northern Hispaniola', '船队沿岛屿北岸航行，并留下部分船员。', 'The fleet sailed along the northern coast and left some of its crew there.'],
      [1493, -6.89, 37.23, '帕洛斯港', 'Palos de la Frontera', '返回西班牙', 'Return to Spain', '哥伦布于翌年回到西班牙，国际联系与殖民扩张由此进一步展开。', 'Columbus returned to Spain the following year, deepening transatlantic contact and colonial expansion.'],
    ],
  },
];

export const journeys = itineraries.map(({stops, ...journey}) => ({
  ...journey, shortZh: journey.titleZh, shortEn: journey.titleEn,
  stops: stops.map(([year, lon, lat, nameZh, nameEn, titleZh, titleEn, descZh, descEn]) => ({
    year, coord: [lon, lat], ancientZh: nameZh, modernZh: nameZh, ancientEn: nameEn, modernEn: nameEn,
    titleZh, titleEn, descZh, descEn, quoteZh: journey.source[0], quoteEn: journey.source[0],
  })),
}));

export const corridors = [{
  key: 'chang-an-tianshan', kind: 'road', title: '丝绸之路 · 长安—天山廊道',
  span: [-130, 1500], labelAt: [89.2, 44.8],
  summary: '连接长安、河西走廊与中亚天山的路线节点示意。各路段的使用时间并不相同。资料：UNESCO 丝绸之路长安—天山廊道。',
  segments: [[[108.94,34.26], [103.83,36.06], [100.45,38.94], [94.66,40.14], [89.53,42.85], [82.96,41.72], [78.88,42.49], [75.29,42.83]]],
}];
