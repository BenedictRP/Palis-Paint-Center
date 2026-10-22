const PalisStore = (() => {
  const K = {
    products: "palis_products",
    inquiries: "palis_inquiries",
    settings: "palis_settings",
    events: "palis_events",
    logs: "palis_logs",
    auth: "palis_auth",
  };

  const DEFAULT_SETTINGS = {
    phone: "0995 631 7627",
    address: "Rizal Street, Poblacion East, San Nicolas, Pangasinan, Philippines",
    facebook: "https://www.facebook.com/people/Palis-Paint-Center/61590207343370/",
    hours: "",
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Could not save " + key, e);
      return false;
    }
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(K.settings, {}));
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

  return { K, DEFAULT_SETTINGS, read, write, uid, getSettings, addInquiry };
})();