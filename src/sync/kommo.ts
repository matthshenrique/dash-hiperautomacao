import { CLIENT } from "../../config/client";

export interface LeadRow {
  id: number;
  pipeline_id: number | null;
  status_id: number | null;
  price: number;
  created_at: number | null;
  closed_at: number | null;
  updated_at: number | null;
  loss_reason_id: number | null;
  loss_reason: string | null;
  produto: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  responsible_user_id: number | null;
}

function cf(raw: any, fieldId: number): string | null {
  const f = (raw.custom_fields_values ?? []).find(
    (c: any) => c.field_id === fieldId,
  );
  const v = f?.values?.[0]?.value;
  return v === undefined || v === null || v === "" ? null : String(v);
}

export function parseLead(raw: any): LeadRow {
  const lr = raw._embedded?.loss_reason?.[0] ?? null;
  return {
    id: raw.id,
    pipeline_id: raw.pipeline_id ?? null,
    status_id: raw.status_id ?? null,
    price: raw.price ?? 0,
    created_at: raw.created_at ?? null,
    closed_at: raw.closed_at ?? null,
    updated_at: raw.updated_at ?? null,
    loss_reason_id: lr?.id ?? null,
    loss_reason: lr?.name ?? null,
    produto: cf(raw, CLIENT.campos.produto),
    utm_source: cf(raw, CLIENT.campos.utm_source),
    utm_campaign: cf(raw, CLIENT.campos.utm_campaign),
    utm_content: cf(raw, CLIENT.campos.utm_content),
    responsible_user_id: raw.responsible_user_id ?? null,
  };
}

export interface EventRow {
  id: string;
  lead_id: number;
  created_at: number;
  status_before: number | null;
  status_after: number | null;
}

export function parseStatusEvent(raw: any): EventRow {
  const before = raw.value_before?.[0]?.lead_status?.id ?? null;
  const after = raw.value_after?.[0]?.lead_status?.id ?? null;
  return {
    id: String(raw.id),
    lead_id: raw.entity_id,
    created_at: raw.created_at,
    status_before: before,
    status_after: after,
  };
}
