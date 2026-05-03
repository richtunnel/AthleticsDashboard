import { Resend } from "resend";
import { getResendClient } from "../resend";
import {
  CircuitBreakerPolicy,
  RetryPolicy,
  Policy,
  ConsecutiveBreaker,
} from "cockatiel";

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
}

export class EmailGatewayService {
  private resend: Resend | null = null;
  private retryPolicy: RetryPolicy;
  private circuitBreaker: CircuitBreakerPolicy;

  constructor() {
    // Configure retry policy: 3 retries with exponential backoff
    this.retryPolicy = Policy.handleAll()
      .retry()
      .attempts(3)
      .exponential({
        initialDelay: 1000,
        maxDelay: 10000,
      });

    // Configure circuit breaker: break after 5 consecutive failures, for 30 seconds
    this.circuitBreaker = Policy.handleAll().circuitBreaker(30000, new ConsecutiveBreaker(5));
  }

  private getResend() {
    if (!this.resend) {
      this.resend = getResendClient();
    }
    return this.resend;
  }

  async send(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: any }> {
    const combinedPolicy = Policy.wrap(this.retryPolicy, this.circuitBreaker);

    try {
      const result = await combinedPolicy.execute(async () => {
        const { to, cc, subject, body, from, replyTo } = options;
        const resend = this.getResend();
        
        const response = await resend.emails.send({
          from: from || process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
          to: Array.isArray(to) ? to : [to],
          cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
          subject,
          html: body,
          replyTo: replyTo,
        });

        if (response.error) {
          throw response.error;
        }

        return response.data;
      });

      return { success: true, id: result?.id };
    } catch (error: any) {
      console.error("[EmailGatewayService] Failed to send email:", error);
      return { success: false, error: error.message || error };
    }
  }
}

export const emailGatewayService = new EmailGatewayService();
