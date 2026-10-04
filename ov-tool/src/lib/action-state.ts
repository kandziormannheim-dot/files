export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** frei verwendbar, z. B. ID eines neu angelegten Objekts */
  data?: Record<string, unknown>;
} | null;
