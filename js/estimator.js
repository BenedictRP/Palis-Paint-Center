/* Customer-facing estimator inside the inquiry form:
 * - "Products you want to buy" list with quantities and a total
 * - Paint job estimate (labor + paint) shown as a price range
 * All amounts are in PHP. */
const PalisEstimator = (() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => PalisDB.fmtPHP(n);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toNum = (p) => p.priceNum ?? (Number(String(p.price).replace(/[^\d.]/g, "")) || 0);

  let products = [], settings = null, cart = [];
  let jobResult = null;

  function markup() {
    return `
      <div class="est" id="estProducts">
        <h5>Products you want to buy <small>(optional)</small></h5>
        <div class="est-row"><select id="estCat" aria-label="Category"></select><select id="estProd" aria-label="Product"></select></div>
        <div class="est-row"><input id="estQty" type="number" min="1" max="999" value="1" aria-label="Quantity"><button type="button" class="est-btn" id="estAdd">Add to list</button></div>
        <div id="estList"></div>
      </div>
      <div class="est" id="estJob" style="display:none">
        <h5>Paint job details</h5>
        <div class="field"><label for="estService">Type of work</label><select id="estService"></select></div>
        <div class="field"><label for="estArea">Area to paint (square meters)</label><input id="estArea" type="number" min="1" max="100000" step="any"></div>
        <div class="field"><label for="estPaint">Paint</label><select id="estPaint"></select></div>
        <div id="estJobOut"></div>
      </div>
      <div class="est est-total" id="estSummary" style="display:none"></div>
      <input type="hidden" name="estimate_summary" id="estSummaryField">`;
  }

  const isJob = () => $("type") && $("type").value === "Painting Service Estimate";

  function fillSelects() {
    const cats = [...new Set(products.map((p) => p.category))];
    $("estCat").innerHTML = cats.map((c) => `<option>${esc(c)}</option>`).join("");
    fillProducts();
    $("estService").innerHTML = settings.services.map((s, i) => `<option value="${i}">${esc(s.label)}</option>`).join("");
    const paints = products.filter((p) => PalisDB.PAINT_CATS.includes(p.category) && p.unit === "Per Gallon");
    const byCat = {};
    paints.forEach((p) => (byCat[p.category] = byCat[p.category] || []).push(p));
    $("estPaint").innerHTML = '<option value="">I will buy my own paint / labor only</option>' +
      Object.entries(byCat).map(([c, list]) => `<optgroup label="${esc(c)}">${list.map((p) => `<option value="${p._i}">${esc(p.item)} — ${fmt(p.priceNum)} per gallon</option>`).join("")}</optgroup>`).join("");
  }

  function fillProducts() {
    const cat = $("estCat").value;
    $("estProd").innerHTML = products.filter((p) => p.category === cat)
      .map((p) => `<option value="${p._i}">${esc(p.item)} — ${esc(p.unit)} — ${fmt(p.priceNum)}</option>`).join("");
  }

  function cartTotal() { return cart.reduce((s, c) => s + c.qty * c.price, 0); }

  function computeJob() {
    jobResult = null;
    const out = $("estJobOut");
    if (!isJob()) { out.innerHTML = ""; $("estArea").required = false; return; }
    $("estArea").required = true;
    const svc = settings.services[Number($("estService").value)];
    const area = Number($("estArea").value);
    if (!svc || !(area > 0)) { out.innerHTML = '<p class="est-note">Enter the area to see your estimate.</p>'; return; }
    const paint = $("estPaint").value === "" ? null : products[Number($("estPaint").value)];
    const r = PalisDB.calcJob(settings, { rate: Number(svc.rate), area, paintPrice: paint ? paint.priceNum : 0 });
    jobResult = {
      service_label: svc.label, rate: Number(svc.rate), area_sqm: area, coats: settings.coats,
      paint_name: paint ? `${paint.category} ${paint.item}` : null, paint_price: paint ? paint.priceNum : null,
      gallons: r.gallons, labor: r.labor, materials: r.materials, margin_pct: Number(settings.margin_pct),
      low: r.low, high: r.high,
    };
    out.innerHTML = `
      <div class="est-line"><span>Labor (${area} sq m × ${fmt(svc.rate)})</span><b>${fmt(r.labor)}</b></div>
      ${paint ? `<div class="est-line"><span>Paint (${r.gallons} gal × ${fmt(paint.priceNum)}, ${settings.coats} coats)</span><b>${fmt(r.materials)}</b></div>` : ""}
      <div class="est-line"><span>Estimated range</span><b>${fmt(r.low)} – ${fmt(r.high)}</b></div>`;
  }

  function range() {
    const sub = cartTotal();
    return { low: sub + (jobResult ? jobResult.low : 0), high: sub + (jobResult ? jobResult.high : 0) };
  }

  function summaryText() {
    const lines = [];
    if (cart.length) {
      lines.push("PRODUCTS:");
      cart.forEach((c) => lines.push(`- ${c.qty} x ${c.item} (${c.unit}) @ ${fmt(c.price)} = ${fmt(c.qty * c.price)}`));
      lines.push(`Products subtotal: ${fmt(cartTotal())}`);
    }
    if (jobResult) {
      lines.push(`PAINT JOB: ${jobResult.service_label}, ${jobResult.area_sqm} sq m`);
      lines.push(`Paint: ${jobResult.paint_name ? `${jobResult.paint_name} (${jobResult.gallons} gal)` : "customer's own / not selected"}`);
      lines.push(`Job estimate: ${fmt(jobResult.low)} - ${fmt(jobResult.high)}`);
    }
    if (cart.length || jobResult) {
      const r = range();
      lines.push(`TOTAL ESTIMATE: ${r.low === r.high ? fmt(r.high) : `${fmt(r.low)} - ${fmt(r.high)}`}`);
    }
    return lines.join("\n");
  }

  function render() {
    $("estJob").style.display = isJob() ? "" : "none";
    computeJob();
    $("estList").innerHTML = cart.length ? cart.map((c, i) => `
      <div class="est-line"><span>${c.qty} × ${esc(c.item)} <small>(${esc(c.unit)})</small></span>
        <span><b>${fmt(c.qty * c.price)}</b> <button type="button" class="est-x" data-rm="${i}" aria-label="Remove">✕</button></span></div>`).join("") : "";
    const box = $("estSummary");
    if (cart.length || jobResult) {
      const r = range();
      box.style.display = "";
      box.innerHTML = `<div class="est-line" style="border:0"><span>Estimated total</span><b>${r.low === r.high ? fmt(r.high) : `${fmt(r.low)} – ${fmt(r.high)}`}</b></div>
        <p class="est-note">Estimate only. Final price is confirmed by the shop after your inquiry.</p>`;
    } else box.style.display = "none";
    $("estSummaryField").value = summaryText();
  }

  function wire() {
    $("estCat").addEventListener("change", fillProducts);
    $("estAdd").addEventListener("click", () => {
      const p = products[Number($("estProd").value)];
      const qty = Math.max(1, Math.min(999, Math.floor(Number($("estQty").value) || 1)));
      if (!p) return;
      const existing = cart.find((c) => c.i === p._i);
      if (existing) existing.qty += qty;
      else cart.push({ i: p._i, id: p.id ?? null, category: p.category, item: p.item, unit: p.unit, price: p.priceNum, qty });
      $("estQty").value = 1;
      render();
    });
    $("estList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]");
      if (b) { cart.splice(Number(b.dataset.rm), 1); render(); }
    });
    ["estService", "estArea", "estPaint"].forEach((id) => $(id).addEventListener("input", render));
    $("type").addEventListener("change", render);
  }

  async function init(list) {
    const mount = $("estimator");
    if (!mount) return;
    products = list.filter((p) => p.available !== false).map((p, i) => ({ ...p, _i: i, priceNum: toNum(p) }));
    if (!products.length) return;
    settings = await PalisDB.getEstimatorSettings();
    mount.innerHTML = markup();
    fillSelects();
    wire();
    render();
  }

  // Data saved with the inquiry
  function getPayload() {
    if (!$("estProducts")) return {};
    const r = range();
    const hasAny = cart.length || jobResult;
    return {
      items: cart.map(({ id, category, item, unit, price, qty }) => ({ id, category, item, unit, price, qty })),
      job: jobResult,
      estimate_low: hasAny ? r.low : null,
      estimate_high: hasAny ? r.high : null,
    };
  }

  function reset() { cart = []; jobResult = null; if ($("estProducts")) { $("estArea").value = ""; render(); } }

  return { init, getPayload, reset };
})();