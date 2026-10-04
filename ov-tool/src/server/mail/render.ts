import "server-only";
import { renderMailTemplate, type RenderedMail } from "@/server/templates/engine";
import { getTemplateSource } from "@/server/templates/store";
import { ovContext } from "@/server/ov";

/** Rendert eine Mail-Vorlage aus der Ablage; ov.* wird automatisch ergänzt. */
export async function renderMail(key: string, context: object): Promise<RenderedMail & { version: number }> {
  const { source, version } = await getTemplateSource(key);
  return { ...renderMailTemplate(source, { ov: await ovContext(), ...context }), version };
}
