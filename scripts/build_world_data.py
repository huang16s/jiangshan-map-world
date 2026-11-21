#!/usr/bin/env python3
"""Prepare the world atlas's local GeoJSON from the pinned source datasets."""

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile

from shapely.geometry import mapping, shape


ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "world"
SOURCES = (
    (
        "cliopatria-v0.2.1.zip",
        "https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/v0.2.1/cliopatria.geojson.zip",
        "e10a4e429fca708788ff9e7572a95fce801fae55852d217cffabc1c59cd4eed4",
    ),
    (
        "ne_50m_land.geojson",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson",
        "e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b",
    ),
    (
        "ne_50m_admin_0_countries.geojson",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson",
        "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb",
    ),
    (
        "ne_50m_lakes.geojson",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_lakes.geojson",
        "d350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52",
    ),
    (
        "ne_50m_rivers_lake_centerlines.geojson",
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_rivers_lake_centerlines.geojson",
        "f286e0ce978fde999ca2d7a78c764be08542e19b63cded52b05c12d5173ccc51",
    ),
)
# Shorter intervals in centuries with more frequent boundary changes.
EDGES = (
    -3400, -2000, -1000, -500, 1, 500, 1000, 1250, 1500, 1600, 1700, 1750,
    1800, 1850, 1875, 1900, 1914, 1919, 1939, 1946, 1960, 1975, 1990, 2000,
    2010, 2025,
)


def source_files(folder, download):
    folder.mkdir(parents=True, exist_ok=True)
    for filename, url, expected_hash in SOURCES:
        path = folder / filename
        if download and not path.exists():
            temporary = path.with_suffix(".download")
            urlretrieve(url, temporary)
            temporary.replace(path)
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        if digest != expected_hash:
            raise ValueError(f"SHA-256 mismatch for {path}")
        yield path


def archive_features(path):
    # This pinned GDAL export stores one feature per line. Process the large
    # archive incrementally and fail if a future release changes that layout.
    with ZipFile(path) as archive, archive.open("cliopatria_polities_only_v021.geojson") as data:
        for line in data:
            if line.lstrip().startswith(b'"features"'):
                break
        else:
            raise ValueError("Cliopatria feature collection is missing")
        for line in data:
            line = line.strip()
            if line.startswith(b"]"):
                return
            yield json.loads(line.removesuffix(b","))
        raise ValueError("Incomplete Cliopatria feature collection")


def round_coordinates(coordinates):
    if not coordinates:
        return []
    if isinstance(coordinates[0], (int, float)):
        return [round(value, 3) for value in coordinates[:2]]
    return [round_coordinates(child) for child in coordinates]


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")


def natural_earth(path, keys=()):
    base = json.loads(path.read_text(encoding="utf-8"))
    features = [feature for feature in base["features"] if feature.get("geometry") and feature["geometry"].get("coordinates")]
    for feature in features:
        feature["properties"] = {key: feature["properties"][key] for key in keys if key in feature["properties"]}
        feature["geometry"]["coordinates"] = round_coordinates(feature["geometry"]["coordinates"])
    return {"type": "FeatureCollection", "features": features}


def build(source, land, modern, lakes, rivers, output):
    output.mkdir(parents=True, exist_ok=True)
    ranges = list(zip(EDGES, EDGES[1:]))
    batches = [[] for _ in ranges]
    names = defaultdict(list)
    total = 0

    for feature in archive_features(source):
        fields = feature["properties"]
        if fields["Type"] != "POLITY" or not feature.get("geometry"):
            continue
        start, end = int(fields["FromYear"]), int(fields["ToYear"])
        if end == 0:
            end = -1  # The timeline goes directly from 1 BCE to 1 CE.
        name = fields["Name"]
        simplified = shape(feature["geometry"]).simplify(0.018, preserve_topology=True)
        if simplified.is_empty or simplified.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError(f"Unexpected geometry for {name} ({start}–{end})")
        geometry = mapping(simplified)
        geometry["coordinates"] = round_coordinates(geometry["coordinates"])
        point = simplified.representative_point()
        properties = {
            "name": name, "from": start, "to": end, "area": round(fields["Area"]),
            "point": [round(point.x, 3), round(point.y, 3)],
            "wiki": fields.get("Wikipedia") or "",
            "wikidata": fields.get("Wikidata") or "",
        }
        entry = {
            "type": "Feature", "geometry": geometry, "properties": properties,
            "bbox": [round(value, 3) for value in simplified.bounds],
        }
        for index, (lower, upper) in enumerate(ranges):
            if start < upper and end >= lower:
                batches[index].append(entry)
        names[name].append((start, end))
        total += 1

    periods = []
    for (start, upper), features in zip(ranges, batches):
        # Smaller territories are painted last, so city-states and enclaves
        # are still inspectable where records overlap.
        features.sort(key=lambda feature: -feature["properties"]["area"])
        file = f"borders-{start}.geojson"
        write_json(output / file, {"type": "FeatureCollection", "features": features})
        last_year = -1 if upper == 1 else upper - 1
        periods.append({"from": start, "to": last_year, "file": file})

    write_json(output / "land.geojson", natural_earth(land))
    write_json(output / "modern.geojson", natural_earth(modern, ("ADM0_A3", "NAME_EN", "NAME_ZH", "LABEL_X", "LABEL_Y")))
    write_json(output / "water.json", {
        "lakes": natural_earth(lakes, ("scalerank",)),
        "rivers": natural_earth(rivers, ("scalerank",)),
    })
    catalog = {name: sorted(set(years)) for name, years in sorted(names.items())}
    write_json(output / "index.json", {"version": "0.2.1", "records": total, "periods": periods, "polities": catalog})
    print(f"Prepared {total:,} dated records for {len(catalog):,} polities in {len(periods)} files")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="fetch the pinned inputs if absent")
    parser.add_argument("--source-dir", type=Path, default=ATLAS / ".sources")
    parser.add_argument("--output", type=Path, default=ATLAS / "maps")
    args = parser.parse_args()
    build(*source_files(args.source_dir, args.download), args.output)


if __name__ == "__main__":
    main()
