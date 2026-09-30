"use client";

import { useSyncExternalStore, useCallback } from "react";

export type Theme = "light" | "dark";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("storage", callback);
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mql.removeEventListener("change", callback);
  };
}

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("cairn-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("cairn-theme", nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
      window.dispatchEvent(new Event("storage"));
    } catch {
      // Ignore local storage errors in sandboxed environments
    }
  }, [theme]);

  return { theme, toggleTheme };
}
