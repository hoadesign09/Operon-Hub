const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ALLOWED_LICENSES = new Set(['MIT']);

const args = process.argv.slice(2);
const pkgIdx = args.indexOf('--pkg');
const isAudit = args.includes('--audit');

function normalizeLicense(raw) {
  if (!raw) return 'UNKNOWN';
  if (typeof raw === 'string') return raw.trim().replace(/^\(|\)$/g, '');
  if (typeof raw === 'object' && raw.type) return String(raw.type).trim();
  return 'UNKNOWN';
}

// Chế độ 1: Kiểm tra 1 package trên npm registry TRƯỚC KHI CÀI
if (pkgIdx !== -1 && args[pkgIdx + 1]) {
  const pkgName = args[pkgIdx + 1];
  try {
    const output = execFileSync('npm', ['view', pkgName, 'license', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

    const parsed = output ? JSON.parse(output) : null;
    const license = normalizeLicense(parsed);

    if (ALLOWED_LICENSES.has(license)) {
      console.log(`[ALLOWED] ${pkgName} -> License: ${license}`);
      process.exit(0);
    } else {
      console.error(`[BLOCKED] ${pkgName} -> License: ${license} (Chỉ cho phép: MIT)`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[ERROR] Không thể kiểm tra license của "${pkgName}":`, err.message);
    process.exit(1);
  }
}

// Chế độ 2: Audit toàn bộ dependencies & devDependencies trong package.json
if (isAudit) {
  const rootDir = path.resolve(__dirname, '../..');
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('Không tìm thấy package.json tại:', rootDir);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const violations = [];
  for (const name of Object.keys(allDeps)) {
    const depPkgPath = path.join(rootDir, 'node_modules', name, 'package.json');
    if (!fs.existsSync(depPkgPath)) {
      violations.push({ name, license: 'NOT_INSTALLED' });
      continue;
    }
    const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
    const license = normalizeLicense(depPkg.license || depPkg.licenses);
    if (!ALLOWED_LICENSES.has(license)) {
      violations.push({ name, license });
    }
  }

  if (violations.length === 0) {
    console.log(`[PASS] Toàn bộ ${Object.keys(allDeps).length} packages đều đạt chuẩn MIT.`);
    process.exit(0);
  }

  console.error('[FAIL] Phát hiện package không đạt chuẩn MIT:');
  violations.forEach((v) => console.error(`  - ${v.name}: ${v.license}`));
  process.exit(1);
}

console.log('Cách dùng:');
console.log('  Kiểm tra trước khi cài : node .agents/scripts/check-license.js --pkg <ten-package>');
console.log('  Audit toàn bộ dự án    : node .agents/scripts/check-license.js --audit');