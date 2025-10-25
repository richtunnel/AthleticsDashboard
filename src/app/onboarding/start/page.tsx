import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

type StartSearchParams = { plan?: string };
export default async function StartPage({ searchParams }: { searchParams: Promise<StartSearchParams> }) {
  const { plan } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/onboarding/plans");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  if (!user) {
    redirect("/onboarding/plans");
  }

  if (user.plan) {
    redirect("/onboarding/details");
  }

  if (!plan) {
    redirect("/onboarding/plans");
  }

  if (plan === "free_trial_plan" || plan === "free") {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        plan: "free_trial", 
        trialEnd,
        hasReceivedFreeTrial: true,
      },
    });

    redirect("/onboarding/details");
  }

  redirect("/onboarding/plans");
}
