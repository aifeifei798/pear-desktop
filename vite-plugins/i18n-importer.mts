import { readFileSync } from 'node:fs';
import { basename, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globSync } from 'glob';
import { Project } from 'ts-morph';

const __dirname = dirname(fileURLToPath(import.meta.url));
const globalProject = new Project({
  tsConfigFilePath: resolve(__dirname, '..', 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  skipLoadingLibFiles: true,
  skipFileDependencyResolution: true,
});

export const i18nImporter = () => {
  const srcPath = resolve(__dirname, '..', 'src');
  const plugins = globSync(['src/i18n/resources/*.json']).map((path) => {
    const nameWithExt = basename(path);
    const name = nameWithExt.replace(extname(nameWithExt), '');

    return { name, path };
  });

  const src = globalProject.createSourceFile(
    'vm:i18n',
    (writer) => {
      // Display names are extracted at build time so the language menu
      // doesn't need to load every translation file
      const displayNames: Record<string, unknown> = {};
      for (const { name, path } of plugins) {
        try {
          const content = JSON.parse(
            readFileSync(resolve(srcPath, '..', path), 'utf-8'),
          ) as {
            language?: Record<string, string>;
            translation?: {
              language?: Record<string, string>;
            };
          };
          displayNames[name] = content.language ?? content.translation?.language ?? {};
        } catch {
          displayNames[name] = {};
        }
      }
      writer.writeLine(
        `export const availableLanguages = ${JSON.stringify(displayNames)};`,
      );
      writer.writeLine(
        'export const languageResource = async (lang) => {',
      );
      writer.writeLine('  const importer = resourceImporters[lang];');
      writer.writeLine("  if (!importer) throw new Error(`Unknown language: ${lang}`);");
      writer.writeLine('  const mod = await importer();');
      writer.writeLine('  return { [lang]: { translation: mod.default } };');
      writer.writeLine('};');
      writer.blankLine();
      writer.writeLine('const resourceImporters = {');
      for (const { name, path } of plugins) {
        const absolutePath = resolve(srcPath, '..', path).replace(
          /\\/g,
          '/',
        );

        writer.writeLine(`  "${name}": () => import('${absolutePath}'),`);
      }
      writer.writeLine('};');
      writer.blankLine();
      writer.writeLine('export const languageResources = async () => {');
      writer.writeLine('  const entries = await Promise.all([');
      for (const { name } of plugins) {
        writer.writeLine(
          `    resourceImporters["${name}"]().then((mod) => ({ "${name}": { translation: mod.default } })),`,
        );
      }
      writer.writeLine('  ]);');
      writer.writeLine('  return Object.assign({}, ...entries);');
      writer.writeLine('};');
      writer.blankLine();
    },
    { overwrite: true },
  );

  return src.getText();
};
