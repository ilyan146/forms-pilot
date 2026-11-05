import { describe, expect, it } from "vitest";

import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";

describe("errorMessage", () => {
  it("shows the API's own explanation", () => {
    const error = new ApiError(429, { detail: "Too many requests. Try again in 12 seconds." });

    expect(errorMessage(error)).toBe("Too many requests. Try again in 12 seconds.");
  });

  it("does not show validation details meant for developers", () => {
    const error = new ApiError(422, { detail: [{ loc: ["body"], msg: "Field required" }] });

    expect(errorMessage(error)).toBe("The API did not accept the request.");
  });

  it("explains an unreachable server", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toMatch(/Cannot reach the Forms Pilot API/);
  });
});

it("recognises a rejected token by status", () => {
  expect(isUnauthorized(new ApiError(401, { detail: "Your API token is missing or not valid." }))).toBe(true);
  expect(isUnauthorized(new ApiError(503, {}))).toBe(false);
});
