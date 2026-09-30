import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Field } from "@/components/ui/Field";

describe("Field Primitive", () => {
  it("renders text input with uppercase mono label associated by id", () => {
    render(<Field id="target-url" label="Target URL" placeholder="https://example.com" />);
    const label = screen.getByText("Target URL");
    const input = screen.getByLabelText("Target URL");
    expect(label).toHaveClass("font-mono");
    expect(label).toHaveAttribute("for", "target-url");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "target-url");
    expect(input).toHaveAttribute("placeholder", "https://example.com");
  });

  it("renders textarea when multiline is true", () => {
    render(<Field multiline id="user-prompt" label="User Prompt" />);
    const textarea = screen.getByLabelText("User Prompt");
    expect(textarea.tagName.toLowerCase()).toBe("textarea");
  });

  it("displays error message and sets aria-invalid and aria-describedby", () => {
    render(
      <Field
        id="sample-field"
        label="Sample Field"
        error="Field value is required"
      />
    );
    const input = screen.getByLabelText("Sample Field");
    const errorMsg = screen.getByText("Field value is required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "sample-field-error");
    expect(errorMsg).toHaveAttribute("id", "sample-field-error");
  });

  it("displays helper text and links aria-describedby", () => {
    render(
      <Field
        id="helper-field"
        label="Helper Field"
        helperText="Must obey robots.txt"
      />
    );
    const input = screen.getByLabelText("Helper Field");
    const helperMsg = screen.getByText("Must obey robots.txt");
    expect(input).toHaveAttribute("aria-describedby", "helper-field-helper");
    expect(helperMsg).toHaveAttribute("id", "helper-field-helper");
  });

  it("handles input change events", () => {
    const handleChange = vi.fn();
    render(<Field id="typed-field" label="Typed Field" onChange={handleChange} />);
    const input = screen.getByLabelText("Typed Field");
    fireEvent.change(input, { target: { value: "New Value" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
