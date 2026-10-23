/* Palis Paint Center — Admin Panel (Supabase) */
(() => {
  const D = PalisDB;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const TYPES = ["Product Inquiry", "Custom Color Request", "Painting Service Estimate"];
  const STATUS = { new: "New", progress: "In progress", resolved: "Resolved" };

  const ICON = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICONS = {
    dashboard: ICON('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    inbox: ICON('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    box: ICON('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    calc: ICON('<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/>'),
    archive: ICON('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'),
  };

  const state = { products: [], inquiries: [], settings: null };
  const ui = {
    inq: { q: "", status: "", type: "" },
    prod: { q: "", cat: "", show: "" },
    archTab: "inquiries",
  };

  /* ---------- Data (all reads/writes go to Supabase) ---------- */
  async function loadAll() {
    const [p, i, st] = await Promise.all([
      D.client.from("products").select("*").order("id"),
      D.client.from("inquiries").select("*").order("created_at", { ascending: false }),
      D.getEstimatorSettings(),
    ]);
    state.settings = st;
    const err = p.error || i.error;
    if (err) { toast("Could not load data: " + err.message); return false; }
    state.products = p.data;
    state.inquiries = i.data;
    return true;
  }

  // Run a Supabase write, reload everything, redraw the page
  async function db(request, message) {
    const { error } = await request;
    if (error) { toast("Error: " + error.message); return false; }
    await loadAll();
    if (message) toast(message);
    refresh();
    return true;
  }

  /* ---------- Helpers ---------- */
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const fmtDateTime = (iso) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const fmt = (n) => D.fmtPHP(n);
  const estText = (i) => i.estimate_high == null ? "—"
    : (Number(i.estimate_low) === Number(i.estimate_high) ? fmt(i.estimate_high) : `${fmt(i.estimate_low)} – ${fmt(i.estimate_high)}`);
  const badge = (s) => `<span class="badge b-${s}">${STATUS[s] || s}</span>`;
  const same = (a, b) => String(a) === String(b);
  const find = (list, id) => list.find((x) => same(x.id, id));
  const pageHead = (eyebrow, title, desc, actions = "") =>
    `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
  const activeInquiries = () => state.inquiries.filter((i) => !i.archived);
  const newCount = () => activeInquiries().filter((i) => i.status === "new").length;

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  function openModal(title, body, foot = "") {
    const m = $("#modal");
    m.innerHTML = `<div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="Close" type="button">✕</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}`;
    if (!m.open) m.showModal();
  }
  const closeModal = () => { const m = $("#modal"); if (m.open) m.close(); };

  function confirmBox(message, okLabel, onOk) {
    openModal("Please confirm", `<p>${esc(message)}</p>`,
      `<button class="btn" data-close type="button">Cancel</button><button class="btn btn-danger" id="confirmOk" type="button">${esc(okLabel)}</button>`);
    $("#confirmOk").onclick = () => { closeModal(); onOk(); };
  }

  /* ---------- Routing ---------- */
  const ROUTES = {
    dashboard: { title: "Dashboard", render: viewDashboard },
    inquiries: { title: "Inquiries", render: viewInquiries },
    products: { title: "Products", render: viewProducts },
    estimator: { title: "Estimator", render: viewEstimator },
    archive: { title: "Archive", render: viewArchive },
  };
  const NAV = [
    ["Overview", [["dashboard", "Dashboard", "dashboard"]]],
    ["Requests", [["inquiries", "Inquiries", "inbox"]]],
    ["Content", [["products", "Products", "box"]]],
    ["Configuration", [["estimator", "Estimator", "calc"]]],
    ["Records", [["archive", "Archive", "archive"]]],
  ];

  function renderNav(active) {
    $("#nav").innerHTML = NAV.map(([group, items]) =>
      `<div class="nav-group">${group}</div>` +
      items.map(([id, label, icon]) =>
        `<a class="nav-item ${id === active ? "active" : ""}" href="#/${id}">${ICONS[icon]}<span>${label}</span>${id === "inquiries" && newCount() ? `<span class="nav-badge">${newCount()}</span>` : ""}</a>`
      ).join("")
    ).join("");
  }

  function route() {
    if ($("#app").classList.contains("hidden")) return;
    const id = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
    const key = ROUTES[id] ? id : "dashboard";
    $("#pageTitle").textContent = ROUTES[key].title;
    document.title = `${ROUTES[key].title} — Palis Admin`;
    renderNav(key);
    $("#view").innerHTML = ROUTES[key].render();
    $("#sidebar").classList.remove("open");
    $("#scrim").classList.remove("show");
  }
  const refresh = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

  /* ---------- Dashboard ---------- */
  function viewDashboard() {
    const inq = activeInquiries();
    const prods = state.products.filter((p) => !p.archived);
    const cats = {};
    prods.forEach((p) => (cats[p.category] = (cats[p.category] || 0) + 1));
    const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const byType = TYPES.map((t) => [t, inq.filter((i) => i.type === t).length]);
    const bars = (rows) => {
      const max = Math.max(1, ...rows.map((r) => r[1]));
      return rows.length ? rows.map(([l, n]) => `<div class="bar-row"><span>${esc(l)}</span><div class="bar"><span style="width:${(n / max) * 100}%"></span></div><b>${n}</b></div>`).join("") : '<div class="empty">No data yet.</div>';
    };
    const open = inq.filter((i) => i.status !== "resolved");
    const pipeline = open.reduce((sum, i) => i.estimate_high == null ? sum : sum + (Number(i.estimate_low) + Number(i.estimate_high)) / 2, 0);
    const demand = {};
    inq.forEach((i) => (i.items || []).forEach((it) => {
      const k = `${it.item} · ${it.unit}`;
      demand[k] = demand[k] || { qty: 0, value: 0 };
      demand[k].qty += Number(it.qty); demand[k].value += Number(it.qty) * Number(it.price);
    }));
    const top = Object.entries(demand).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
    return pageHead("Overview", "Dashboard", "A quick look at inquiries and your catalog.",
      '<button class="btn btn-gold" data-action="new-product" type="button">+ Add product</button>') + `
      <div class="tiles">
        <div class="tile blue"><div class="eyebrow">New inquiries</div><div class="n">${inq.filter((i) => i.status === "new").length}</div><div class="muted">awaiting a reply</div></div>
        <div class="tile"><div class="eyebrow">Open inquiries</div><div class="n">${inq.filter((i) => i.status !== "resolved").length}</div><div class="muted">new + in progress</div></div>
        <div class="tile teal"><div class="eyebrow">Products listed</div><div class="n">${prods.length}</div><div class="muted">${Object.keys(cats).length} categories</div></div>
        <div class="tile"><div class="eyebrow">Est. value of open inquiries</div><div class="n" style="font-size:26px;padding:8px 0 6px">${fmt(Math.round(pipeline))}</div><div class="muted">from customer estimates</div></div>
        <div class="tile red"><div class="eyebrow">Out of stock</div><div class="n">${prods.filter((p) => !p.available).length}</div><div class="muted">marked unavailable</div></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Recent inquiries</h3>
          ${inq.slice(0, 5).map((i) => `<div class="list-row"><div><b>${esc(i.name)}</b><div class="muted">${esc(i.type)} · ${fmtDate(i.created_at)}</div></div>${badge(i.status)}</div>`).join("") || '<div class="empty">No inquiries yet.</div>'}
          <div style="margin-top:12px"><a class="btn btn-sm" href="#/inquiries">View all</a></div>
        </div>
        <div class="card"><h3>Products customers want to buy</h3><p class="sub">Totals from the product lists in inquiries</p>
          ${top.map(([name, d]) => `<div class="list-row"><div><b>${esc(name)}</b></div><span class="mono">${d.qty} pcs · ${fmt(d.value)}</span></div>`).join("") || '<div class="empty">No product requests yet.</div>'}
        </div>
        <div class="card"><h3>Products by category</h3>${bars(catRows)}</div>
        <div class="card"><h3>Inquiries by type</h3>${bars(byType)}</div>
      </div>`;
  }

  /* ---------- Inquiries ---------- */
  function filteredInquiries() {
    const f = ui.inq, q = f.q.toLowerCase();
    return activeInquiries().filter((i) =>
      (!f.status || i.status === f.status) && (!f.type || i.type === f.type) &&
      (!q || [i.name, i.phone, i.email, i.message].join(" ").toLowerCase().includes(q)));
  }

  function inquiryRows() {
    const list = filteredInquiries();
    if (!list.length) return '<tr><td colspan="6"><div class="empty">No inquiries match.</div></td></tr>';
    return list.map((i) => `<tr class="clickable" data-action="open-inquiry" data-id="${i.id}">
      <td class="muted" style="white-space:nowrap">${fmtDate(i.created_at)}</td>
      <td><b>${esc(i.name)}</b><div class="muted">${esc(i.phone)}</div></td>
      <td>${esc(i.type)}</td>
      <td class="muted">${esc(i.message.length > 70 ? i.message.slice(0, 70) + "…" : i.message)}</td>
      <td class="mono" style="white-space:nowrap">${estText(i)}</td>
      <td>${badge(i.status)}</td></tr>`).join("");
  }

  function viewInquiries() {
    return pageHead("Requests", "Inquiries", "Messages sent from the website's inquiry form. Click a row to read it, update its status or add a note.",
      '<button class="btn" data-action="export-inquiries" type="button">Export CSV</button>') + `
      <div class="toolbar">
        <input id="inqSearch" type="search" placeholder="Search name, phone, message…" value="${esc(ui.inq.q)}">
        <select id="inqStatus"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${ui.inq.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select id="inqType"><option value="">All types</option>${TYPES.map((t) => `<option ${ui.inq.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Message</th><th>Estimate</th><th>Status</th></tr></thead>
      <tbody id="inqBody">${inquiryRows()}</tbody></table></div>`;
  }

  function openInquiry(id) {
    const i = find(state.inquiries, id);
    if (!i) return;
    const tel = (i.phone || "").replace(/[^\d+]/g, "");
    const items = i.items || [];
    const sub = items.reduce((t, it) => t + Number(it.qty) * Number(it.price), 0);
    const itemsHtml = items.length ? `<h4 class="mini-h">Products requested</h4><table class="mini"><tbody>
        ${items.map((it) => `<tr><td>${Number(it.qty)} × ${esc(it.item)} <span class="muted">(${esc(it.unit)} @ ${fmt(it.price)})</span></td><td class="mono r">${fmt(it.qty * it.price)}</td></tr>`).join("")}
        <tr><td><b>Products subtotal</b></td><td class="mono r"><b>${fmt(sub)}</b></td></tr></tbody></table>` : "";
    const j = i.job;
    const jobHtml = j ? `<h4 class="mini-h">Paint job</h4><dl class="kv">
        <dt>Work</dt><dd>${esc(j.service_label)}</dd>
        <dt>Area</dt><dd>${Number(j.area_sqm)} sq m</dd>
        <dt>Paint</dt><dd>${j.paint_name ? `${esc(j.paint_name)} — ${Number(j.gallons)} gal @ ${fmt(j.paint_price)} (${Number(j.coats)} coats)` : "Customer's own / not selected"}</dd>
        <dt>Labor</dt><dd>${fmt(j.labor)} (${fmt(j.rate)} per sq m)</dd>
        <dt>Materials</dt><dd>${fmt(j.materials)}</dd>
        <dt>Job estimate</dt><dd><b>${fmt(j.low)} – ${fmt(j.high)}</b></dd></dl>` : "";
    const totalHtml = i.estimate_high != null ? `<div class="notice" style="margin-top:0"><b>Customer's total estimate:</b> ${estText(i)}</div>` : "";
    openModal(esc(i.name), `<form id="inqForm" data-id="${i.id}">
        <dl class="kv">
          <dt>Phone</dt><dd>${esc(i.phone)}</dd>
          <dt>Email</dt><dd>${esc(i.email || "—")}</dd>
          <dt>Type</dt><dd>${esc(i.type)}</dd>
          <dt>Received</dt><dd>${fmtDateTime(i.created_at)}</dd>
          <dt>Message</dt><dd>${esc(i.message)}</dd>
        </dl>
        ${itemsHtml}${jobHtml}${totalHtml}
        <label class="field">Status<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${i.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="field">Internal note <small>(only visible here)</small><textarea name="note">${esc(i.note)}</textarea></label>
      </form>`,
      `<a class="btn btn-sm" href="tel:${esc(tel)}">Call</a>
       ${i.email ? `<a class="btn btn-sm" href="mailto:${esc(i.email)}">Email</a>` : ""}
       ${(items.length || i.job) ? `<button class="btn btn-sm" data-action="print-quote" data-id="${i.id}" type="button">Print quote</button>` : ""}
       <button class="btn btn-sm" data-action="archive-inquiry" data-id="${i.id}" type="button">Archive</button>
       <button class="btn btn-gold" data-action="save-inquiry" type="button">Save</button>`);
  }

  async function saveInquiry() {
    const form = $("#inqForm");
    const fd = new FormData(form);
    closeModal();
    await db(D.client.from("inquiries").update({ status: fd.get("status"), note: fd.get("note") }).eq("id", form.dataset.id), "Inquiry saved");
  }

  function exportInquiries() {
    const rows = [["Date", "Name", "Phone", "Email", "Type", "Status", "Message", "Products requested", "Estimate low (PHP)", "Estimate high (PHP)", "Note"]]
      .concat(filteredInquiries().map((i) => [i.created_at, i.name, i.phone, i.email, i.type, STATUS[i.status], i.message,
        (i.items || []).map((it) => `${it.qty} x ${it.item} (${it.unit})`).join("; "), i.estimate_low, i.estimate_high, i.note]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "palis-inquiries.csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Products: create / update / delete ---------- */
  function filteredProducts() {
    const f = ui.prod, q = f.q.toLowerCase();
    return state.products.filter((p) => !p.archived &&
      (!f.cat || p.category === f.cat) &&
      (!f.show || (f.show === "out" ? !p.available : p.available)) &&
      (!q || (p.category + " " + p.item).toLowerCase().includes(q)));
  }
  const categories = () => [...new Set(state.products.map((p) => p.category))].sort();

  function productRows() {
    const list = filteredProducts();
    if (!list.length) return '<tr><td colspan="6"><div class="empty">No products match.</div></td></tr>';
    return list.map((p) => `<tr>
      <td><span class="dot" style="background:${esc(p.swatch)}"></span></td>
      <td><b>${esc(p.item)}</b><div class="muted">${esc(p.category)}</div></td>
      <td>${esc(p.unit)}</td>
      <td class="mono">${esc(D.fmtPrice(p.price))}</td>
      <td>${p.available ? '<span class="badge b-resolved">In stock</span>' : '<span class="badge b-out">Out of stock</span>'}</td>
      <td style="white-space:nowrap"><button class="btn btn-sm" data-action="edit-product" data-id="${p.id}" type="button">Edit</button>
        <button class="btn btn-sm" data-action="toggle-stock" data-id="${p.id}" type="button">${p.available ? "Mark out" : "Mark in"}</button>
        <button class="btn btn-sm btn-danger" data-action="archive-product" data-id="${p.id}" type="button">Archive</button></td></tr>`).join("");
  }

  function viewProducts() {
    return pageHead("Content", "Products", "The catalog shown on the public website. Changes appear on the site immediately.",
      '<button class="btn btn-gold" data-action="new-product" type="button">+ Add product</button>') + `
      <div class="toolbar">
        <input id="prodSearch" type="search" placeholder="Search products…" value="${esc(ui.prod.q)}">
        <select id="prodCat"><option value="">All categories</option>${categories().map((c) => `<option ${ui.prod.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <select id="prodShow"><option value="">All stock</option><option value="in" ${ui.prod.show === "in" ? "selected" : ""}>In stock</option><option value="out" ${ui.prod.show === "out" ? "selected" : ""}>Out of stock</option></select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Color</th><th>Product</th><th>Unit</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody id="prodBody">${productRows()}</tbody></table></div>`;
  }

  function openProductForm(p) {
    const isEdit = !!p;
    p = p || { category: "", item: "", unit: "", price: "", swatch: "#c23b2c", available: true };
    openModal(isEdit ? "Edit product" : "Add product", `<form id="prodForm" data-id="${p.id || ""}">
      <label class="field">Category / brand<input name="category" list="catList" required value="${esc(p.category)}" placeholder="e.g. Boysen"><datalist id="catList">${categories().map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label class="field">Product name<input name="item" required value="${esc(p.item)}"></label>
      <div class="row2"><label class="field">Unit / pack<input name="unit" required value="${esc(p.unit)}" placeholder="e.g. 4 Gals"></label>
      <label class="field">Price (PHP)<input name="price" type="number" min="0" step="any" required value="${esc(p.price)}"></label></div>
      <div class="row2"><label class="field">Swatch color<input name="swatch" type="color" value="${esc(p.swatch)}"></label>
      <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="available" ${p.available ? "checked" : ""}> In stock</label></div>
    </form>`, '<button class="btn btn-gold" data-action="save-product" type="button">Save</button>');
  }

  async function saveProduct() {
    const form = $("#prodForm");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const row = {
      category: fd.get("category").trim(), item: fd.get("item").trim(), unit: fd.get("unit").trim(),
      price: Number(fd.get("price")), swatch: fd.get("swatch"), available: fd.get("available") === "on",
    };
    const id = form.dataset.id;
    closeModal();
    if (id) await db(D.client.from("products").update(row).eq("id", id), "Product updated");
    else await db(D.client.from("products").insert(row), "Product added");
  }

  /* ---------- Printable quote ---------- */
  const SHOP = {
    name: "Palis Paint Center",
    phone: "0995 631 7627",
    address: "Rizal Street, Poblacion East, San Nicolas, Pangasinan, Philippines",
    validDays: 7,
  };

  function quoteHtml(i, logo) {
    const items = i.items || [], j = i.job;
    const sub = items.reduce((t, it) => t + Number(it.qty) * Number(it.price), 0);
    const now = new Date();
    const until = new Date(now.getTime() + SHOP.validDays * 86400000);
    const d = (x) => x.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
    const no = "Q-" + now.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(i.id).slice(-4).toUpperCase();
    const rows = items.map((it) => `<tr><td>${esc(it.item)}<small>${esc(it.category)} · ${esc(it.unit)}</small></td><td class="c">${Number(it.qty)}</td><td class="r">${fmt(it.price)}</td><td class="r">${fmt(it.qty * it.price)}</td></tr>`).join("");
    const jobBlock = j ? `
      <h3>Painting service</h3>
      <table><tbody>
        <tr><td>${esc(j.service_label)} <small>${Number(j.area_sqm)} sq m × ${fmt(j.rate)} per sq m</small></td><td class="r">${fmt(j.labor)}</td></tr>
        ${j.paint_name ? `<tr><td>Paint: ${esc(j.paint_name)} <small>${Number(j.gallons)} gallon(s) × ${fmt(j.paint_price)} · ${Number(j.coats)} coats</small></td><td class="r">${fmt(j.materials)}</td></tr>` : ""}
        <tr class="sum"><td>Estimated cost of painting job <small>(±${Number(j.margin_pct)}%)</small></td><td class="r">${fmt(j.low)} – ${fmt(j.high)}</td></tr>
      </tbody></table>` : "";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quotation ${esc(no)} — ${esc(i.name)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#1c2b3a;margin:0;background:#e9e6dd;font-size:14px;line-height:1.45}
  .bar{position:sticky;top:0;background:#1c2b3a;color:#fff;padding:10px 16px;display:flex;gap:10px;justify-content:space-between;align-items:center}
  .bar button{background:#e2a638;border:0;border-radius:4px;padding:10px 18px;font-weight:700;font-size:14px;cursor:pointer}
  .page{background:#fff;max-width:800px;margin:18px auto;padding:36px 40px}
  .top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #c23b2c;padding-bottom:16px}
  .shop{display:flex;gap:14px;align-items:center}
  .shop img{height:60px;width:auto;max-width:110px;object-fit:contain}
  .shop b{font-size:20px;display:block}
  .shop span{font-size:12.5px;color:#555;display:block}
  .meta{text-align:right;font-size:13px}
  .meta h1{margin:0 0 6px;font-size:26px;letter-spacing:.04em;color:#c23b2c}
  .to{margin:20px 0 6px;display:flex;gap:30px;flex-wrap:wrap}
  .to div{min-width:200px}
  .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#777;margin-bottom:2px}
  h3{font-size:14px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.08em}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666;border-bottom:2px solid #1c2b3a;padding:8px 6px}
  td{padding:9px 6px;border-bottom:1px solid #ddd;vertical-align:top}
  td small{display:block;color:#777;font-size:12px}
  .c{text-align:center;white-space:nowrap}.r{text-align:right;white-space:nowrap}
  th.c{text-align:center}th.r{text-align:right}
  tr.sum td{font-weight:700;border-bottom:0}
  .total{margin-top:22px;background:#1c2b3a;color:#fff;border-radius:6px;padding:16px 20px;display:flex;justify-content:space-between;gap:16px;align-items:center;font-size:18px}
  .total b{font-size:22px;white-space:nowrap}
  .note{margin-top:22px;font-size:12.5px;color:#444}
  .note li{margin-bottom:4px}
  .foot{margin-top:26px;text-align:center;font-size:12px;color:#777}
  @media (max-width:600px){.page{margin:0;padding:22px 16px}.top{flex-direction:column}.meta{text-align:left}.total{flex-direction:column;align-items:flex-start}}
  @media print{
    body{background:#fff}.bar{display:none}
    .page{margin:0;max-width:none;padding:0}
    .total{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tr{break-inside:avoid}
  }
  @page{margin:16mm}
</style></head><body>
<div class="bar"><span>Quotation preview</span><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <div class="top">
    <div class="shop">${logo ? `<img src="${logo}" alt="">` : ""}<div><b>${esc(SHOP.name)}</b><span>${esc(SHOP.address)}</span><span>Tel: ${esc(SHOP.phone)}</span></div></div>
    <div class="meta"><h1>QUOTATION</h1><div><b>No.</b> ${esc(no)}</div><div><b>Date:</b> ${d(now)}</div><div><b>Valid until:</b> ${d(until)}</div></div>
  </div>
  <div class="to">
    <div><div class="lbl">Prepared for</div><b>${esc(i.name)}</b><br>${esc(i.phone)}${i.email ? `<br>${esc(i.email)}` : ""}</div>
    <div><div class="lbl">Request</div>${esc(i.type)}<br><span style="color:#777">Inquiry received ${fmtDate(i.created_at)}</span></div>
  </div>
  ${items.length ? `<h3>Products</h3>
  <table><thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}
    <tr class="sum"><td colspan="3" class="r">Products subtotal</td><td class="r">${fmt(sub)}</td></tr></tbody></table>` : ""}
  ${jobBlock}
  <div class="total"><span>Total estimate</span><b>${estText(i)}</b></div>
  <ul class="note">
    <li>All amounts are in Philippine pesos (PHP).</li>
    <li>This quotation is an estimate based on your inquiry. The final price is confirmed by ${esc(SHOP.name)} after checking the area, the paint chosen and current stock.</li>
    <li>Prices are valid until ${d(until)} and may change after that date.</li>
  </ul>
  <div class="foot">Thank you for choosing ${esc(SHOP.name)} · ${esc(SHOP.phone)}</div>
</div>
</body></html>`;
  }

  // The logo is embedded in the quote so it always shows when printed or saved as PDF
  async function logoDataUrl() {
    try {
      const blob = await (await fetch(new URL("../images/palis-logo.png", location.href))).blob();
      return await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
    } catch (e) { return ""; }
  }

  async function printQuote(id) {
    const i = find(state.inquiries, id);
    if (!i) return;
    const w = window.open("", "_blank"); // opened right away so pop-up blockers allow it
    if (!w) return toast("Please allow pop-ups for this site to open the quote.");
    w.document.write("<p style='font-family:Arial;padding:20px'>Preparing quote…</p>");
    const logo = await logoDataUrl();
    w.document.open(); w.document.write(quoteHtml(i, logo)); w.document.close();
  }

  /* ---------- Estimator ---------- */
  const paintProducts = () => state.products.filter((p) => !p.archived && p.available && p.unit === "Per Gallon" && D.PAINT_CATS.includes(p.category));
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "service";

  function svcRows() {
    return state.settings.services.map((s, i) => `<div class="svc-row">
      <input data-svc-label aria-label="Service name" value="${esc(s.label)}" placeholder="Service name">
      <input data-svc-rate aria-label="Rate per sq m" type="number" min="0" step="any" value="${esc(s.rate)}">
      <button class="btn btn-sm btn-danger" data-action="remove-service" data-i="${i}" type="button" aria-label="Remove">✕</button></div>`).join("");
  }

  function readSettingsForm() {
    const f = $("#estForm");
    if (!f) return;
    const rows = [...f.querySelectorAll(".svc-row")];
    state.settings = {
      ...state.settings,
      margin_pct: Number(f.elements.margin_pct.value),
      coats: Number(f.elements.coats.value),
      coverage_sqm_per_gallon: Number(f.elements.coverage.value),
      services: rows.map((row, i) => ({
        key: (state.settings.services[i] || {}).key || slug(row.querySelector("[data-svc-label]").value),
        label: row.querySelector("[data-svc-label]").value.trim(),
        rate: Number(row.querySelector("[data-svc-rate]").value),
      })),
    };
  }

  // v = { svc, area, paint }; defaults are used for the first draw, before the inputs exist
  function calcOut(v = { svc: 0, area: 40, paint: "" }) {
    const s = state.settings;
    const svc = s.services[Number(v.svc)];
    const area = Number(v.area);
    if (!svc || !(area > 0)) return '<div class="muted">Enter an area to see the estimate.</div>';
    const paint = v.paint ? find(state.products, v.paint) : null;
    const r = D.calcJob(s, { rate: Number(svc.rate), area, paintPrice: paint ? Number(paint.price) : 0 });
    return `<div class="list-row"><span>Labor (${area} sq m × ${fmt(svc.rate)})</span><b>${fmt(r.labor)}</b></div>
      ${paint ? `<div class="list-row"><span>Paint (${r.gallons} gal × ${fmt(paint.price)}, ${s.coats} coats)</span><b>${fmt(r.materials)}</b></div>` : ""}
      <div class="list-row"><span>Estimated range (±${s.margin_pct}%)</span><b>${fmt(r.low)} – ${fmt(r.high)}</b></div>`;
  }

  function viewEstimator() {
    const s = state.settings;
    return pageHead("Configuration", "Estimator", "Set the rates used by the website's price estimator. Every amount is in Philippine pesos (PHP).") + `
      <div class="grid2">
        <div class="card"><h3>Global logic</h3>
          <form id="estForm">
            <label class="field">Price range margin (%) <small>The estimate is shown as total − margin to total + margin.</small>
              <input name="margin_pct" type="number" min="0" max="100" step="any" required value="${esc(s.margin_pct)}"></label>
            <div class="row2">
              <label class="field">Coats of paint<input name="coats" type="number" min="1" max="5" step="1" required value="${esc(s.coats)}"></label>
              <label class="field">Coverage (sq m per gallon)<input name="coverage" type="number" min="1" step="any" required value="${esc(s.coverage_sqm_per_gallon)}"></label>
            </div>
            <h3 style="margin:8px 0 14px;font-size:16px">Service type pricing</h3>
            <p class="sub">Labor rate per square meter, in PHP.</p>
            ${svcRows()}
            <div class="actions" style="margin-top:12px">
              <button class="btn" data-action="add-service" type="button">+ Add service</button>
              <button class="btn btn-gold" type="submit">Save estimator settings</button>
            </div>
          </form>
        </div>
        <div class="card"><h3>Quick estimate</h3><p class="sub">Try the same calculation customers see on the website.</p>
          <label class="field">Type of work<select id="calcService">${s.services.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join("")}</select></label>
          <label class="field">Area (square meters)<input id="calcArea" type="number" min="1" step="any" value="40"></label>
          <label class="field">Paint<select id="calcPaint"><option value="">Labor only</option>${paintProducts().map((p) => `<option value="${p.id}">${esc(p.category)} ${esc(p.item)} — ${fmt(p.price)}/gal</option>`).join("")}</select></label>
          <div id="calcOut">${calcOut()}</div>
          <p class="muted" style="margin-top:10px">Paint gallons = area × coats ÷ coverage, rounded up.</p>
        </div>
      </div>`;
  }

  async function saveEstimator() {
    readSettingsForm();
    const s = state.settings;
    if (s.services.some((x) => !x.label || !(x.rate >= 0))) return toast("Every service needs a name and a rate.");
    if (!(s.coverage_sqm_per_gallon > 0)) return toast("Coverage must be more than 0.");
    await db(D.client.from("estimator_settings").upsert({
      id: 1, margin_pct: s.margin_pct, coats: s.coats, coverage_sqm_per_gallon: s.coverage_sqm_per_gallon,
      services: s.services, updated_at: new Date().toISOString(),
    }), "Estimator settings saved");
  }

  /* ---------- Archive ---------- */
  function viewArchive() {
    const ai = state.inquiries.filter((i) => i.archived);
    const ap = state.products.filter((p) => p.archived);
    const tab = ui.archTab;
    let body;
    if (tab === "inquiries") {
      body = ai.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>${ai.map((i) => `<tr>
        <td class="muted">${fmtDate(i.created_at)}</td><td><b>${esc(i.name)}</b><div class="muted">${esc(i.phone)}</div></td><td>${esc(i.type)}</td><td>${badge(i.status)}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" data-action="restore-inquiry" data-id="${i.id}" type="button">Restore</button>
        <button class="btn btn-sm btn-danger" data-action="delete-inquiry" data-id="${i.id}" type="button">Delete</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="card empty">No archived inquiries.</div>';
    } else {
      body = ap.length ? `<div class="table-wrap"><table><thead><tr><th>Color</th><th>Product</th><th>Price</th><th></th></tr></thead><tbody>${ap.map((p) => `<tr>
        <td><span class="dot" style="background:${esc(p.swatch)}"></span></td><td><b>${esc(p.item)}</b><div class="muted">${esc(p.category)}</div></td><td class="mono">${esc(D.fmtPrice(p.price))}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" data-action="restore-product" data-id="${p.id}" type="button">Restore</button>
        <button class="btn btn-sm btn-danger" data-action="delete-product" data-id="${p.id}" type="button">Delete</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="card empty">No archived products.</div>';
    }
    return pageHead("Records", "Archive", "Restore archived items or delete them for good.") + `
      <div class="tabs">
        <button class="tab ${tab === "inquiries" ? "active" : ""}" data-action="arch-tab" data-tab="inquiries" type="button">Inquiries (${ai.length})</button>
        <button class="tab ${tab === "products" ? "active" : ""}" data-action="arch-tab" data-tab="products" type="button">Products (${ap.length})</button>
      </div>${body}`;
  }

  /* ---------- Events ---------- */
  const T = (table) => D.client.from(table);
  const actions = {
    "open-inquiry": (el) => openInquiry(el.dataset.id),
    "save-inquiry": saveInquiry,
    "export-inquiries": exportInquiries,
    "print-quote": (el) => printQuote(el.dataset.id),
    "archive-inquiry": (el) => { closeModal(); db(T("inquiries").update({ archived: true }).eq("id", el.dataset.id), "Moved to archive"); },
    "restore-inquiry": (el) => db(T("inquiries").update({ archived: false }).eq("id", el.dataset.id), "Restored"),
    "delete-inquiry": (el) => confirmBox("Permanently delete this inquiry? This cannot be undone.", "Delete", () => db(T("inquiries").delete().eq("id", el.dataset.id), "Inquiry deleted")),

    "new-product": () => openProductForm(null),
    "edit-product": (el) => openProductForm(find(state.products, el.dataset.id)),
    "save-product": saveProduct,
    "toggle-stock": (el) => { const p = find(state.products, el.dataset.id); db(T("products").update({ available: !p.available }).eq("id", p.id)); },
    "archive-product": (el) => db(T("products").update({ archived: true }).eq("id", el.dataset.id), "Removed from website — find it in Archive"),
    "restore-product": (el) => db(T("products").update({ archived: false }).eq("id", el.dataset.id), "Restored"),
    "delete-product": (el) => confirmBox("Permanently delete this product? This cannot be undone.", "Delete", () => db(T("products").delete().eq("id", el.dataset.id), "Product deleted")),
    "add-service": () => { readSettingsForm(); state.settings.services.push({ key: "svc_" + Date.now(), label: "", rate: 0 }); refresh(); },
    "remove-service": (el) => { readSettingsForm(); state.settings.services.splice(Number(el.dataset.i), 1); refresh(); },
    "arch-tab": (el) => { ui.archTab = el.dataset.tab; refresh(); },
  };

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeModal();
    const el = e.target.closest("[data-action]");
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  });
  document.addEventListener("input", (e) => {
    if (["calcService", "calcArea", "calcPaint"].includes(e.target.id))
      $("#calcOut").innerHTML = calcOut({ svc: $("#calcService").value, area: $("#calcArea").value, paint: $("#calcPaint").value });
    if (e.target.id === "inqSearch") { ui.inq.q = e.target.value; $("#inqBody").innerHTML = inquiryRows(); }
    if (e.target.id === "prodSearch") { ui.prod.q = e.target.value; $("#prodBody").innerHTML = productRows(); }
  });
  document.addEventListener("change", (e) => {
    const id = e.target.id;
    if (id === "inqStatus") { ui.inq.status = e.target.value; $("#inqBody").innerHTML = inquiryRows(); }
    if (id === "inqType") { ui.inq.type = e.target.value; $("#inqBody").innerHTML = inquiryRows(); }
    if (id === "prodCat") { ui.prod.cat = e.target.value; $("#prodBody").innerHTML = productRows(); }
    if (id === "prodShow") { ui.prod.show = e.target.value; $("#prodBody").innerHTML = productRows(); }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "estForm") { e.preventDefault(); saveEstimator(); }
    if (["inqForm", "prodForm"].includes(e.target.id)) e.preventDefault();
  });

  /* ---------- Login / boot ---------- */
  async function start(session) {
    const email = session.user.email || "admin";
    $("#whoami").textContent = email.split("@")[0];
    $("#avatar").textContent = email.charAt(0).toUpperCase();
    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    await loadAll();
    route();
  }
  const showLogin = (msg = "") => {
    $("#app").classList.add("hidden");
    $("#login").classList.remove("hidden");
    $("#loginError").textContent = msg;
  };

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!D.ready) return showLogin("Supabase isn't configured yet — fill in js/config.js.");
    const { data, error } = await D.client.auth.signInWithPassword({ email: $("#loginUser").value.trim(), password: $("#loginPass").value });
    if (error) return showLogin("Incorrect email or password.");
    $("#loginPass").value = "";
    start(data.session);
  });
  $("#logoutBtn").addEventListener("click", async () => {
    if (D.ready) await D.client.auth.signOut();
    showLogin();
  });
  $("#menuBtn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); });
  $("#scrim").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); });
  window.addEventListener("hashchange", route);

  (async function init() {
    if (!D.ready) return showLogin("Supabase isn't configured yet — fill in js/config.js.");
    const { data } = await D.client.auth.getSession();
    if (data.session) start(data.session); else showLogin();
  })();
})();