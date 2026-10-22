/* Shared Supabase helper used by BOTH the public site and the admin panel. */
const PalisDB = (() => {
  const cfg = window.PALIS_CONFIG || {};
  const ready = !!(window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
                   !cfg.SUPABASE_URL.includes("YOUR-"));
  const client = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  // PHP
  const fmtPHP = (n) => `${Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 })} PHP`;

  // Categories that are paints sold per gallon (used by the paint-job estimator)
  const PAINT_CATS = ["Boysen", "Roofguard Boysen", "Dreamcoat", "Rain or Shine", "Domino", "Alpha Chroma"];

  // Used when the estimator_settings table can't be read
  const DEFAULT_ESTIMATOR = {
    margin_pct: 10, coats: 2, coverage_sqm_per_gallon: 30,
    services: [
      { key: "interior", label: "Interior wall painting", rate: 120 },
      { key: "exterior", label: "Exterior wall painting", rate: 150 },
      { key: "ceiling", label: "Ceiling painting", rate: 130 },
      { key: "roof", label: "Roof painting", rate: 140 },
      { key: "wood_metal", label: "Wood / metal painting", rate: 180 },
      { key: "repaint_prep", label: "Repaint with putty & primer", rate: 200 },
    ],
  };

  async function getEstimatorSettings() {
    if (!ready) return DEFAULT_ESTIMATOR;
    const { data, error } = await client.from("estimator_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return DEFAULT_ESTIMATOR;
    return { ...DEFAULT_ESTIMATOR, ...data };
  }

  // Paint job estimate: labor (area x rate) + paint (gallons x price), shown as a range
  function calcJob(s, { rate, area, paintPrice }) {
    const gallons = paintPrice ? Math.ceil((area * s.coats) / s.coverage_sqm_per_gallon) : 0;
    const materials = gallons * (paintPrice || 0);
    const labor = area * rate;
    const total = materials + labor;
    const m = Number(s.margin_pct) / 100;
    return { gallons, materials, labor, total, low: Math.round(total * (1 - m)), high: Math.round(total * (1 + m)) };
  }

  // Public: active products, shaped the way the website expects
  async function getPublicProducts() {
    if (!ready) return null;
    const { data, error } = await client.from("products").select("*").order("id");
    if (error) { console.warn("Supabase products error:", error.message); return null; }
    return data.map((p) => ({ ...p, priceNum: Number(p.price), price: fmtPHP(p.price) }));
  }

  // Public: save an inquiry (with the customer's product list / paint job estimate)
  async function addInquiry(d) {
    if (!ready) return false;
    const { error } = await client.from("inquiries").insert({
      name: d.name || "", phone: d.phone || "", email: d.email || "",
      type: d.type || "Product Inquiry", message: d.message || "",
      items: d.items || [], job: d.job || null,
      estimate_low: d.estimate_low ?? null, estimate_high: d.estimate_high ?? null,
    });
    if (error) console.warn("Supabase inquiry error:", error.message);
    return !error;
  }

  return { ready, client, fmtPHP, fmtPrice: fmtPHP, PAINT_CATS, getEstimatorSettings, calcJob, getPublicProducts, addInquiry };
})();