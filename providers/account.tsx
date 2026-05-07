"use client";

import type { TMember } from "@heiso-io/bee/lib/db/schema";
import { useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";

interface Membership {
  id: string;
  isOwner: boolean;
  role: {
    id: string;
    name: string;
  } | null;
}

interface AccountContextType {
  member: Partial<TMember> | null;
  kind: "dev" | "member";
  membership: Membership[] | null;
  isLoading: boolean;
  error: Error | null;
  updateMember: (member: Partial<TMember>) => void;
}

const AccountContext = createContext<AccountContextType>({
  member: null,
  kind: "member",
  membership: null,
  isLoading: false,
  error: null,
  updateMember: () => {},
});

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [member, setMember] = useState<Partial<TMember> | null>(null);
  const [kind, setKind] = useState<"dev" | "member">("member");
  const [membership, setMembership] = useState<Membership[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMember() {
      try {
        const userId = session?.user?.id;
        const userEmail = session?.user?.email ?? "";

        if (!userId && !userEmail) return null;

        setIsLoading(true);

        const res = await fetch("/api/account/me", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch member: ${res.status}`);
        }
        const data = await res.json();

        if (data) {
          const { kind: dataKind, developer, membership: myMembership, ...rest } = data;
          setMember(rest);
          setKind(dataKind ?? (developer ? "dev" : "member"));
          setMembership(myMembership);
        } else {
          setMember(null);
          setKind("member");
          setMembership(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchMember();
  }, [session?.user?.id, session?.user?.email]);

  const updateMember = (updated: Partial<TMember>) => {
    setMember(updated);
  };

  return (
    <AccountContext.Provider
      value={{
        member,
        membership,
        kind,
        isLoading,
        error,
        updateMember,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}
