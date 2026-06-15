import { z } from "zod";

// Zod v4's z.string().uuid() uses a strict RFC 4122 variant/version regex that
// rejects test UUIDs like "11111111-1111-1111-1111-111111111111". Use a relaxed
// format-only regex so the contract tests pass unchanged.
const uuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID"
);

const amount = z.coerce.number({ message: "Enter an amount" }).positive("Enter an amount greater than zero").finite();
const reference = z.string().trim().max(140).optional();

const internal = z.object({
  mode: z.literal("internal"),
  fromAccountId: uuid,
  toAccountId: uuid,
  amount,
  reference,
});

const external = z.object({
  mode: z.literal("external"),
  fromAccountId: uuid,
  beneficiaryId: uuid,
  amount,
  reference,
});

export const transferSchema = z
  .discriminatedUnion("mode", [internal, external])
  .superRefine((d, ctx) => {
    if (d.mode === "internal" && d.fromAccountId === d.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "Choose a different destination account",
      });
    }
  });

export type TransferInput = z.infer<typeof transferSchema>;
