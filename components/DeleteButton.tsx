"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this entry and its photos permanently? This cannot be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Delete failed");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <button className="danger" onClick={del} disabled={busy}>
      {busy ? "Deleting…" : "Delete entry"}
    </button>
  );
}
