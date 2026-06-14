"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheckIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReviewEntrySearch() {
  const router = useRouter();
  const [custId, setCustId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = custId.trim();
    if (trimmed) {
      router.push(`/review/${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-card p-4 shadow-sm shadow-primary/5"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <ClipboardCheckIcon className="size-4 text-primary" />
        Customer Risk Review Workbench
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Customer ID</span>
          <Input
            value={custId}
            onChange={(event) => setCustId(event.target.value)}
            placeholder="Enter customer ID"
            className="font-mono"
            aria-label="Customer ID"
          />
        </label>
        <Button type="submit" disabled={custId.trim().length === 0}>
          <SearchIcon data-icon="inline-start" />
          Open workbench
        </Button>
      </div>
    </form>
  );
}
