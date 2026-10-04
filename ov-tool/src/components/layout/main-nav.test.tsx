// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./main-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/tasks/7" }));

afterEach(cleanup);

describe("BottomNav", () => {
  it("hebt den aktuellen Bereich hervor", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Aufgaben" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Übersicht" }).getAttribute("aria-current")).toBeNull();
    expect(screen.queryByRole("link", { name: "Einstellungen" })).toBeNull();
  });
});
