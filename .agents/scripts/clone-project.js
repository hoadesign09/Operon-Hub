const fs = require('fs');
const path = require('path');

// Đọc tham số CLI: --target ../new-app --name new-app --exclude src/modules/invoices,src/modules/orders
const args = process.argv.slice(2);
const getArg = (flag, fallback = '') => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const targetDir = path.resolve(getArg('--target'));
const projectName = getArg('--name', path.basename(targetDir));
const extraExcludes = getArg('--exclude', '').split(',').filter(Boolean);

if (!getArg('--target')) {
  console.error('Thiếu tham số --target <duong-dan-du-an-moi>');
  process.exit(1);
}

const sourceDir = path.resolve(__dirname, '../..');

// Danh sách luôn loại bỏ mặc định
const DEFAULT_EXCLUDES = [
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.env',
  '.env.local',
  '.env.production',
  'uploads',
  '.agents/logs/work',
  '.agents/logs/test',
  '.agents/reports',
  '.agents/test-cases/master-testcases.xlsx',
  ...extraExcludes,
];

const isExcluded = (relPath) => {
  const normalized = relPath.replace(/\\/g, '/');
  return DEFAULT_EXCLUDES.some(
    (ex) => normalized === ex || normalized.startsWith(`${ex}/`)
  );
};

function copyRecursive(src, dest, relBase = '') {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (isExcluded(relPath)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, relPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(sourceDir, targetDir);

// Tạo sẵn các thư mục log/report rỗng ở dự án mới
['.agents/logs/work', '.agents/logs/test', '.agents/reports'].forEach((dir) => {
  fs.mkdirSync(path.join(targetDir, dir), { recursive: true });
});

// Cập nhật nhanh tên dự án trong package.json (nếu có)
const pkgPath = path.join(targetDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = projectName;
  pkg.version = '1.0.0';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

console.log(`Đã clone khung dự án sạch sang: ${targetDir}`);