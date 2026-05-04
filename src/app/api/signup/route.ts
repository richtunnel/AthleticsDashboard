import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import bcrypt from "bcryptjs";
import { trackReferral } from "@/lib/services/referral.service";
import { trackServerEvent, identifyServerUser } from "@/lib/analytics/mixpanel.server";
import { isSignupBlocked, getDaysRemaining } from "@/lib/services/signup-log.service";
import { createSampleGame } from "@/lib/services/sample-game.service";
import { createInitialColumnPreferences } from "@/lib/services/initial-columns.service";
import { rateLimit, RateLimitConfig, getClientIp } from "@/lib/security/rate-limiter";
import { applyAllSecurityHeaders } from "@/lib/security/security-headers";
import { sanitizeEmail, sanitizeString, validatePassword } from "@/lib/security/sanitizer";
import { generateUniqueShareCode } from "@/lib/utils/shareCode";
import { checkInvitationCookie, clearInvitationCookie, setBypassOnboardingCookie } from "@/lib/utils/invitation";

export async function POST(request: NextRequest) {
  // Apply rate limiting - strict limit for signup to prevent abuse
  const clientIp = getClientIp(request);
  const { allowed: rateLimitAllowed, retryAfter } = await rateLimit(
    request,
    RateLimitConfig.auth
  );

  if (!rateLimitAllowed) {
    const response = NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
      { status: 429 }
    );
    response.headers.set('Retry-After', retryAfter?.toString() || '900');
    return applyAllSecurityHeaders(request, response);
  }

  try {
    const body = await request.json();
    const { email, password, name, plan, referrerEmail, phone } = body;

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedName = sanitizeString(name || '');
    const sanitizedReferrerEmail = referrerEmail ? sanitizeEmail(referrerEmail) : null;
    const sanitizedPhone = phone ? phone.replace(/[^+\d]/g, '') : null;

    console.log("[Signup] Signup attempt for email:", sanitizedEmail);

    // Validation
    if (!sanitizedEmail || !password || !sanitizedName) {
      console.error("[Signup] Missing required fields:", {
        email: !!sanitizedEmail,
        password: !!password,
        name: !!sanitizedName,
      });
      const response = NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.error("[Signup] Password validation failed for email:", sanitizedEmail, passwordValidation.errors);
      const response = NextResponse.json(
        {
          error: "Password does not meet requirements",
          details: passwordValidation.errors,
          strength: passwordValidation.strength,
        },
        { status: 400 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    const normalizedEmail = sanitizedEmail.toLowerCase();

    // Check if email/phone is blocked due to recent account deletion (90-day rule)
    const signupCheck = await isSignupBlocked(normalizedEmail, sanitizedPhone);
    if (signupCheck.blocked) {
      const daysRemaining = signupCheck.expiresAt ? getDaysRemaining(signupCheck.expiresAt) : 90;
      console.error("[Signup] Signup blocked for email:", normalizedEmail, "Days remaining:", daysRemaining);
      const response = NextResponse.json(
        {
          error: `This email/phone was used for an account that was recently deleted. Please wait ${daysRemaining} more days before signing up again, or contact support if you believe this is an error.`,
          blocked: true,
          daysRemaining,
        },
        { status: 403 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      console.error("[Signup] User already exists:", normalizedEmail);
      const response = NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
      return applyAllSecurityHeaders(request, response);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    let stripeCustomerId = null;

    // Create Stripe customer if plan is selected (not free trial)
    if (plan && plan !== "free_trial_plan") {
      try {
        const stripe = getStripe();
        const customer = await stripe.customers.create({
          email: normalizedEmail,
          name: sanitizedName,
          metadata: {
            plan: plan,
            source: "onboarding",
          },
        });
        stripeCustomerId = customer.id;
        console.log("[Signup] Stripe customer created:", customer.id, "for email:", normalizedEmail);
      } catch (stripeError) {
        console.error("[Signup] Stripe customer creation error for email:", normalizedEmail, stripeError);
        // Continue with user creation even if Stripe fails - we can retry later
      }
    }

    // Check if this is a parent plan
    const isParentPlan = plan === "parent_plan" || plan === "parent_free" || plan === "parent_donation";

    // Generate a unique share code for the new user
    const shareCode = await generateUniqueShareCode();

    // Check if user is joining via an invitation
    const invitationData = await checkInvitationCookie();
    let user;

    if (invitationData) {
      // Create user as collaborator in existing organization
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: sanitizedName,
          phone: sanitizedPhone,
          hashedPassword,
          role: invitationData.role,
          plan: "free_trial_plan",
          stripeCustomerId,
          shareCode,
          trialEnd: null,
          organizationId: invitationData.organizationId,
          // Copy school details from the inviter
          schoolName: invitationData.schoolName,
          teamName: invitationData.teamName,
          schoolAddress: invitationData.schoolAddress,
          city: invitationData.city,
          aiSchedulerEnabled: invitationData.aiSchedulerEnabled,
          aiTravelTimesEnabled: invitationData.aiTravelTimesEnabled,
          aiEmailGenerationEnabled: invitationData.aiEmailGenerationEnabled,
          costBudgetEnabled: invitationData.costBudgetEnabled,
          scoreTrackerEnabled: invitationData.scoreTrackerEnabled,
        },
        include: {
          organization: true,
        },
      });

      // Clear the invitation cookie
      await clearInvitationCookie();

      // Set a temporary cookie to bypass onboarding redirect
      await setBypassOnboardingCookie();
      
      console.log("[Signup] User created via invitation:", user.id, normalizedEmail);
    } else {
      // Normal signup flow - create user with their own organization
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: sanitizedName,
          phone: sanitizedPhone,
          hashedPassword,
          role: isParentPlan ? "PARENT" : "ATHLETIC_DIRECTOR",
          plan: plan || "free_trial_plan",
          stripeCustomerId,
          shareCode,
          trialEnd: plan === "free_trial_plan" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
          organization: {
            create: {
              name: isParentPlan ? `${sanitizedName}'s Family` : `${sanitizedName}'s Organization`,
              timezone: "America/New_York",
            },
          },
        },
        include: {
          organization: true,
        },
      });
      console.log("[Signup] User created successfully:", user.id, normalizedEmail);
    }

    // Create sample game for new user (non-blocking)
    void createSampleGame({
      userId: user.id,
      organizationId: user.organizationId,
    }).catch((error) => {
      console.error("[Signup] Failed to create sample game:", error);
    });

    // Create initial column preferences for new user (non-blocking)
    // This ensures they see only the 5 essential columns: Date, Sport, Level, Location, Actions
    void createInitialColumnPreferences(user.id).catch((error) => {
      console.error("[Signup] Failed to create initial column preferences:", error);
    });

    // Track referral if referrerEmail is provided
    if (sanitizedReferrerEmail) {
      try {
        await trackReferral(sanitizedReferrerEmail, user.id, normalizedEmail);
        console.log("[Signup] Referral tracked for:", sanitizedReferrerEmail);
      } catch (referralError) {
        console.error("[Signup] Failed to track referral:", referralError);
        // Don't fail signup if referral tracking fails
      }
    }

    // Track signup event in Mixpanel
    try {
      trackServerEvent("User Signup", {
        distinct_id: user.id,
        signup_method: "email",
        plan: user.plan,
        email: normalizedEmail,
        name: user.name,
        has_referrer: !!sanitizedReferrerEmail,
      });
      identifyServerUser(user.id, {
        $email: normalizedEmail,
        $name: user.name,
        plan: user.plan,
        role: user.role,
        signup_method: "email",
        signup_date: new Date().toISOString(),
      });
    } catch (mixpanelError) {
      console.error("[Signup] Failed to track Mixpanel event:", mixpanelError);
      // Don't fail signup if tracking fails
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          organizationId: user.organizationId,
        },
      },
      { status: 201 }
    );
    return applyAllSecurityHeaders(request, response);
  } catch (error) {
    console.error("[Signup] Unexpected error during signup:", error);
    const response = NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
    return applyAllSecurityHeaders(request, response);
  }
}
