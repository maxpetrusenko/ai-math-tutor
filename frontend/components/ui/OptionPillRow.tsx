import React from "react";

type Option = {
  label: string;
  value: string;
};

type OptionPillRowProps = {
  activeValue: string;
  ariaLabel: string;
  onSelect: (value: string) => void;
  options: Option[];
};

export function OptionPillRow({ activeValue, ariaLabel, onSelect, options }: OptionPillRowProps) {
  return (
    <div aria-label={ariaLabel} className="pill-row" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          className={`pill-row__item${activeValue === option.value ? " pill-row__item--active" : ""}`}
          onClick={() => onSelect(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
