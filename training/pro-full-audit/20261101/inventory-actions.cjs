/* eslint-disable @typescript-eslint/no-require-imports -- read-only source inventory. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const walk = dir => fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir,entry.name)) : [path.join(dir,entry.name)]);
const rows=[];
for(const file of walk(path.join(root,'src')).filter(file=>/\.[tj]sx?$/.test(file))) {
  const source=fs.readFileSync(file,'utf8');
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const serverModule=ast.statements.some(node=>ts.isExpressionStatement(node)&&ts.isStringLiteral(node.expression)&&node.expression.text==='use server');
  if(!serverModule)continue;
  for(const node of ast.statements) {
    if(!node.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))continue;
    const declarations=ts.isFunctionDeclaration(node)?[node]:ts.isVariableStatement(node)?node.declarationList.declarations.filter(item=>item.initializer&&(ts.isArrowFunction(item.initializer)||ts.isFunctionExpression(item.initializer))):[];
    for(const declaration of declarations) {
      const snippet=declaration.getText(ast);
      const name=declaration.name?.getText(ast);
      if(!name)continue;
      const strings=(method)=>[...snippet.matchAll(new RegExp('\\.'+method+'\\(\\s*["\x27`]([^"\x27`]+)["\x27`]','g'))].map(match=>match[1]);
      rows.push({file:path.relative(root,file).replaceAll('\\','/'),name,line:ast.getLineAndCharacterOfPosition(declaration.getStart(ast)).line+1,tables:[...new Set(strings('from'))],rpc:[...new Set(strings('rpc'))],guards:[...new Set([...snippet.matchAll(/\b(require\w*(?:Workspace|Access|Role|Permission)|assert\w+|ensure\w+)\s*\(/g)].map(match=>match[1]))]});
    }
  }
}
rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
const data={date:new Date().toISOString(),scope:'Exported functions in use-server source modules. Tables, RPC and guard names are lexical observations only; inherited guards and external effects require functional tests.',actions:rows.length,files:new Set(rows.map(row=>row.file)).size,rows};
fs.writeFileSync(path.join(__dirname,'action-inventory.json'),JSON.stringify(data,null,2)+'\n');
const cell=value=>String(value).replaceAll('|','\\|');
const md=['# Inventaire des actions serveur','',`${data.actions} exports dans ${data.files} fichiers « use server ». Inventaire source, pas une certification de succès ni une analyse complète des permissions. Les appels indirects ne sont pas développés.`, '', '| Fichier | Fonction | Tables directes | RPC directs | Gardes nommées directes |','|---|---|---|---|---|',...rows.map(row=>`| ${cell(row.file)}:${row.line} | ${cell(row.name)} | ${cell(row.tables.join(', '))} | ${cell(row.rpc.join(', '))} | ${cell(row.guards.join(', '))} |`)];
fs.writeFileSync(path.join(__dirname,'ACTIONS.md'),md.join('\n')+'\n');
console.log(JSON.stringify({actions:data.actions,files:data.files}));
