import archiver from 'archiver';
import { spawnSync } from 'child_process';
import { Command } from 'commander';
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import luamin from 'luamin';
import path from 'path';
import { rimrafSync } from 'rimraf';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

import pkg from '../package.json' with { type: 'json' };
import { packAtlas } from './atlas/main.js';

type PackAtlasOptions = {
  project?: string;
};

type PackLoveOptions = {
  name?: string;
  project?: string;
};

type BuildProjectOptions = {
  clean?: boolean;
  bundle?: boolean;
  minify?: boolean;
  noAtlas?: boolean;
  project?: string;
};

function packLove({ name, project }: PackLoveOptions): void {
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
  void archive.finalize(); // Implement the packLove function here
}

function buildProject({ bundle, clean, minify, noAtlas, project }: BuildProjectOptions): boolean {
  project ??= 'tsconfig.json';

  if (clean) {
    rimrafSync(path.join(process.cwd(), 'export'));
  }

  if (!existsSync(path.join(process.cwd(), 'export'))) {
    mkdirSync(path.join(process.cwd(), 'export'));
  }

  if (!noAtlas) {
    process.stdout.write('Packing atlases...\n');
    packAtlas();
  }

  process.stdout.write('\nCopying assets...\n');
  if (existsSync(path.join(process.cwd(), 'assets'))) {
    cpSync(path.join(process.cwd(), 'assets'), path.join(process.cwd(), 'export/assets'), { recursive: true });
  }

  process.stdout.write('\nCompiling TypeScript to Lua...\n');

  let result;
  if (minify) {
    result = tstl.transpileProject(path.join(process.cwd(), project), {
      luaBundle: 'main.lua',
      luaBundleEntry: 'src/main.ts',
      noEmitOnError: true,
    });

    const mainLua = path.join(process.cwd(), 'export/main.lua');
    const data = readFileSync(mainLua, 'utf8');

    const minified = luamin.minify(data);
    writeFileSync(mainLua, minified);
  } else {
    if (bundle) {
      result = tstl.transpileProject(path.join(process.cwd(), project), {
        luaBundle: 'main.lua',
        luaBundleEntry: 'src/main.ts',
        noEmitOnError: true,
      });
    } else {
      result = tstl.transpileProject(path.join(process.cwd(), project), { noEmitOnError: true });
    }
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

function buildAndRun(options: BuildProjectOptions): void {
  if (buildProject(options)) {
    process.stdout.write('Running love2d.\n');
    spawnSync('love', ['export'], { stdio: 'inherit' });
    process.stdout.write('Finished running love2d.\n');
  }
}

const program = new Command();
program.name('Kami CLI').description('Command line tools for Kami').version(pkg.version);

const atlas = program.command('atlas');

atlas
  .command('pack')
  .description('Pack images into an atlas')
  .option('-p, --project <string>')
  .action(({ project }: PackAtlasOptions) => {
    packAtlas(project);
  });

program
  .command('.love')
  .description('Create a .love file from a folder')
  .option('-n --name <string>', 'The name of the .love file')
  .option('-p, --project <string>', 'The input folder. Defaults to export.')
  .action(packLove);

program
  .command('build')
  .description('Build the Lumi project')
  .option('-c, --clean', 'Clean the export directory')
  .option('--noAtlas', "Don't build the sprite atlas")
  .option('--minify', 'Minify the lua code for smaller file size')
  .option('-p --project <string>', 'The project tsconfig to use')
  .action((options: BuildProjectOptions) => {
    buildProject(options);
  });

program
  .command('run')
  .description('Build and run the Lumi project.')
  .option('-c, --clean', 'Clean the export directory.')
  .option('--noAtlas', "Don't build the sprite atlas.")
  .option('--minify', 'Minify the lua code for smaller file size')
  .option('-p --project <string>', 'The project tsconfig to use')
  .action((options: BuildProjectOptions) => {
    buildAndRun(options);
  });

program.parse();
