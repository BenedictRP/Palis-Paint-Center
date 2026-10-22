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
    archive: ICON('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'),
  };

  const state = { products: [], inquiries: [] };
  const ui = {
    inq: { q: "", status: "", type: "" },
    prod: { q: "", cat: "", show: "" },
    archTab: "inquiries",
  };

  /* ---------- Data (all reads/writes go to Supabase) ---------- */
  async function loadAll() {
    const [p, i] = await Promise.all([
      D.client.from("products").select("*").order("id"),
      D.client.from("inquiries").select("*").order("created_at", { ascending: false }),
    ]);
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
    archive: { title: "Archive", render: viewArchive },
  };
  const NAV = [
    ["Overview", [["dashboard", "Dashboard", "dashboard"]]],
    ["Requests", [["inquiries", "Inquiries", "inbox"]]],
    ["Content", [["products", "Products", "box"]]],
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
    return pageHead("Overview", "Dashboard", "A quick look at inquiries and your catalog.",
      '<button class="btn btn-gold" data-action="new-product" type="button">+ Add product</button>') + `
      <div class="tiles">
        <div class="tile blue"><div class="eyebrow">New inquiries</div><div class="n">${inq.filter((i) => i.status === "new").length}</div><div class="muted">awaiting a reply</div></div>
        <div class="tile"><div class="eyebrow">Open inquiries</div><div class="n">${inq.filter((i) => i.status !== "resolved").length}</div><div class="muted">new + in progress</div></div>
        <div class="tile teal"><div class="eyebrow">Products listed</div><div class="n">${prods.length}</div><div class="muted">${Object.keys(cats).length} categories</div></div>
        <div class="tile red"><div class="eyebrow">Out of stock</div><div class="n">${prods.filter((p) => !p.available).length}</div><div class="muted">marked unavailable</div></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Recent inquiries</h3>
          ${inq.slice(0, 5).map((i) => `<div class="list-row"><div><b>${esc(i.name)}</b><div class="muted">${esc(i.type)} · ${fmtDate(i.created_at)}</div></div>${badge(i.status)}</div>`).join("") || '<div class="empty">No inquiries yet.</div>'}
          <div style="margin-top:12px"><a class="btn btn-sm" href="#/inquiries">View all</a></div>
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
    if (!list.length) return '<tr><td colspan="5"><div class="empty">No inquiries match.</div></td></tr>';
    return list.map((i) => `<tr class="clickable" data-action="open-inquiry" data-id="${i.id}">
      <td class="muted" style="white-space:nowrap">${fmtDate(i.created_at)}</td>
      <td><b>${esc(i.name)}</b><div class="muted">${esc(i.phone)}</div></td>
      <td>${esc(i.type)}</td>
      <td class="muted">${esc(i.message.length > 70 ? i.message.slice(0, 70) + "…" : i.message)}</td>
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
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Message</th><th>Status</th></tr></thead>
      <tbody id="inqBody">${inquiryRows()}</tbody></table></div>`;
  }

  function openInquiry(id) {
    const i = find(state.inquiries, id);
    if (!i) return;
    const tel = (i.phone || "").replace(/[^\d+]/g, "");
    openModal(esc(i.name), `<form id="inqForm" data-id="${i.id}">
        <dl class="kv">
          <dt>Phone</dt><dd>${esc(i.phone)}</dd>
          <dt>Email</dt><dd>${esc(i.email || "—")}</dd>
          <dt>Type</dt><dd>${esc(i.type)}</dd>
          <dt>Received</dt><dd>${fmtDateTime(i.created_at)}</dd>
          <dt>Message</dt><dd>${esc(i.message)}</dd>
        </dl>
        <label class="field">Status<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${i.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="field">Internal note <small>(only visible here)</small><textarea name="note">${esc(i.note)}</textarea></label>
      </form>`,
      `<a class="btn btn-sm" href="tel:${esc(tel)}">Call</a>
       ${i.email ? `<a class="btn btn-sm" href="mailto:${esc(i.email)}">Email</a>` : ""}
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
    const rows = [["Date", "Name", "Phone", "Email", "Type", "Status", "Message", "Note"]]
      .concat(filteredInquiries().map((i) => [i.created_at, i.name, i.phone, i.email, i.type, STATUS[i.status], i.message, i.note]));
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
      <div class="row2"><label class="field">Unit / pack<input name="unit" required value="${esc(p.unit)}" placeholder="e.g. Per Gallon"></label>
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
    "arch-tab": (el) => { ui.archTab = el.dataset.tab; refresh(); },
  };

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeModal();
    const el = e.target.closest("[data-action]");
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  });
  document.addEventListener("input", (e) => {
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