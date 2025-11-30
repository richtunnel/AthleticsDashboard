"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { CalendarPreviewWidget } from "@/components/dashboard/CalendarPreviewWidget";
import { ImportBox } from "@/components/import-export/ImportBox";
import { ImportUndoButton } from "@/components/games/ImportUndoButton";
import { useImportUndoStore } from "@/lib/stores/importUndoStore";
import { useNotifications } from "@/contexts/NotificationContext";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) router.push("/login");
    })();
  }, [router]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Import your spreadsheets</h2>
        <p className="text-gray-600 text-sm md:text-base">
          Import your CSV game schedules below and navigate to{" "}
          <Link color="(var(--main-blue))" href="dashboard/games">
            <b>Game Center</b>
          </Link>{" "}
          to create, manage, update, email and automate your game schedules.
        </p>
        <br />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 items-start">
        <div className="flex-1 w-full">
          <Suspense fallback={<div>Loading import tools...</div>}>
            <ImportBox
              onImportComplete={(result: any) => {
                if (result.success > 0 && result.createdGameIds && result.createdGameIds.length > 0) {
                  useImportUndoStore.getState().setImportedGames(result.createdGameIds);
                }
                // Invalidate table preferences to immediately show imported custom columns
                queryClient.invalidateQueries({ queryKey: ["tablePreferences", "games"] });
                // Refresh imported columns for calendar group mappings
                queryClient.invalidateQueries({ queryKey: ["importedColumns"] });
              }}
            />
          </Suspense>
        </div>
        <div className="w-full lg:w-auto">
          <CalendarPreviewWidget />
        </div>
      </div>

      <ImportUndoButton
        onUndo={() => {
          queryClient.invalidateQueries({ queryKey: ["games"] });
          queryClient.invalidateQueries({ queryKey: ["tablePreferences", "games"] });
          queryClient.invalidateQueries({ queryKey: ["importedColumns"] });
          addNotification("Import undone - all imported games have been deleted", "success");
        }}
      />
    </div>
  );
}
