"use server";

import { prisma } from "@/lib/database/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

type UpdateUserPayload = {
  name: string;
  phone?: string;
  role?: string;
  image?: string;
  // we accept either an existing organization id OR a free-text organization name
  organizationId?: string | null;
  organizationName?: string | null;
};

function sanitizeString(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function updateUserDetails(payload: UpdateUserPayload) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  // basic validation
  const name = sanitizeString(payload.name);
  if (!name || name.length < 2) {
    return { success: false, error: "Name must be at least 2 characters." };
  }

  const phone = sanitizeString(payload.phone);
  const role = sanitizeString(payload.role);
  const image = sanitizeString(payload.image);
  const orgId = sanitizeString(payload.organizationId);
  const orgName = sanitizeString(payload.organizationName);

  // Build the update object, but don't assume organization field type.
  // We'll attempt relation-style update first (connect/connectOrCreate).
  const baseUpdate: any = {
    name,
    phone,
    role,
    image,
  };

  try {
    // Try relation-style update: organization: { connect: { id } } or connectOrCreate by name.
    if (orgId) {
      baseUpdate.organization = { connect: { id: orgId } };
    } else if (orgName) {
      baseUpdate.organization = {
        connectOrCreate: {
          where: { name: orgName },
          create: { name: orgName },
        },
      };
    } else {
      // if neither provided, we leave relation unchanged — do not disconnect automatically
    }

    await prisma.user.update({
      where: { id: userId },
      data: baseUpdate,
    });

    return { success: true };
  } catch (err: any) {
    // If the attempt above failed because organization is actually a scalar column (string),
    // retry updating a scalar "organization" column (if it exists). We detect this by
    // checking for a PrismaClientKnownRequestError with code P2012/P2013 or a message referencing
    // "Unknown arg `organization` for field `User.update`" — but rather than brittle text checks,
    // we musically fallback and try a scalar update in a safe manner.
    try {
      // Build scalar-style payload:
      const scalarUpdate: any = {
        name,
        phone,
        role,
        image,
      };

      // If orgId provided, we assume it's actually an org *name* for scalar column cases.
      // Prefer organizationName if provided; else orgId (fallthrough).
      const orgScalarValue = orgName ?? orgId ?? null;
      if (orgScalarValue !== null) scalarUpdate.organization = orgScalarValue;

      await prisma.user.update({
        where: { id: userId },
        data: scalarUpdate,
      });

      return { success: true };
    } catch (scalarErr: any) {
      // At this point both approaches failed. Return diagnostic info (but not stack traces).
      console.error("updateUserDetails: relation update error:", err);
      console.error("updateUserDetails: scalar update error:", scalarErr);

      // Try to give a helpful message to the frontend so the developer knows what's wrong.
      return {
        success: false,
        error: "Failed to update organization. Your Prisma schema likely defines organization as a relation OR a scalar; both update strategies failed. Check server logs for details.",
      };
    }
  }
}

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  if (!payload.newPassword || payload.newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hashedPassword: true },
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    if (user.hashedPassword && payload.currentPassword) {
      const isValid = await bcrypt.compare(payload.currentPassword, user.hashedPassword);
      if (!isValid) {
        return { success: false, error: "Current password is incorrect." };
      }
    } else if (user.hashedPassword && !payload.currentPassword) {
      return { success: false, error: "Current password is required." };
    }

    const hashedPassword = await bcrypt.hash(payload.newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { hashedPassword },
    });

    return { success: true };
  } catch (err: any) {
    console.error("changePassword error:", err);
    return { success: false, error: "Failed to update password." };
  }
}
