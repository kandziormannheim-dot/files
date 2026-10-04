import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { requireUser } from "@/server/auth/session";
import { canEditTask, getTask, originText } from "@/server/services/tasks";
import { listActiveUsers } from "@/server/services/users";
import { updateTaskAction } from "../../actions";

export const metadata: Metadata = { title: "Aufgabe bearbeiten" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = await getTask(user, id);
  if (!canEditTask(user, task)) redirect("/no-access");
  const users = await listActiveUsers();
  return (
    <>
      <PageHeader title="Aufgabe bearbeiten" />
      <TaskForm
        action={updateTaskAction.bind(null, id)}
        users={users}
        isEdit
        originLabel={originText(task) || undefined}
        values={{ ...task, assigneeIds: task.assignees.map((a) => a.userId) }}
      />
    </>
  );
}
