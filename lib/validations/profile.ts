import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().max(32).optional(),
  country: z.string().trim().max(64).optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export type PasswordInput = z.infer<typeof passwordSchema>;

export const notificationPrefsSchema = z.object({
  product: z.boolean(),
  security: z.boolean(),
  transfers: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
