"use client"

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ChecklistPage() {
  const router = useRouter();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is from the iframe about the boost traffic button
      if (event.data && event.data.action === "boost-traffic") {
        router.push("/welcome");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  return (
    <div className="w-full h-screen bg-gray-900">
      <iframe
        src="https://static-checklist-782191.framer.app/"
        width="100%"
        height="100%"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        className="w-full h-full"
      />
    </div>
  );
}