/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { Project, Node, SyntaxKind, type SourceFile } from 'ts-morph';

import { CORE_I18N_SECTIONS } from '../lib/i18n.server';

const SOURCE_GLOBS = ['pages/**/*.ts', 'pages/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx'];

// 페이지 import closure 추적용 — t()를 쓸 수 있는 로컬 소스 전체.
const CLOSURE_GLOBS = [
  ...SOURCE_GLOBS,
  'lib/**/*.ts',
  'lib/**/*.tsx',
  'utils/**/*.ts',
  'utils/**/*.tsx',
  'hooks/**/*.ts',
  'hooks/**/*.tsx',
  'data/**/*.ts',
  'data/**/*.tsx',
];

const hasKey = (resource: unknown, key: string): boolean => {
  let current = resource;

  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return true;
};

// returnObjects 호출만 검사에서 제외한다: 결과가 배열/객체라 호출부가 Array.isArray로
// 가드하고, contact.faq처럼 특정 locale 전용 섹션이 존재한다.
// defaultValue는 제외 사유가 아니다 — 키가 JSON에 안착되지 않으면 모든 locale에
// defaultValue 원문(주로 한국어)이 그대로 노출되므로 누락으로 취급한다.
const isReturnObjectsCall = (argument: Node | undefined): boolean => {
  if (!argument || !Node.isObjectLiteralExpression(argument)) {
    return false;
  }

  return argument.getProperties().some((property) => {
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
      return false;
    }

    return property.getName() === 'returnObjects';
  });
};

describe('i18n literal keys', () => {
  it('keeps static t() keys present in every locale resource', () => {
    const localesDir = path.join(process.cwd(), 'public/locales');
    const locales = fs
      .readdirSync(localesDir)
      .filter((locale) => fs.existsSync(path.join(localesDir, locale, 'common.json')));
    const resources = Object.fromEntries(
      locales.map((locale) => [
        locale,
        JSON.parse(fs.readFileSync(path.join(localesDir, locale, 'common.json'), 'utf8')) as unknown,
      ])
    );

    const project = new Project({ tsConfigFilePath: 'tsconfig.json', skipAddingFilesFromTsConfig: true });
    project.addSourceFilesAtPaths(SOURCE_GLOBS);

    const missing: string[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      sourceFile.forEachDescendant((node) => {
        if (!Node.isCallExpression(node)) {
          return;
        }

        if (node.getExpression().getText() !== 't') {
          return;
        }

        const args = node.getArguments();
        const keyArg = args[0];
        if (!keyArg || (!Node.isStringLiteral(keyArg) && !Node.isNoSubstitutionTemplateLiteral(keyArg))) {
          return;
        }

        const key = keyArg.getLiteralValue();
        if (isReturnObjectsCall(args[1])) {
          return;
        }

        const missingLocales = locales.filter((locale) => !hasKey(resources[locale], key));
        if (missingLocales.length === 0) {
          return;
        }

        const relativePath = path.relative(process.cwd(), sourceFile.getFilePath());
        missing.push(`${relativePath}:${node.getStartLineNumber()} ${key} missing in ${missingLocales.join(',')}`);
      });
    }

    expect(missing).toEqual([]);
  });
});

// i18nSections로 page-data를 슬라이싱하는 페이지는, 그 페이지가 렌더하는 컴포넌트
// 트리(정적 import + next/dynamic import closure)가 참조하는 모든 top-level 섹션을
// 실어야 한다. 안 실리면 t()가 리소스를 못 찾아 생 키(예: stories.categories.vocal)가
// 화면에 그대로 노출된다. defaultValue 유무와 무관 — 번역이 있어도 렌더되지 않는다.
describe('i18n page sections', () => {
  it('ships every i18n section referenced by each page component tree', () => {
    const project = new Project({ tsConfigFilePath: 'tsconfig.json', skipAddingFilesFromTsConfig: true });
    project.addSourceFilesAtPaths(CLOSURE_GLOBS);

    const rel = (file: SourceFile) => path.relative(process.cwd(), file.getFilePath());

    const resolveImport = (fromFile: SourceFile, spec: string): SourceFile | undefined => {
      let base: string;
      if (spec.startsWith('@/')) {
        base = path.join(process.cwd(), spec.slice(2));
      } else if (spec.startsWith('.')) {
        base = path.join(path.dirname(fromFile.getFilePath()), spec);
      } else {
        return undefined; // 외부 패키지
      }

      for (const suffix of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
        const found = project.getSourceFile(base + suffix);
        if (found) {
          return found;
        }
      }
      return undefined;
    };

    const collectClosure = (entry: SourceFile): SourceFile[] => {
      const visited = new Set<SourceFile>([entry]);
      const queue: SourceFile[] = [entry];

      while (queue.length > 0) {
        const file = queue.pop() as SourceFile;
        const specs: string[] = [];

        for (const decl of file.getImportDeclarations()) {
          specs.push(decl.getModuleSpecifierValue());
        }
        for (const decl of file.getExportDeclarations()) {
          const spec = decl.getModuleSpecifierValue();
          if (spec) {
            specs.push(spec);
          }
        }
        file.forEachDescendant((node) => {
          if (!Node.isCallExpression(node)) {
            return;
          }
          if (node.getExpression().getKind() !== SyntaxKind.ImportKeyword) {
            return;
          }
          const arg = node.getArguments()[0];
          if (arg && Node.isStringLiteral(arg)) {
            specs.push(arg.getLiteralValue());
          }
        });

        for (const spec of specs) {
          const resolved = resolveImport(file, spec);
          if (resolved && !visited.has(resolved)) {
            visited.add(resolved);
            queue.push(resolved);
          }
        }
      }

      return [...visited];
    };

    // 파일별 "사용 섹션 → 대표 키" 맵. 템플릿 키(t(`stories.categories.${k}`))는
    // head의 첫 세그먼트로 섹션을 특정한다. 완전 동적 키(t(변수))는 특정 불가 — 스킵.
    const usedSectionsCache = new Map<SourceFile, Map<string, string>>();
    const usedSections = (file: SourceFile): Map<string, string> => {
      const cached = usedSectionsCache.get(file);
      if (cached) {
        return cached;
      }

      const sections = new Map<string, string>();
      file.forEachDescendant((node) => {
        if (!Node.isCallExpression(node)) {
          return;
        }
        if (node.getExpression().getText() !== 't') {
          return;
        }

        const keyArg = node.getArguments()[0];
        let key: string | undefined;
        if (keyArg && (Node.isStringLiteral(keyArg) || Node.isNoSubstitutionTemplateLiteral(keyArg))) {
          key = keyArg.getLiteralValue();
        } else if (keyArg && Node.isTemplateExpression(keyArg)) {
          const head = keyArg.getHead().getLiteralText();
          if (head.includes('.')) {
            key = head;
          }
        }
        if (!key) {
          return;
        }

        const section = key.split('.')[0];
        if (!sections.has(section)) {
          sections.set(section, `${rel(file)}:${node.getStartLineNumber()} ${key}`);
        }
      });

      usedSectionsCache.set(file, sections);
      return sections;
    };

    const violations: string[] = [];

    for (const page of project.getSourceFiles()) {
      if (!rel(page).startsWith('pages/')) {
        continue;
      }

      let declared: string[] | undefined;
      page.forEachDescendant((node) => {
        if (declared || !Node.isPropertyAssignment(node)) {
          return;
        }
        if (node.getName() !== 'i18nSections') {
          return;
        }
        const initializer = node.getInitializer();
        if (initializer && Node.isArrayLiteralExpression(initializer)) {
          declared = initializer
            .getElements()
            .flatMap((element) => (Node.isStringLiteral(element) ? [element.getLiteralValue()] : []));
        }
      });
      if (!declared) {
        continue; // 섹션 슬라이싱 미사용 → 전체 common.json 직렬화, 제약 없음
      }

      const allowed = new Set<string>([...CORE_I18N_SECTIONS, ...declared]);
      const reported = new Set<string>();
      for (const file of collectClosure(page)) {
        for (const [section, exemplar] of usedSections(file)) {
          if (allowed.has(section) || reported.has(section)) {
            continue;
          }
          reported.add(section);
          violations.push(`${rel(page)} i18nSections missing '${section}' (used at ${exemplar})`);
        }
      }
    }

    expect(violations.sort()).toEqual([]);
  });
});
