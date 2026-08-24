export type CreditReason = "purchase" | "unlock_spend" | "admin_adjustment" | "refund" | "signup_bonus";

export const CREDIT_REASON_LABEL: Record<CreditReason, { label: string; emoji: string }> = {
  purchase: { label: "Kupovina", emoji: "💳" },
  unlock_spend: { label: "Otključavanje", emoji: "🔓" },
  admin_adjustment: { label: "Administrativno", emoji: "🛠️" },
  refund: { label: "Povraćaj", emoji: "↩️" },
  signup_bonus: { label: "Dobrodošlica", emoji: "🎁" },
};
