import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Sentry BEFORE importing the route handler (handler imports Sentry at module load)
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { POST, GET } from "./route";

describe("/api/csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 + forwards legacy CSP-1 report to Sentry", async () => {
    const body = {
      "csp-report": {
        "document-uri": "https://crialook.com.br/",
        "violated-directive": "script-src",
        "effective-directive": "script-src",
        "blocked-uri": "https://evil.example.com/x.js",
      },
    };
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("script-src"),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ csp_violation: "true", directive: "script-src" }),
      }),
    );
  });

  it("returns 204 + forwards modern Reporting API array to Sentry", async () => {
    const body = [
      {
        type: "csp-violation",
        body: {
          documentURL: "https://crialook.com.br/",
          blockedURL: "https://evil.example.com/x.js",
          effectiveDirective: "script-src",
          disposition: "report",
        },
      },
    ];
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("returns 204 + swallows malformed body silently (no Sentry call)", async () => {
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("returns 204 on empty body (no Sentry call)", async () => {
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: "",
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("returns 405 on GET", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
