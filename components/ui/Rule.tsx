import React from "react";

export interface RuleProps extends React.HTMLAttributes<HTMLElement> {
  orientation?: "horizontal" | "vertical";
}

export const Rule: React.FC<RuleProps> = ({
  orientation = "horizontal",
  className = "",
  ...props
}) => {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`inline-block self-stretch border-l border-rule w-0 ${className}`.trim()}
        {...props}
      />
    );
  }

  return (
    <hr
      role="separator"
      aria-orientation="horizontal"
      className={`w-full border-0 border-t border-rule m-0 ${className}`.trim()}
      {...props}
    />
  );
};
