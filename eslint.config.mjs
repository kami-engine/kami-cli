import { defineConfig, globalIgnores } from 'eslint/config';
import kamiConfig from '@kami-engine/eslint-config';

export default defineConfig([globalIgnores(['./dist/**', 'node_modules/**', 'eslint.config.mjs']), kamiConfig]);
