import { z } from "zod";

export const beneficiarySchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  type: z.enum(["internal", "external", "wire"]),
  account_number: z.string().trim().min(4, "Enter the account number"),
  bank_name: z.string().trim().max(120).optional(),
  routing_number: z.string().trim().max(40).optional(),
  iban: z.string().trim().max(64).optional(),
});
export type BeneficiaryInput = z.infer<typeof beneficiarySchema>;
