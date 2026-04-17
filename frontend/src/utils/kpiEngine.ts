export interface PerformanceRecord {
  affiliate_id?: string;
  affiliate_name?: string;
  country?: string;
  campaign?: string;
  date?: string;
  clicks?: number;
  registrations?: number;
  ftds?: number;
  revenue?: number;
  cost?: number;
  // Filter support fields
  brand?: string;
  am?: string;
  source?: string;
  period?: string | number;
  casino_real_ngr?: number;
  sb_real_ngr?: number;
  flats_and_adjustments?: number;
  [key: string]: any;
}

export const processKPIs = (data: PerformanceRecord[]) => {
  let bonusWeightedSum = 0, bonusWeight = 0;
  let cashoutWeightedSum = 0, cashoutWeight = 0;

  const initial = {
    revenue: 0, cost: 0, profit: 0,
    ftds: 0, clicks: 0, registrations: 0,
    casino_real_ngr: 0, sb_real_ngr: 0, flats_and_adjustments: 0,
  };

  const totals = data.reduce((acc, row) => {
    const rev = Number(row.revenue) || 0;
    acc.revenue               += rev;
    acc.cost                  += Number(row.cost)                    || 0;
    acc.ftds                  += Number(row.ftds)                    || 0;
    acc.clicks                += Number(row.clicks)                  || 0;
    acc.registrations         += Number(row.registrations)           || 0;
    acc.casino_real_ngr       += Number(row.casino_real_ngr)        || 0;
    acc.sb_real_ngr           += Number(row.sb_real_ngr)            || 0;
    acc.flats_and_adjustments += Number(row.flats_and_adjustments)  || 0;
    if (row._bonus   != null && rev > 0) { bonusWeightedSum   += (Number(row._bonus)   || 0) * rev; bonusWeight   += rev; }
    if (row._cashout != null && rev > 0) { cashoutWeightedSum += (Number(row._cashout) || 0) * rev; cashoutWeight += rev; }
    return acc;
  }, initial);

  totals.profit = totals.revenue - totals.cost;

  const totalSpend = totals.cost + totals.flats_and_adjustments;
  const totalNgr   = totals.casino_real_ngr + totals.sb_real_ngr;

  // ROI = NGR / (Partner Income + Flat Amounts)
  const roi             = totalSpend > 0  ? totalNgr / totalSpend         : 0;
  const cpa             = totals.ftds > 0 ? totals.cost / totals.ftds     : 0;
  const conversion_rate = totals.clicks > 0 ? totals.ftds / totals.clicks : 0;
  const adpu            = totals.ftds > 0 ? totals.revenue / totals.ftds  : 0;
  const arpu            = totals.ftds > 0 ? totalNgr / totals.ftds        : 0;
  const ecpa            = totals.ftds > 0 ? totalSpend / totals.ftds      : 0;
  const bonus_pct       = bonusWeight   > 0 ? bonusWeightedSum   / bonusWeight   : 0;
  const cashout_pct     = cashoutWeight > 0 ? cashoutWeightedSum / cashoutWeight : 0;

  return { ...totals, roi, cpa, conversion_rate, adpu, arpu, ecpa, bonus_pct, cashout_pct };
};

export interface AffiliateSummary {
  id: string;
  name: string;
}

export const getInsights = (data: PerformanceRecord[]) => {
  const affiliateMap: Record<string, { name: string, revenue: number, cost: number, profit: number }> = {};

  data.forEach(row => {
    if (!row.affiliate_id) return;
    const aff = row.affiliate_id;
    if (!affiliateMap[aff]) affiliateMap[aff] = { name: '', revenue: 0, cost: 0, profit: 0 };
    if (row.affiliate_name && !affiliateMap[aff].name) affiliateMap[aff].name = row.affiliate_name;
    affiliateMap[aff].revenue += Number(row.revenue) || 0;
    affiliateMap[aff].cost    += Number(row.cost)    || 0;
    affiliateMap[aff].profit  += (Number(row.revenue) || 0) - (Number(row.cost) || 0);
  });

  const affiliates = Object.keys(affiliateMap).map(id => ({
    id,
    name: affiliateMap[id].name,
    ...affiliateMap[id],
    roi: affiliateMap[id].cost > 0 ? affiliateMap[id].profit / affiliateMap[id].cost : 0,
  }));

  const pickSummary = (a: { id: string; name: string }): AffiliateSummary => ({ id: a.id, name: a.name });
  const labelOf     = (a: AffiliateSummary) => a.name ? `${a.name} (${a.id})` : a.id;

  const top_affiliates_list = [...affiliates].sort((a, b) => b.profit - a.profit);
  const top_affiliates      = top_affiliates_list.slice(0, 5).map(pickSummary);

  const worst_affiliates_list = [...affiliates].sort((a, b) => a.roi - b.roi);
  const worst_affiliates      = worst_affiliates_list.filter(a => a.roi < 0).slice(0, 5).map(pickSummary);

  const recommendations: string[] = [];
  if (worst_affiliates.length > 0) {
    recommendations.push(`Review poorly performing affiliates like ${labelOf(worst_affiliates[0])} who have negative ROI.`);
  } else {
    recommendations.push(`All affiliates have a positive ROI. Good work!`);
  }

  if (top_affiliates.length > 0) {
    recommendations.push(`Consider incentivizing top earners like ${top_affiliates.slice(0, 2).map(labelOf).join(' and ')} for scaling.`);
  }

  return { top_affiliates, worst_affiliates, recommendations };
};
