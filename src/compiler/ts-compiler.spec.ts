import { readFileSync } from 'fs'
import { join } from 'path'

import { LogLevels } from 'bs-logger'

import { createConfigSet, makeCompiler } from '../__helpers__/fakers'
import { logTargetMock } from '../__helpers__/mocks'
import { mockFolder } from '../__helpers__/path'
import ProcessedSource from '../__helpers__/processed-source'

import { TsCompiler } from './ts-compiler'

const logTarget = logTargetMock()

describe('TsCompiler', () => {
  describe('isolatedModule true', () => {
    const baseTsJestConfig = {
      isolatedModules: true,
    }

    test('should transpile code with useESM true', () => {
      const compiler = makeCompiler({
        tsJestConfig: { ...baseTsJestConfig, useESM: true },
      })
      const fileName = join(mockFolder, 'thing.spec.ts')

      const compiledOutput = compiler.getCompiledOutput(readFileSync(fileName, 'utf-8'), fileName, true)

      expect(new ProcessedSource(compiledOutput, fileName).outputCodeWithoutMaps).toMatchSnapshot()
    })

    test('should compile js file for allowJs true', () => {
      const fileName = 'foo.js'
      const compiler = makeCompiler({
        tsJestConfig: { ...baseTsJestConfig, tsconfig: { allowJs: true } },
      })
      const source = 'export default 42'

      const compiledOutput = compiler.getCompiledOutput(source, fileName, false)

      expect(new ProcessedSource(compiledOutput, fileName).outputCodeWithoutMaps).toMatchSnapshot()
    })

    describe('jsx option', () => {
      const fileName = 'foo.tsx'
      const source = `
        const App = () => {
          return <>Test</>
        }
      `

      it('should compile tsx file for jsx preserve', () => {
        const compiler = makeCompiler({
          tsJestConfig: {
            ...baseTsJestConfig,
            tsconfig: {
              jsx: 'preserve' as any,
            },
          },
        })
        const compiledOutput = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiledOutput, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      })

      it('should compile tsx file for other jsx options', () => {
        const compiler = makeCompiler({
          tsJestConfig: {
            ...baseTsJestConfig,
            tsconfig: {
              jsx: 'react' as any,
            },
          },
        })
        const compiledOutput = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiledOutput, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      })
    })

    describe('source maps', () => {
      const source = 'const f = (v: number) => v\nconst t: number = f(5)'
      const fileName = 'test-source-map-transpiler.ts'

      it('should have correct source maps without mapRoot', () => {
        const compiler = makeCompiler({ tsJestConfig: { ...baseTsJestConfig, tsconfig: false } })
        const compiledOutput = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiledOutput, fileName).outputSourceMaps).toMatchObject({
          file: fileName,
          sources: [fileName],
          sourcesContent: [source],
        })
      })

      it('should have correct source maps with mapRoot', () => {
        const compiler = makeCompiler({
          tsJestConfig: {
            ...baseTsJestConfig,
            tsconfig: {
              mapRoot: './',
            },
          },
        })
        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputSourceMaps).toMatchObject({
          file: fileName,
          sources: [fileName],
          sourcesContent: [source],
        })
      })
    })

    describe('diagnostics', () => {
      it('should not report diagnostics related to typings', () => {
        const compiler = makeCompiler({ tsJestConfig: { ...baseTsJestConfig, tsconfig: false } })

        expect(() =>
          compiler.getCompiledOutput(
            `
const f = (v: number) => v
const t: string = f(5)
const v: boolean = t
`,
            'foo.ts',
            false,
          ),
        ).not.toThrowError()
      })

      it('should report diagnostics related to codes with exclude config is undefined', () => {
        const compiler = makeCompiler({ tsJestConfig: { ...baseTsJestConfig, tsconfig: false } })

        expect(() =>
          compiler.getCompiledOutput(
            `
const f = (v: number) = v
const t: string = f(5)
`,
            'foo.ts',
            false,
          ),
        ).toThrowErrorMatchingSnapshot()
      })

      it('should report diagnostics related to codes with exclude config matches file name', () => {
        const compiler = makeCompiler({
          tsJestConfig: { ...baseTsJestConfig, tsconfig: false, diagnostics: { exclude: ['foo.ts'] } },
        })

        expect(() =>
          compiler.getCompiledOutput(
            `
const f = (v: number) = v
const t: string = f(5)
`,
            'foo.ts',
            false,
          ),
        ).toThrowErrorMatchingSnapshot()
      })

      it('should not report diagnostics related to codes with exclude config does not match file name', () => {
        const compiler = makeCompiler({
          tsJestConfig: { ...baseTsJestConfig, tsconfig: false, diagnostics: { exclude: ['bar.ts'] } },
        })

        expect(() =>
          compiler.getCompiledOutput(
            `
const f = (v: number) = v
const t: string = f(5)
`,
            'foo.ts',
            false,
          ),
        ).not.toThrowError()
      })
    })

    test('should use correct custom AST transformers', () => {
      // eslint-disable-next-line no-console
      console.log = jest.fn()
      const fileName = 'foo.js'
      const compiler = makeCompiler({
        tsJestConfig: {
          ...baseTsJestConfig,
          tsconfig: {
            allowJs: true,
          },
          astTransformers: {
            before: ['dummy-transformer'],
            after: ['dummy-transformer'],
            afterDeclarations: ['dummy-transformer'],
          },
        },
      })
      const source = 'export default 42'

      compiler.getCompiledOutput(source, fileName, false)

      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(3)
    })
  })

  describe('isolatedModule false', () => {
    const baseTsJestConfig = { tsconfig: require.resolve('../../tsconfig.spec.json') }
    const jestCacheFS = new Map<string, string>()

    beforeEach(() => {
      logTarget.clear()
    })

    test('should compile codes with useESM true', () => {
      const compiler = new TsCompiler(
        createConfigSet({
          tsJestConfig: {
            ...baseTsJestConfig,
            useESM: true,
            tsconfig: {
              esModuleInterop: false,
              allowSyntheticDefaultImports: false,
            },
          },
        }),
        new Map(),
      )
      const fileName = join(mockFolder, 'thing.spec.ts')

      const compiledOutput = compiler.getCompiledOutput(readFileSync(fileName, 'utf-8'), fileName, true)

      expect(new ProcessedSource(compiledOutput, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      // @ts-expect-error _compilerOptions is a private property
      expect(compiler._compilerOptions.esModuleInterop).toEqual(true)
      // @ts-expect-error _compilerOptions is a private property
      expect(compiler._compilerOptions.allowSyntheticDefaultImports).toEqual(true)
      // @ts-expect-error _initialCompilerOptions is a private property
      expect(compiler._initialCompilerOptions.esModuleInterop).not.toEqual(true)
      // @ts-expect-error _initialCompilerOptions is a private property
      expect(compiler._initialCompilerOptions.allowSyntheticDefaultImports).not.toEqual(true)
    })

    describe('allowJs option', () => {
      const fileName = 'test-allow-js.js'
      const source = 'export default 42'
      jestCacheFS.set(fileName, source)

      it('should compile js file for allowJs true with outDir', () => {
        const compiler = makeCompiler(
          {
            tsJestConfig: { tsconfig: { allowJs: true, outDir: '$$foo$$' } },
          },
          jestCacheFS,
        )

        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      })

      it('should compile js file for allowJs true without outDir', () => {
        const compiler = makeCompiler(
          {
            tsJestConfig: { tsconfig: { allowJs: true } },
          },
          jestCacheFS,
        )
        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      })
    })

    describe('jsx option', () => {
      const fileName = 'test-jsx.tsx'
      const source = `
        const App = () => {
          return <>Test</>
        }
      `
      jestCacheFS.set(fileName, source)

      it('should compile tsx file for jsx preserve', () => {
        const compiler = makeCompiler(
          {
            tsJestConfig: {
              tsconfig: {
                jsx: 'preserve' as any,
              },
            },
          },
          jestCacheFS,
        )

        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      })

      it('should compile tsx file for other jsx options', () => {
        const compiler = makeCompiler(
          {
            tsJestConfig: {
              tsconfig: {
                jsx: 'react' as any,
              },
            },
          },
          jestCacheFS,
        )
        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputCodeWithoutMaps).toMatchSnapshot()
      })
    })

    describe('source maps', () => {
      const source = 'const gsm = (v: number) => v\nconst h: number = gsm(5)'
      const fileName = 'test-source-map.ts'
      jestCacheFS.set(fileName, source)

      it('should have correct source maps without mapRoot', () => {
        const compiler = makeCompiler(
          { tsJestConfig: { tsconfig: require.resolve('../../tsconfig.spec.json') } },
          jestCacheFS,
        )
        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputSourceMaps).toMatchObject({
          file: fileName,
          sources: [fileName],
          sourcesContent: [source],
        })
      })

      it('should have correct source maps with mapRoot', () => {
        const compiler = makeCompiler(
          {
            tsJestConfig: {
              tsconfig: {
                mapRoot: './',
              },
            },
          },
          jestCacheFS,
        )
        const compiled = compiler.getCompiledOutput(source, fileName, false)

        expect(new ProcessedSource(compiled, fileName).outputSourceMaps).toMatchObject({
          file: fileName,
          sources: [fileName],
          sourcesContent: [source],
        })
      })
    })

    describe('module resolution', () => {
      it(`should use moduleResolutionCache`, () => {
        jest.unmock('typescript')
        const ts = require('typescript')
        const moduleResolutionCacheMock = (ts.createModuleResolutionCache = jest.fn().mockImplementation(() => {}))

        makeCompiler({
          tsJestConfig: baseTsJestConfig,
        })

        expect(moduleResolutionCacheMock).toHaveBeenCalled()
        expect(moduleResolutionCacheMock.mock.calls[0].length).toBe(3)

        moduleResolutionCacheMock.mockRestore()
      })
    })

    describe('getResolvedModulesMap', () => {
      const fileName = 'foo.ts'
      const fileContent = 'const foo = 1'

      test('should return undefined when file name is not known to compiler', () => {
        const compiler = makeCompiler({
          tsJestConfig: baseTsJestConfig,
        })

        expect(compiler.getResolvedModulesMap(fileContent, fileName)).toBeUndefined()
      })

      test('should return undefined when it is isolatedModules true', () => {
        const compiler = makeCompiler({
          tsJestConfig: {
            ...baseTsJestConfig,
            isolatedModules: true,
          },
        })

        expect(compiler.getResolvedModulesMap(fileContent, fileName)).toBeUndefined()
      })

      test('should return undefined when file has no resolved modules', () => {
        const jestCacheFS = new Map<string, string>()
        jestCacheFS.set(fileName, fileContent)
        const compiler = makeCompiler(
          {
            tsJestConfig: baseTsJestConfig,
          },
          jestCacheFS,
        )

        expect(compiler.getResolvedModulesMap(fileContent, fileName)).toBeUndefined()
      })

      test('should return resolved modules when file has resolved modules', () => {
        const jestCacheFS = new Map<string, string>()
        const fileContentWithModules = readFileSync(join(__dirname, '..', '__mocks__', 'thing.spec.ts'), 'utf-8')
        jestCacheFS.set(fileName, fileContentWithModules)
        const compiler = makeCompiler(
          {
            tsJestConfig: baseTsJestConfig,
          },
          jestCacheFS,
        )

        expect(compiler.getResolvedModulesMap(fileContentWithModules, fileName)).toBeDefined()
      })
    })

    describe('diagnostics', () => {
      const importedFileName = require.resolve('../__mocks__/thing.ts')
      const importedFileContent = readFileSync(importedFileName, 'utf-8')

      it(`shouldn't report diagnostics when file name doesn't match diagnostic file pattern`, () => {
        jestCacheFS.set(importedFileName, importedFileContent)
        const compiler = makeCompiler(
          {
            tsJestConfig: {
              ...baseTsJestConfig,
              diagnostics: { exclude: ['foo.spec.ts'] },
            },
          },
          jestCacheFS,
        )

        expect(() => compiler.getCompiledOutput(importedFileContent, importedFileName, false)).not.toThrowError()
      })

      it(`shouldn't report diagnostic when processing file isn't used by any test files`, () => {
        jestCacheFS.set('foo.ts', importedFileContent)
        const compiler = makeCompiler(
          {
            tsJestConfig: baseTsJestConfig,
          },
          jestCacheFS,
        )
        logTarget.clear()

        compiler.getCompiledOutput(importedFileContent, 'foo.ts', false)

        expect(logTarget.filteredLines(LogLevels.debug, Infinity)).toMatchSnapshot()
      })

      it('should throw error when cannot compile', () => {
        const fileName = 'test-cannot-compile.d.ts'
        const source = `
        interface Foo {
          a: string
        }
      `
        jestCacheFS.set(fileName, source)
        const compiler = makeCompiler(
          {
            tsJestConfig: baseTsJestConfig,
          },
          jestCacheFS,
        )

        expect(() => compiler.getCompiledOutput(source, fileName, false)).toThrowErrorMatchingSnapshot()
      })
    })

    test('should pass Program instance into custom transformers', () => {
      // eslint-disable-next-line no-console
      console.log = jest.fn()
      const fileName = join(mockFolder, 'thing.spec.ts')
      const compiler = makeCompiler(
        {
          tsJestConfig: {
            ...baseTsJestConfig,
            astTransformers: {
              before: ['dummy-transformer'],
              after: ['dummy-transformer'],
              afterDeclarations: ['dummy-transformer'],
            },
          },
        },
        jestCacheFS,
      )

      compiler.getCompiledOutput(readFileSync(fileName, 'utf-8'), fileName, false)

      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalled()
      // eslint-disable-next-line no-console
      expect(((console.log as any) as jest.MockInstance<any, any>).mock.calls[0][0].emit).toBeDefined()
    })
  })
})
