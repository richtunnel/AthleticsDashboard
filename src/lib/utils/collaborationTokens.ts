import "server-only";

import { CollaborativeRole } from "@prisma/client";
import jwt from "jsonwebtoken";

export function generateInvitationToken(payload: {
  email: string;
  ownerId: string;
  role: CollaborativeRole;
  invitedAt: Date;
  expiresAt: Date;
}): string {
  return jwt.sign(payload, process.env.JWT_SECRET || "default-secret", {
    expiresIn: "24h",
  });
}

export function verifyInvitationToken(token: string): {
  email: string;
  ownerId: string;
  role: CollaborativeRole;
  invitedAt: Date;
  expiresAt: Date;
} | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret");
    return decoded as {
      email: string;
      ownerId: string;
      role: CollaborativeRole;
      invitedAt: Date;
      expiresAt: Date;
    };
  } catch (error) {
    console.error("Invalid invitation token:", error);
    return null;
  }
}
