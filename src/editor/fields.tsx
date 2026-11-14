import React from "react";

export const Row: React.FC<{ children: React.ReactNode; label?: string }> = ({
  children,
  label,
}) => (
  <label className="row">
    {label ? <span className="row-label">{label}</span> : null}
    {children}
  </label>
);

type NumProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export const NumberField: React.FC<NumProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
}) => (
  <Row label={label}>
    <input
      type="number"
      value={Number.isFinite(value) ? String(value) : "0"}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  </Row>
);

export const SliderField: React.FC<NumProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}) => (
  <Row label={label}>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    <span className="num">{value.toFixed(2)}</span>
  </Row>
);

export const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}> = ({ label, value, onChange, multiline }) =>
  multiline ? (
    <Row label={label}>
      <textarea value={value} rows={2} onChange={(e) => onChange(e.target.value)} />
    </Row>
  ) : (
    <Row label={label}>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </Row>
  );

export const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Row label={label}>
      <input
        type="color"
        value={isHex ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="grow"
      />
    </Row>
  );
};

export const CheckboxField: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <Row>
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </Row>
);
