/* Shared Supabase helper used by BOTH the public site and the admin panel. */
const PalisDB = (() => {
  const cfg = window.PALIS_CONFIG || {};
  const ready = !!(window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
                   !cfg.SUPABASE_URL.includes("YOUR-"));
  const client = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const fmtPrice = (n) => `${Number(n).toLocaleString("en-US")} PHP`;

  // Public: active products, shaped the way the website expects
  async function getPublicProducts() {
    if (!ready) return null;
    const { data, error } = await client.from("products").select("*").order("id");
    if (error) { console.warn("Supabase products error:", error.message); return null; }
    return data.map((p) => ({ ...p, price: fmtPrice(p.price) }));
  }

  // Public: save an inquiry so the admin can see it
  async function addInquiry(d) {
    if (!ready) return false;
    const { error } = await client.from("inquiries").insert({
      name: d.name || "", phone: d.phone || "", email: d.email || "",
      type: d.type || "Product Inquiry", message: d.message || "",
    });
    if (error) console.warn("Supabase inquiry error:", error.message);
    return !error;
  }

  return { ready, client, fmtPrice, getPublicProducts, addInquiry };
})();