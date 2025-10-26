import { z } from "zod";

export const planTypeSchema = z.enum(["MONTHLY", "ANNUAL"]);

export const createCheckoutSessionSchema = z.object({
  planType: planTypeSchema,
});

export const createCheckoutSessionByPriceSchema = z.object({
  priceId: z.string().min(1),
});

export const cancelSubscriptionSchema = z.object({
  immediately: z.boolean().optional().default(false),
});

export const changePlanSchema = z.object({
  planType: planTypeSchema,
});

export const subscriptionStatusSchema = z.enum([
  "INCOMPLETE",
  "INCOMPLETE_EXPIRED",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "UNPAID",
]);

export type CreateCheckoutSession = z.infer<typeof createCheckoutSessionSchema>;
export type CreateCheckoutSessionByPrice = z.infer<typeof createCheckoutSessionByPriceSchema>;
export type CancelSubscription = z.infer<typeof cancelSubscriptionSchema>;
export type ChangePlan = z.infer<typeof changePlanSchema>;
export type PlanType = z.infer<typeof planTypeSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
