import { z } from "zod";

export const adminProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a name"),
  country: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(32).optional(),
  kyc_status: z.enum(["unverified", "pending", "verified", "rejected"]),
});
export type AdminProfileInput = z.infer<typeof adminProfileSchema>;

export const adminBalanceSchema = z.object({
  balance: z.coerce.number().min(0, "Balance can't be negative").finite(),
});
export type AdminBalanceInput = z.infer<typeof adminBalanceSchema>;

export const adminTransactionSchema = z.object({
  type: z.enum(["credit", "debit"]),
  category: z.string().trim().min(1, "Category is required").max(40),
  amount: z.coerce.number().positive("Amount must be greater than zero").finite(),
  description: z.string().trim().max(140).optional(),
});
export type AdminTransactionInput = z.infer<typeof adminTransactionSchema>;
