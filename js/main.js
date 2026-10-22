const SECTIONS = {
  "header-mount":       "sections/header.html",
  "hero-mount":         "sections/hero.html",
  "products-mount":     "sections/products.html",
  "mixing-mount":       "sections/mixing.html",
  "contracting-mount":  "sections/contracting.html",
  "about-mount":        "sections/about.html",
  "contact-mount":      "sections/contact.html",
  "footer-mount":       "sections/footer.html",
};

// Fallback product data, used only if the database can't be reached
const FALLBACK_PRODUCTS = [
  {category:"Boysen", item:"Gloss Latex", unit:"Per Tin", price:"3,100 PHP", swatch:"#c23b2c"},
  {category:"Boysen", item:"Flat Latex", unit:"Per Tin", price:"2,700 PHP", swatch:"#e2a638"},
  {category:"Boysen", item:"Plexibond", unit:"Per Tin", price:"3,400 PHP", swatch:"#2f7566"},
  {category:"Domino", item:"Texas QDE White", unit:"Per Gallon", price:"468 PHP", swatch:"#f4f1ea"},
  {category:"Paint Brush", item:"1/2 inch", unit:"Per Pc", price:"10 PHP", swatch:"#2f4f7a"},
  {category:"Roller", item:"#7 Roller", unit:"Per Pc", price:"80 PHP", swatch:"#7a3f6b"},
];

async function loadSections() {
  const entries = Object.entries(SECTIONS);
  await Promise.all(entries.map(async ([mountId, path]) => {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    try {
      const res = await fetch(path);
      mount.innerHTML = await res.text();
    } catch (err) {
      mount.innerHTML = `<p style="padding:24px;color:#c23b2c;">Could not load ${path}. Serve this folder over http:// to load sections.</p>`;
      console.error(`Failed to load ${path}`, err);
    }
  }));
}

async function loadProducts() {
  // Live catalog from Supabase (edited in /admin); falls back to the JSON file
  const live = await PalisDB.getPublicProducts();
  if (live) return live;
  try {
    const res = await fetch("data/products.json");
    return await res.json();
  } catch (err) {
    console.warn("Falling back to inline product data:", err);
    return FALLBACK_PRODUCTS;
  }
}

function initMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const navList = document.getElementById("navList");
  if (!menuBtn || !navList) return;
  menuBtn.addEventListener("click", () => navList.classList.toggle("open"));
  navList.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => navList.classList.remove("open"))
  );
}

function initProducts(products) {
  const filtersEl = document.getElementById("filters");
  const gridEl = document.getElementById("productGrid");
  if (!filtersEl || !gridEl) return;

  const categories = ["All", ...new Set(products.map(p => p.category))];

  function render(filter) {
    gridEl.innerHTML = "";
    const list = filter === "All" ? products : products.filter(p => p.category === filter);
    if (!list.length) {
      gridEl.innerHTML = '<div class="no-results">No products in this category yet.</div>';
      return;
    }
    list.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="swatch-dot" style="background:${p.swatch}"></div>
        <div class="cat">${p.category}</div>
        <h4>${p.item}</h4>
        <div class="meta">
          <span class="unit">${p.unit}</span>
          <span class="price">${p.available === false ? "Out of stock" : p.price}</span>
        </div>`;
      if (p.available === false) card.style.opacity = "0.55";
      gridEl.appendChild(card);
    });
  }

  categories.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.className = "filter-chip" + (i === 0 ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      filtersEl.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      render(cat);
    });
    filtersEl.appendChild(btn);
  });

  render("All");
}

// Handles the "Send Inquiry" form: saves to Supabase and emails via Formspree
function initForm() {
  const form = document.getElementById("inquiryForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault(); // stop the normal page-reload form submission

    const submitBtn = form.querySelector(".submit-btn");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Sending...";
    submitBtn.disabled = true;

    try {
      const data = { ...Object.fromEntries(new FormData(form)), ...PalisEstimator.getPayload() };
      // Save to the database (for the admin panel) and email via Formspree at the same time
      const [saved, response] = await Promise.all([
        PalisDB.addInquiry(data),
        fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { "Accept": "application/json" }
        }).catch(() => ({ ok: false })),
      ]);

      if (saved || response.ok) {
        form.reset();
        PalisEstimator.reset();
        submitBtn.textContent = "Sent — thank you!";
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 4000);
      } else {
        throw new Error("Form submission failed");
      }
    } catch (err) {
      console.error(err);
      submitBtn.textContent = "Something went wrong — try again";
      submitBtn.disabled = false;
    }
  });
}

function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

(async function init() {
  await loadSections();
  const products = await loadProducts();
  initMenu();
  initProducts(products);
  initForm();
  await PalisEstimator.init(products);
  setYear();
})();