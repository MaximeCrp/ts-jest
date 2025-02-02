import { createDefaultEsmPreset } from 'ts-jest'

/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = {
  ...createDefaultEsmPreset({
    tsconfig: 'tsconfig-esm.json',
  }),
}

export default jestConfig
