
function Dry2Selection({
  setDry2Prices,
  setDry2Program,
  setStep,
}) {
  const options = [
    {
      price: 20,
      program: 1,
      name: "Fast Dry",
      time: "30 นาที",
      quantity: "ผ้า 2 กก. หรือประมาณ 10 ชิ้น",
      description: "เหมาะสำหรับผ้าเนื้อบาง",
    },
    {
      price: 30,
      program: 2,
      name: "อบผ้าทั่วไป",
      time: "60 นาที",
      quantity: "ผ้า 4 กก. หรือประมาณ 15 ชิ้น",
      description: "เหมาะสำหรับผ้าทั่วไป ไม่รวมผ้าหนา",
    },
    {
      price: 40,
      program: 3,
      name: "อบผ้าผสม",
      time: "90 นาที",
      quantity: "ผ้า 5 กก. หรือประมาณ 20 ชิ้น",
      description: "เหมาะสำหรับผ้าผสม",
    },
  ];

  return (
    <div className="dry-price-selection">
      <p className="dry-price-description">
        เลือกราคาและระยะเวลาอบผ้าที่เหมาะสม
      </p>

      <div className="dry-price-list">
        {options.map((option) => (
          <button
            key={option.program}
            type="button"
            className="dry-price-card"
            onClick={() => {
              setDry2Prices(option.price);
              setDry2Program(option.program);
              setStep(3_2_1);
            }}
          >
            <span className="dry-price-card-top">
              <span className="dry-price-card-name">
                {option.name}
              </span>

              <span className="dry-price-card-amount">
                {option.price} บาท
              </span>
            </span>

            <span className="dry-price-card-time">
              ⏱ {option.time}
            </span>

            <span className="dry-price-card-details">
              {option.quantity}
            </span>

            <span className="dry-price-card-details">
              {option.description}
            </span>

            <span className="dry-price-card-action">
              เลือกราคานี้ →
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="machine-back"
        onClick={() => setStep(1_2)}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default Dry2Selection;
