import {validateQaAssets} from './validate-qa-assets.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, symlinkSync, unlinkSync, rmSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(args,options={})=>execFileSync('git',args,{cwd:source,encoding:'utf8',...options});
const repo=git(['rev-parse','--show-toplevel']).trim();
const project=relative(repo,source).split(sep).join('/');
const working=process.argv.includes('--working-tree');
const list=git(['diff','--cached','--name-only','--diff-filter=ACMR','-z']).split('\0').filter(Boolean);
if(!working&&!list.some(path=>path===project||path.startsWith(project+'/'))){console.log('Sin cambios preparados en Codigo: no se requiere esta suite.');process.exit(0)}
let snapshot;let testedTree;let folder=source;const results=[];
function run(label,command,args,cwd=folder){
  console.log(`\n[PRE-COMMIT] ${label}`);const start=Date.now();
  const result=spawnSync(command,args,{cwd,stdio:'inherit',env:process.env,shell:false});
  results.push({check:label,passed:!result.error&&result.status===0,durationMs:Date.now()-start});
  if(result.error||result.status!==0)throw new Error(`Fallo ${label}; commit bloqueado.`);
}
function scan(root,paths){
 for(const name of paths){
  const rel=relative(resolve(root,project),resolve(root,name)).split(sep).join('/');
  if(rel.startsWith('..'))continue;
  if(/(^|\/)\.env$|(^|\/)secrets\/|\.(?:key|p12|pfx|db|db-wal|db-shm)$/i.test(rel))throw new Error(`Archivo sensible o de ejecucion preparado: ${rel}`);
  const path=resolve(root,name);if(!existsSync(path))continue;
  const buffer=readFileSync(path);if(buffer.includes(0)||buffer.length>2000000)continue;
  const text=buffer.toString('utf8');
  if(/^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/m.test(text)||/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{64,}/.test(text))throw new Error(`Posible clave privada o JWT activo preparado: ${rel}`);
 }
}

try{
 if(!working){
   testedTree=git(['write-tree']).trim();
   snapshot=mkdtempSync(resolve(tmpdir(),'secure-backend-precommit-'));
   git(['checkout-index','--all',`--prefix=${snapshot.replaceAll('\\','/')}/`]);
   folder=resolve(snapshot,project);
   scan(snapshot,list);
   for(const app of ['auth','stego']){
     const installed=resolve(source,app,'node_modules');
     if(!existsSync(installed))throw new Error(`Faltan dependencias: npm ci --prefix ${app}`);
     for(const manifest of ['package.json','package-lock.json']){
       // Changes to scripts are fine; dependency lock must match the installed workspace.
       if(manifest==='package-lock.json'&&!readFileSync(resolve(folder,app,manifest)).equals(readFileSync(resolve(source,app,manifest))))throw new Error(`El lock de ${app} preparado no coincide con el instalado. Prepare el lock actualizado.`);
     }
     symlinkSync(installed,resolve(folder,app,'node_modules'),process.platform==='win32'?'junction':'dir');
     const buildInfo=resolve(folder,app,'tsconfig.build.tsbuildinfo');if(existsSync(buildInfo))unlinkSync(buildInfo);
   }
 }else{
   scan(repo,git(['ls-files','-z','--',project]).split('\0').filter(Boolean));
 }
 run('Sin errores de whitespace','git',['-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','diff',...(working?[]:['--cached']),'--check'],repo);
 validateQaAssets(folder);
 const npmCli=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 function npm(args){
   if(process.platform==='win32'){
     if(!existsSync(npmCli))throw new Error('No se encontro npm-cli.js junto a Node. Instale Node LTS con npm.');
     run('npm '+args.join(' '),process.execPath,[npmCli,...args]);
   }else{run('npm '+args.join(' '),'npm',args)}
 }
 for(const app of ['auth','stego']){
   const started=Date.now();console.log(`\n[PRE-COMMIT] ${app}: lint, build y unitarias`);
   npm(['run','lint','--prefix',app]);npm(['run','build','--prefix',app]);
   npm(['test','--prefix',app,...(app==='auth'?['--','--runInBand']:[])]);
   results.push({check:`${app}: lint/build/unit`,passed:true,durationMs:Date.now()-started});
 }
 run('Docker disponible (PostgreSQL temporal de e2e)','docker',['info','--format','{{.ServerVersion}}']);
 npm(['run','test:e2e','--prefix','auth','--','--runInBand']);
 npm(['run','test:e2e','--prefix','stego']);
 const tree=working?null:git(['write-tree']).trim();
 if(!working&&tree!==testedTree)throw new Error('El indice cambio durante las pruebas. Vuelva a ejecutar el control.');
 const report={timestamp:new Date().toISOString(),mode:working?'working-tree':'staged-snapshot',tree,passed:true,checks:results,postmanGui:'No ejecutado por este gate: ver PLAN_PRUEBAS_PRE_COMMIT.md'};
 const out=resolve(source,'tmp/precommit-result.json');mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('\nPASS: comprobaciones previas al commit aprobadas.');
}catch(error){console.error('\nBLOCK: '+error.message);process.exitCode=1}
finally{
 if(snapshot){
   // Remove junctions first, never follow them into the developer's node_modules.
   for(const app of ['auth','stego']){const link=resolve(snapshot,project,app,'node_modules');if(existsSync(link))rmSync(link,{recursive:false,force:true})}
   const target=realpathSync(snapshot);const allowed=realpathSync(tmpdir());
   if(target.startsWith(allowed+sep)&&relative(allowed,target).startsWith('secure-backend-precommit-'))rmSync(target,{recursive:true,force:true});
 }
}
