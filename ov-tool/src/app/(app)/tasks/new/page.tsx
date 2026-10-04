import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { requirePageCapability } from "@/server/auth/session";
import { listActiveUsers } from "@/server/services/users";
import { createTaskAction } from "../actions";

export const metadata: Metadata = { title: "Aufgabe anlegen" };

type Search = { meetingId?: string; agendaItemId?: string; resolutionId?: string; actionId?: string; topicId?: string; titel?: string };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePageCapability("task.create");
  const { titel, ...origin } = await searchParams;
  const users = await listActiveUsers();
  return (
    <>
      <PageHeader title="Aufgabe anlegen" />
      <TaskForm action={createTaskAction} users={users} origin={origin} values={{ title: titel }} />
    </>
  );
}
