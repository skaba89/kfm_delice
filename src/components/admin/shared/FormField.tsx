"use client";

import { Input } from "@/components/ui/input";

interface FormFieldProps {
  /** Label text (shown above the input) */
  label: string;
  /** Current input value */
  value: string;
  /** Called when the value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Input type (default: "text") */
  type?: string;
  /** Mark as required with asterisk? */
  required?: boolean;
}

/**
 * Standardized form field with label + input for admin CRUD forms.
 * Centralizes dark mode classes and consistent styling.
 */
export function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: FormFieldProps) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
        {label}{required && " *"}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="dark:bg-gray-800 dark:border-gray-600"
      />
    </div>
  );
}
