import TOML from '@ltd/j-toml';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import { KamiConfig } from '../../src/building/kamiConfig.js';

describe('KamiConfig', () => {
  it('should load the config', () => {
    const data = readFileSync('tests/building/testFiles/kami.toml');
    const config = TOML.parse(data.toString()) as KamiConfig;

    expect(config).toBeDefined();

    expect(config.outDir).toBe('export');
    expect(config.bundle).toBe(true);
    expect(config.minify).toBe(true);
    expect(config.noAtlas).toBe(false);

    expect(config.love).toBeDefined();
    expect(config.love?.version).toBe('11.4');
    expect(config.love?.identity).toBe('com.example.kami');
    expect(config.love?.appendidentity).toBe(true);
    expect(config.love?.console).toBe(true);
    expect(config.love?.accelerometerjoystick).toBe(true);
    expect(config.love?.externalstorage).toBe(true);
    expect(config.love?.gammacorrect).toBe(true);

    expect(config.love?.audio).toBeDefined();
    expect(config.love?.audio?.mic).toBe(true);
    expect(config.love?.audio?.mixwithsystem).toBe(true);

    expect(config.love?.modules).toBeDefined();
    expect(config.love?.modules?.audio).toBe(true);
    expect(config.love?.modules?.data).toBe(true);
    expect(config.love?.modules?.event).toBe(true);
    expect(config.love?.modules?.font).toBe(true);
    expect(config.love?.modules?.graphics).toBe(true);
    expect(config.love?.modules?.image).toBe(true);
    expect(config.love?.modules?.joystick).toBe(true);
    expect(config.love?.modules?.keyboard).toBe(true);
    expect(config.love?.modules?.mouse).toBe(true);
    expect(config.love?.modules?.physics).toBe(true);
    expect(config.love?.modules?.sound).toBe(true);
    expect(config.love?.modules?.system).toBe(true);
    expect(config.love?.modules?.timer).toBe(true);
    expect(config.love?.modules?.touch).toBe(true);
    expect(config.love?.modules?.window).toBe(true);
  });
});
