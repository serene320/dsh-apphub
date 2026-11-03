import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative, dirname } from 'node:path'
import ts from 'typescript'

// A small dependency guard, not a security sandbox or a replacement for review.
const root=resolve('src'),errors=[]
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(resolve(dir,entry.name)):[resolve(dir,entry.name)]))).flat()}
const fail=(file,message)=>errors.push(`${relative(process.cwd(),file)}: ${message}`)
for(const file of await files(root)) {
  const path=relative(root,file),source=await readFile(file,'utf8')
  if(path.endsWith('.css')){
    if(path!=='ui/appearance.css'&&/--dsw-[\w-]+\s*:/.test(source))fail(file,'Host token overrides belong only in ui/appearance.css')
    if(/(?:^|[{}])\s*(?:html|body|:root|\*)\s*[{,]/m.test(source))fail(file,'Do not style global host elements')
    continue
  }
  if(!/\.tsx?$/.test(path))continue
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  const ui=path.startsWith('ui/'),application=path.startsWith('application/'),contracts=path==='contracts.ts'
  function inspectImport(node,spec){
    const target=spec.startsWith('.')?relative(root,resolve(dirname(file),spec)):spec
    if((ui||application||contracts)&&target.startsWith('adapter/'))fail(file,`Forbidden adapter dependency: ${spec}`)
    if((application||contracts)&&(spec==='react'||spec.startsWith('@deepseek-ai/')||target.startsWith('ui/')))fail(file,`Business/contracts cannot import UI or host: ${spec}`)
    if(ui&&(spec.startsWith('node:')||(spec.startsWith('@deepseek-ai/')&&spec!=='@deepseek-ai/dsh-client-ui-primitives')))fail(file,`UI can only use the public primitives library: ${spec}`)
    if((ui||application||contracts)&&spec.includes('/lib/'))fail(file,'Generated host contracts belong in the adapter')
    if(application&&spec.startsWith('node:')&&!(path==='application/apphub-service.ts'&&spec==='node:crypto'))fail(file,`OS/storage dependency belongs in adapter: ${spec}`)
    if(contracts)fail(file,'contracts.ts must remain dependency-free')
  }
  function visit(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))inspectImport(node,node.moduleSpecifier.text)
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){const arg=node.arguments[0];if(arg&&ts.isStringLiteral(arg))inspectImport(node,arg.text);else if(ui||application||contracts)fail(file,'Dynamic computed import crosses the auditable boundary')}
    if((ui||application||contracts)&&ts.isIdentifier(node)&&['fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','indexedDB'].includes(node.text))fail(file,`Direct I/O is not allowed here: ${node.text}`)
    if(ui&&ts.isIdentifier(node)&&['document','window'].includes(node.text))fail(file,'Host DOM access belongs in adapter; use primitives for portals/focus')
    if(ui&&(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&['button','dialog','select'].includes(node.tagName.getText(tree)))fail(file,'Use the official control instead of a native button/dialog/select')
    ts.forEachChild(node,visit)
  }
  visit(tree)
}
if(errors.length){console.error([...new Set(errors)].join('\n'));process.exitCode=1}else console.log('AppHub dependency and theme boundaries passed.')
