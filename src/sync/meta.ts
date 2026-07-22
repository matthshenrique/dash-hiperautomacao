import { CLIENT } from "../../config/client";

export interface AdInsightRow {
  date: string;
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

const LEAD_ACTIONS = new Set(CLIENT.metaResultActions);

export function parseInsight(raw: any): AdInsightRow {
  const leads = (raw.actions ?? [])
    .filter((a: any) => LEAD_ACTIONS.has(a.action_type))
    .reduce((s: number, a: any) => s + Number(a.value ?? 0), 0);
  return {
    date: raw.date_start,
    ad_id: String(raw.ad_id),
    ad_name: raw.ad_name ?? null,
    campaign_id: raw.campaign_id ? String(raw.campaign_id) : null,
    campaign_name: raw.campaign_name ?? null,
    spend: Number(raw.spend ?? 0),
    impressions: Number(raw.impressions ?? 0),
    clicks: Number(raw.clicks ?? 0),
    leads,
  };
}
