const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=fs.readdirSync(root).filter(f=>f.endsWith('.test.cjs')||f==='test.cjs').sort();
for(const file of files){const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
console.log(`\n${files.length}개 테스트 파일 통과`);

// A green regression suite must not hide disconnected source values.
const numeric=spawnSync(process.execPath,[path.join(root,'scripts/audit-numeric-execution.cjs')],{cwd:root,stdio:'inherit'});
if(numeric.error)throw numeric.error;if(numeric.status!==0)process.exit(numeric.status||1);
