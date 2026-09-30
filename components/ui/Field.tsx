import React, { useId } from "react";

export interface FieldBaseProps {
  label: string;
  id?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export type InputFieldProps = FieldBaseProps &
  React.InputHTMLAttributes<HTMLInputElement> & {
    multiline?: false;
  };

export type TextareaFieldProps = FieldBaseProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    multiline: true;
  };

export type FieldProps = InputFieldProps | TextareaFieldProps;

export const Field = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  FieldProps
>((props, ref) => {
  const generatedId = useId();
  const id = props.id || generatedId;
  const { label, error, helperText, className = "", multiline = false, ...rest } = props;

  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const ariaDescribedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const commonClasses =
    "w-full bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 border border-rule rounded-xs transition-colors duration-fast focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal disabled:bg-paper-2 disabled:text-ink-soft disabled:cursor-not-allowed";

  const errorBorderClass = error ? "border-reject focus:border-reject focus:ring-reject" : "";

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label
        htmlFor={id}
        className="font-mono text-xs uppercase tracking-wider text-ink-soft select-none"
      >
        {label}
      </label>

      {multiline ? (
        <textarea
          ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={ariaDescribedBy}
          className={`${commonClasses} min-h-[96px] resize-y ${errorBorderClass}`}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as React.ForwardedRef<HTMLInputElement>}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={ariaDescribedBy}
          className={`${commonClasses} min-h-[44px] ${errorBorderClass}`}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && (
        <span
          id={errorId}
          role="alert"
          className="font-mono text-xs text-reject tracking-wide mt-0.5"
        >
          {error}
        </span>
      )}

      {!error && helperText && (
        <span
          id={helperId}
          className="font-mono text-xs text-ink-soft tracking-wide mt-0.5"
        >
          {helperText}
        </span>
      )}
    </div>
  );
});

Field.displayName = "Field";
