"use client";

interface FormSelectProps {
  /** Label text */
  label: string;
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Options as value/label pairs */
  options: { value: string; label: string }[];
  /** Mark as required? */
  required?: boolean;
}

/**
 * Standardized form select with label for admin CRUD forms.
 * Centralizes dark mode classes and consistent styling.
 */
export function FormSelect({
  label,
  value,
  onChange,
  options,
  required = false,
}: FormSelectProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
        {label}{required && " *"}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
