"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { notify } from "@/lib/toast";

const recentlyShown = new Set<string>();

export function AuthToastWatcher() {
  const searchParams = useSearchParams();
  const localShownRef = useRef<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const checkout = searchParams.get("checkout");

    if (
      checkout === "success" &&
      localShownRef.current !== "checkout:success" &&
      !recentlyShown.has("checkout:success")
    ) {
      localShownRef.current = "checkout:success";
      recentlyShown.add("checkout:success");
      setTimeout(() => recentlyShown.delete("checkout:success"), 3000);

      notify.success("Subscription updated! Your workspace limits are now active.");

      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      return;
    }

    if (
      error &&
      localShownRef.current !== `error:${error}` &&
      !recentlyShown.has(`error:${error}`)
    ) {
      localShownRef.current = `error:${error}`;
      recentlyShown.add(`error:${error}`);
      setTimeout(() => recentlyShown.delete(`error:${error}`), 3000);

      notify.error(error);

      // Clean query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } else if (
      message &&
      localShownRef.current !== `message:${message}` &&
      !recentlyShown.has(`message:${message}`)
    ) {
      localShownRef.current = `message:${message}`;
      recentlyShown.add(`message:${message}`);
      setTimeout(() => recentlyShown.delete(`message:${message}`), 3000);

      notify.success(message);

      // Clean query params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [searchParams]);

  return null;
}
