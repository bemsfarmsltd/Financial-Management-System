#!/usr/bin/env python3
"""Package the committed web release; never include environment files or local builds."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);parser.add_argument('--downloads-manifest');args=parser.parse_args()
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',commit],cwd=ROOT,text=True).splitlines()
 roots={'package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.js','tailwind.config.js','server.js','ecosystem.config.js'}
 scripts={'run-typescript.cjs','process-outbox.ts','process-wallet-transfers.ts','reconcile-wallet.ts','wallet-preflight.ts','preflight-corrections.ts'}
 files={p for p in tracked if p in roots or p.startswith(('src/','prisma/')) or (p.startswith('scripts/') and Path(p).name in scripts) or (p.startswith('public/') and not p.startswith(('public/downloads/','public/gmd-app/')) and Path(p).name!='.DS_Store')}
 # Preserve the existing browser entry point and download aliases; do not imply
 # that unchanged native binaries are newly signed releases.
 for p in (ROOT/'public/gmd-app').rglob('*'):
  if p.is_file() and not p.is_symlink() and p.name!='.DS_Store':files.add(p.relative_to(ROOT).as_posix())
 downloads={'gmd-app.apk','staff-app.apk'}
 if args.downloads_manifest:
  for row in json.loads(Path(args.downloads_manifest).read_text()):
   for name in [row.get('fileName',''),Path(row.get('downloadUrl','')).name]:
    if name and name==Path(name).name and name.lower().endswith('.apk'):downloads.add(name)
 missing=[]
 for name in sorted(downloads):
  path=ROOT/'public/downloads'/name
  if path.is_file():files.add(path.relative_to(ROOT).as_posix())
  else:missing.append(name)
 # Scan against configured private values without printing those values.
 secrets={}
 for envfile in ['.env','.env.local']:
  p=ROOT/envfile
  if not p.exists():continue
  for line in p.read_text().splitlines():
   m=re.match(r'^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$',line)
   if not m:continue
   name,value=m.groups();value=value.strip().strip('"\'')
   if re.search(r'SECRET|TOKEN|PASSWORD|API_KEY|SMTP_PASS|DATABASE_URL|DIRECT_URL',name) and len(value)>=12:secrets[name]=value.encode()
 output=Path(args.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
 if output.exists():raise RuntimeError('Preserve the existing release archive; select a new output path.')
 manifest={'sourceCommit':commit,'contents':'Web source; Hostinger installs dependencies and builds on Linux.','unchangedDownloadFiles':[],'missingLegacyReleaseFiles':missing,'files':{}}
 try:
  with zipfile.ZipFile(output,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
   for rel in sorted(files):
    path=ROOT/rel
    if path.is_symlink() or any(x in {'.git','node_modules','.next','.private-release-backups','__pycache__'} or x.startswith('.env') for x in path.relative_to(ROOT).parts):raise RuntimeError('Unsafe archive member: '+rel)
    data=path.read_bytes()
    for key,value in secrets.items():
     if value in data:raise RuntimeError('Configured credential detected in '+rel+' ('+key+').')
    archive.writestr(rel,data)
    manifest['files'][rel]=hashlib.sha256(data).hexdigest()
    if rel.startswith('public/downloads/'):manifest['unchangedDownloadFiles'].append(rel)
   archive.writestr('RELEASE-MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
  with zipfile.ZipFile(output) as archive:
   assert archive.testzip() is None
   assert 'package.json' in archive.namelist() and 'src/app/api/meta/features/route.ts' in archive.namelist()
 except Exception:
  output.unlink(missing_ok=True);raise
 digest=hashlib.sha256(output.read_bytes()).hexdigest()
 output.with_suffix('.sha256').write_text(digest+'  '+output.name+'\n')
 print(json.dumps({'archive':str(output),'sourceCommit':commit,'files':len(files),'sizeMiB':round(output.stat().st_size/1024/1024,2),'sha256':digest,'missingLegacyReleaseFiles':missing,'credentialsIncluded':False,'dependenciesIncluded':False},indent=2))
if __name__=='__main__':main()
