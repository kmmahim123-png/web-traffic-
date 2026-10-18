const fs = require('fs');
const content = fs.readFileSync('chunk_api.js', 'utf8');

// Find imports
const imports = content.match(/import\s*\{?[^;]+from\s*["'][^"']+["']/g) || [];
console.log('Imports in chunk_api.js:');
imports.forEach(i => console.log(i));

// Find M definition
const mIdx = content.indexOf('function M(');
if (mIdx !== -1) {
  console.log('function M snippet:', content.substring(mIdx, mIdx + 500));
}

// Find stGetFreeTrafficOverview
const idx = content.indexOf('stGetFreeTrafficOverview');
console.log('Around stGetFreeTrafficOverview:');
console.log(content.substring(Math.max(0, idx - 200), idx + 300));
