import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionValue, type IdentityTokenResponse } from "@/lib/auth/identity-session";
import { GET, POST } from "./route";

// @covers api/locale/preference
// @level unit

vi.mock("@/lib/review/store", () => ({
  getReviewerLocalePreference: vi.fn(),
  updateReviewerLocalePreference: vi.fn(),
}));

import {
  getReviewerLocalePreference,
  updateReviewerLocalePreference,
} from "@/lib/review/store";

const mockedGet = vi.mocked(getReviewerLocalePreference);
const mockedUpdate = vi.mocked(updateReviewerLocalePreference);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeTokenResponse(): IdentityTokenResponse {
  return {
    user: {
      id: "reviewer_123",
      email: "reviewer@skyee360.com",
      name: "Reviewer",
      image: null,
    },
    organization: {
      id: "org_1",
      slug: "skyee",
      name: "Skyee",
    },
    membership: {
      role: "REVIEWER",
      status: "ACTIVE",
    },
  };
}

function makeRequestWithSession(
  method: string,
  body?: object
): Request {
  const sessionValue = createSessionValue(makeTokenResponse());
  if (!sessionValue) {
    throw new Error("Failed to create session value");
  }

  const headers: Record<string, string> = {
    cookie: `skyee_graph_session=${encodeURIComponent(sessionValue)}`,
  };

  if (body) {
    headers["content-type"] = "application/json";
  }

  return new Request("http://localhost/api/locale/preference", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeUnsignedRequest(method: string, body?: object): Request {
  const headers: Record<string, string> = {};
  if (body) {
    headers["content-type"] = "application/json";
  }
  return new Request("http://localhost/api/locale/preference", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/locale/preference", () => {
  it("returns the signed-in reviewer's stored locale preference", async () => {
    mockedGet.mockResolvedValue("zh-CN");

    const response = await GET(makeRequestWithSession("GET"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ locale: "zh-CN" });
    expect(mockedGet).toHaveBeenCalledWith("reviewer_123");
  });

  it("returns null when the reviewer has no stored preference", async () => {
    mockedGet.mockResolvedValue(null);

    const response = await GET(makeRequestWithSession("GET"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ locale: null });
  });

  it("returns 401 when the request is not signed in", async () => {
    const response = await GET(makeUnsignedRequest("GET"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/locale/preference", () => {
  it("updates the locale preference and returns the saved locale", async () => {
    mockedUpdate.mockResolvedValue("en");

    const response = await POST(
      makeRequestWithSession("POST", { locale: "en" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ locale: "en" });
    expect(mockedUpdate).toHaveBeenCalledWith("reviewer_123", "en");
  });

  it("updates zh-CN locale preference", async () => {
    mockedUpdate.mockResolvedValue("zh-CN");

    const response = await POST(
      makeRequestWithSession("POST", { locale: "zh-CN" })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ locale: "zh-CN" });
  });

  it("returns 400 for an unsupported locale", async () => {
    const response = await POST(
      makeRequestWithSession("POST", { locale: "fr" })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the locale field is missing", async () => {
    const response = await POST(makeRequestWithSession("POST", {}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not signed in", async () => {
    const response = await POST(makeUnsignedRequest("POST", { locale: "en" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHENTICATED");
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("returns 500 when the store update fails", async () => {
    mockedUpdate.mockRejectedValue(new Error("database down"));

    const response = await POST(
      makeRequestWithSession("POST", { locale: "en" })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });
});
