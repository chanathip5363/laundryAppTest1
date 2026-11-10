const fs=require("fs"),path=require("path");
const root=path.dirname(__dirname);
for(const name of ["payment-slip-api.cjs","payment-verify.cjs"]) fs.copyFileSync(path.join(__dirname,name),path.join(root,name));
for(const name of ["slip-bbl.cjs","payment-bbl.test.cjs"]) fs.rmSync(path.join(root,name),{force:true});
console.log("คืนไฟล์ก่อนเพิ่มกรุงเทพแล้ว ยังไม่รีสตาร์ต");
