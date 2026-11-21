# 世界时序

世界时序是江山时序的世界历史页面。此扩展基于上游提交 `73eea126752b49d65b461db0bb40304fc85a396d`，复用页面结构、样式、时间轴和地图控制器。世界投影、疆域和历史数据由 `world/` 下的适配代码提供。代码按仓库的 GPL-3.0 许可证发布，各地图数据按自己的许可使用。[上游项目](https://github.com/DeanChensj/jiangshan-map) · [上游许可证](../LICENSE)

## 本地预览

从仓库根目录启动 HTTP 服务，打开 `/` 查看中国历史或 `/world/` 查看世界历史。浏览器直接使用仓库内的地图与事件数据。

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

地图支持拖拽、滚轮和双指缩放。点击地名或双击地图可以打开沿革卡，查阅各时期的代表年份。年份输入使用负数表示公元前。左右方向键切换大事，Shift 加方向键按十年移动，空格播放或暂停，Ctrl 或 ⌘ 加 K 打开搜索。在「更多」菜单可复制带年份、事件、政权或坐标的视图链接。

## 数据与出处

- **历史疆域**来自 James S. Bennett 等人维护的 Cliopatria v0.2.1，包含公元前 3400 年至公元 2024 年的全球政权记录。多边形用 0.018° 容差作拓扑保留简化，坐标舍入至三位小数，并按年份分文件。较细的绘图保留更多原始顶点。历史时期的政区细分、疆域重叠和覆盖缺口仍取决于原始资料。[数据论文](https://doi.org/10.1038/s41597-025-04516-9) · [数据版本](https://github.com/Seshat-Global-History-Databank/cliopatria/tree/v0.2.1) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **地理参照**使用 Natural Earth 1:50m 陆地、河流、湖泊和现代参考界线。采用现代自然地理图层，历史政权范围单独显示。历史政区开关适用于有州郡级资料的地图，目前世界数据只提供政权级疆域。[陆地数据](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/) · [公有领域说明](https://www.naturalearthdata.com/about/terms-of-use/)
- **大事年表**采用中文编辑摘要。资料包括 UNESCO、博物馆、各国档案馆、大学、学术论文和国际组织。原文链接随每条事件显示。估计日期标注为「约」，跨地区事件使用代表性地点或事件节点定位。[数据文件](events.json)
- **政权中文名**按 Cliopatria 的原始记录逐项对应，参考 Wikidata 的中英文标签与别名，并采用常见简体中文译名。原名可用于搜索，未收录译名的条目继续显示原名。[译名表](polity-names.json) · [Wikidata 数据许可（CC0）](https://www.wikidata.org/wiki/Wikidata:Licensing) · [联合国会员国中文名](https://www.un.org/zh/about-us/member-states)

## 更新数据

`events.json` 中的事件记录依次为事件 ID、年份、地区、主题、标题、地点、经度、纬度、中文摘要、资料 ID，以及可选的约年标记。新增事件使用唯一 ID 和直接指向资料的 HTTPS 链接。政权中文名可在 `polity-names.json` 里补充，按 Cliopatria 原始名称匹配。

人物和路线示例及其出处见 `lore.js`。世界页的 HTML 由 `python scripts/build_world_shell.py` 从中国版结构生成，`--check` 可验证页面是否同步。

原始地理资料可通过构建脚本下载或放入 `world/.sources/`。脚本校验版本摘要，生成 `world/maps` 下的标准 GeoJSON 和时段索引。需要 Python 3.11 或更新版本和 Shapely。页面运行只需要静态 HTTP 服务。

```powershell
python -m pip install shapely
python scripts/build_world_data.py --download
```

中国历史页面及其地图资料沿用原项目的许可说明。CHGIS 与 Hartwell 派生的郡州府边界及 DataV 现代省界遵循各自的数据条款。[中国版数据来源与授权](../README_ZH.md#数据来源与授权)
