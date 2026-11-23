import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  createTranslator,
  interpolateTemplate,
  normalizeLocale,
  parseCookieValue,
} from '@/lib/portable/i18n-engine';
import { resolveAppLocale } from '@/shared/i18n/config';
import { enDictionary } from '@/shared/i18n/dictionaries/en';
import { viDictionary, type TranslationKey } from '@/shared/i18n/dictionaries/vi';
import {
  formatMonthSelectOption,
  formatPeriodLabel,
  translateApp,
} from '@/shared/i18n/translator';

describe('Portable i18n Engine (Zero Dependencies)', () => {
  it('normalizes exact, regional, uppercase, and invalid locales safely', () => {
    expect(normalizeLocale('vi', ['vi', 'en'], 'vi')).toBe('vi');
    expect(normalizeLocale('EN', ['vi', 'en'], 'vi')).toBe('en');
    expect(normalizeLocale('en-US', ['vi', 'en'], 'vi')).toBe('en');
    expect(normalizeLocale('vi_VN', ['vi', 'en'], 'en')).toBe('vi');
    expect(normalizeLocale('ja-JP', ['vi', 'en'], 'vi')).toBe('vi');
    expect(normalizeLocale('', ['vi', 'en'], 'vi')).toBe('vi');
    expect(normalizeLocale(null, ['vi', 'en'], 'vi')).toBe('vi');
  });

  it('parses cookie values from standard Cookie headers safely', () => {
    const header = 'foo=bar; operon_locale=en; theme=midnight%20cmd';
    expect(parseCookieValue(header, 'operon_locale')).toBe('en');
    expect(parseCookieValue(header, 'theme')).toBe('midnight cmd');
    expect(parseCookieValue(header, 'missing')).toBeNull();
    expect(parseCookieValue('', 'operon_locale')).toBeNull();
  });

  it('interpolates template placeholders and preserves unresolved tokens', () => {
    expect(interpolateTemplate('Hello {name}, {count} alerts', { name: 'An', count: 3 })).toBe(
      'Hello An, 3 alerts',
    );
    expect(interpolateTemplate('Hi {name} ({role})', { name: 'An' })).toBe('Hi An ({role})');
  });

  it('resolves translations with fallback locale when target dictionary is missing', () => {
    const translator = createTranslator(
      {
        vi: { greeting: 'Xin chào {name}' },
        en: { greeting: 'Hello {name}' },
      },
      { fallbackLocale: 'vi' },
    );
    expect(translator.translate('vi', 'greeting', { name: 'Operon' })).toBe('Xin chào Operon');
    expect(translator.translate('en', 'greeting', { name: 'Operon' })).toBe('Hello Operon');
  });
});

describe('Operon Hub VI/EN Bilingual Dictionaries & Formatters', () => {
  it('maintains 100% key and interpolation token parity between VI and EN dictionaries', () => {
    const viKeys = Object.keys(viDictionary).sort() as TranslationKey[];
    const enKeys = Object.keys(enDictionary).sort() as TranslationKey[];
    expect(enKeys).toEqual(viKeys);

    const tokenRegex = /\{([a-zA-Z0-9_]+)\}/g;
    for (const key of viKeys) {
      expect(viDictionary[key].trim().length).toBeGreaterThan(0);
      expect(enDictionary[key].trim().length).toBeGreaterThan(0);

      const viTokens = [...viDictionary[key].matchAll(tokenRegex)].map((m) => m[1]).sort();
      const enTokens = [...enDictionary[key].matchAll(tokenRegex)].map((m) => m[1]).sort();
      expect(enTokens, `Mismatch tokens for key "${key}"`).toEqual(viTokens);
    }
  });

  it('translates key application strings accurately in VI and EN', () => {
    expect(resolveAppLocale('en-GB')).toBe('en');
    expect(resolveAppLocale('unknown')).toBe('vi');

    expect(translateApp('vi', 'common.logout')).toBe('Đăng xuất');
    expect(translateApp('en', 'common.logout')).toBe('Sign out');
    expect(translateApp('vi', 'notifications.header', { count: 4 })).toBe('Thông báo (4 chưa đọc)');
    expect(translateApp('en', 'notifications.header', { count: 4 })).toBe(
      'Notifications (4 unread)',
    );
  });

  it('formats dashboard period and month options per active locale', () => {
    expect(formatPeriodLabel('vi', 11, 2026)).toBe('Tháng 11/2026');
    expect(formatPeriodLabel('en', 11, 2026)).toBe('Nov 2026');
    expect(formatMonthSelectOption('vi', 3)).toBe('Tháng 3');
    expect(formatMonthSelectOption('en', 3)).toBe('Mar');
  });

  it('has ZERO untranslated static Vietnamese strings across all 59 production UI files when switched to EN', () => {
    const vnRe = /[\u00C0-\u00FF\u0102-\u01B0\u1EA0-\u1EF9]/;

    function walk(dir: string, acc: string[] = []): string[] {
      if (!fs.existsSync(dir)) return acc;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.(tsx|ts)$/.test(entry.name)) acc.push(full);
      }
      return acc;
    }

    const root = process.cwd();
    const uiFiles = [
      path.join(root, 'src/app/layout.tsx'),
      ...walk(path.join(root, 'src/app/login')),
      ...walk(path.join(root, 'src/app/(portal)')),
      ...walk(path.join(root, 'src/components/portal')),
      ...walk(path.join(root, 'src/components/hrm')),
      ...walk(path.join(root, 'src/components/system')),
      ...walk(path.join(root, 'src/components/ui')),
      ...walk(path.join(root, 'src/layouts')),
    ];

    function getPropKey(name: ts.PropertyName): string {
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
      }
      return '';
    }

    function isInsideAllowedViSlot(node: ts.Node): boolean {
      let cur: ts.Node | undefined = node;
      while (cur && cur.parent) {
        const p: ts.Node = cur.parent;
        if (ts.isCallExpression(p)) {
          const exprText = p.expression.getText();
          if (
            (exprText === 'tr' || exprText.endsWith('.current') || exprText.endsWith('.tr')) &&
            p.arguments.length >= 2 &&
            p.arguments[0] === cur
          ) {
            return true;
          }
        }
        if (ts.isPropertyAssignment(p) && p.initializer === cur) {
          const propName = getPropKey(p.name);
          if (propName === 'vi' && ts.isObjectLiteralExpression(p.parent)) {
            const hasEn = p.parent.properties.some(
              (pr) => ts.isPropertyAssignment(pr) && getPropKey(pr.name) === 'en',
            );
            if (hasEn) return true;
          }
        }
        if (ts.isConditionalExpression(p)) {
          const condText = p.condition.getText();
          if (condText.includes('locale') && condText.includes('en') && p.whenFalse === cur) {
            return true;
          }
          if (condText.includes('locale') && condText.includes('vi') && p.whenTrue === cur) {
            return true;
          }
          if (condText.includes('isEn') && p.whenFalse === cur) {
            return true;
          }
        }
        cur = p;
      }
      return false;
    }

    function isInsideEnSlot(node: ts.Node): boolean {
      let cur: ts.Node | undefined = node;
      while (cur && cur.parent) {
        const p: ts.Node = cur.parent;
        if (ts.isCallExpression(p)) {
          const exprText = p.expression.getText();
          if (
            (exprText === 'tr' || exprText.endsWith('.current')) &&
            p.arguments.length >= 2 &&
            p.arguments[1] === cur
          ) {
            return true;
          }
        }
        if (ts.isPropertyAssignment(p) && p.initializer === cur && getPropKey(p.name) === 'en') {
          return true;
        }
        cur = p;
      }
      return false;
    }

    const leaks: string[] = [];
    const enLeaks: string[] = [];

    for (const filePath of uiFiles) {
      const rel = path.relative(root, filePath).replace(/\\/g, '/');
      const code = fs.readFileSync(filePath, 'utf8');
      const sf = ts.createSourceFile(
        filePath,
        code,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      const visit = (node: ts.Node) => {
        if (
          ts.isJsxText(node) ||
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateHead(node) ||
          ts.isTemplateMiddle(node) ||
          ts.isTemplateTail(node)
        ) {
          const cleaned = node.text.replace(/[°×÷©®™±·•–—₫]/g, '');
          if (vnRe.test(cleaned)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            const preview = node.text.trim().slice(0, 70);
            if (isInsideEnSlot(node)) {
              enLeaks.push(`${rel}:${line + 1} -> "${preview}"`);
            } else if (!isInsideAllowedViSlot(node)) {
              leaks.push(`${rel}:${line + 1} -> "${preview}"`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sf);
    }

    expect(uiFiles.length).toBeGreaterThanOrEqual(59);
    expect(enLeaks, `Vietnamese leaked into EN branch:\n${enLeaks.join('\n')}`).toEqual([]);
    expect(leaks, `Untranslated static Vietnamese UI strings found:\n${leaks.join('\n')}`).toEqual(
      [],
    );
  });
});
