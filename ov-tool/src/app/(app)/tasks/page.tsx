import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listTasks, type TaskFilter, type TaskView } from "@/server/services/tasks";
import { listActiveUsers } from "@/server/services/users";

export const metadata: Metadata = { title: "Aufgaben" };

const VIEWS: [TaskView, string][] = [
  ["mine", "Meine"],
  ["all", "Alle"],
  ["overdue", "Überfällig"],
];

type Search = { ansicht?: string; status?: string; person?: string; herkunft?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = (VIEWS.find(([v]) => v === sp.ansicht)?.[0] ?? "mine") as TaskView;
  const filter: TaskFilter = {
    view,
    status: (["OFFEN", "IN_ARBEIT", "ERLEDIGT", "AKTIV"] as const).find((s) => s === sp.status),
    assigneeId: sp.person || undefined,
    origin: (["meeting", "action", "topic", "resolution", "none"] as const).find((o) => o === sp.herkunft),
  };
  const [tasks, users] = await Promise.all([listTasks(user, filter), listActiveUsers()]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Aufgaben" />
        {can(user.role, "task.create") ? (
          <Button asChild>
            <Link href="/tasks/new">Aufgabe anlegen</Link>
          </Button>
        ) : null}
      </div>
      <nav className="mb-4 flex gap-1 border-b" aria-label="Ansicht">
        {VIEWS.map(([v, label]) => (
          <Link
            key={v}
            href={`/tasks?ansicht=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              v === view ? "border-akzent font-semibold text-akzent-dunkel" : "border-transparent text-neutral-600",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "all" ? (
        <form className="mb-4 grid gap-2 sm:grid-cols-4" action="/tasks">
          <input type="hidden" name="ansicht" value="all" />
          <NativeSelect name="status" defaultValue={sp.status ?? ""} aria-label="Status">
            <option value="">alle Status</option>
            <option value="AKTIV">offen + in Arbeit</option>
            <option value="OFFEN">offen</option>
            <option value="IN_ARBEIT">in Arbeit</option>
            <option value="ERLEDIGT">erledigt</option>
          </NativeSelect>
          <NativeSelect name="person" defaultValue={sp.person ?? ""} aria-label="Person">
            <option value="">alle Personen</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="herkunft" defaultValue={sp.herkunft ?? ""} aria-label="Herkunft">
            <option value="">jede Herkunft</option>
            <option value="meeting">aus Sitzungen</option>
            <option value="resolution">aus Beschlüssen</option>
            <option value="action">aus Aktionen</option>
            <option value="topic">aus Themen</option>
            <option value="none">ohne Herkunft</option>
          </NativeSelect>
          <Button type="submit" variant="outline">
            Filtern
          </Button>
        </form>
      ) : null}
      <TaskList
        tasks={tasks}
        empty={view === "mine" ? "Keine offenen Aufgaben für Sie." : view === "overdue" ? "Nichts überfällig." : "Keine Aufgaben."}
      />
    </>
  );
}
