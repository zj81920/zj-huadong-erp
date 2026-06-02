import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useFlowConfigured(businessType: string): {
  configured: boolean;
  loading: boolean;
} {
  const { user } = useAuth();
  const isAdmin = user?.username === "admin";
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      setConfigured(true);
      setLoading(false);
      return;
    }
    if (!businessType) {
      setConfigured(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/approval-flows/check?businessType=${businessType}`)
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data) => {
        setConfigured(data.configured ?? false);
        setLoading(false);
      })
      .catch(() => {
        setConfigured(false);
        setLoading(false);
      });
  }, [businessType, isAdmin]);

  return { configured, loading };
}
