import { origin } from "./engine.js";
export function demoData() {
  const nodes = [],
    edges = [],
    buildings = [],
    trees = [];
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++)
      nodes.push({ point: [x * 65 - 195, y * 65 - 195] });
  const id = (x, y) => y * 7 + x;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      if (x < 6)
        edges.push({
          a: id(x, y),
          b: id(x + 1, y),
          name:
            y === 6
              ? "Banyan Walk"
              : y === 0
                ? "University Walk"
                : "Campus Walk",
        });
      if (y < 6)
        edges.push({
          a: id(x, y),
          b: id(x, y + 1),
          name: x === 0 ? "Grove Promenade" : "Palm Walk",
        });
    }
  for (let i = 0; i < 6; i++)
    edges.push({
      a: id(i, i),
      b: id(i + 1, i + 1),
      name: "Commons Cut-through",
    });
  for (let p = -195; p <= 195; p += 19) {
    trees.push({ point: [-196, p], radius: 8 });
    trees.push({ point: [p, 196], radius: 8 });
  }
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      if (x === y) continue;
      const a = x * 65 - 181,
        b = y * 65 - 181;
      buildings.push({
        points: [
          [a, b],
          [a + 33, b],
          [a + 33, b + 31],
          [a, b + 31],
        ],
        height: 8 + ((x * 7 + y * 3) % 5) * 3,
        estimated: true,
      });
      if ((x + y) % 3 === 0)
        for (let t = 0; t < 4; t++)
          trees.push({ point: [a - 12, b + t * 12], radius: 7 });
    }
  return {
    origin,
    nodes,
    edges,
    buildings,
    trees,
    woods: [],
    source: "demo",
    places: [
      { id: 0, name: "Campus entrance" },
      { id: 48, name: "Banyan gardens" },
      { id: 24, name: "The commons" },
      { id: 6, name: "East library" },
      { id: 42, name: "Grove café" },
      { id: 27, name: "Design studio" },
    ],
  };
}
