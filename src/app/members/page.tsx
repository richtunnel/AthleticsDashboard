"use client";

import TopFooter from "@/components/footer/topFooter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ATTEMPTS_KEY = "members_signin_attempts";
const LOCK_UNTIL_KEY = "members_signin_locked_until";

export default function MembersPage() {
  const router = useRouter();
  const { status } = useSession();

  const [memberNo, setMemberNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const lockedUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) ?? "0");

    if (lockedUntil && Date.now() < lockedUntil) {
      setLocked(true);
      router.replace("/");
      return;
    }

    if (lockedUntil && Date.now() >= lockedUntil) {
      localStorage.removeItem(LOCK_UNTIL_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
    }

    const storedAttempts = Number(localStorage.getItem(ATTEMPTS_KEY) ?? "0");

    if (storedAttempts >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + LOCKOUT_MS));
      setLocked(true);
      router.replace("/");
      return;
    }

    setAttempts(storedAttempts);
  }, [router]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  const attemptsRemaining = useMemo(() => Math.max(0, MAX_ATTEMPTS - attempts), [attempts]);

  const lockAndSendHome = () => {
    localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + LOCKOUT_MS));
    setLocked(true);
    setTimeout(() => router.replace("/"), 900);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (submitting || locked) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await signIn("member-code", {
        redirect: false,
        code: memberNo,
      });

      if (result?.ok) {
        localStorage.removeItem(ATTEMPTS_KEY);
        localStorage.removeItem(LOCK_UNTIL_KEY);
        router.push("/dashboard");
        return;
      }

      const nextAttempts = attempts + 1;
      localStorage.setItem(ATTEMPTS_KEY, String(nextAttempts));
      setAttempts(nextAttempts);

      if (nextAttempts >= MAX_ATTEMPTS) {
        setError("Too many attempts. Redirecting you back home.");
        lockAndSendHome();
        return;
      }

      setError(`Invalid member number. ${MAX_ATTEMPTS - nextAttempts} attempt(s) remaining.`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-theme="dark"
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "#131316",
        color: "rgb(197, 197, 210)",
      }}
    >
      <div className="flex-1 flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-xl relative">
          <Link
            href="/"
            className="absolute right-0 -top-10 text-sm font-medium"
            style={{ color: "rgb(197, 197, 210)", textDecoration: "none" }}
          >
            Close
          </Link>

          <div className="text-center">
            <h1 className="text-5xl font-semibold tracking-tight">Howdy!</h1>
            <p className="mt-4 text-lg" style={{ color: "rgb(197, 197, 210)" }}>
              Thank you for your time and loyalty.
            </p>
            <p className="mt-2" style={{ color: "rgb(197, 197, 210)" }}>
              Please enter your member number for access.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col items-center gap-4">
            <input
              value={memberNo}
              onChange={(e) => setMemberNo(e.target.value)}
              placeholder="Enter member no."
              autoComplete="off"
              spellCheck={false}
              disabled={locked || submitting}
              className="w-full rounded-xl text-base outline-none"
              style={{
                border: `1px solid rgb(197, 197, 210)`,
                padding: "18px 22px",
                backgroundColor: "rgba(197, 197, 210, 0.04)",
              }}
            />

            <button
              type="submit"
              disabled={locked || submitting || memberNo.trim().length === 0}
              className="w-full rounded-xl font-semibold transition-opacity"
              style={{
                border: `1px solid rgb(197, 197, 210)`,
                padding: "14px 22px",
                opacity: locked || submitting || memberNo.trim().length === 0 ? 0.55 : 1,
              }}
            >
              {submitting ? "Checking..." : "Continue"}
            </button>

            <div className="text-sm" style={{ color: "rgb(197, 197, 210)" }}>
              Attempts: {attempts}/{MAX_ATTEMPTS} ({attemptsRemaining} remaining)
            </div>

            {error ? (
              <div
                className="w-full rounded-xl text-sm"
                style={{
                  border: "1px solid rgb(197, 197, 210)",
                  padding: "12px 14px",
                  backgroundColor: "rgba(197, 197, 210, 0.06)",
                }}
              >
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgb(197, 197, 210)" }}>
        <TopFooter />
      </div>
    </div>
  );
}
