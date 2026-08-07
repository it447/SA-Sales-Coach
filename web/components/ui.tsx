"use client";

/**
 * Shared UI primitives matching the scale-army-pricing-calculator app's look
 * (navy background, cream text, orange accents, rounded cards). Used by the
 * internal dashboard (Phase 4) so it reads as the same family of tools.
 */
import type { ReactNode, CSSProperties } from "react";
import { colors } from "../lib/theme";

export function Card({
  title,
  children,
  accent = false,
}: {
  title?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  const style: CSSProperties = {
    background: accent
      ? `linear-gradient(135deg, ${colors.navyLight}, ${colors.navyMid})`
      : colors.navyLight,
    borderRadius: "16px",
    padding: "1.5rem",
    border: accent ? `2px solid ${colors.orange}` : `1px solid ${colors.navyBorder}`,
    marginBottom: "1rem",
  };

  return (
    <div style={style}>
      {title && (
        <h3
          style={{
            color: colors.orange,
            marginBottom: "1rem",
            fontSize: "1.1rem",
            fontWeight: "bold",
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneColor = {
    neutral: colors.orange,
    success: colors.greenAccent,
    warning: colors.yellowAccent,
    danger: colors.redAccent,
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.35rem 0.75rem",
        background: `${toneColor}20`,
        border: `2px solid ${toneColor}`,
        borderRadius: "8px",
        color: toneColor,
        fontWeight: "bold",
        fontSize: "0.8rem",
      }}
    >
      {label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.75rem 1.5rem",
        background: isPrimary ? colors.orange : "transparent",
        color: isPrimary ? colors.navy : colors.cream,
        border: `2px solid ${isPrimary ? colors.orange : colors.navyMid}`,
        borderRadius: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontWeight: "bold",
        fontSize: "0.9rem",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}
