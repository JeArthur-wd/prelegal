"use client";

import { useEffect, useState } from "react";

import AuthScreen from "@/components/AuthScreen";
import { Logo } from "@/components/Brand";
import Workspace from "@/components/Workspace";
import { getCurrentUser, type User } from "@/lib/api";
import type { Template } from "@/lib/template";

/** Shows the sign-in screen or the workspace, depending on whether there is a session. */
export default function App({ templates }: { templates: Template[] }) {
  // undefined while we check for an existing session.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    getCurrentUser().then(setUser, () => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
        <div className="animate-pulse">
          <Logo />
        </div>
      </div>
    );
  }
  if (user === null) {
    return <AuthScreen templates={templates} onSignedIn={setUser} />;
  }
  return <Workspace user={user} templates={templates} onSignedOut={() => setUser(null)} />;
}
