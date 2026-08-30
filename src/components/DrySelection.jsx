function DrySelection({
  resetOptions,
  setProgram,
  setStep,
}) {
  return (
    <>
      <h2>เลือกระบบ</h2>

      <div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
        {/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
          <button onClick={() => {
            setProgram(4);
            setStep(3_1);
          }}>ลมร้อน</button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>รายละเอียด<br/>
            - น้ำหนักผ้า 7-8 กก.<br/>
            - ระบบลมร้อนใช้อุณหภูมิสูงในการอบผ้า<br/>
            - เพื่อใหีประสิทธิภาพดีที่สุด ควรตรวจสอบกรองอากาศ ก่อนเริ่มใช้งาน<br/>
            - ระยะเวลาที่แสดงหน้าจอตอนเริ่มทำงาน ~3:30 ชม. แต่ทำงานจริง ~80 ถึง 100 นาที<br/>
            - เพราะว่าระบบมีการตรวจจับความชื้นอยู่เป็นระยะ จึงมีการคำนวณเวลาเสร็จอยู่ตลอด<br/>           
          </h4>
        </div>
      </div>        

      <div style={{ display: "flex", gap: "40px", alignItems: "flex-start", marginBottom: "20px"}}>       
        {/* ฝั่งขวา = รายละเอียด */}
        <div style={{ width: "120px"}}>
          <button onClick={() => {
            setProgram(4);
            setStep(3_2);
          }}>Heat Pump</button>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <h4>รายละเอียด<br/>
            - น้ำหนักผ้า 7-8 กก.<br/>
            - อบด้วยระบบควบแน้นที่อุณหภูมิต่ำ จึงช่วยถนอมผ้ามากขึ้น<br/>
            - เพื่อใหีประสิทธิภาพดีที่สุด ควรตรวจสอบกรองอากาศ ก่อนเริ่มใช้งาน<br/>
            - ระยะเวลา ~80 ถึง 120 นาที<br/>
          </h4>
        </div>
      </div>        
   
      {/* <br /> */}
      <button onClick={() => {
        resetOptions();  
        setProgram(0);                  
        setStep(1_2);
      }}>ย้อนกลับ</button>
    </>
  );
}

export default DrySelection;