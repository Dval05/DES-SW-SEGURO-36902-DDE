import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const event=(listen,lines)=>({listen,script:{type:'text/javascript',exec:lines}});
const status=code=>`pm.test('HTTP ${code}',()=>pm.response.to.have.status(${code}));`;
function req(id,name,method,url,{token,body,file,expected=200,tests=[],before=[],description=''}={}){
 const request={method,header:[],url};
 if(token)request.header.push({key:'Authorization',value:`Bearer {{qa_${token}Jwt}}`});
 if(body){request.header.push({key:'Content-Type',value:'application/json'});request.body={mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}};}
 if(file)request.body={mode:'formdata',formdata:[{key:'file',type:'file',src:file,contentType:'image/png'}]};
 return {name:`${id} | ${name}`,description,request,event:[...(before.length?[event('prerequest',before)]:[]),event('test',[status(expected),...tests])]};
}
const auth='{{qa_authUrl}}',stego='{{qa_stegoUrl}}';
const png='samples/original/reference.png';
const login=role=>req(`SES-${role}`,`Login ${role.toUpperCase()}`,'POST',auth+'/api/auth/login',{body:{identity:`{{qa_${role}Identity}}`,password:`{{qa_${role}Password}}`},expected:201,tests:[`if(pm.response.code===201) pm.environment.set('qa_${role}Jwt',pm.response.json().access_token);`,`pm.test('JWT emitido y expiracion acotada',()=>{const j=pm.response.json();pm.expect(j.access_token).to.be.a('string');pm.expect(j.expires_in).to.be.within(1,3600);});`]});
const analyze=(id,name,file,expected=201,classification,token='analyst')=>req(id,name,'POST',stego+'/api/steganography/analyze',{token,file,expected,tests:classification?[`pm.test('Clasificacion ${classification}',()=>pm.expect(pm.response.json().status).to.eql('${classification}'));`,`pm.test('Trazabilidad del archivo',()=>{const j=pm.response.json();pm.expect(j.sha256).to.match(/^[a-f0-9]{64}$/);pm.expect(j).to.include.all.keys('id','user_id','technique','indicators','created_at','action','limitations');});`]:[]});
const items=[
 {name:'01 | Preparacion y sesiones',description:'Ejecutar primero. Los tokens quedan en el entorno QA, nunca en la coleccion exportada.',item:[
 req('INF-01','AUTH disponible','GET',auth+'/health'),req('INF-02','STEGO disponible','GET',stego+'/api/health'),login('admin'),login('analyst'),login('user'),
 req('SES-01','Perfil sin credenciales','GET',auth+'/api/auth/profile',{token:'analyst',tests:[`pm.test('Sin hash ni version de sesion',()=>{const j=pm.response.json();pm.expect(j).not.to.have.property('passwordHash');pm.expect(j).not.to.have.property('tokenVersion');});`]}),
 req('SET-01','Obtener usuarios e identificador ANALYST','GET',auth+'/api/users',{token:'admin',tests:[`const users=pm.response.json();const u=users.find(x=>x.username===pm.environment.get('qa_analystIdentity'));pm.test('ANALYST existe',()=>pm.expect(u).to.be.an('object'));if(u)pm.environment.set('qa_analystId',u.id);`]}),
 req('SET-02','Obtener rol ANALYST','GET',auth+'/api/roles',{token:'admin',tests:[`const role=pm.response.json().find(x=>x.rol==='ANALYST');pm.test('Rol ANALYST existe',()=>pm.expect(role).to.be.an('object'));if(role)pm.environment.set('qa_analystRoleId',role.id);`]}),
 req('SET-03','Obtener asignacion ANALYST','GET',auth+'/api/user-roles',{token:'admin',tests:[`const relation=pm.response.json().find(x=>x.userId===pm.environment.get('qa_analystId')&&x.roleId===pm.environment.get('qa_analystRoleId'));pm.test('Asignacion vigente',()=>pm.expect(relation).to.be.an('object'));if(relation)pm.environment.set('qa_assignmentId',relation.id);`]})]},
 {name:'02 | Validacion y contratos',item:[
 req('VAL-01','UUID invalido','GET',auth+'/api/users/bad-id',{token:'admin',expected:400}),
 req('VAL-02','Fecha invalida','PATCH',auth+'/api/users/{{qa_analystId}}',{token:'admin',body:{fechaNacimiento:'2026-02-30'},expected:400}),
 req('VAL-03','Null no permitido','PATCH',auth+'/api/users/{{qa_analystId}}',{token:'admin',body:{username:null},expected:400}),
 req('VAL-04','Conflicto de username','PATCH',auth+'/api/users/{{qa_analystId}}',{token:'admin',body:{username:'{{qa_adminIdentity}}'},expected:409}),
 req('VAL-05','Rechazar campo no permitido','PATCH',auth+'/api/users/{{qa_analystId}}',{token:'admin',body:{tokenVersion:0},expected:400}),
 req('OAS-01','Contrato AUTH utilizable','GET',auth+'/docs-json',{tests:[`pm.test('UpdateUserDto y UpdateRoleDto completos',()=>{const s=pm.response.json().components.schemas;pm.expect(s.UpdateUserDto.properties.username).to.be.an('object');pm.expect(s.UpdateRoleDto.properties.rol).to.be.an('object');});`]}),
 req('OAS-02','Contrato STEGO estructurado','GET',stego+'/docs-json',{tests:[`pm.test('Respuesta de analisis con esquema',()=>{const r=pm.response.json().paths['/api/steganography/analyze'].post.responses['201'];pm.expect(r.content['application/json'].schema.$ref).to.include('AnalysisResponseDto');});`]})]},
 {name:'03 | Autenticacion y permisos',item:[
 analyze('SEC-01','Sin JWT',png,401,undefined,undefined),
 req('SEC-02','JWT manipulado','POST',stego+'/api/steganography/analyze',{token:'tampered',file:png,expected:401,before:[`const token=pm.environment.get('qa_analystJwt');pm.environment.set('qa_tamperedJwt',token.slice(0,-8)+'invalid!');`]}),
 analyze('SEC-03','USER no puede analizar',png,403,undefined,'user'),
 req('SEC-04','Asignacion duplicada','POST',auth+'/api/user-roles',{token:'admin',body:{userId:'{{qa_analystId}}',roleId:'{{qa_analystRoleId}}'},expected:409}),
 req('SEC-05','Sin identidad de servicio','POST',auth+'/internal/authorization/check',{body:{subject_token:'{{qa_analystJwt}}',action:'steganography.analyze',resource_id:null},expected:401})]},
 {name:'04 | Imagenes y resultados',description:'Seleccionar archivos locales en Body si Postman no resuelve las rutas relativas. Directorio de trabajo: Codigo.',item:[
 {...analyze('IMG-01','PNG de referencia',png,201,'sin_indicios'),event:[event('test',[status(201),`const j=pm.response.json();pm.test('Referencia sin indicios',()=>pm.expect(j.status).to.eql('sin_indicios'));if(j.id)pm.environment.set('qa_analysisId',j.id);`])]},
 analyze('IMG-02','Carga LSB densa','samples/stego/lsb-random-payload.png',201,'sospechoso'),
 analyze('IMG-03','Ruido original ambiguo','samples/original/noisy-unmodified.png',201,'no_concluyente'),
 analyze('IMG-04','Carga dispersa: limitacion conocida','samples/stego/lsb-sparse-payload.png',201,'sin_indicios'),
 analyze('IMG-05','Archivo con firma incompatible','tmp/t10/jpeg-named-png.png',415),
 analyze('IMG-06','PNG corrupto','tmp/t10/corrupt.png',422),
 analyze('IMG-07','Carga excesiva','tmp/t10/oversized.png',413),
 req('RES-01','Leer resultado propio','GET',stego+'/api/steganography/results/{{qa_analysisId}}',{token:'analyst'}),
 req('RES-02','ADMIN puede consultar resultado','GET',stego+'/api/steganography/results/{{qa_analysisId}}',{token:'admin'})]},
 {name:'05 | Revocacion y restauracion',description:'Ejecutar completa y en orden. La ultima solicitud RESTAURA el permiso de demostracion. No interrumpir tras revocar.',item:[
 req('REV-01','Revocar ANALYST','DELETE',auth+'/api/user-roles/{{qa_assignmentId}}',{token:'admin'}),
 analyze('REV-02','Mismo JWT tras revocacion',png,403),
 req('REV-03','Restaurar ANALYST','POST',auth+'/api/user-roles',{token:'admin',body:{userId:'{{qa_analystId}}',roleId:'{{qa_analystRoleId}}'},expected:201,tests:[`if(pm.response.code===201)pm.environment.set('qa_assignmentId',pm.response.json().id);`]}),
 analyze('REV-04','Permiso restaurado',png,201,'sin_indicios')]},
 {name:'06 | Logout (ejecutar al final)',description:'Invalida la sesion ANALYST. Volver a preparar sesiones para repetir.',item:[
 req('SES-02','Logout','POST',auth+'/api/auth/logout',{token:'analyst',expected:201}),analyze('SES-03','JWT invalidado tras logout',png,401)]},
 {name:'MANUAL | AUTH no disponible',description:'NO incluir en un run completo. Detener AUTH desde terminal antes de enviar. Restaurar AUTH inmediatamente despues. Requiere JWT ADMIN vigente.',item:[analyze('DIS-01','Fallo seguro sin AUTH',png,503,undefined,'admin')]}
];
// SEC-01 deliberately has no authorization header.
items[2].item[0].request.header=[];
const collection={info:{_postman_id:'91f6ead4-56c1-4f5a-8d50-f129b6704108',name:'QA Backend V1 | Pre-commit y regresion | Nueva',description:'Coleccion nueva, independiente de la sustentacion anterior. Estado: preparada, pendiente de ejecucion en la GUI. No ejecutar la carpeta MANUAL dentro del Runner general. Credenciales y JWT solo en un entorno LOCAL; no exportarlos.',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:items};
const values=[['authUrl','https://localhost:3001'],['stegoUrl','http://localhost:3002'],['adminIdentity','admin'],['adminPassword',''],['analystIdentity','analyst'],['analystPassword',''],['userIdentity','user'],['userPassword',''],...['adminJwt','analystJwt','userJwt','tamperedJwt','analystId','analystRoleId','assignmentId','analysisId'].map(key=>[key,''])].map(([key,value])=>({key:'qa_'+key,value,enabled:true,type:/Password|Jwt/.test(key)?'secret':'default'}));
const env={id:'91f6ead4-56c1-4f5a-8d50-f129b6704109',name:'QA Backend V1 | LOCAL | Sin secretos',values,_postman_variable_scope:'environment'};
const out=resolve(root,'pruebas/postman-export');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'QA_Backend_V1.postman_collection.json'),JSON.stringify(collection,null,2)+'\n');
writeFileSync(resolve(out,'QA_Backend_V1.postman_environment.json'),JSON.stringify(env,null,2)+'\n');
console.log(`Coleccion nueva: ${items.reduce((n,f)=>n+f.item.length,0)} solicitudes; entorno exportado sin contrasenas ni JWT.`);
