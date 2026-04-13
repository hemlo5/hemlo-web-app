const fs = require('fs');
const svg = fs.readFileSync('public/logo.svg', 'utf-8');

// Quick and dirty bounds extraction from all paths
const pathMatches = [...svg.matchAll(/d="([^"]+)"/g)];
const translateMatches = [...svg.matchAll(/translate\(([^,]+),([^)]+)\)/g)];

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

for (let i = 0; i < pathMatches.length; i++) {
  const d = pathMatches[i][1];
  let dx = 0, dy = 0;
  if (translateMatches[i]) {
    dx = parseFloat(translateMatches[i][1]);
    dy = parseFloat(translateMatches[i][2]);
  }
  
  // Extract all coordinates. This is a rough estimation assuming absolute coordinates.
  const coords = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  for (const match of coords) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    if (!isNaN(x) && !isNaN(y)) {
      minX = Math.min(minX, x + dx);
      minY = Math.min(minY, y + dy);
      maxX = Math.max(maxX, x + dx);
      maxY = Math.max(maxY, y + dy);
    }
  }
}

console.log(`viewBox="${Math.floor(minX)} ${Math.floor(minY)} ${Math.ceil(maxX - minX)} ${Math.ceil(maxY - minY)}"`);
