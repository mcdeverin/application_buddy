"use client";

import { Analytics } from "@vercel/analytics/next";

export default function DemoAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        // Count demo visits without recording URL parameters or fragments.
        if (url.pathname !== "/demo" && !url.pathname.startsWith("/demo/")) return null;
        url.search = "";
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
