interface Insight { ad_id: string; ad_name: string | null; spend: number }

// chave de join normalizada
const normKey = (s: string | null) => (s ?? "").trim().toLowerCase();

// Spend vem da Meta (investido); a contagem de leads vem do Kommo, casada por
// utm_content (nome do anúncio congelado no clique) — UTM é a fonte única de leads.
export function creativesGeneration(
  insights: Insight[],
  leads: { utm_content: string | null }[],
) {
  const m = new Map<string, { ad_name: string | null; spend: number }>();
  for (const i of insights) {
    const cur = m.get(i.ad_id) ?? { ad_name: i.ad_name, spend: 0 };
    cur.spend += i.spend;
    m.set(i.ad_id, cur);
  }
  const leadsByName = new Map<string, number>();
  for (const l of leads) {
    const k = normKey(l.utm_content);
    if (!k) continue;
    leadsByName.set(k, (leadsByName.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([ad_id, v]) => {
      const leadsCount = leadsByName.get(normKey(v.ad_name)) ?? 0;
      return {
        ad_id, ad_name: v.ad_name, spend: v.spend, leads: leadsCount,
        cpl: leadsCount ? v.spend / leadsCount : 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);
}

export function creativesConversion(wonLeads: { utm_content: string | null; price: number }[]) {
  const m = new Map<string, { ganhos: number; receita: number }>();
  for (const l of wonLeads) {
    if (!l.utm_content) continue;
    const cur = m.get(l.utm_content) ?? { ganhos: 0, receita: 0 };
    cur.ganhos++; cur.receita += l.price;
    m.set(l.utm_content, cur);
  }
  return [...m.entries()]
    .map(([criativo, v]) => ({ criativo, ganhos: v.ganhos, receita: v.receita }))
    .sort((a, b) => b.receita - a.receita);
}

// Funil por CAMPANHA: junta Meta (campaign_name → spend) com Kommo (utm_campaign →
// leads gerados e ganhos/receita). UTM do Kommo é a fonte única de leads/conversão;
// nome de campanha é estável (raramente renomeado) → cruzamento confiável.
export function campaignsUnified(
  insights: { campaign_name: string | null; spend: number }[],
  leads: { utm_campaign: string | null }[],
  wonLeads: { utm_campaign: string | null; price: number }[],
) {
  type Row = { campanha: string; leads: number; spend: number; ganhos: number; receita: number };
  const m = new Map<string, Row>();
  const get = (name: string): Row => {
    let r = m.get(normKey(name));
    if (!r) { r = { campanha: name, leads: 0, spend: 0, ganhos: 0, receita: 0 }; m.set(normKey(name), r); }
    return r;
  };
  for (const i of insights) {
    if (!normKey(i.campaign_name)) continue;
    const r = get(i.campaign_name!.trim());
    r.spend += i.spend;
  }
  for (const l of leads) {
    if (!normKey(l.utm_campaign)) continue;
    const r = get(l.utm_campaign!.trim());
    r.leads++;
  }
  for (const l of wonLeads) {
    if (!normKey(l.utm_campaign)) continue;
    const r = get(l.utm_campaign!.trim());
    r.ganhos++; r.receita += l.price;
  }
  return [...m.values()]
    .map((r) => ({
      ...r,
      cac: r.ganhos ? r.spend / r.ganhos : 0,
      roas: r.spend ? r.receita / r.spend : 0,
      taxaConversao: r.leads ? r.ganhos / r.leads : 0,
    }))
    .sort((a, b) => b.receita - a.receita || b.leads - a.leads);
}
