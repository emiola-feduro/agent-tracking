import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  isLoading?: boolean;
};

const variantClasses = {
  primary: "bg-brand text-on-brand border-brand hover:bg-brand-hover hover:border-brand-hover",
  secondary: "bg-surface text-ink border-line-strong hover:bg-subtle",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-subtle hover:text-ink",
  danger: "bg-surface text-danger border-line-strong hover:bg-danger-soft hover:border-danger",
};

const sizeClasses = { md: "min-h-10 px-4 text-[0.9375rem]", sm: "min-h-8 px-3 text-sm" };

const Button = ({
  variant = "secondary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) => {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {isLoading && (
        <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {children}
    </button>
  );
};

export default Button;
