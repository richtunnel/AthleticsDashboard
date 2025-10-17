import { Suspense } from "react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { ImportBox } from "@/components/import-export/ImportBox";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
        <p className="text-gray-600">Import your CSV game schedules and navigate to game center to create, manage, update, email and automate your schedules. </p>
        <strong>You can make updates to your game schedule inside game center and download it.</strong>
        <br />
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        {/* <DashboardStats /> */}
        <ImportBox />
        {/* <p className="mt-4 text-gray-600"></p> */}
        {/* <DashboardStats /> */}
      </Suspense>
    </div>
  );
}
