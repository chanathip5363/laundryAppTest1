import { useEffect, useState } from "react";


function WashPriceSelection({
  selectedMachine,
  onPricingLoaded,
  onSelect20,
  onSelect30,
  onSelect50,
  onBack,
}) {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    setPricing(null);
    setLoading(true);
    setError("");

    if (!selectedMachine) {
      setError("กรุณาเลือกเครื่องซักผ้า");
      setLoading(false);
      return () => controller.abort();
    }

    async function loadPricing() {
      try {
        const response = await fetch(
          `https://api.the-oasis-living.com/payments/pricing/${encodeURIComponent(selectedMachine)}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดราคาของเครื่องได้");
        }

        const data = await response.json();

        if (
          !data.success ||
          data.machine !== selectedMachine ||
          data.type !== "wash" ||
          !data.priceGroups ||
          typeof data.priceGroups !== "object" ||
          Array.isArray(data.priceGroups)
        ) {
          throw new Error("ข้อมูลราคาจาก Server ไม่ถูกต้อง");
        }

        if (!controller.signal.aborted) {
          setPricing(data);
          onPricingLoaded(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPricing();

    return () => controller.abort();
  }, [selectedMachine, onPricingLoaded]);

  const findGroupPrice = (programIds) => {
    if (!pricing?.priceGroups) return null;

    const match = Object.entries(pricing.priceGroups).find(
      ([, programs]) =>
        Array.isArray(programs) &&
        programs.some((id) => programIds.includes(Number(id)))
    );

    if (!match) return null;

    const price = Number(match[0]);
    return Number.isFinite(price) && price > 0 ? price : null;
  };

  const packages = [
    {
      price: findGroupPrice([4, 6]),
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
      price: findGroupPrice([1, 2, 3, 5, 7, 8, 9]),
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
      price: findGroupPrice([10]),
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
        {loading && <p>กำลังโหลดราคา...</p>}
        {!loading && error && <p role="alert">{error}</p>}
        {!loading && !error && pricing &&
          packages
            .filter((pkg) => pkg.price !== null)
            .map((pkg) => (
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
              onClick={() => pkg.onSelect(pkg.price)}
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
