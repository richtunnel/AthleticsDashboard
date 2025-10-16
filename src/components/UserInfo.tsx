"use client";

import { useSession } from "next-auth/react";

export function UserInfo() {
  const { data: session } = useSession();

  return (
    <div>
      <p>Email: {session?.user?.email}</p>
      <p>Role: {session?.user?.role}</p>
      <p>ID: {session?.user?.id}</p>
    </div>
  );
}
