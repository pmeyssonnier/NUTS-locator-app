
export const xmlUnesc=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d)).replace(/&amp;/g,'&');
export const xmlEsc=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const attrs=s=>{const o={};for(const m of s.matchAll(/([\w:.-]+)="([^"]*)"/g))o[m[1]]=m[2];return o;};
export const colIdx=c=>{let n=0;for(const ch of c)n=n*26+ch.charCodeAt(0)-64;return n-1;};
export const colName=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=(i-m-1)/26;}return s;};
export const tTexts=s=>[...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>xmlUnesc(x[1])).join('');
