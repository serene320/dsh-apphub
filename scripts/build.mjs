import { build } from 'esbuild'
import { cp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { WorkspaceAnalyzer, FaceModelEmitter, writePackageArtifacts } from '@deepseek-ai/dsh-typert-generator'
import ts from 'typescript'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
// Upstream generator expects a workspace. Stage just this one package, never modify DSH.
const workspace = resolve('.build/typert')
const staged = resolve(workspace, 'packages/apphub')
await rm(workspace, { recursive: true, force: true })
await mkdir(staged, { recursive: true })
await symlink(resolve('node_modules'), resolve(workspace, 'node_modules'), 'dir')
await cp('src', resolve(staged, 'src'), { recursive: true })
const options = { types: ['node'], target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, allowImportingTsExtensions: true, noEmit: true, ignoreDeprecations: '6.0' }
await writeFile(resolve(staged, 'package.json'), JSON.stringify(manifest))
await writeFile(resolve(staged, 'tsconfig.host.json'), JSON.stringify({ compilerOptions: options, include: ['src/adapter/host/**/*.ts', 'src/application/hub.ts', 'src/contracts.ts'] }))
await writeFile(resolve(workspace, 'tsconfig.host.json'), JSON.stringify({ compilerOptions: options, include: ['packages/apphub/src/adapter/host/**/*.ts'], references: [{ path: './packages/apphub/tsconfig.host.json' }] }))
// The upstream analyzer recognizes protocol symbols only from registered projects.
// Stage the installed official declarations, without vendoring or editing them.
const protocolRoot = resolve(workspace, 'packages/protocol')
await mkdir(protocolRoot, { recursive: true })
await cp('node_modules/@deepseek-ai/dsh-typert-protocol/lib/types', resolve(protocolRoot, 'src'), { recursive: true })
await writeFile(resolve(protocolRoot, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-typert-protocol', type: 'module', exports: { '.': './src/index.d.ts' } }))
await writeFile(resolve(protocolRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: options, include: ['src/**/*.d.ts'] }))
const generationOptions = { ...options, paths: { '@deepseek-ai/dsh-typert-protocol': ['./packages/protocol/src/index.d.ts'] } }
await writeFile(resolve(workspace, 'tsconfig.host.json'), JSON.stringify({ compilerOptions: generationOptions, include: ['packages/apphub/src/adapter/host/**/*.ts'], references: [{ path: './packages/apphub/tsconfig.host.json' }, { path: './packages/protocol/tsconfig.json' }] }))
const model = new WorkspaceAnalyzer({ root: workspace, packages: ['dsh-apphub'], faces: ['host'] }).analyze()
const artifacts = model.faces.map(face => ({ ...new FaceModelEmitter(face).emit('dsh-apphub'), packageRoot: 'packages/apphub' }))
if (!artifacts.some(a => a.remote)) throw new Error('No Remote contribution generated')
writePackageArtifacts(root, artifacts)
for (const face of ['host', 'client']) execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `tsconfig.${face}.json`, '--noEmit', 'false', '--declaration', '--emitDeclarationOnly', '--outDir', 'lib/types', '--rootDir', 'src'], { stdio: 'inherit' })
await writeFile('lib/contracts.js', 'export {};\n')
await build({ entryPoints: ['src/adapter/host/index.ts'], outfile: 'lib/index.js', bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24', plugins: [{ name: 'standard-decorators', setup(b) { b.onLoad({ filter: /\.ts$/ }, async ({ path }) => ({ contents: ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext } }).outputText, loader: 'js', resolveDir: resolve(path, '..') })) } }] })
await build({ entryPoints: ['src/adapter/client/index.tsx'], outfile: 'lib/client.js', bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', external: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis', 'zod', '@deepseek-ai/dsh-client-ui-primitives'], loader: { '.css': 'text' }, banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` }, footer: { js: 'return module.exports;}});' } })
console.log('Built Host, generated Remote contract, and Client bundle.')
