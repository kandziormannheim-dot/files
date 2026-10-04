import { beforeEach, describe, expect, it } from "vitest";
import { form, hasTestDb, makeUser, resetDb } from "../../../tests/db";
import { fromBerlin } from "@/lib/dates";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";
import { captureMailsForTests } from "@/server/mail/transport";
import { addTaskComment, createTask, deleteTask, listTasks, setTaskStatus, updateTask } from "./tasks";

describe.skipIf(!hasTestDb)("Aufgaben (DB)", () => {
  beforeEach(resetDb);

  it("legt Aufgaben an und benachrichtigt nur andere Verantwortliche", async () => {
    const outbox = captureMailsForTests();
    const a = await makeUser({ role: "VORSTAND", name: "Anna" });
    const b = await makeUser({ role: "VORSTAND", name: "Bernd" });
    const task = await createTask(
      a,
      form({ title: "Plakate bestellen", "assigneeIds[]": [a.id, b.id], dueDate: "2026-03-13", dueText: "ignoriert" }),
    );
    expect(task.dueText).toBe("");
    expect(task.dueDate?.toISOString()).toBe(fromBerlin(2026, 3, 13).toISOString());
    expect(outbox.map((m) => m.to)).toEqual([b.email]);
    expect(outbox[0]!.subject).toBe("Neue Aufgabe: Plakate bestellen");
    expect(outbox[0]!.text).toContain("Anna hat Ihnen eine Aufgabe zugewiesen");
  });

  it("Vorstand bearbeitet nur eigene Aufgaben, Gruppenaufgaben aber alle", async () => {
    captureMailsForTests();
    const a = await makeUser({ role: "VORSTAND" });
    const b = await makeUser({ role: "VORSTAND" });
    const leser = await makeUser({ role: "LESEZUGRIFF" });
    const own = await createTask(a, form({ title: "Eigene", "assigneeIds[]": [a.id] }));
    await expect(setTaskStatus(b, own.id, "ERLEDIGT")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setTaskStatus(leser, own.id, "ERLEDIGT")).rejects.toBeInstanceOf(ForbiddenError);
    const group = await createTask(a, form({ title: "Alle", assigneeGroup: "VORSTAND" }));
    await setTaskStatus(b, group.id, "ERLEDIGT");
    expect((await db.task.findUniqueOrThrow({ where: { id: group.id } })).completedAt).not.toBeNull();
    await expect(deleteTask(b, group.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addTaskComment(leser, own.id, form({ text: "x" }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("setzt Erinnerungen zurück, wenn sich die Frist ändert, und meldet neue Verantwortliche", async () => {
    const outbox = captureMailsForTests();
    const a = await makeUser({ role: "ADMIN" });
    const b = await makeUser({ role: "VORSTAND" });
    const t = await createTask(a, form({ title: "T", dueDate: "2026-03-01" }));
    await db.task.update({ where: { id: t.id }, data: { remindedBeforeAt: new Date() } });
    await updateTask(a, t.id, form({ title: "T", dueDate: "2026-04-01", "assigneeIds[]": [b.id] }));
    const after = await db.task.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.remindedBeforeAt).toBeNull();
    expect(outbox.map((m) => m.to)).toEqual([b.email]);
    expect(await db.auditLog.count({ where: { entityId: t.id } })).toBe(2);
  });

  it("filtert Meine und Überfällig", async () => {
    captureMailsForTests();
    const a = await makeUser({ role: "VORSTAND" });
    const b = await makeUser({ role: "VORSTAND" });
    await createTask(a, form({ title: "für b, überfällig", "assigneeIds[]": [b.id], dueDate: "2020-01-01" }));
    await createTask(a, form({ title: "Gruppe", assigneeGroup: "ALLE" }));
    await createTask(a, form({ title: "nur a", "assigneeIds[]": [a.id] }));
    expect((await listTasks(b, { view: "mine" })).map((t) => t.title)).toEqual(["für b, überfällig", "Gruppe"]);
    expect((await listTasks(a, { view: "overdue" })).map((t) => t.title)).toEqual(["für b, überfällig"]);
    expect(await listTasks(a, { view: "all" })).toHaveLength(3);
  });
});
