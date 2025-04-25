import archiver from 'archiver';
import { spawnSync } from 'child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import luamin from 'luamin';
import path from 'path';
import { rimrafSync } from 'rimraf';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

import { packAtlas } from '../atlas/main.js';

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
   * Whether to clean the `export` folder before building. Defaults to `false`.
   */
  clean?: boolean;

  /**
   * Whether to bundle the project into a single Lua file. Defaults to `false`.
   */
  bundle?: boolean;

  /**
   * Whether to minify the output Lua code. Defaults to `false`.
   */
  minify?: boolean;

  /**
   * Whether to skip packing atlases. Defaults to `false`.
   */
  noAtlas?: boolean;

  /**
   * The path to the TypeScript project configuration file. Defaults to `tsconfig.json`.
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
 * @param bundle - Whether to bundle the project into a single Lua file.
 * @param clean - Whether to clean the `export` folder before building.
 * @param minify - Whether to minify the output Lua code.
 * @param noAtlas - Whether to skip packing atlases.
 * @param project - The path to the TypeScript project configuration file. Defaults to `tsconfig.json`.
 * @returns `true` if the build was successful, `false` otherwise.
 */
export function buildProject({ bundle, clean, minify, noAtlas, project }: BuildProjectOptions): boolean {
  project ??= 'tsconfig.json';

  if (clean) {
    process.stdout.write('Cleaning export folder...\n');
    rimrafSync(path.join(process.cwd(), 'export'));
  }

  if (!existsSync(path.join(process.cwd(), 'export'))) {
    mkdirSync(path.join(process.cwd(), 'export'));
  }

  if (!noAtlas) {
    process.stdout.write('Packing atlases...\n');
    try {
      packAtlas();
    } catch (error) {
      process.stdout.write(`Error: Failed to pack atlases: ${(error as Error).message}\n`);
      return false;
    }
  }

  process.stdout.write('\nCopying assets...\n');
  if (existsSync(path.join(process.cwd(), 'assets'))) {
    cpSync(path.join(process.cwd(), 'assets'), path.join(process.cwd(), 'export/assets'), { recursive: true });
  }

  process.stdout.write('\nCompiling TypeScript to Lua...\n');

  let result;
  try {
    if (minify) {
      result = tstl.transpileProject(path.join(process.cwd(), project), {
        luaBundle: 'main.lua',
        luaBundleEntry: 'src/main.ts',
        noEmitOnError: true,
      });

      // No errors while transpiling, minify the output.
      if (result.diagnostics.length === 0) {
        const mainLua = path.join(process.cwd(), 'export/main.lua');
        const data = readFileSync(mainLua, 'utf8');

        const minified = luamin.minify(data);
        writeFileSync(mainLua, minified);
      }
    } else {
      if (bundle) {
        result = tstl.transpileProject(path.join(process.cwd(), project), {
          luaBundle: 'main.lua',
          luaBundleEntry: 'src/main.ts',
          noEmitOnError: true,
        });
      } else {
        result = tstl.transpileProject(path.join(process.cwd(), project), {
          noEmitOnError: true,
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
