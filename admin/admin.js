/* Palis Paint Center — Admin Panel (single-page, hash routed) */
(() => {
  const S = PalisStore;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const INQUIRY_TYPES = ["Product Inquiry", "Custom Color Request", "Painting Service Estimate"];
  const STATUS = { new: "New", progress: "In progress", resolved: "Resolved" };
  const DEFAULT_USER = "admin";
  const DEFAULT_PASS = "admin123";

  const ICON = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICONS = {
    dashboard: ICON('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    inbox: ICON('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    calendar: ICON('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    box: ICON('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    layout: ICON('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
    archive: ICON('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'),
    user: ICON('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  };

  const state = { products: [], inquiries: [], events: [], settings: {}, logs: [] };
  const ui = {
    inq: { q: "", status: "", type: "" },
    prod: { q: "", cat: "", show: "" },
    cal: { y: new Date().getFullYear(), m: new Date().getMonth() },
    archTab: "inquiries",
  };

  const save = {
    products: () => S.write(S.K.products, state.products),
    inquiries: () => S.write(S.K.inquiries, state.inquiries),
    events: () => S.write(S.K.events, state.events),
    settings: () => S.write(S.K.settings, state.settings),
    logs: () => S.write(S.K.logs, state.logs.slice(0, 300)),
  };

  function log(action, detail = "") {
    state.logs.unshift({ ts: new Date().toISOString(), action, detail });
    save.logs();
  }

  async function loadAll() {
    let products = S.read(S.K.products, null);
    if (!products) {
      // First run: import the catalog that ships with the website.
      try {
        const res = await fetch("../data/products.json");
        const raw = await res.json();
        products = raw.map((p) => ({ id: S.uid(), available: true, archived: false, ...p }));
      } catch (e) {
        products = [];
      }
      S.write(S.K.products, products);
    }
    state.products = products;

    let inquiries = S.read(S.K.inquiries, null);
    if (!inquiries) {
      const now = Date.now(), day = 864e5;
      inquiries = [
        { id: S.uid(), sample: true, name: "Maria Santos", phone: "0917 555 0101", email: "", type: "Custom Color Request", message: "Looking for a sage green similar to a sample chip I have. Can you match it in 4 liters of latex?", status: "new", archived: false, note: "", created: new Date(now - 0.2 * day).toISOString() },
        { id: S.uid(), sample: true, name: "Juan dela Cruz", phone: "0920 555 0102", email: "juan@example.com", type: "Painting Service Estimate", message: "Two-storey house exterior, about 180 sqm of wall. Do you offer a site visit and quote?", status: "progress", archived: false, note: "Called back, visit proposed.", created: new Date(now - 2 * day).toISOString() },
        { id: S.uid(), sample: true, name: "Ana Reyes", phone: "0936 555 0103", email: "", type: "Product Inquiry", message: "Is Boysen Plexibond still available? How much per tin?", status: "resolved", archived: false, note: "", created: new Date(now - 5 * day).toISOString() },
      ];
      S.write(S.K.inquiries, inquiries);
    }
    state.inquiries = inquiries;
    state.events = S.read(S.K.events, []);
    state.settings = S.getSettings();
    state.logs = S.read(S.K.logs, []);
  }

  /* ---------- Auth ---------- */
  async function sha(text) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      return "plain:" + text; // crypto.subtle needs https/localhost
    }
  }
  const getAuth = () => S.read(S.K.auth, null);
  const isLoggedIn = () => sessionStorage.getItem("palis_admin") === "1";
  const currentUser = () => (getAuth() || { user: DEFAULT_USER }).user;

  async function tryLogin(user, pass) {
    const auth = getAuth();
    if (!auth) return user === DEFAULT_USER && pass === DEFAULT_PASS;
    return user === auth.user && (await sha(pass)) === auth.hash;
  }

  /* ---------- Helpers ---------- */
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const fmtDateTime = (iso) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const priceNumber = (s) => Number(String(s).replace(/[^\d.]/g, "")) || 0;
  const priceText = (n) => `${Number(n).toLocaleString("en-US")} PHP`;
  const badge = (s) => `<span class="badge b-${s}">${STATUS[s] || s}</span>`;
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
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  function openModal(title, body, foot = "") {
    const m = $("#modal");
    m.innerHTML = `<div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="Close" type="button">✕</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}`;
    if (!m.open) m.showModal();
    return m;
  }
  const closeModal = () => { const m = $("#modal"); if (m.open) m.close(); };

  function confirmBox(message, okLabel, onOk) {
    openModal("Please confirm", `<p>${esc(message)}</p>`,
      `<button class="btn" data-close type="button">Cancel</button><button class="btn btn-danger" id="confirmOk" type="button">${esc(okLabel)}</button>`);
    $("#confirmOk").onclick = () => { closeModal(); onOk(); };
  }

  function download(filename, text, type = "text/plain") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- Views ---------- */
  const ROUTES = {
    dashboard: { title: "Dashboard", render: viewDashboard },
    inquiries: { title: "Inquiries", render: viewInquiries },
    calendar: { title: "Calendar", render: viewCalendar },
    products: { title: "Products", render: viewProducts },
    store: { title: "Store Info", render: viewStore },
    archive: { title: "Archive & Logs", render: viewArchive },
    profile: { title: "Profile", render: viewProfile },
  };

  const NAV = [
    ["Overview", [["dashboard", "Dashboard", "dashboard"]]],
    ["Requests", [["inquiries", "Inquiries", "inbox"], ["calendar", "Calendar", "calendar"]]],
    ["Content", [["products", "Products", "box"], ["store", "Store Info", "layout"]]],
    ["Records", [["archive", "Archive & Logs", "archive"]]],
    ["Account", [["profile", "Profile", "user"]]],
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
    if (!isLoggedIn()) return;
    const id = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
    const r = ROUTES[id] || ROUTES.dashboard;
    const key = ROUTES[id] ? id : "dashboard";
    $("#pageTitle").textContent = r.title;
    document.title = `${r.title} — Palis Admin`;
    renderNav(key);
    $("#view").innerHTML = r.render();
    $("#sidebar").classList.remove("open");
    $("#scrim").classList.remove("show");
    window.scrollTo(0, 0);
  }
  const refresh = () => {
    const y = window.scrollY;
    route();
    window.scrollTo(0, y);
  };

  /* Dashboard */
  function viewDashboard() {
    const inq = activeInquiries();
    const prods = state.products.filter((p) => !p.archived);
    const open = inq.filter((i) => i.status !== "resolved").length;
    const out = prods.filter((p) => !p.available).length;

    const byType = INQUIRY_TYPES.map((t) => [t, inq.filter((i) => i.type === t).length]);
    const maxT = Math.max(1, ...byType.map((x) => x[1]));
    const cats = {};
    prods.forEach((p) => (cats[p.category] = (cats[p.category] || 0) + 1));
    const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const maxC = Math.max(1, ...catRows.map((x) => x[1]));
    const today = ymd(new Date());
    const upcoming = state.events.filter((e) => e.date >= today && !e.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5);

    const bars = (rows, max) => rows.length ? rows.map(([l, n]) =>
      `<div class="bar-row"><span>${esc(l)}</span><div class="bar"><span style="width:${(n / max) * 100}%"></span></div><b>${n}</b></div>`).join("") : '<div class="empty">No data yet.</div>';

    return pageHead("Overview", "Dashboard", "A quick look at inquiries, your catalog and upcoming visits.",
      '<a class="btn btn-gold" href="#/products">+ Add product</a>') + `
      <div class="tiles">
        <div class="tile blue"><div class="eyebrow">New inquiries</div><div class="n">${inq.filter((i) => i.status === "new").length}</div><div class="muted">awaiting a reply</div></div>
        <div class="tile"><div class="eyebrow">Open inquiries</div><div class="n">${open}</div><div class="muted">new + in progress</div></div>
        <div class="tile teal"><div class="eyebrow">Products listed</div><div class="n">${prods.length}</div><div class="muted">${Object.keys(cats).length} categories</div></div>
        <div class="tile red"><div class="eyebrow">Out of stock</div><div class="n">${out}</div><div class="muted">marked unavailable</div></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Recent inquiries</h3>
          ${inq.slice(0, 5).map((i) => `<div class="list-row"><div><b>${esc(i.name)}</b><div class="muted">${esc(i.type)} · ${fmtDate(i.created)}</div></div>${badge(i.status)}</div>`).join("") || '<div class="empty">No inquiries yet.</div>'}
          <div style="margin-top:12px"><a class="btn btn-sm" href="#/inquiries">View all</a></div>
        </div>
        <div class="card"><h3>Upcoming visits</h3>
          ${upcoming.map((e) => `<div class="list-row"><div><b>${esc(e.title)}</b><div class="muted">${esc(e.note || "")}</div></div><span class="mono muted">${fmtDate(e.date + "T00:00")}${e.time ? " · " + esc(e.time) : ""}</span></div>`).join("") || '<div class="empty">Nothing scheduled.</div>'}
          <div style="margin-top:12px"><a class="btn btn-sm" href="#/calendar">Open calendar</a></div>
        </div>
        <div class="card"><h3>Inquiries by type</h3>${bars(byType, maxT)}</div>
        <div class="card"><h3>Products by category</h3>${bars(catRows, maxC)}</div>
      </div>`;
  }

  /* Inquiries */
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
      <td class="muted" style="white-space:nowrap">${fmtDate(i.created)}</td>
      <td><b>${esc(i.name)}</b>${i.sample ? ' <span class="badge b-sample">sample</span>' : ""}<div class="muted">${esc(i.phone)}</div></td>
      <td>${esc(i.type)}</td>
      <td class="muted">${esc(i.message.length > 70 ? i.message.slice(0, 70) + "…" : i.message)}</td>
      <td>${badge(i.status)}</td></tr>`).join("");
  }

  function viewInquiries() {
    return pageHead("Requests", "Inquiries", "Messages sent from the website's inquiry form. Click a row to reply, update status or schedule a visit.",
      '<button class="btn" data-action="export-inquiries" type="button">Export CSV</button><button class="btn btn-gold" data-action="new-inquiry" type="button">+ Log inquiry</button>') + `
      <div class="toolbar">
        <input id="inqSearch" type="search" placeholder="Search name, phone, message…" value="${esc(ui.inq.q)}">
        <select id="inqStatus"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${ui.inq.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select id="inqType"><option value="">All types</option>${INQUIRY_TYPES.map((t) => `<option ${ui.inq.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Message</th><th>Status</th></tr></thead>
      <tbody id="inqBody">${inquiryRows()}</tbody></table></div>`;
  }

  function inquiryForm(i) {
    const isNew = !i;
    i = i || { name: "", phone: "", email: "", type: INQUIRY_TYPES[0], message: "", status: "new", note: "" };
    return `<form id="inqForm" data-id="${i.id || ""}">
      <div class="row2"><label class="field">Name<input name="name" required value="${esc(i.name)}"></label>
      <label class="field">Phone<input name="phone" required value="${esc(i.phone)}"></label></div>
      <div class="row2"><label class="field">Email<input name="email" type="email" value="${esc(i.email)}"></label>
      <label class="field">Type<select name="type">${INQUIRY_TYPES.map((t) => `<option ${i.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <label class="field">Message<textarea name="message" required>${esc(i.message)}</textarea></label>
      <label class="field">Status<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${i.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="field">Internal note <small>(only visible here)</small><textarea name="note">${esc(i.note)}</textarea></label>
      ${isNew ? "" : `<div class="muted">Received ${fmtDateTime(i.created)}</div>`}
    </form>`;
  }

  function openInquiry(id) {
    const i = state.inquiries.find((x) => x.id === id);
    if (!i) return;
    const tel = i.phone.replace(/[^\d+]/g, "");
    openModal(esc(i.name),
      inquiryForm(i),
      `<a class="btn btn-sm" href="tel:${esc(tel)}">Call</a>
       ${i.email ? `<a class="btn btn-sm" href="mailto:${esc(i.email)}">Email</a>` : ""}
       <button class="btn btn-sm" data-action="schedule-from-inquiry" data-id="${i.id}" type="button">Schedule visit</button>
       <button class="btn btn-sm" data-action="archive-inquiry" data-id="${i.id}" type="button">Archive</button>
       <button class="btn btn-gold" data-action="save-inquiry" type="button">Save</button>`);
  }

  function saveInquiryFromForm() {
    const form = $("#inqForm");
    if (!form.reportValidity()) return;
    const d = Object.fromEntries(new FormData(form));
    const id = form.dataset.id;
    if (id) {
      const i = state.inquiries.find((x) => x.id === id);
      Object.assign(i, d);
      log("Inquiry updated", `${i.name} → ${STATUS[i.status]}`);
    } else {
      state.inquiries.unshift({ id: S.uid(), archived: false, created: new Date().toISOString(), ...d });
      log("Inquiry logged", d.name);
    }
    save.inquiries();
    closeModal();
    toast("Inquiry saved");
    refresh();
  }

  function exportInquiries() {
    const rows = [["Date", "Name", "Phone", "Email", "Type", "Status", "Message", "Note"]]
      .concat(filteredInquiries().map((i) => [i.created, i.name, i.phone, i.email, i.type, STATUS[i.status], i.message, i.note]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    download("palis-inquiries.csv", "\ufeff" + csv, "text/csv");
    log("Exported inquiries", `${rows.length - 1} rows`);
  }

  /* Calendar */
  function viewCalendar() {
    const { y, m } = ui.cal;
    const first = new Date(y, m, 1);
    const start = new Date(y, m, 1 - first.getDay());
    const today = ymd(new Date());
    let cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`).join("");
    for (let n = 0; n < 42; n++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n);
      const key = ymd(d);
      const evs = state.events.filter((e) => e.date === key).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      cells += `<div class="day ${d.getMonth() !== m ? "off" : ""} ${key === today ? "today" : ""}" data-action="new-event" data-date="${key}">
        <span class="dn">${d.getDate()}</span>
        ${evs.map((e) => `<span class="chip ${e.done ? "done" : ""}" data-action="open-event" data-id="${e.id}" title="${esc(e.title)}">${esc(e.time ? e.time + " " : "")}${esc(e.title)}</span>`).join("")}
      </div>`;
    }
    return pageHead("Requests / Schedule", "Calendar", "Site visits, estimates and pickups. Click a day to add an entry.",
      '<button class="btn btn-gold" data-action="new-event" type="button">+ Add entry</button>') + `
      <div class="cal-head">
        <button class="icon-btn" data-action="cal-prev" aria-label="Previous month" type="button">‹</button>
        <h3>${first.toLocaleString("en-US", { month: "long", year: "numeric" })}</h3>
        <button class="btn btn-sm" data-action="cal-today" type="button">Today</button>
        <button class="icon-btn" data-action="cal-next" aria-label="Next month" type="button">›</button>
      </div>
      <div class="cal">${cells}</div>`;
  }

  function eventForm(e) {
    e = e || {};
    return `<form id="evForm" data-id="${e.id || ""}" data-inq="${e.inquiryId || ""}">
      <label class="field">Title<input name="title" required value="${esc(e.title || "")}" placeholder="e.g. Site visit — Juan dela Cruz"></label>
      <div class="row2"><label class="field">Date<input name="date" type="date" required value="${esc(e.date || ymd(new Date()))}"></label>
      <label class="field">Time <small>(optional)</small><input name="time" type="time" value="${esc(e.time || "")}"></label></div>
      <label class="field">Notes<textarea name="note">${esc(e.note || "")}</textarea></label>
      <label class="check"><input type="checkbox" name="done" ${e.done ? "checked" : ""}> Mark as done</label>
    </form>`;
  }

  function openEvent(e) {
    openModal(e && e.id ? "Edit entry" : "New entry", eventForm(e),
      `${e && e.id ? '<button class="btn btn-danger" data-action="delete-event" type="button">Delete</button>' : ""}<button class="btn btn-gold" data-action="save-event" type="button">Save</button>`);
  }

  function saveEvent() {
    const form = $("#evForm");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const data = { title: fd.get("title"), date: fd.get("date"), time: fd.get("time"), note: fd.get("note"), done: fd.get("done") === "on" };
    const id = form.dataset.id;
    if (id) {
      Object.assign(state.events.find((x) => x.id === id), data);
      log("Calendar entry updated", data.title);
    } else {
      state.events.push({ id: S.uid(), inquiryId: form.dataset.inq || "", ...data });
      log("Calendar entry added", data.title);
    }
    save.events();
    closeModal();
    toast("Calendar saved");
    refresh();
  }

  /* Products (create / update / delete) */
  function filteredProducts() {
    const f = ui.prod, q = f.q.toLowerCase();
    return state.products.filter((p) => !p.archived &&
      (!f.cat || p.category === f.cat) &&
      (!f.show || (f.show === "out" ? !p.available : p.available)) &&
      (!q || (p.category + " " + p.item).toLowerCase().includes(q)));
  }

  function productRows() {
    const list = filteredProducts();
    if (!list.length) return '<tr><td colspan="6"><div class="empty">No products match.</div></td></tr>';
    return list.map((p) => `<tr>
      <td><span class="dot" style="background:${esc(p.swatch)}"></span></td>
      <td><b>${esc(p.item)}</b><div class="muted">${esc(p.category)}</div></td>
      <td>${esc(p.unit)}</td>
      <td class="mono">${esc(p.price)}</td>
      <td>${p.available ? '<span class="badge b-resolved">In stock</span>' : '<span class="badge b-out">Out of stock</span>'}</td>
      <td style="white-space:nowrap"><button class="btn btn-sm" data-action="edit-product" data-id="${p.id}" type="button">Edit</button>
        <button class="btn btn-sm" data-action="toggle-stock" data-id="${p.id}" type="button">${p.available ? "Mark out" : "Mark in"}</button>
        <button class="btn btn-sm btn-danger" data-action="archive-product" data-id="${p.id}" type="button">Archive</button></td></tr>`).join("");
  }

  const categories = () => [...new Set(state.products.map((p) => p.category))].sort();

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

  function productForm(p) {
    p = p || { category: "", item: "", unit: "", price: "", swatch: "#c23b2c", available: true };
    return `<form id="prodForm" data-id="${p.id || ""}">
      <label class="field">Category / brand<input name="category" list="catList" required value="${esc(p.category)}" placeholder="e.g. Boysen"><datalist id="catList">${categories().map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label class="field">Product name<input name="item" required value="${esc(p.item)}"></label>
      <div class="row2"><label class="field">Unit / pack<input name="unit" required value="${esc(p.unit)}" placeholder="e.g. 4 Gals"></label>
      <label class="field">Price (PHP)<input name="price" type="number" min="0" step="1" required value="${p.price ? priceNumber(p.price) : ""}"></label></div>
      <div class="row2"><label class="field">Swatch color<input name="swatch" type="color" value="${esc(p.swatch)}"></label>
      <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="available" ${p.available ? "checked" : ""}> In stock</label></div>
    </form>`;
  }

  function saveProduct() {
    const form = $("#prodForm");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const data = {
      category: fd.get("category").trim(), item: fd.get("item").trim(), unit: fd.get("unit").trim(),
      price: priceText(fd.get("price")), swatch: fd.get("swatch"), available: fd.get("available") === "on",
    };
    const id = form.dataset.id;
    if (id) {
      Object.assign(state.products.find((x) => x.id === id), data);
      log("Product updated", data.item);
    } else {
      state.products.push({ id: S.uid(), archived: false, ...data });
      log("Product added", data.item);
    }
    save.products();
    closeModal();
    toast("Product saved");
    refresh();
  }

  /* Store info */
  function viewStore() {
    const s = state.settings;
    return pageHead("Content", "Store Info", "Contact details shown in the website's Contact section and footer.") + `
      <div class="card" style="max-width:640px">
        <form id="storeForm">
          <label class="field">Phone number<input name="phone" required value="${esc(s.phone)}"></label>
          <label class="field">Address<textarea name="address" required>${esc(s.address)}</textarea></label>
          <label class="field">Facebook page URL<input name="facebook" type="url" value="${esc(s.facebook)}"></label>
          <label class="field">Store hours <small>(optional — shown in the Contact section when filled in)</small><input name="hours" value="${esc(s.hours)}" placeholder="Mon–Sat 8:00 AM – 6:00 PM"></label>
          <button class="btn btn-gold" type="submit">Save changes</button>
        </form>
      </div>`;
  }

  /* Archive & logs */
  function viewArchive() {
    const ai = state.inquiries.filter((i) => i.archived);
    const ap = state.products.filter((p) => p.archived);
    const tab = ui.archTab;
    let body = "";
    if (tab === "inquiries") {
      body = ai.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>${ai.map((i) => `<tr>
        <td class="muted">${fmtDate(i.created)}</td><td><b>${esc(i.name)}</b><div class="muted">${esc(i.phone)}</div></td><td>${esc(i.type)}</td><td>${badge(i.status)}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" data-action="restore-inquiry" data-id="${i.id}" type="button">Restore</button>
        <button class="btn btn-sm btn-danger" data-action="delete-inquiry" data-id="${i.id}" type="button">Delete</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="card empty">No archived inquiries.</div>';
    } else if (tab === "products") {
      body = ap.length ? `<div class="table-wrap"><table><thead><tr><th>Color</th><th>Product</th><th>Price</th><th></th></tr></thead><tbody>${ap.map((p) => `<tr>
        <td><span class="dot" style="background:${esc(p.swatch)}"></span></td><td><b>${esc(p.item)}</b><div class="muted">${esc(p.category)}</div></td><td class="mono">${esc(p.price)}</td>
        <td style="white-space:nowrap"><button class="btn btn-sm" data-action="restore-product" data-id="${p.id}" type="button">Restore</button>
        <button class="btn btn-sm btn-danger" data-action="delete-product" data-id="${p.id}" type="button">Delete</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="card empty">No archived products.</div>';
    } else {
      body = state.logs.length ? `<div class="card">${state.logs.slice(0, 100).map((l) => `<div class="list-row"><div><b>${esc(l.action)}</b><div class="muted">${esc(l.detail)}</div></div><span class="mono muted">${fmtDateTime(l.ts)}</span></div>`).join("")}</div>` : '<div class="card empty">No activity recorded yet.</div>';
    }
    return pageHead("Records", "Archive & Logs", "Restore archived items or review recent admin activity.",
      tab === "logs" && state.logs.length ? '<button class="btn btn-danger" data-action="clear-logs" type="button">Clear log</button>' : "") + `
      <div class="tabs">
        <button class="tab ${tab === "inquiries" ? "active" : ""}" data-action="arch-tab" data-tab="inquiries" type="button">Inquiries (${ai.length})</button>
        <button class="tab ${tab === "products" ? "active" : ""}" data-action="arch-tab" data-tab="products" type="button">Products (${ap.length})</button>
        <button class="tab ${tab === "logs" ? "active" : ""}" data-action="arch-tab" data-tab="logs" type="button">Activity log</button>
      </div>${body}`;
  }

  /* Profile */
  function viewProfile() {
    return pageHead("Account", "Profile", "Sign-in details and data tools.") + `
      <div class="notice"><b>How data is stored:</b> everything (products, inquiries, calendar) is saved in this browser's local storage, so it is private to this device. Use <b>Backup</b> below to keep a copy. Customers' inquiries are also emailed to you through Formspree.</div>
      <div class="grid2">
        <div class="card"><h3>Sign-in</h3>
          <form id="pwForm">
            <label class="field">Username<input name="user" required value="${esc(currentUser())}"></label>
            <label class="field">Current password<input name="cur" type="password" required autocomplete="current-password"></label>
            <label class="field">New password <small>(min. 6 characters, leave blank to keep)</small><input name="next" type="password" minlength="6" autocomplete="new-password"></label>
            <div id="pwMsg" class="form-error" role="alert"></div>
            <button class="btn btn-gold" type="submit">Update</button>
          </form>
        </div>
        <div class="card"><h3>Data tools</h3>
          <p class="sub">Backup and restore everything as one JSON file.</p>
          <div class="actions" style="margin-bottom:18px">
            <button class="btn" data-action="backup" type="button">Download backup</button>
            <label class="btn" style="cursor:pointer">Restore backup<input id="restoreFile" type="file" accept="application/json" hidden></label>
          </div>
          <p class="sub">Remove the three sample inquiries that came with the demo.</p>
          <button class="btn" data-action="clear-samples" type="button">Remove sample inquiries</button>
          <p class="sub" style="margin-top:18px">Reset the catalog, inquiries, calendar and info to the original website defaults.</p>
          <button class="btn btn-danger" data-action="reset-all" type="button">Reset all data</button>
        </div>
      </div>`;
  }

  /* ---------- Events ---------- */
  const byId = (list, id) => list.find((x) => x.id === id);

  const actions = {
    "open-inquiry": (el) => openInquiry(el.dataset.id),
    "new-inquiry": () => openModal("Log an inquiry", inquiryForm(null), '<button class="btn btn-gold" data-action="save-inquiry" type="button">Save</button>'),
    "save-inquiry": saveInquiryFromForm,
    "export-inquiries": exportInquiries,
    "archive-inquiry": (el) => {
      const i = byId(state.inquiries, el.dataset.id);
      i.archived = true; save.inquiries(); log("Inquiry archived", i.name);
      closeModal(); toast("Moved to archive"); refresh();
    },
    "restore-inquiry": (el) => {
      const i = byId(state.inquiries, el.dataset.id);
      i.archived = false; save.inquiries(); log("Inquiry restored", i.name); toast("Restored"); refresh();
    },
    "delete-inquiry": (el) => confirmBox("Permanently delete this inquiry? This cannot be undone.", "Delete", () => {
      const i = byId(state.inquiries, el.dataset.id);
      state.inquiries = state.inquiries.filter((x) => x.id !== i.id); save.inquiries(); log("Inquiry deleted", i.name); refresh();
    }),
    "schedule-from-inquiry": (el) => {
      const i = byId(state.inquiries, el.dataset.id);
      openEvent({ title: `${i.type === "Painting Service Estimate" ? "Site visit" : "Follow-up"} — ${i.name}`, note: `${i.phone}\n${i.message}`, inquiryId: i.id });
    },

    "cal-prev": () => { ui.cal.m--; if (ui.cal.m < 0) { ui.cal.m = 11; ui.cal.y--; } refresh(); },
    "cal-next": () => { ui.cal.m++; if (ui.cal.m > 11) { ui.cal.m = 0; ui.cal.y++; } refresh(); },
    "cal-today": () => { const n = new Date(); ui.cal = { y: n.getFullYear(), m: n.getMonth() }; refresh(); },
    "new-event": (el) => openEvent(el.dataset.date ? { date: el.dataset.date } : null),
    "open-event": (el) => openEvent(byId(state.events, el.dataset.id)),
    "save-event": saveEvent,
    "delete-event": () => {
      const id = $("#evForm").dataset.id;
      const e = byId(state.events, id);
      state.events = state.events.filter((x) => x.id !== id); save.events(); log("Calendar entry deleted", e.title);
      closeModal(); toast("Entry deleted"); refresh();
    },

    "new-product": () => openModal("Add product", productForm(null), '<button class="btn btn-gold" data-action="save-product" type="button">Save</button>'),
    "edit-product": (el) => openModal("Edit product", productForm(byId(state.products, el.dataset.id)), '<button class="btn btn-gold" data-action="save-product" type="button">Save</button>'),
    "save-product": saveProduct,
    "toggle-stock": (el) => {
      const p = byId(state.products, el.dataset.id);
      p.available = !p.available; save.products(); log("Stock changed", `${p.item} → ${p.available ? "in stock" : "out of stock"}`); refresh();
    },
    "archive-product": (el) => {
      const p = byId(state.products, el.dataset.id);
      p.archived = true; save.products(); log("Product archived", p.item); toast("Removed from website — find it in Archive"); refresh();
    },
    "restore-product": (el) => {
      const p = byId(state.products, el.dataset.id);
      p.archived = false; save.products(); log("Product restored", p.item); toast("Restored"); refresh();
    },
    "delete-product": (el) => confirmBox("Permanently delete this product? This cannot be undone.", "Delete", () => {
      const p = byId(state.products, el.dataset.id);
      state.products = state.products.filter((x) => x.id !== p.id); save.products(); log("Product deleted", p.item); refresh();
    }),

    "arch-tab": (el) => { ui.archTab = el.dataset.tab; refresh(); },
    "clear-logs": () => confirmBox("Clear the whole activity log?", "Clear", () => { state.logs = []; save.logs(); refresh(); }),

    "backup": () => {
      const data = { exported: new Date().toISOString(), products: state.products, inquiries: state.inquiries, events: state.events, settings: state.settings };
      download(`palis-backup-${ymd(new Date())}.json`, JSON.stringify(data, null, 2), "application/json");
      log("Backup downloaded");
    },
    "clear-samples": () => {
      state.inquiries = state.inquiries.filter((i) => !i.sample); save.inquiries(); log("Sample inquiries removed"); toast("Sample inquiries removed"); refresh();
    },
    "reset-all": () => confirmBox("This erases all products, inquiries, calendar entries and settings in this browser and restores the website defaults.", "Reset everything", async () => {
      [S.K.products, S.K.inquiries, S.K.events, S.K.settings, S.K.logs].forEach((k) => localStorage.removeItem(k));
      await loadAll(); toast("Data reset"); refresh();
    }),
  };

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeModal();
    const el = e.target.closest("[data-action]");
    if (!el) return;
    if (el.dataset.action === "new-event" && e.target.closest('[data-action="open-event"]')) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.stopPropagation(); fn(el); }
  });

  document.addEventListener("input", (e) => {
    const id = e.target.id;
    if (id === "inqSearch") { ui.inq.q = e.target.value; $("#inqBody").innerHTML = inquiryRows(); }
    if (id === "prodSearch") { ui.prod.q = e.target.value; $("#prodBody").innerHTML = productRows(); }
  });
  document.addEventListener("change", (e) => {
    const id = e.target.id;
    if (id === "inqStatus") { ui.inq.status = e.target.value; $("#inqBody").innerHTML = inquiryRows(); }
    if (id === "inqType") { ui.inq.type = e.target.value; $("#inqBody").innerHTML = inquiryRows(); }
    if (id === "prodCat") { ui.prod.cat = e.target.value; $("#prodBody").innerHTML = productRows(); }
    if (id === "prodShow") { ui.prod.show = e.target.value; $("#prodBody").innerHTML = productRows(); }
    if (id === "restoreFile") restoreBackup(e.target.files[0]);
  });

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (form.id === "storeForm") {
      e.preventDefault();
      state.settings = { ...state.settings, ...Object.fromEntries(new FormData(form)) };
      save.settings(); log("Store info updated"); toast("Store info saved");
    }
    if (form.id === "pwForm") {
      e.preventDefault();
      const fd = new FormData(form), msg = $("#pwMsg");
      if (!(await tryLogin(currentUser(), fd.get("cur")))) { msg.textContent = "Current password is incorrect."; return; }
      const next = fd.get("next") || fd.get("cur");
      S.write(S.K.auth, { user: fd.get("user").trim(), hash: await sha(next) });
      log("Sign-in details updated"); msg.textContent = ""; form.reset(); toast("Sign-in details updated"); refresh();
    }
    if (form.id === "inqForm" || form.id === "evForm" || form.id === "prodForm") e.preventDefault();
  });

  async function restoreBackup(file) {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.products) || !Array.isArray(d.inquiries)) throw new Error("bad file");
      S.write(S.K.products, d.products);
      S.write(S.K.inquiries, d.inquiries);
      S.write(S.K.events, d.events || []);
      S.write(S.K.settings, d.settings || {});
      await loadAll();
      log("Backup restored"); toast("Backup restored"); refresh();
    } catch (err) {
      toast("That file isn't a valid backup");
    }
  }

  /* ---------- Boot ---------- */
  function showApp() {
    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    const u = currentUser();
    $("#whoami").textContent = u;
    $("#avatar").textContent = u.charAt(0).toUpperCase();
    route();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#loginError");
    if (await tryLogin($("#loginUser").value.trim(), $("#loginPass").value)) {
      sessionStorage.setItem("palis_admin", "1");
      err.textContent = "";
      await loadAll();
      log("Signed in");
      showApp();
    } else {
      err.textContent = "Incorrect username or password.";
    }
  });

  $("#logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("palis_admin");
    $("#app").classList.add("hidden");
    $("#login").classList.remove("hidden");
    $("#loginPass").value = "";
  });
  $("#menuBtn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); });
  $("#scrim").addEventListener("click", () => { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); });
  window.addEventListener("hashchange", route);

  (async function init() {
    if (isLoggedIn()) { await loadAll(); showApp(); }
    else $("#login").classList.remove("hidden");
  })();
})();