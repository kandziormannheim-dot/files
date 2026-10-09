import type { VideoProject } from "@prisma/client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { FORMAT_KEYS, VIDEO_FORMATS } from "@/lib/video-plan";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ProjectForm({ action, project, submitLabel }: { action: Action; project?: VideoProject; submitLabel: string }) {
  const formats = project?.formats ?? ["9:16"];
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Titel (intern)" name="title" className="sm:col-span-2">
        <Input id="title" name="title" defaultValue={project?.title} required maxLength={150} placeholder="z. B. Schulweg Kloppenheimer Straße" />
      </Field>
      <Field label="Worum geht es?" name="topic" hint="Thema, Anlass, Fakten – daraus entstehen Titelzeile und Einblendungen. Nur was hier steht, wird als Fakt verwendet." className="sm:col-span-2">
        <Textarea
          id="topic"
          name="topic"
          rows={4}
          defaultValue={project?.topic}
          required
          placeholder="z. B. An der Kreuzung Kloppenheimer Straße/Hauptstraße queren täglich rund 300 Schulkinder ohne Zebrastreifen. Die CDU beantragt im Bezirksbeirat einen Fußgängerüberweg."
        />
      </Field>
      <Field label="Kernbotschaft (optional)" name="message" hint="Steht auf der Abschlusstafel.">
        <Input id="message" name="message" defaultValue={project?.message} maxLength={300} placeholder="Sichere Schulwege für unsere Kinder" />
      </Field>
      <Field label="Handlungsaufruf (optional)" name="callToAction">
        <Input id="callToAction" name="callToAction" defaultValue={project?.callToAction} maxLength={120} placeholder="Mehr auf cdu-sf.de" />
      </Field>
      <Field
        label="Regievorgaben (optional)"
        name="direction"
        hint="Ergänzt die allgemeinen Regievorgaben (Einstellungen → Vorlagen → „Prompt Videoschnitt“)."
        className="sm:col-span-2"
      >
        <Textarea
          id="direction"
          name="direction"
          rows={3}
          defaultValue={project?.direction}
          placeholder={"z. B. Mit dem O-Ton der Anwohnerin beginnen. Den Satz zur Ampel unbedingt verwenden. Ruhiges Tempo, keine schnellen Schnitte."}
        />
      </Field>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Formate</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {FORMAT_KEYS.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <Checkbox name="formats[]" value={f} defaultChecked={formats.includes(f)} />
              <span>
                {VIDEO_FORMATS[f].label} <span className="text-neutral-600">· {VIDEO_FORMATS[f].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Kanal (Logo)" name="account">
        <NativeSelect id="account" name="account" defaultValue={project?.account ?? "OV"}>
          <option value="OV">CDU-Ortsverband</option>
          <option value="BBR">CDU-Gruppe im Bezirksbeirat</option>
        </NativeSelect>
      </Field>
      <Field label="Höchstlänge (Sekunden)" name="maxSeconds" hint="inklusive 3 Sekunden Abschlusstafel">
        <Input id="maxSeconds" name="maxSeconds" type="number" min={10} max={60} defaultValue={project?.maxSeconds ?? 30} required />
      </Field>
      <Field label="Musiklautstärke unter O-Tönen (%)" name="musicVolume" hint="nur wenn Musik hochgeladen ist; die Musik wird bei Sprache automatisch leiser">
        <Input id="musicVolume" name="musicVolume" type="number" min={0} max={60} defaultValue={project?.musicVolume ?? 15} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <Checkbox name="subtitles" defaultChecked={project?.subtitles ?? true} />
        O-Töne automatisch untertiteln
      </label>
      {!project ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm sm:col-span-2">
          <Checkbox name="consent" required className="mt-0.5" />
          <span>
            Alle erkennbar gezeigten und zu hörenden Personen sind mit Aufnahme und Veröffentlichung einverstanden (bei Minderjährigen die Eltern). Die Clips werden nur auf
            dem eigenen Server bearbeitet; der Ton wird dort abgeschrieben, Standbilder und Transkript gehen für den Schnittvorschlag an die Claude API.
          </span>
        </label>
      ) : null}
      <SubmitButton className="justify-self-start sm:col-span-2">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
