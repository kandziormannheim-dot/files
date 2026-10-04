import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { TopicForm } from "@/components/topic-form";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { encryptionConfigured } from "@/server/crypto";
import { getSettings } from "@/server/services/settings";
import { canEditTopic, getTopic } from "@/server/services/topics";
import { listActiveUsers } from "@/server/services/users";
import { deleteTopicAction, updateTopicAction } from "../../actions";

export const metadata: Metadata = { title: "Thema bearbeiten" };

export default async function EditTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [topic, s, users] = await Promise.all([getTopic(user, id), getSettings(), listActiveUsers()]);
  if (!canEditTopic(user, topic)) redirect("/no-access");
  return (
    <>
      <PageHeader title="Thema bearbeiten" />
      <TopicForm
        action={updateTopicAction.bind(null, id)}
        topic={topic}
        categories={s.topicCategories}
        users={users}
        hasContact={!!topic.citizenContact}
        retentionMonths={s.retention.citizenContactMonths}
        encryptionReady={encryptionConfigured()}
      />
      {can(user.role, "topic.editAll") || topic.createdById === user.id ? (
        <ActionForm action={deleteTopicAction.bind(null, id)} className="mt-8 border-t pt-6">
          <ConfirmSubmit variant="destructive" confirm="Thema mit Verlauf und Anhängen löschen?">
            Thema löschen
          </ConfirmSubmit>
        </ActionForm>
      ) : null}
    </>
  );
}
