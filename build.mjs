import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
await mkdir('lib', { recursive: true })
await build({ entryPoints: ['src/index.ts', 'src/import.ts', 'src/share.ts'], outdir: 'lib', platform: 'node', format: 'esm', bundle: true, packages: 'external', sourcemap: true, plugins: [{ name: 'official-converter', setup(build) { build.onResolve({ filter: /^@deepseek-ai\/dsh-deepseek-chat-import\/src\// }, args => ({ path: require.resolve(args.path) })) } }] })
const result = await build({ entryPoints: ['src/client.tsx'], platform: 'browser', format: 'cjs', bundle: true, packages: 'external', write: false })
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-plugin-deepseek-share-import",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`)
