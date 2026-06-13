const ts = require('typescript');
const fs = require('fs');
const files = ['components/recipes.tsx','components/invoicing.tsx','components/cash-register.tsx','components/inventory-list.tsx','components/services-management.tsx','components/purchase-invoices.tsx'];
let bad=0;
for (const f of files){
  const src=fs.readFileSync(f,'utf8');
  const out=ts.transpileModule(src,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext},fileName:f});
  const errs=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errs.length){bad++;console.log('--- '+f+' ---');for(const d of errs.slice(0,8)){const p=d.file&&d.start!=null?d.file.getLineAndCharacterOfPosition(d.start):null;console.log('  line '+(p?p.line+1:'?')+': '+ts.flattenDiagnosticMessageText(d.messageText,'\n'));}}
  else console.log('OK  '+f);
}
console.log(bad===0?'ALL_SYNTAX_OK':'SYNTAX_ERRORS='+bad);
