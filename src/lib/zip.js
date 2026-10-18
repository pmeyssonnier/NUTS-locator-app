// --- Lecture ZIP / XLSX ---
export function zipOpen(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('fichier ZIP/XLSX invalide');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={};
  for(let k=0;k<n;k++){
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true);
    const nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    files[new TextDecoder().decode(u8.subarray(p+46,p+46+nl))]={method,csize,off};p+=46+nl+xl+cl;
  }
  return {u8,dv,files};
}
export async function zipText(z,name){
  const f=z.files[name];if(!f)return null;
  const start=f.off+30+z.dv.getUint16(f.off+26,true)+z.dv.getUint16(f.off+28,true);
  const data=z.u8.slice(start,start+f.csize);
  if(f.method===0)return new TextDecoder().decode(data);
  const out=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return new TextDecoder().decode(out);
}
// --- Écriture XLSX (ZIP non compressé) ---
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
export function zipBuild(files){
  const enc=new TextEncoder(),parts=[],central=[];let off=0;
  for(const f of files){
    const name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(12,0x21,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,name.length,true);
    parts.push(lh.buffer,name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(14,0x21,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,name.length,true);ch.setUint32(42,off,true);
    central.push(ch.buffer,name);off+=30+name.length+data.length;
  }
  const csize=central.reduce((s,b)=>s+b.byteLength,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,e.buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
