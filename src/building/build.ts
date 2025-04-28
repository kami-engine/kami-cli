import TOML from '@ltd/j-toml';
import archiver from 'archiver';
import { spawnSync } from 'child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import luamin from 'luamin';
import path from 'path';
import { rimrafSync } from 'rimraf';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

import { packAtlas } from '../atlas/main.js';
import { KamiConfig } from './kamiConfig.js';

export type PackLoveOptions = {
  /**
   * The name of the output `.love` file. Defaults to `game.love`.
   */
  name?: string;

  /**
   * The path to the Love2D game project folder. Defaults to `export`.
   */
  project?: string;
};

export type BuildProjectOptions = {
  /**
   * Whether to clean the `out` folder before building. Defaults to `false`.
   */
  clean?: boolean;

  /**
   * The path to the Kami project folder. Defaults to the current folder.
   */
  project?: string;
};

/**
 * Creates a `.love` archive for the Love2D game.
 * @param name - The name of the output `.love` file. Defaults to `game.love`.
 * @param project - The path to the Love2D game project folder. Defaults to `export`.
 */
export function packLove({ name, project }: PackLoveOptions): void {
  let destination = name ? name : 'game';
  if (!destination.endsWith('.love')) {
    destination += '.love';
  }

  const outPath = path.join(process.cwd(), destination);
  const output = createWriteStream(outPath);

  const source = project ? project : 'export';

  const archive = archiver('zip');
  archive.pipe(output);

  archive.directory(source, false);

  try {
    void archive.finalize();
    process.stdout.write(`Packed .love file saved to: ${outPath}\n`);
  } catch (error) {
    process.stdout.write(`Error: Failed to create .love file: ${(error as Error).message}\n`);
  }
}

/**
 * Builds the TypeScript project into Lua code and copies all assets.
 * @param clean - Whether to clean the `export` folder before building.
 * @param project - The path to the Kami project folder. Defaults to the current folder.
 * @returns `true` if the build was successful, `false` otherwise.
 */
export function buildProject({ clean, project }: BuildProjectOptions): boolean {
  let projectPath = process.cwd();
  if (project) {
    if (path.isAbsolute(project)) {
      projectPath = project;
    } else {
      projectPath = path.join(process.cwd(), project);
    }
  }
  process.chdir(projectPath);

  const configPath = path.join(projectPath, 'kami.toml');

  if (!existsSync(configPath)) {
    process.stdout.write(`Error: kami.toml not found in ${projectPath}\n`);
    return false;
  }

  const data = readFileSync(configPath);
  const config = TOML.parse(data.toString(), 1, undefined, false) as KamiConfig;

  const outPath = path.join(projectPath, config.outDir ? config.outDir : 'export');
  if (clean) {
    process.stdout.write('Cleaning output folder...\n');
    rimrafSync(outPath);
  }

  if (!existsSync(outPath)) {
    mkdirSync(outPath, { recursive: true });
  }

  if (!config.noAtlas) {
    process.stdout.write('Packing atlases...\n');
    try {
      packAtlas(configPath);
    } catch (error) {
      process.stdout.write(`Error: Failed to pack atlases: ${(error as Error).message}\n`);
      return false;
    }
  }

  process.stdout.write('\nCopying assets...\n');
  if (existsSync(path.join(projectPath, 'assets'))) {
    cpSync(path.join(projectPath, 'assets'), path.join(outPath, 'assets'), { recursive: true });
  }

  process.stdout.write('Creating conf.lua...\n');
  const confLua = buildConfLua(config);
  if (confLua) {
    const confLuaPath = path.join(outPath, 'conf.lua');
    writeFileSync(confLuaPath, confLua);
  }

  process.stdout.write('\nCompiling TypeScript to Lua...\n');

  let result;
  try {
    if (config.minify) {
      result = tstl.transpileProject(path.join(projectPath, 'tsconfig.json'), {
        luaBundle: 'main.lua',
        luaBundleEntry: 'src/main.ts',
        noEmitOnError: true,
        outDir: outPath,
      });

      // No errors while transpiling, minify the output.
      if (result.diagnostics.length === 0) {
        const mainLua = path.join(outPath, 'main.lua');
        const data = readFileSync(mainLua, 'utf8');

        const minified = luamin.minify(data);
        writeFileSync(mainLua, minified);
      }
    } else {
      if (config.bundle) {
        result = tstl.transpileProject(path.join(projectPath, 'tsconfig.json'), {
          luaBundle: 'main.lua',
          luaBundleEntry: 'src/main.ts',
          noEmitOnError: true,
          outDir: outPath,
        });
      } else {
        result = tstl.transpileProject(path.join(projectPath, 'tsconfig.json'), {
          noEmitOnError: true,
          outDir: outPath,
        });
      }
    }
  } catch (error) {
    process.stdout.write(`Error: Failed to transpile TypeScript to Lua: ${(error as Error).message}\n`);
    return false;
  }

  const reportDiagnostic = tstl.createDiagnosticReporter(true);
  const diagnostics = ts.sortAndDeduplicateDiagnostics(result.diagnostics);
  diagnostics.forEach(reportDiagnostic);

  const success = result.diagnostics.length === 0;
  if (success) {
    process.stdout.write('Build complete.\n');
  } else {
    process.stdout.write('Build failed.\n');
  }

  return success;
}

/**
 * Build the project and run it using love2d.
 * @param options - The build options. See the build function for details.
 */
export function buildAndRun(options: BuildProjectOptions): void {
  if (buildProject(options)) {
    process.stdout.write('Running Love2D...\n');
    spawnSync('love', ['export'], { stdio: 'inherit' });
    process.stdout.write('Finished running Love2D.\n');
  }
}

/**
 * Build the Love2D configuration code (conf.lua) from the provided configuration object.
 * @param config - The configuration object containing the Love2D settings.
 * @returns The lua code for the Love2D configuration.
 */
export function buildConfLua(config: KamiConfig): string {
  const loveConfig = config.love;
  if (!loveConfig) {
    return '';
  }

  let confLua = `function love.conf(config)\n`;

  const prefixes = ['config'];
  for (const loveKey in loveConfig) {
    if (!Object.prototype.hasOwnProperty.call(loveConfig, loveKey)) {
      continue;
    }

    confLua += addKeyAndValue(loveKey, loveConfig, prefixes);
  }
  confLua += 'end\n';

  return confLua;
}

/**
 * Add key and value pair to the configuration string.
 * @param key - The key to add.
 * @param item - The item containing the key.
 * @param prefixes - The prefixes to use for the key. (e.g., "config.window").
 * @returns The configuration line as a string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addKeyAndValue(key: string, item: any, prefixes: string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const value = item[key];
  if (value === undefined) {
    return '';
  }

  let configLine = `  ${prefixes.join('.')}.${key} = `;
  if (typeof value === 'object') {
    configLine = '\n';
    prefixes.push(key);
    for (const subKey in value) {
      if (!Object.prototype.hasOwnProperty.call(value, subKey)) {
        continue;
      }

      configLine += addKeyAndValue(subKey, value, prefixes);
    }
    prefixes.pop();
  } else if (typeof value === 'string') {
    configLine += `"${value}"\n`;
  } else if (typeof value === 'number') {
    configLine += `${value}\n`;
  } else if (typeof value === 'boolean') {
    configLine += `${value ? 'true' : 'false'}\n`;
  } else {
    configLine += `nil\n`;
  }

  return configLine;
}
