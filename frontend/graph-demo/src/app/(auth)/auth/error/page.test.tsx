import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderToReadableStream } from "react-dom/server";
import type { ReactElement } from "react";

import { en } from "@/lib/i18n/en";
import { zhCN } from "@/lib/i18n/zh-CN";

// @covers route/auth/error
// @level unit

async function renderServerComponent(jsx: ReactElement) {
  const stream = await renderToReadableStream(jsx);
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let html = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    html += value;
  }
  document.body.innerHTML = html;
}

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/review/store", () => ({
  getReviewerLocalePreference: vi.fn(() => {
    throw new Error("preference store should not be called");
  }),
  updateReviewerLocalePreference: vi.fn(() => {
    throw new Error("preference store should not be called");
  }),
}));

import { headers } from "next/headers";
import {
  getReviewerLocalePreference,
  updateReviewerLocalePreference,
} from "@/lib/review/store";
import AuthErrorPage from "./page";

const mockedHeaders = vi.mocked(headers);
const mockedGetPreference = vi.mocked(getReviewerLocalePreference);
const mockedUpdatePreference = vi.mocked(updateReviewerLocalePreference);

describe("AuthErrorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders in English when the browser requests English", async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({ "accept-language": "en-US" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >
    );

    await renderServerComponent(
      <AuthErrorPage searchParams={Promise.resolve({ error: "access_denied" })} />
    );

    expect(
      screen.getByRole("heading", { name: en.authAccessDeniedTitle })
    ).toBeInTheDocument();
    expect(screen.getByText(en.authAccessDeniedBody)).toBeInTheDocument();
    expect(screen.getByText(en.authentication)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.loginWithAnotherAccount })
    ).toBeInTheDocument();
  });

  it("renders in Chinese when the browser requests Chinese", async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({ "accept-language": "zh-CN" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >
    );

    await renderServerComponent(
      <AuthErrorPage searchParams={Promise.resolve({ error: "access_denied" })} />
    );

    expect(
      screen.getByRole("heading", { name: zhCN.authAccessDeniedTitle })
    ).toBeInTheDocument();
    expect(screen.getByText(zhCN.authAccessDeniedBody)).toBeInTheDocument();
    expect(screen.getByText(zhCN.authentication)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: zhCN.loginWithAnotherAccount })
    ).toBeInTheDocument();
  });

  it("localizes unknown errors using the fallback title and body", async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({ "accept-language": "en" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >
    );

    await renderServerComponent(
      <AuthErrorPage searchParams={Promise.resolve({ error: "unknown" })} />
    );

    expect(
      screen.getByRole("heading", { name: en.authLoginFailedTitle })
    ).toBeInTheDocument();
    expect(screen.getByText(en.authLoginFailedBody)).toBeInTheDocument();
  });

  it("does not read or write the reviewer preference store", async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({ "accept-language": "en" }) as unknown as Awaited<
        ReturnType<typeof headers>
      >
    );

    await renderServerComponent(
      <AuthErrorPage searchParams={Promise.resolve({ error: "access_denied" })} />
    );

    expect(mockedGetPreference).not.toHaveBeenCalled();
    expect(mockedUpdatePreference).not.toHaveBeenCalled();
  });
});
