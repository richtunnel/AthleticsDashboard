"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { CalendarPreviewWidget } from "@/components/dashboard/CalendarPreviewWidget";
import { ImportBox } from "@/components/import-export/ImportBox";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) router.push("/login");
    })();
  }, [router]);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Import your spreadsheets</h2>
        <strong>Import your CSV game schedules and navigate to game center to create, manage, update, email and automate your schedules. </strong>
        <p className="text-gray-600">You can also make updates to your game schedule inside game center and download it back to it's original CSV format.</p>
        <br />
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1 w-full">
          <Suspense fallback={<div>Loading import tools...</div>}>
            <ImportBox />
          </Suspense>
        </div>
        <CalendarPreviewWidget />
      </div>
    </div>
  );
}
