"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Send } from "lucide-react";

interface EmailComposerProps {
  gameId?: string;
  onClose: () => void;
}

export function EmailComposer({ gameId, onClose }: EmailComposerProps) {
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = gameId ? `/api/email/game/${gameId}` : "/api/email/send";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to send email");
      return res.json();
    },
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const emailData = gameId
      ? { recipients: to.split(",").map((e) => e.trim()) }
      : {
          to: to.split(",").map((e) => e.trim()),
          cc: cc ? cc.split(",").map((e) => e.trim()) : [],
          subject,
          body,
          gameId: gameId || null,
        };

    mutation.mutate(emailData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold">Send Email</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">To (comma separated)</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="email@example.com, another@example.com"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            {!gameId && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">CC (optional)</label>
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </>
            )}

            {gameId && <p className="text-sm text-gray-600">Game details will be automatically included in the email.</p>}

            {mutation.isError && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Failed to send email. Please try again.</div>}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="px-6 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Send size={18} />
                {mutation.isPending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
