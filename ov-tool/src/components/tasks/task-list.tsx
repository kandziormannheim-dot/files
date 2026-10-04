import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { isOverdue, TASK_STATUS_LABELS } from "@/lib/tasks";
import { taskSummary, type TaskWithRelations } from "@/server/services/tasks";

export function TaskStatusBadge({ task }: { task: Pick<TaskWithRelations, "status" | "dueDate"> }) {
  if (task.status !== "ERLEDIGT" && isOverdue(task)) return <Badge variant="destructive">überfällig</Badge>;
  if (task.status === "ERLEDIGT") return <Badge variant="success">erledigt</Badge>;
  if (task.status === "IN_ARBEIT") return <Badge>in Arbeit</Badge>;
  return <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>;
}

export function TaskList({ tasks, empty = "Keine Aufgaben." }: { tasks: TaskWithRelations[]; empty?: string }) {
  if (!tasks.length) return <p className="text-sm text-neutral-600">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const s = taskSummary(task);
        return (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="block rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-akzent"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={task.status === "ERLEDIGT" ? "text-neutral-500 line-through" : "font-medium"}>
                  {task.title}
                </span>
                <span className="flex shrink-0 gap-1">
                  {task.priority === "HOCH" ? <Badge variant="warning">wichtig</Badge> : null}
                  <TaskStatusBadge task={task} />
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                {s.assignees ? <span>Verantwortlich: {s.assignees}</span> : <span>noch niemand verantwortlich</span>}
                {s.due ? <span>Frist: {s.due}</span> : null}
                {s.origin ? <span>{s.origin}</span> : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
