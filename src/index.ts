import { Command } from 'commander';

import { packAtlas } from './atlas/main.js';
import { buildAndRun, buildProject, BuildProjectOptions, packLove } from './building/build.js';

type PackAtlasOptions = {
  project?: string;
};

const program = new Command();
program.name('Kami CLI').description('Command line tools for Kami').version('0.1.0');

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
