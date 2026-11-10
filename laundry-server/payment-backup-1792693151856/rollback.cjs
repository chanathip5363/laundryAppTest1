const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root="/home/partner/Control-laundry",backup=__dirname;
const entries=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n').trim()).digest('hex');
for(const e of entries){const f=path.join(root,e.name);if(!fs.existsSync(f)||hash(fs.readFileSync(f,'utf8'))!==e.after)throw Error('ไฟล์ถูกแก้ต่อแล้ว หยุดก่อนย้อน: '+e.name);}
for(const e of entries){const f=path.join(root,e.name);if(e.existed)fs.copyFileSync(path.join(backup,e.name),f);else fs.unlinkSync(f);}
console.log('ย้อนเฉพาะไฟล์ชุดเชื่อมนี้แล้ว ยังไม่รีสตาร์ต');