function ServiceSelection({ onSelectWash, onSelectDry }) {
  return (
    <>
      <h2>เลือกประเภท</h2>

      <button onClick={onSelectWash}>
        ซัก
      </button>

      <button onClick={onSelectDry}>
        อบ
      </button>
    </>
  );
}

export default ServiceSelection;