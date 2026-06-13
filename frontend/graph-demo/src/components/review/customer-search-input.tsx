"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";

interface CustomerSearchInputProps {
  currentCustId: string;
}

export function CustomerSearchInput({ currentCustId }: CustomerSearchInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(currentCustId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentCustId) {
      router.push(`/review/${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-md">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter customer ID"
        className="font-mono"
        aria-label="Customer ID"
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!value.trim() || value.trim() === currentCustId}
      >
        <SearchIcon className="h-4 w-4 mr-1" />
        Review
      </Button>
    </form>
  );
}
