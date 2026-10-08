import { Camera, FileText, Mail } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, toDateInput } from "@/lib/dates";
import { CONDITIONS, type getItem } from "@/server/services/inventory";
import { addLoanPhotosAction, lendItemAction, resendProtocolAction, returnItemAction } from "../actions";

type Item = Awaited<ReturnType<typeof getItem>>;
type Person = { id: string; name: string };

const today = () => toDateInput(new Date());

function PersonSelect({ name, people, defaultValue }: { name: string; people: Person[]; defaultValue: string }) {
  return (
    <NativeSelect id={name} name={name} defaultValue={defaultValue}>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function ConditionSelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <NativeSelect id={name} name={name} defaultValue={defaultValue}>
      {CONDITIONS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </NativeSelect>
  );
}

const photoHint = "Mehrere Fotos möglich (max. 10). Am Handy Kamera oder Galerie wählen; Standortdaten werden entfernt.";

export function LendForm({ item, people, userId }: { item: Item; people: Person[]; userId: string }) {
  return (
    <ActionForm action={lendItemAction.bind(null, item.id)} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
      <Field label="Datum der Abholung" name="pickupAt">
        <Input id="pickupAt" name="pickupAt" type="date" defaultValue={today()} max={today()} required />
      </Field>
      <Field label="Übergeben von" name="handedOverById">
        <PersonSelect name="handedOverById" people={people} defaultValue={userId} />
      </Field>
      <Field label="Name (wer ausleiht)" name="borrowerName">
        <Input id="borrowerName" name="borrowerName" required placeholder="Vor- und Nachname" autoComplete="off" />
      </Field>
      <Field label="Organisation (optional)" name="organization">
        <Input id="organization" name="organization" placeholder="z. B. JU Mannheim, FDP Mannheim Süd, Verein" />
      </Field>
      <Field label="E-Mail (optional)" name="borrowerEmail" hint="erhält das Ausgabe- und das Rückgabeprotokoll; wird 12 Monate nach der Rückgabe gelöscht" className="sm:col-span-2">
        <Input id="borrowerEmail" name="borrowerEmail" type="email" autoComplete="off" />
      </Field>
      <Field label="Zubehör (optional)" name="accessories" className="sm:col-span-2">
        <Textarea id="accessories" name="accessories" rows={2} placeholder="z. B. 4 Seitenwände, Tasche, 8 Heringe, 2 Gewichte" />
      </Field>
      <Field label="Zustand bei Ausgabe" name="conditionOut">
        <ConditionSelect name="conditionOut" defaultValue={item.condition} />
      </Field>
      <Field label="Rückgabe bis (optional)" name="dueAt">
        <Input id="dueAt" name="dueAt" type="date" min={today()} />
      </Field>
      <Field label="Notiz (optional)" name="note" className="sm:col-span-2">
        <Input id="note" name="note" placeholder="z. B. für das Sommerfest" />
      </Field>
      <Field label="Fotos bei Ausgabe (optional)" name="photos" hint={photoHint} className="sm:col-span-2">
        <Input id="photos" name="photos" type="file" accept="image/*" multiple />
      </Field>
      <SubmitButton className="justify-self-start sm:col-span-2" pendingText="Wird gebucht …">
        Verleih buchen und Protokoll senden
      </SubmitButton>
    </ActionForm>
  );
}

export function ReturnForm({ item, people, userId }: { item: Item; people: Person[]; userId: string }) {
  const open = item.loans.find((l) => !l.returnedAt);
  return (
    <ActionForm action={returnItemAction.bind(null, item.id)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Datum der Rückgabe" name="returnedAt">
        <Input id="returnedAt" name="returnedAt" type="date" defaultValue={today()} max={today()} required />
      </Field>
      <Field label="Angenommen von" name="receivedById">
        <PersonSelect name="receivedById" people={people} defaultValue={userId} />
      </Field>
      <Field label="Zurückgegeben von" name="returnedByName">
        <Input id="returnedByName" name="returnedByName" defaultValue={open?.borrowerName || item.lentTo || ""} />
      </Field>
      <Field label="Zustand bei Rückgabe" name="conditionIn" hint="wird als aktueller Zustand übernommen">
        <ConditionSelect name="conditionIn" defaultValue={open?.conditionOut || item.condition} />
      </Field>
      {open?.accessories ? (
        <Field label="Zubehör vollständig?" name="accessoriesComplete" hint={`Ausgegeben: ${open.accessories}`} className="sm:col-span-2">
          <NativeSelect id="accessoriesComplete" name="accessoriesComplete" defaultValue="ja">
            <option value="ja">ja</option>
            <option value="nein">nein – siehe Bemerkung</option>
          </NativeSelect>
        </Field>
      ) : null}
      <Field label="Bemerkung (optional)" name="returnNote" className="sm:col-span-2">
        <Textarea id="returnNote" name="returnNote" rows={2} placeholder="z. B. sauber und vollständig; Kratzer am Gestänge" />
      </Field>
      <Field label="Fotos bei Rückgabe (optional)" name="photos" hint={photoHint} className="sm:col-span-2">
        <Input id="photos-return" name="photos" type="file" accept="image/*" multiple />
      </Field>
      <SubmitButton className="justify-self-start sm:col-span-2" pendingText="Wird gebucht …">
        Rückgabe buchen und Protokoll senden
      </SubmitButton>
    </ActionForm>
  );
}

function Photos({ photos }: { photos: { id: string }[] }) {
  if (!photos.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {photos.map((p) => (
        <a key={p.id} href={`/api/inventory/loans/photo/${p.id}`} target="_blank" rel="noopener" className="block size-16 overflow-hidden rounded border bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/inventory/loans/photo/${p.id}`} alt="" className="size-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

function PhaseLinks({ itemId, loanId, phase, sentAt, editor }: { itemId: string; loanId: string; phase: "AUSGABE" | "RUECKGABE"; sentAt: Date | null; editor: boolean }) {
  const label = phase === "AUSGABE" ? "Ausgabe" : "Rückgabe";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <a href={`/api/inventory/loans/${loanId}/protocol?phase=${phase === "AUSGABE" ? "ausgabe" : "rueckgabe"}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 underline">
        <FileText className="size-3.5" aria-hidden /> Protokoll {label}
      </a>
      <span className="text-neutral-600">{sentAt ? `gemailt ${formatDateTime(sentAt)}` : "nicht gemailt"}</span>
      {editor ? (
        <>
          <ActionForm action={resendProtocolAction.bind(null, itemId, loanId, phase)} className="inline">
            <SubmitButton variant="link" size="sm" className="h-auto p-0 text-xs" pendingText="…">
              <Mail className="size-3.5" /> erneut senden
            </SubmitButton>
          </ActionForm>
          <details className="w-full">
            <summary className="inline-flex cursor-pointer items-center gap-1 underline">
              <Camera className="size-3.5" aria-hidden /> Fotos zur {label} nachreichen
            </summary>
            <ActionForm action={addLoanPhotosAction.bind(null, itemId, loanId, phase)} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end" resetOnSuccess>
              <Input name="photos" type="file" accept="image/*" multiple required aria-label={`Fotos zur ${label}`} />
              <SubmitButton size="sm" pendingText="…">
                Hochladen
              </SubmitButton>
            </ActionForm>
          </details>
        </>
      ) : null}
    </div>
  );
}

export function LoanHistory({ item, editor }: { item: Item; editor: boolean }) {
  if (!item.loans.length) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 font-medium">Verlauf</p>
      <ul className="divide-y rounded-md border">
        {item.loans.map((l) => {
          const out = l.photos.filter((p) => p.phase === "AUSGABE");
          const back = l.photos.filter((p) => p.phase === "RUECKGABE");
          return (
            <li key={l.id} className="flex flex-col gap-1 px-3 py-2">
              <div>
                <span className="font-medium">{l.borrower}</span> · {formatDate(l.lentAt)} – {l.returnedAt ? formatDate(l.returnedAt) : "offen"}
                {l.dueAt && !l.returnedAt ? <span className="text-neutral-600"> (bis {formatDate(l.dueAt)})</span> : null}
              </div>
              <div className="text-neutral-600">
                {l.handedOverBy ? `übergeben von ${l.handedOverBy}` : l.createdBy ? `gebucht von ${l.createdBy.name}` : ""}
                {l.conditionOut ? ` · Zustand ${l.conditionOut}` : ""}
                {l.accessories ? ` · Zubehör: ${l.accessories}` : ""}
              </div>
              {l.note ? <p className="whitespace-pre-wrap text-neutral-600">{l.note}</p> : null}
              <Photos photos={out} />
              <PhaseLinks itemId={item.id} loanId={l.id} phase="AUSGABE" sentAt={l.outMailSentAt} editor={editor} />
              {l.returnedAt ? (
                <div className="mt-1 border-t pt-1">
                  <div className="text-neutral-600">
                    Rückgabe {l.returnedByName ? `von ${l.returnedByName}` : ""}
                    {l.receivedBy ? `, angenommen von ${l.receivedBy}` : ""}
                    {l.conditionIn ? ` · Zustand ${l.conditionIn}` : ""}
                    {l.accessoriesComplete === false ? " · Zubehör unvollständig" : ""}
                  </div>
                  {l.returnNote ? <p className="whitespace-pre-wrap text-neutral-600">{l.returnNote}</p> : null}
                  <Photos photos={back} />
                  <PhaseLinks itemId={item.id} loanId={l.id} phase="RUECKGABE" sentAt={l.returnMailSentAt} editor={editor} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
