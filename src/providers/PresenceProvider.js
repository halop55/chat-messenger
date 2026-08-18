import { useEffect } from "react";
import { startPresenceTracking } from "../services/presenceServices";

export function PresenceProvider({ children }) {
  useEffect(() => startPresenceTracking(), []);

  return children;
}
