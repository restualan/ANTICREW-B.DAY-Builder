(() => {
  const KEY = "anticrew-bday-v2";
  const POSTER_W = 1920, POSTER_H = 1080;
  const CARD_W = 170, CARD_H = 232.2, GAP = 25;
  const ZONE_W = 1600, ZONE_H = 495;
  const PH_W = 156.5, PH_H = 218.7;
  const MAX_PHOTO_PX = 1100;

  const BASES = [
    { name: "Black", css: "#000000" },
    { name: "Midnight", css: "linear-gradient(160deg,#0b1d26,#031921)" },
    { name: "Ocean", css: "linear-gradient(160deg,#0f3a4a,#06141c)" },
    { name: "Forest", css: "linear-gradient(160deg,#10321f,#050f0a)" },
    { name: "Plum", css: "linear-gradient(160deg,#3a1636,#0d0610)" },
    { name: "Ember", css: "linear-gradient(160deg,#6b2a14,#150805)" },
  ];

  const $ = (id) => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const newExport = (scale, format) => ({ id: uid(), scale: scale || "1x", format: format || "PNG", quality: 95 });

  const sample = (name, title, date) => ({ id: uid(), name, title, date, photo: null, w: 0, h: 0, zoom: 1, ox: 0, oy: 0.6 });
  const defaults = () => ({
    texts: {
      headline: "Shout out to the Anticrew\nbirthday of the month",
      greeting:
        "Warmest birthday wishes to a valuable member of our team!\nMay your special month be as bright and wonderful as you are,\nbringing you happiness and prosperity throughout the year ahead.",
      season: "October 2026 -  Libra & Scorpion season",
    },
    cardScale: 1,
    exports: [newExport("2x", "JPG")],
    bg: { image: "default", base: BASES[0].css, imageOpacity: 0.7, overlay: 0 },
    cards: [
      sample("Person_Name_1", "Creative Director", "01"),
      sample("Person_Name_2", "Frontend Web Developer", "13"),
      sample("Person_Name_3", "CRM", "17"),
      sample("Person_Name_4", "Project Manager", "20"),
      sample("Person_Name_5", "Web Admin", "22"),
      sample("Person_Name_6", "Frontend Web Developer Lead", "23"),
      sample("Person_Name_7", "Sr. Project Manager", "23"),
      sample("Person_Name_8", "Project Manager", "23"),
      sample("Person_Name_9", "Sr. Graphic Designer", "28"),
    ],
  });

  let state = load() || defaults();
  let selectedId = null;
  let uploadTarget = null; // card id awaiting a photo from the file picker
  let viewScale = 1;

  /* ---------- persistence ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!(s && s.cards && s.texts && s.bg)) return null;
      if (typeof s.cardScale !== "number") s.cardScale = 1;
      if (!Array.isArray(s.exports)) s.exports = [{ id: uid(), scale: "2x", format: "JPG", quality: 95 }];
      return s;
    } catch (e) { return null; }
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        setStatus("Draft saved in this browser.");
      } catch (e) {
        setStatus("Autosave is full (large photos). Export your JPG soon so work isn't lost.", true);
      }
    }, 300);
  }
  function setStatus(msg, warn) {
    const el = $("status");
    el.textContent = msg;
    el.classList.toggle("warn", !!warn);
  }

  /* ---------- editable text ---------- */
  const plainOnly = (() => {
    const d = document.createElement("div");
    try { d.contentEditable = "plaintext-only"; } catch (e) {}
    return d.contentEditable === "plaintext-only";
  })();

  function makeEditable(el, get, set) {
    el.classList.add("editable");
    el.contentEditable = plainOnly ? "plaintext-only" : "true";
    el.spellcheck = false;
    el.textContent = get();
    el.addEventListener("input", () => { set(el.textContent); save(); });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertText", false, "\n"); }
    });
    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });
  }

  /* ---------- images ---------- */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, MAX_PHOTO_PX / Math.max(img.width, img.height));
          const w = Math.round(img.width * k), h = Math.round(img.height * k);
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          const keepsAlpha = /png|webp|gif/.test(file.type);
          let url = keepsAlpha ? cv.toDataURL("image/webp", 0.9) : cv.toDataURL("image/jpeg", 0.88);
          if (keepsAlpha && !url.startsWith("data:image/webp")) url = cv.toDataURL("image/png");
          resolve({ url, w, h });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  async function setCardPhoto(id, file) {
    const c = state.cards.find((x) => x.id === id);
    if (!c || !file || !file.type.startsWith("image/")) return;
    try {
      const { url, w, h } = await readImage(file);
      Object.assign(c, { photo: url, w, h, zoom: 1, ox: 0, oy: 0.6 });
      renderCards(); renderPanel(); save();
    } catch (e) { setStatus("Couldn't read that image.", true); }
  }

  function photoGeom(c) {
    const base = Math.max(PH_W / c.w, PH_H / c.h);
    const sc = base * c.zoom;
    const iw = c.w * sc, ih = c.h * sc;
    return { iw, ih, ex: (iw - PH_W) / 2, ey: (ih - PH_H) / 2 };
  }
  function placePhoto(c, img) {
    const g = photoGeom(c);
    img.style.width = g.iw + "px";
    img.style.height = g.ih + "px";
    img.style.left = (PH_W - g.iw) / 2 + c.ox * g.ex + "px";
    img.style.top = (PH_H - g.ih) / 2 + c.oy * g.ey + "px";
  }

  /* ---------- poster: background & static text ---------- */
  function renderBg() {
    const b = state.bg;
    $("bgBase").style.background = b.base;
    const img = $("bgImg");
    const src = b.image === "default" ? window.DEFAULT_BG : b.image;
    if (src) { img.src = src; img.style.display = ""; } else { img.removeAttribute("src"); img.style.display = "none"; }
    img.style.opacity = b.imageOpacity;
    $("bgOverlay").style.opacity = b.overlay;
  }

  /* ---------- poster: cards ---------- */
  function layout(n) {
    if (n <= 5) {
      // single row: scale up to use the available space
      const k = Math.max(1, n);
      const s = Math.min(2, ZONE_H / CARD_H, ZONE_W / (k * CARD_W + (k - 1) * GAP));
      return { rows: 1, per: k, s };
    }
    if (n <= 10) { const rows = Math.max(1, Math.ceil(n / 5)); return { rows, per: Math.ceil(n / rows), s: 1 }; }
    let best = null;
    for (let r = 3; r <= 8; r++) {
      const per = Math.ceil(n / r);
      const s = Math.min(1, ZONE_H / (r * CARD_H + (r - 1) * GAP), ZONE_W / (per * CARD_W + (per - 1) * GAP));
      if (!best || s > best.s + 1e-6) best = { rows: r, per, s };
    }
    return best;
  }

  const CAMERA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h3l2-3h8l2 3h3v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  function buildCard(c, s) {
    const card = document.createElement("div");
    card.className = "card" + (c.id === selectedId ? " sel" : "");
    card.dataset.id = c.id;
    card.style.setProperty("--s", s);

    const inner = document.createElement("div");
    inner.className = "card-in";
    const photo = document.createElement("div");
    photo.className = "photo";

    if (c.photo) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = c.photo;
      placePhoto(c, img);
      photo.appendChild(img);
    } else {
      const hint = document.createElement("div");
      hint.className = "empty-hint";
      hint.innerHTML = CAMERA + "<span>Click to add<br>photo</span>";
      photo.appendChild(hint);
    }
    const grad = document.createElement("div");
    grad.className = "grad";
    const date = document.createElement("div");
    date.className = "date";
    makeEditable(date, () => c.date, (v) => (c.date = v));
    const who = document.createElement("div");
    who.className = "who";
    const name = document.createElement("span");
    name.className = "name";
    makeEditable(name, () => c.name, (v) => (c.name = v));
    const role = document.createElement("span");
    role.className = "role";
    makeEditable(role, () => c.title, (v) => (c.title = v));
    who.append(name, role);
    photo.append(grad, date, who);
    // Never let the browser scroll the clipped photo to reveal the caret while typing.
    photo.addEventListener("scroll", () => { photo.scrollTop = 0; photo.scrollLeft = 0; });
    inner.appendChild(photo);
    card.appendChild(inner);

    // select / empty-click upload / pan
    photo.addEventListener("pointerdown", (e) => {
      select(c.id);
      if (e.target.closest(".editable")) return;
      if (!c.photo) { uploadTarget = c.id; $("photoInput").click(); return; }
      const g = photoGeom(c);
      if (g.ex < 0.5 && g.ey < 0.5) return;
      const k = viewScale * s;
      const sx = e.clientX, sy = e.clientY, ox0 = c.ox, oy0 = c.oy;
      const img = photo.querySelector("img");
      photo.setPointerCapture(e.pointerId);
      photo.classList.add("dragging");
      const move = (ev) => {
        const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
        c.ox = g.ex > 0.5 ? clamp(ox0 + dx / g.ex, -1, 1) : 0;
        c.oy = g.ey > 0.5 ? clamp(oy0 + dy / g.ey, -1, 1) : 0;
        placePhoto(c, img);
      };
      const up = () => {
        photo.classList.remove("dragging");
        photo.removeEventListener("pointermove", move);
        photo.removeEventListener("pointerup", up);
        photo.removeEventListener("pointercancel", up);
        save();
      };
      photo.addEventListener("pointermove", move);
      photo.addEventListener("pointerup", up);
      photo.addEventListener("pointercancel", up);
    });
    photo.addEventListener("dblclick", (e) => {
      if (e.target.closest(".editable")) return;
      uploadTarget = c.id; $("photoInput").click();
    });
    photo.addEventListener("wheel", (e) => {
      if (!c.photo) return;
      e.preventDefault();
      select(c.id);
      setZoom(c, c.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06));
    }, { passive: false });
    card.addEventListener("pointerdown", () => select(c.id));
    card.addEventListener("dragover", (e) => { e.preventDefault(); card.classList.add("dropping"); });
    card.addEventListener("dragleave", () => card.classList.remove("dropping"));
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("dropping");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setCardPhoto(c.id, f);
    });
    return card;
  }

  function renderCards() {
    const zone = $("cardsZone");
    zone.textContent = "";
    const lay = layout(state.cards.length);
    const per = lay.per, s = lay.s * state.cardScale;
    for (let i = 0; i < state.cards.length; i += per) {
      const row = document.createElement("div");
      row.className = "card-row";
      row.style.setProperty("--s", s);
      state.cards.slice(i, i + per).forEach((c) => row.appendChild(buildCard(c, s)));
      zone.appendChild(row);
    }
    fitDates();
    $("cardCount").textContent = "(" + state.cards.length + ")";
    renderList();
  }

  function setZoom(c, z) {
    c.zoom = clamp(z, 1, 4);
    const el = document.querySelector('.card[data-id="' + c.id + '"] .photo img');
    if (el) placePhoto(c, el);
    if (selectedId === c.id) $("zoomRange").value = c.zoom;
    save();
  }

  /* Pin each date to the photo's bottom-right corner: put the digits' baseline on the
     bottom edge regardless of which font is actually loaded. */
  const metricsCtx = document.createElement("canvas").getContext("2d");
  function fitDates() {
    if (window.CSS && CSS.supports("text-box-trim", "trim-both")) return; // CSS vertical trim handles it
    document.querySelectorAll(".date").forEach((el) => {
      const cs = getComputedStyle(el);
      metricsCtx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      const m = metricsCtx.measureText("0");
      const fa = m.fontBoundingBoxAscent, fd = m.fontBoundingBoxDescent;
      if (!(fa > 0)) return; // unsupported browser: keep the CSS default
      el.style.lineHeight = fa + fd + "px";
      el.style.bottom = -(fd + 1) + "px"; // baseline sits ~1px below the edge, like the Figma crop
    });
  }

  /* ---------- selection & side panel ---------- */
  function select(id) {
    if (selectedId === id) return;
    selectedId = id;
    document.querySelectorAll(".card").forEach((el) => el.classList.toggle("sel", el.dataset.id === id));
    renderList(); renderPanel();
  }

  function renderList() {
    const ol = $("cardList");
    ol.textContent = "";
    state.cards.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = c.id === selectedId ? "on" : "";
      const dot = document.createElement("span");
      dot.className = "dot";
      if (c.photo) dot.style.backgroundImage = "url(" + c.photo + ")";
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = (c.name || "Untitled").replace(/\n/g, " ");
      const dt = document.createElement("span");
      dt.className = "dt";
      dt.textContent = c.date;
      li.append(dot, nm, dt);
      li.addEventListener("click", () => select(c.id));
      ol.appendChild(li);
    });
  }

  function renderPanel() {
    const c = state.cards.find((x) => x.id === selectedId);
    $("selectedPanel").hidden = !c;
    if (!c) return;
    $("selName").textContent = (c.name || "Untitled").replace(/\n/g, " ");
    $("zoomRange").value = c.zoom;
    $("zoomRange").disabled = !c.photo;
    $("clearPhotoBtn").disabled = !c.photo;
    const i = state.cards.indexOf(c);
    $("moveLeftBtn").disabled = i === 0;
    $("moveRightBtn").disabled = i === state.cards.length - 1;
  }

  function renderSwatches() {
    const box = $("swatches");
    box.textContent = "";
    BASES.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "swatch" + (state.bg.base === b.css ? " on" : "");
      btn.style.background = b.css;
      btn.title = b.name;
      btn.setAttribute("aria-label", b.name);
      btn.addEventListener("click", () => { state.bg.base = b.css; renderBg(); renderSwatches(); save(); });
      box.appendChild(btn);
    });
    if (/^#/.test(state.bg.base)) $("bgColor").value = state.bg.base;
  }

  /* ---------- fit poster to window ---------- */
  function fit() {
    const st = $("stage");
    const cs = getComputedStyle(st);
    const w = st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    viewScale = Math.max(0.1, Math.min(w / POSTER_W, h / POSTER_H));
    $("posterHolder").style.width = POSTER_W * viewScale + "px";
    $("posterHolder").style.height = POSTER_H * viewScale + "px";
    $("poster").style.transform = "scale(" + viewScale + ")";
  }

  /* ---------- export (Figma-style settings: scale + format, many rows) ---------- */
  const MIN_W = 480, MAX_W = 8192;
  const FORMATS = {
    PNG: { mime: "image/png", ext: "png", lossy: false },
    JPG: { mime: "image/jpeg", ext: "jpg", lossy: true },
    WEBP: { mime: "image/webp", ext: "webp", lossy: true },
  };
  const SCALE_PRESETS = ["0.5x", "0.75x", "1x", "1.5x", "2x", "3x", "4x", "1920w", "3840w", "1080h", "2160h"];
  const openOpts = new Set(); // export-row ids whose "···" settings are open
  let menuEl = null;


  // "2x" | "2" | "3840w" | "1080h" -> pixel size at the poster's 16:9 ratio, or null if invalid
  function parseScale(str) {
    const m = /^\s*(\d*\.?\d+)\s*([xwh])?\s*$/i.exec(str || "");
    if (!m) return null;
    const val = parseFloat(m[1]), mode = (m[2] || "x").toLowerCase();
    if (!(val > 0)) return null;
    let w = mode === "x" ? POSTER_W * val : mode === "w" ? val : (val * POSTER_W) / POSTER_H;
    w = clamp(Math.round(w), MIN_W, MAX_W);
    return { w, h: Math.round((w * POSTER_H) / POSTER_W), mode, val, label: +val.toFixed(3) + mode };
  }
  function fileSuffix(p) {
    return p.mode === "x" ? (p.val === 1 ? "" : "@" + p.label) : "@" + p.label;
  }

  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  document.addEventListener("pointerdown", (e) => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest(".chev")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  function renderExports() {
    closeMenu();
    const box = $("exportRows");
    box.textContent = "";
    state.exports.forEach((ex) => {
      const wrap = document.createElement("div");
      wrap.className = "export-row-wrap";
      const row = document.createElement("div");
      row.className = "export-row";

      const combo = document.createElement("div");
      combo.className = "combo";
      const input = document.createElement("input");
      input.type = "text"; input.value = ex.scale; input.spellcheck = false;
      input.setAttribute("aria-label", "Export scale or size, e.g. 2x, 3840w, 1080h");
      const chev = document.createElement("button");
      chev.className = "chev"; chev.type = "button"; chev.textContent = "▾";
      chev.setAttribute("aria-label", "Scale presets");
      combo.append(input, chev);

      const commit = (val) => {
        const p = parseScale(val);
        if (!p) { input.classList.add("bad"); return false; }
        input.classList.remove("bad");
        ex.scale = p.label; input.value = p.label; save(); refreshOpts(); updatePreviewList();
        return true;
      };
      input.addEventListener("input", () => { input.classList.toggle("bad", !parseScale(input.value)); });
      input.addEventListener("change", () => { if (!commit(input.value)) { input.value = ex.scale; input.classList.remove("bad"); } });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      chev.addEventListener("click", () => {
        if (menuEl) { closeMenu(); return; }
        menuEl = document.createElement("div");
        menuEl.className = "menu";
        SCALE_PRESETS.forEach((s, i) => {
          if (i === 7) menuEl.appendChild(document.createElement("hr"));
          const b = document.createElement("button");
          b.type = "button"; b.textContent = s;
          b.onclick = () => { commit(s); closeMenu(); };
          menuEl.appendChild(b);
        });
        wrap.appendChild(menuEl);
      });

      const fmt = document.createElement("select");
      fmt.className = "fmt";
      fmt.setAttribute("aria-label", "Export format");
      Object.keys(FORMATS).forEach((f) => { const o = new Option(f, f); if (f === ex.format) o.selected = true; fmt.add(o); });
      fmt.onchange = () => { ex.format = fmt.value; save(); refreshOpts(); updatePreviewList(); };

      const dots = document.createElement("button");
      dots.className = "row-act" + (openOpts.has(ex.id) ? " on" : "");
      dots.type = "button"; dots.textContent = "•••"; dots.title = "More settings"; dots.setAttribute("aria-label", "More export settings");
      dots.onclick = () => { openOpts.has(ex.id) ? openOpts.delete(ex.id) : openOpts.add(ex.id); renderExports(); };

      const minus = document.createElement("button");
      minus.className = "row-act"; minus.type = "button"; minus.textContent = "—"; minus.title = "Remove export setting";
      minus.setAttribute("aria-label", "Remove export setting");
      minus.onclick = () => { state.exports = state.exports.filter((x) => x.id !== ex.id); openOpts.delete(ex.id); save(); renderExports(); updatePreviewList(); };

      row.append(combo, fmt, dots, minus);
      wrap.appendChild(row);

      const opts = document.createElement("div");
      opts.className = "export-opts";
      opts.hidden = !openOpts.has(ex.id);
      const refreshOpts = () => {
        const p = parseScale(ex.scale) || parseScale("1x");
        const f = FORMATS[ex.format];
        opts.textContent = "";
        const d = document.createElement("div");
        d.innerHTML = 'Output: <span class="dims">' + p.w + " × " + p.h + " px</span>";
        opts.appendChild(d);
        if (f.lossy) {
          const lab = document.createElement("label");
          lab.textContent = "Quality " + ex.quality + "%";
          const r = document.createElement("input");
          r.type = "range"; r.min = 50; r.max = 100; r.step = 1; r.value = ex.quality;
          r.oninput = () => { ex.quality = parseInt(r.value, 10); lab.firstChild.textContent = "Quality " + ex.quality + "%"; save(); };
          lab.appendChild(r);
          opts.appendChild(lab);
        } else {
          const n = document.createElement("div");
          n.textContent = "PNG is lossless, so there is no quality setting.";
          n.style.marginTop = "6px";
          opts.appendChild(n);
        }
      };
      refreshOpts();
      wrap.appendChild(opts);
      box.appendChild(wrap);
    });
    $("exportBtn").disabled = !state.exports.length;
    $("exportTopBtn").disabled = !state.exports.length;
  }

  // Run fn with the editing chrome hidden and the poster rendered at design size (clone only).
  async function withExportMode(fn) {
    const poster = $("poster");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    poster.classList.add("exporting");
    try {
      await document.fonts.ready;
      return await fn(poster);
    } finally {
      poster.classList.remove("exporting");
    }
  }
  const renderCanvas = (poster, w) =>
    window.htmlToImage.toCanvas(poster, {
      width: POSTER_W, height: POSTER_H, pixelRatio: w / POSTER_W,
      backgroundColor: "#000", cacheBust: false, style: { transform: "none" },
    });
  const toBlob = (canvas, mime, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't encode " + mime))), mime, q));

  function slug() {
    return (state.texts.season || "poster").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "poster";
  }

  let exporting = false;
  async function exportAll() {
    if (exporting || !state.exports.length) return;
    if (!window.htmlToImage) { setStatus("Export library didn't load (check your connection).", true); return; }
    exporting = true;
    $("exportBtn").disabled = true; $("exportTopBtn").disabled = true;
    try {
      await withExportMode(async (poster) => {
        await renderCanvas(poster, POSTER_W); // warm-up pass for fonts/images
        const cache = new Map(); // one render per distinct width
        const used = new Set();
        let n = 0;
        for (const ex of state.exports) {
          const p = parseScale(ex.scale) || parseScale("1x");
          const f = FORMATS[ex.format];
          setStatus("Rendering " + p.w + "×" + p.h + " " + ex.format + " (" + (n + 1) + "/" + state.exports.length + ")…");
          if (!cache.has(p.w)) cache.set(p.w, await renderCanvas(poster, p.w));
          const blob = await toBlob(cache.get(p.w), f.mime, ex.quality / 100);
          let name = "anticrew-bday-" + slug() + fileSuffix(p), key = name + "." + f.ext, dup = 2;
          while (used.has(key)) key = name + "-" + dup++ + "." + f.ext;
          used.add(key);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = key;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          n++;
          if (n < state.exports.length) await new Promise((r) => setTimeout(r, 300)); // let the browser accept each download
        }
        setStatus("Exported " + n + " file" + (n > 1 ? "s" : "") + ".");
      });
    } catch (e) {
      console.error(e);
      setStatus("Export failed: " + (e && e.message ? e.message : "unknown error") + ". Try a smaller size.", true);
    } finally {
      exporting = false;
      renderExports();
    }
  }

  /* preview: a small render of the poster plus the size of every export row */
  let previewOpen = false;
  function updatePreviewList() {
    const ul = $("previewList");
    ul.textContent = "";
    state.exports.forEach((ex) => {
      const p = parseScale(ex.scale) || parseScale("1x");
      const li = document.createElement("li");
      const a = document.createElement("span"), b = document.createElement("span");
      a.textContent = "anticrew-bday-" + slug() + fileSuffix(p) + "." + FORMATS[ex.format].ext;
      a.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px";
      b.textContent = p.w + "×" + p.h;
      li.append(a, b);
      ul.appendChild(li);
    });
  }
  async function refreshPreview() {
    if (!window.htmlToImage) return;
    try {
      const url = await withExportMode(async (poster) => (await renderCanvas(poster, 640)).toDataURL("image/jpeg", 0.85));
      $("previewImg").src = url;
    } catch (e) { console.error(e); }
  }

  /* ---------- wiring ---------- */
  function init() {
    $("logo").src = window.LOGO_SVG;

    ["headline", "greeting", "season"].forEach((k) =>
      makeEditable($(k), () => state.texts[k], (v) => (state.texts[k] = v)));
    $("headline").classList.add("editable");

    renderBg(); renderCards(); renderPanel(); renderSwatches(); fit();
    if (document.fonts) document.fonts.ready.then(fitDates);
    $("bgOpacity").value = state.bg.imageOpacity;
    $("bgDarken").value = state.bg.overlay;
    new ResizeObserver(fit).observe($("stage"));

    $("addCardBtn").onclick = () => {
      const c = sample("Person_Name_" + (state.cards.length + 1), "Job Title", "00");
      state.cards.push(c);
      selectedId = c.id;
      renderCards(); renderPanel(); save();
    };
    $("cardScale").value = state.cardScale;
    $("cardScaleVal").textContent = Math.round(state.cardScale * 100) + "%";
    $("cardScale").oninput = (e) => {
      state.cardScale = parseFloat(e.target.value);
      $("cardScaleVal").textContent = Math.round(state.cardScale * 100) + "%";
      renderCards(); save();
    };
    $("subCardBtn").onclick = () => {
      if (!state.cards.length) return;
      const i = state.cards.findIndex((x) => x.id === selectedId);
      state.cards.splice(i < 0 ? state.cards.length - 1 : i, 1);
      selectedId = null;
      renderCards(); renderPanel(); save();
    };
    $("addPhotosBtn").onclick = () => $("multiInput").click();
    $("multiInput").onchange = async (e) => {
      for (const f of e.target.files) {
        const c = sample(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), "Job Title", "00");
        state.cards.push(c);
        selectedId = c.id;
        await setCardPhoto(c.id, f);
      }
      e.target.value = "";
    };
    $("photoInput").onchange = (e) => {
      if (uploadTarget && e.target.files[0]) setCardPhoto(uploadTarget, e.target.files[0]);
      e.target.value = "";
    };
    $("replacePhotoBtn").onclick = () => { uploadTarget = selectedId; $("photoInput").click(); };
    $("clearPhotoBtn").onclick = () => {
      const c = state.cards.find((x) => x.id === selectedId);
      if (c) { Object.assign(c, { photo: null, w: 0, h: 0, zoom: 1, ox: 0, oy: 0.6 }); renderCards(); renderPanel(); save(); }
    };
    $("zoomRange").oninput = (e) => {
      const c = state.cards.find((x) => x.id === selectedId);
      if (c) setZoom(c, parseFloat(e.target.value));
    };
    const move = (d) => {
      const i = state.cards.findIndex((x) => x.id === selectedId), j = i + d;
      if (i < 0 || j < 0 || j >= state.cards.length) return;
      [state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]];
      renderCards(); renderPanel(); save();
    };
    $("moveLeftBtn").onclick = () => move(-1);
    $("moveRightBtn").onclick = () => move(1);
    $("removeCardBtn").onclick = () => {
      state.cards = state.cards.filter((x) => x.id !== selectedId);
      selectedId = null;
      renderCards(); renderPanel(); save();
    };

    $("bgUploadBtn").onclick = () => $("bgInput").click();
    $("bgInput").onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        const fr = new FileReader();
        const dataUrl = await new Promise((res, rej) => { fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(f); });
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
        const k = Math.min(1, 1920 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        state.bg.image = cv.toDataURL("image/jpeg", 0.88);
        renderBg(); save();
      } catch (err) { setStatus("Couldn't read that image.", true); }
    };
    $("bgDefaultBtn").onclick = () => { state.bg.image = "default"; renderBg(); save(); };
    $("bgNoneBtn").onclick = () => { state.bg.image = null; renderBg(); save(); };
    $("bgOpacity").oninput = (e) => { state.bg.imageOpacity = parseFloat(e.target.value); renderBg(); save(); };
    $("bgDarken").oninput = (e) => { state.bg.overlay = parseFloat(e.target.value); renderBg(); save(); };
    $("bgColor").oninput = (e) => { state.bg.base = e.target.value; renderBg(); renderSwatches(); save(); };

    $("resetBtn").onclick = () => {
      if (!confirm("Reset the poster to the original sample content? Your current draft will be lost.")) return;
      state = defaults();
      selectedId = null;
      ["headline", "greeting", "season"].forEach((k) => ($(k).textContent = state.texts[k]));
      $("bgOpacity").value = state.bg.imageOpacity;
      $("bgDarken").value = state.bg.overlay;
      $("cardScale").value = state.cardScale;
      $("cardScaleVal").textContent = "100%";
      renderBg(); renderCards(); renderPanel(); renderSwatches(); openOpts.clear(); renderExports(); updatePreviewList(); save();
    };
    renderExports(); updatePreviewList();
    $("exportAdd").onclick = () => { state.exports.push(newExport("1x", "PNG")); save(); renderExports(); updatePreviewList(); };
    $("exportBtn").onclick = exportAll;
    $("exportTopBtn").onclick = exportAll;
    $("previewToggle").onclick = () => {
      previewOpen = !previewOpen;
      $("previewToggle").setAttribute("aria-expanded", previewOpen);
      $("previewBox").hidden = !previewOpen;
      if (previewOpen) refreshPreview();
    };
    $("previewRefresh").onclick = refreshPreview;
    if (location.protocol === "file:") setStatus("Tip: open via start.command so exported images embed fonts correctly.", true);

    $("stage").addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".card") && !e.target.closest(".editable") && selectedId) {
        selectedId = null;
        document.querySelectorAll(".card.sel").forEach((el) => el.classList.remove("sel"));
        renderList(); renderPanel();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }

  init();
})();
