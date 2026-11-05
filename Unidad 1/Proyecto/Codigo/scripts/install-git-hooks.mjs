import { execFileSync } from 'node:child_process';
import { dirname,resolve,relative,sep } from 'node:path';
import { chmodSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const repo=git(['rev-parse','--show-toplevel']);
const hooks=relative(repo,resolve(root,'.githooks')).split(sep).join('/');
let current='';try{current=git(['config','--get','core.hooksPath'])}catch{}
const legacy=resolve(repo,git(['rev-parse','--git-path','hooks/pre-commit']));
if((current&&current!==hooks)||(!current&&existsSync(legacy)))throw new Error('Ya existe un hook o hooksPath. Integrarlo manualmente para no sobrescribirlo.');
chmodSync(resolve(root,'.githooks/pre-commit'),0o755);
git(['config','--local','core.hooksPath',hooks]);console.log('Hook local pre-commit habilitado: '+hooks);
