
function WashPriceSelection({
  onSelect20,
  onSelect30,
  onSelect50,
  onBack,
}) {
  const packages = [
    {
      price: 20,
      name: "ซักประหยัด",
      subtitle: "เหมาะสำหรับผ้าปริมาณน้อย",
      details: [
        "จำนวนผ้า 2 กก. หรือ 15 ชิ้น",
        "ซักด่วน 15 นาที",
        "ซักแบบประหยัด 57 นาที",
      ],
      onSelect: onSelect20,
      theme: "basic",
    },
    {
      price: 30,
      name: "ซักมาตรฐาน",
      subtitle: "เลือกโปรแกรมให้เหมาะกับเนื้อผ้า",
      details: [
        "ชุดกีฬา 45 นาที",
        "ผ้าขนสัตว์ 1 ชั่วโมง 7 นาที",
        "ผ้าบาง 50 นาที",
        "ผ้าผสม 45 นาที",
        "ซักถนอมสีผ้า 1 ชั่วโมง 3 นาที",
      ],
      onSelect: onSelect30,
      theme: "standard",
    },
    {
      price: 50,
      name: "ซักด้วยไอน้ำ",
      subtitle: "โปรแกรมซักพิเศษ",
      details: [
        "ซักอบด้วยไอน้ำ 2 ชั่วโมง 39 นาที",
        "เพิ่มประสิทธิภาพในการแทรกซึมเข้าใยเนื้อผ้า",
        "เพิ่มประสิทธิภาพในการกำจัดเชื้อโรค",
      ],
      onSelect: onSelect50,
      theme: "premium",
    },
  ];

  return (
    <div className="wash-price-selection">
      <div className="wash-price-heading">
        <p>เลือกแพ็กเกจตามความต้องการของคุณ</p>
      </div>

      <div className="wash-price-grid">
        {packages.map((pkg) => (
          <div
            key={pkg.price}
            className={`wash-price-card ${pkg.theme}`}
          >
            <div className="wash-price-top">
              <div className="wash-price-info">
                <h3>{pkg.name}</h3>
                <p>{pkg.subtitle}</p>
              </div>

              <div className="wash-price-amount">
                <strong>{pkg.price}</strong>
                <span>บาท</span>
              </div>
            </div>

            <div className="wash-price-details">
              {pkg.details.map((detail, index) => (
                <div className="wash-price-detail" key={index}>
                  <span className="wash-price-check">✓</span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="wash-price-button"
              onClick={pkg.onSelect}
            >
              เลือกแพ็กเกจ {pkg.price} บาท
              <span>→</span>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="machine-back"
        onClick={onBack}
      >
        ← ย้อนกลับ
      </button>
    </div>
  );
}

export default WashPriceSelection;
