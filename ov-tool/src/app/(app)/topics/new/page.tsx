import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TopicForm } from "@/components/topic-form";
import { requirePageCapability } from "@/server/auth/session";
import { encryptionConfigured } from "@/server/crypto";
import { getSettings } from "@/server/services/settings";
import { listActiveUsers } from "@/server/services/users";
import { createTopicAction } from "../actions";

export const metadata: Metadata = { title: "Thema anlegen" };

export default async function NewTopicPage() {
  await requirePageCapability("topic.create");
  const [s, users] = await Promise.all([getSettings(), listActiveUsers()]);
  return (
    <>
      <PageHeader title="Thema anlegen" />
      <TopicForm
        action={createTopicAction}
        categories={s.topicCategories}
        users={users}
        hasContact={false}
        retentionMonths={s.retention.citizenContactMonths}
        encryptionReady={encryptionConfigured()}
      />
    </>
  );
}
