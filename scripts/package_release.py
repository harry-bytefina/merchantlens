from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root=Path(__file__).resolve().parents[1]
out=root.parent/'output/tencent_ai_project'
out.mkdir(parents=True,exist_ok=True)
allowed=['src','server','tests','scripts','docs','public','.github']
top=['package.json','package-lock.json','tsconfig.json','tsconfig.core.json','vite.config.ts','index.html','README.md','CHANGELOG.md','.editorconfig','.prettierrc.json','.prettierignore','.gitignore','.env.example']
with ZipFile(out/'MerchantLens_源码与产品材料.zip','w',ZIP_DEFLATED) as z:
    for name in top:
        path=root/name
        if path.is_file():z.write(path,Path('merchantlens')/path.relative_to(root))
    for directory in allowed:
        for path in (root/directory).rglob('*'):
            if path.is_file() and path.name not in ['.DS_Store','.env','.env.local']:
                z.write(path,Path('merchantlens')/path.relative_to(root))
with ZipFile(out/'MerchantLens_静态部署包.zip','w',ZIP_DEFLATED) as z:
    for path in (root/'dist').rglob('*'):
        if path.is_file():z.write(path,path.relative_to(root/'dist'))
(out/'MerchantLens_产品评审.pdf').write_bytes((root/'public/artifacts/MerchantLens_产品评审.pdf').read_bytes())
(out/'MerchantLens_项目交付说明.md').write_text((root/'README.md').read_text())
print(json.dumps({name:p.stat().st_size for name in ['MerchantLens_源码与产品材料.zip','MerchantLens_静态部署包.zip','MerchantLens_产品评审.pdf'] if (p:=out/name).exists()},ensure_ascii=False))
