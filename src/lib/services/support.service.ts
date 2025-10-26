import { randomInt } from "crypto";
import { prisma } from "../database/prisma";
import { SupportTicketStatus } from "@prisma/client";

export class SupportService {
  /**
   * Generate a random ticket number in the format TCKT-XXXXXX
   */
  generateTicketNumber(): string {
    const randomPart = randomInt(100000, 1000000);
    return `TCKT-${randomPart}`;
  }

  /**
   * Create a new support ticket
   */
  async createSupportTicket(data: {
    userId?: string;
    name: string;
    email: string;
    subject: string;
    initialMessage: string;
  }) {
    let ticketNumber = this.generateTicketNumber();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const ticket = await prisma.supportTicket.create({
          data: {
            ticketNumber,
            userId: data.userId || null,
            name: data.name,
            email: data.email,
            subject: data.subject,
            initialMessage: data.initialMessage,
            status: SupportTicketStatus.OPEN,
          },
        });

        return ticket;
      } catch (error: any) {
        if (error.code === "P2002" && attempts < maxAttempts - 1) {
          ticketNumber = this.generateTicketNumber();
          attempts++;
        } else {
          throw error;
        }
      }
    }

    throw new Error("Failed to generate unique ticket number after multiple attempts");
  }

  /**
   * Update a support ticket by ticket number
   */
  async updateSupportTicket(
    ticketNumber: string,
    data: {
      subject?: string;
      description?: string;
      status?: SupportTicketStatus;
    }
  ) {
    const ticket = await prisma.supportTicket.update({
      where: { ticketNumber },
      data,
    });

    return ticket;
  }

  /**
   * Get a support ticket by ticket number
   */
  async getSupportTicket(ticketNumber: string) {
    return prisma.supportTicket.findUnique({
      where: { ticketNumber },
    });
  }

  /**
   * Get all support tickets for a user
   */
  async getUserSupportTickets(userId: string) {
    return prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a feedback submission
   */
  async createFeedbackSubmission(data: {
    userId?: string;
    name: string;
    email?: string;
    subject: string;
    message: string;
  }) {
    const feedback = await prisma.feedbackSubmission.create({
      data: {
        userId: data.userId || null,
        name: data.name,
        email: data.email || null,
        subject: data.subject,
        message: data.message,
      },
    });

    return feedback;
  }

  /**
   * Get all feedback submissions for a user
   */
  async getUserFeedbackSubmissions(userId: string) {
    return prisma.feedbackSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const supportService = new SupportService();
