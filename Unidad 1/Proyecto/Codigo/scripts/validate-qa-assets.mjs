import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
export function validateQaAssets(root){
 const yaml=createRequire(resolve(root,'auth/package.json'))('js-yaml');
 const base=resolve(root,'pruebas/postman-export');
 const collection=JSON.parse(readFileSync(resolve(base,'QA_Backend_V1.postman_collection.json'),'utf8'));
 const environment=JSON.parse(readFileSync(resolve(base,'QA_Backend_V1.postman_environment.json'),'utf8'));
 const expected=new Map();
 function walk(items){for(const item of items){if(item.item){walk(item.item);continue}
   if(!item.request?.url||!item.event?.some(e=>e.listen==='test'))throw new Error('Solicitud sin contrato o assertions: '+item.name);
   expected.set(item.name,item);
   for(const event of item.event??[])new Script(event.script.exec.join('\n'),{filename:item.name});
   if(item.request.body?.mode==='raw')JSON.parse(item.request.body.raw);
   for(const part of item.request.body?.formdata??[])if(part.type==='file'&&!existsSync(resolve(root,part.src))&&!part.src.startsWith('tmp/'))throw new Error('Muestra inexistente: '+part.src);
 }}
 walk(collection.item);
 const native=resolve(root,'pruebas/postman');let nativeCount=0;let nativeEnv=0;
 function files(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
   if(entry.name==='.postman')continue;
   const path=resolve(dir,entry.name);if(entry.isDirectory()){files(path);continue}
   if(!entry.name.endsWith('.yaml'))continue;
   const document=yaml.load(readFileSync(path,'utf8'),{schema:yaml.JSON_SCHEMA});
   if(entry.name.endsWith('.environment.yaml')){nativeEnv++;for(const variable of document.values??[])if(/Password|Jwt/.test(variable.key)&&variable.value)throw new Error('Entorno YAML con credenciales o JWT activos');}
   if(document?.$kind!=='http-request')continue;
   nativeCount++;const original=expected.get(document.name);
   if(!original||document.url!==original.request.url||document.method!==original.request.method)throw new Error('Diferencia entre solicitud YAML y export JSON: '+document.name);
   const scripts=document.scripts??[];
   for(const event of original.event??[]){const type=event.listen==='test'?'afterResponse':'beforeRequest';const nativeScript=scripts.find(s=>s.type===type);if(nativeScript?.code!==event.script.exec.join('\n'))throw new Error('Scripts YAML/JSON diferentes: '+document.name);new Script(nativeScript.code,{filename:path});}
   if(document.body?.type==='json')JSON.parse(document.body.content);
 }}
 files(native);
 for(const variable of environment.values)if(/Password|Jwt/.test(variable.key)&&variable.value)throw new Error('Entorno JSON con credenciales o JWT activos');
 if(nativeCount!==expected.size||nativeEnv!==1)throw new Error('Coleccion YAML incompleta o entorno ausente');
 console.log(`PASS QA: ${expected.size} solicitudes JSON/YAML equivalentes, scripts validos, entornos sin secretos.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))validateQaAssets(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
