"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface UserOption {
  id: string;
  username: string;
  realName: string;
}

export function useUsers() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/settings/users?pageSize=200");
        if (res.ok) {
          const json = await res.json();
          setUsers(
            (json.data || []).map((u: UserOption) => ({
              id: u.id,
              username: u.username,
              realName: u.realName,
            }))
          );
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return { users, loading };
}

export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useUserDisplayName(userId: string | null | undefined) {
  const { users } = useUsers();

  if (!userId) return "-";
  const found = users.find((u) => u.id === userId);
  return found?.realName || userId;
}
