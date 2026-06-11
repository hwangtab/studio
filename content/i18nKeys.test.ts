/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';

const SOURCE_GLOBS = ['pages/**/*.ts', 'pages/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx'];

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

const hasFallbackArgument = (argument: Node | undefined): boolean => {
  if (!argument) {
    return false;
  }

  if (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) {
    return true;
  }

  if (!Node.isObjectLiteralExpression(argument)) {
    return false;
  }

  return argument.getProperties().some((property) => {
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
      return false;
    }

    return property.getName() === 'defaultValue' || property.getName() === 'returnObjects';
  });
};

describe('i18n literal keys', () => {
  it('keeps fallback-free t() keys present in every locale resource', () => {
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
        if (!keyArg || !Node.isStringLiteral(keyArg)) {
          return;
        }

        const key = keyArg.getLiteralValue();
        if (hasFallbackArgument(args[1])) {
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
