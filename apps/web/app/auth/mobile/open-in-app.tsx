"use client";

import { useEffect } from "react";

export function OpenInApp({ href }: { href: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);
  return (
    <a href={href} className="btn btn-primary mt-8">
      Open Echo
    </a>
  );
}
