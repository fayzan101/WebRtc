type Props = {
  mode: string;
  n: string;
  cap: string;
  onMode: (v: string) => void;
  onN: (v: string) => void;
  onCap: (v: string) => void;
};

export function Filters({ mode, n, cap, onMode, onN, onCap }: Props) {
  return (
    <div className="filters" role="group" aria-label="Run filters">
      <span className="filters-label">Filter</span>
      <label>
        <span>Mode</span>
        <select value={mode} onChange={(e) => onMode(e.target.value)}>
          <option value="">All</option>
          <option value="mesh">Mesh</option>
          <option value="sfu">SFU</option>
        </select>
      </label>
      <label>
        <span>N</span>
        <select value={n} onChange={(e) => onN(e.target.value)}>
          <option value="">All</option>
          {[2, 3, 4, 5, 6].map((v) => (
            <option key={v} value={String(v)}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Cap</span>
        <select value={cap} onChange={(e) => onCap(e.target.value)}>
          <option value="">All</option>
          <option value="uncapped">uncapped</option>
          <option value="1Mbps">1Mbps</option>
          <option value="5Mbps">5Mbps</option>
        </select>
      </label>
    </div>
  );
}
