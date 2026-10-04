import { describe, expect, it } from "vitest";
import { fromBerlin } from "./dates";
import { assigneeLabel, compareTasks, daysUntilDue, dueLabel, isOverdue } from "./tasks";

const now = fromBerlin(2026, 3, 10, 9, 0);
const day = (d: number) => fromBerlin(2026, 3, d);

describe("Aufgaben-Fristen", () => {
  it("ist erst am Folgetag der Frist überfällig", () => {
    expect(isOverdue({ dueDate: day(10), status: "OFFEN" }, now)).toBe(false);
    expect(isOverdue({ dueDate: day(9), status: "OFFEN" }, now)).toBe(true);
    expect(isOverdue({ dueDate: day(9), status: "ERLEDIGT" }, now)).toBe(false);
    expect(isOverdue({ dueDate: null, dueText: "laufend", status: "OFFEN" }, now)).toBe(false);
  });

  it("zählt Tage bis zur Frist", () => {
    expect(daysUntilDue({ dueDate: day(13), status: "OFFEN" }, now)).toBe(3);
    expect(daysUntilDue({ dueDate: day(8), status: "OFFEN" }, now)).toBe(-2);
  });

  it("zeigt Datum oder Freitext", () => {
    expect(dueLabel({ dueDate: day(13) })).toBe("13.03.2026");
    expect(dueLabel({ dueDate: null, dueText: "nach Bekanntgabe der Antragsfrist" })).toBe(
      "nach Bekanntgabe der Antragsfrist",
    );
  });

  it("sortiert überfällige zuerst und erledigte zuletzt", () => {
    const t = (name: string, dueDate: Date | null, status: "OFFEN" | "ERLEDIGT" = "OFFEN") => ({
      name,
      dueDate,
      status,
      createdAt: day(1),
    });
    const list = [t("ohne", null), t("erledigt", day(1), "ERLEDIGT"), t("spaeter", day(20)), t("ueber", day(5))];
    expect(list.sort((a, b) => compareTasks(a, b, now)).map((x) => x.name)).toEqual([
      "ueber",
      "spaeter",
      "ohne",
      "erledigt",
    ]);
  });

  it("beschriftet Verantwortliche", () => {
    expect(
      assigneeLabel({ assigneeGroup: "VORSTAND", assignees: [{ user: { name: "Kelsch" } }, { user: { name: "Kandzior" } }] }),
    ).toBe("Vorstand, Kelsch, Kandzior");
  });
});
