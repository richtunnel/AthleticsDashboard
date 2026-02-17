import { CollaborativeRole, CollaborativeStatus } from "@prisma/client";

// API Request/Response Types

export interface InviteCollaboratorRequest {
  email: string;
  role: CollaborativeRole;
}

export interface InviteCollaboratorResponse {
  success: boolean;
  message: string;
  collaboratorId?: string;
}

export interface CollaborationMember {
  id: string;
  email: string;
  role: CollaborativeRole;
  status: CollaborativeStatus;
  invitedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export interface GetMembersResponse {
  members: CollaborationMember[];
  totalCount: number;
  usedSlots: number;
  availableSlots: number;
}

export interface RevokeMemberResponse {
  success: boolean;
  message: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  redirectUrl?: string;
}

export interface CheckMembershipResponse {
  isCollaborator: boolean;
  ownerUserId?: string;
  ownerEmail?: string;
  role?: CollaborativeRole;
  organizationName?: string;
}

export interface CollaborationAuditLogEntry {
  id: string;
  action: string;
  ownerId: string;
  targetEmail?: string;
  collaboratorId?: string;
  role?: CollaborativeRole;
  details?: string;
  createdAt: Date;
}

// Form Types
export interface InviteFormData {
  email: string;
  role: CollaborativeRole;
}

// Error Types
export class CollaborationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "CollaborationError";
  }
}

// Validation Messages
export const VALIDATION_MESSAGES = {
  INVALID_EMAIL: "Please enter a valid email address",
  EMAIL_ALREADY_INVITED: "This person has already been invited to your account",
  EMAIL_ALREADY_MEMBER: "This person is already a member of your account",
  CANNOT_INVITE_SELF: "You cannot invite yourself to collaborate on your own account",
  LIMIT_REACHED: "You have reached your collaborator limit for your current plan",
  INVITATION_EXPIRED: "This invitation has expired. Please request a new invitation",
  INVITATION_REVOKED: "This invitation has been revoked",
  INVITATION_NOT_FOUND: "Invitation not found",
  UNAUTHORIZED: "You are not authorized to perform this action",
  NOT_OWNER: "Only the account owner can perform this action",
  INVALID_TOKEN: "Invalid or malformed invitation token",
} as const;

// Role Display Names
export const ROLE_DISPLAY_NAMES: Record<CollaborativeRole, string> = {
  VIEWER: "Viewer (Read-Only)",
  MEMBER: "Member (Full Access)",
};

// Status Display Names
export const STATUS_DISPLAY_NAMES: Record<CollaborativeStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
};
