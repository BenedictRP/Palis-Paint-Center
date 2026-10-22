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

// Called by the public inquiry form after a successful submit.
  function addInquiry(data) {
    const list = read(K.inquiries, []);
    list.unshift({
      id: uid(),
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      type: data.type || "Product Inquiry",
      message: data.message || "",
      status: "new",
      archived: false,
      note: "",
      created: new Date().toISOString(),
    });
    write(K.inquiries, list);
  }


  return { ready, client, fmtPrice, getPublicProducts, addInquiry };
})();