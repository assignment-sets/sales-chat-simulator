"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { notify } from "@/lib/toast";

export function AuthToastWatcher() {
  const searchParams = useSearchParams();
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (error && shownRef.current !== `error:${error}`) {
      shownRef.current = `error:${error}`;
      notify.error(error);
      // Clean query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } else if (message && shownRef.current !== `message:${message}`) {
      shownRef.current = `message:${message}`;
      notify.success(message);
      // Clean query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [searchParams]);

  return null;
}
