"use client";

import { useActionState } from "react";
import { connectAction, createApiKeyAction, type FormResult } from "@/app/integrations/actions";

interface Field {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  hint?: string;
}

/** One form per connector kind; the server verifies the source before saving it. */
export function ConnectForm({ kind, fields, submit }: { kind: string; fields: Field[]; submit: string }) {
  const [result, action, pending] = useActionState<FormResult | null, FormData>(connectAction, null);
  return (
    <form action={action} className="connect-form">
      <input type="hidden" name="kind" value={kind} />
      {fields.map((field) => (
        <label key={field.name} className="field">
          <span>{field.label}</span>
          <input name={field.name} type={field.type ?? "text"} placeholder={field.placeholder} autoComplete="off" required={field.type !== "hidden" && field.name !== "label" && field.name !== "port"} />
          {field.hint && <small>{field.hint}</small>}
        </label>
      ))}
      <div className="actions">
        <button className="primary" disabled={pending}>{pending ? "Checking…" : submit}</button>
        {result && <span className={result.ok ? "form-ok" : "form-error"}>{result.message}</span>}
      </div>
    </form>
  );
}

export function ApiKeyForm() {
  const [result, action, pending] = useActionState<FormResult | null, FormData>(createApiKeyAction, null);
  return (
    <form action={action} className="connect-form">
      <label className="field">
        <span>What is it for</span>
        <input name="label" placeholder="Zapier – QuickBooks" />
      </label>
      <div className="actions">
        <button className="primary" disabled={pending}>{pending ? "Creating…" : "Create API key"}</button>
      </div>
      {result?.ok && (
        <div className="keybox">
          <div className="keybox-note">Copy it now; it is shown once.</div>
          <code>{result.message}</code>
        </div>
      )}
    </form>
  );
}
