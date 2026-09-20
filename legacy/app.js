/* ---------------------------------------------------------
   Yayın Yönetim Aracı
   Yerel form tabanlı yayın bilgisi girişi + adapter mimarisi.
   API entegrasyonu eklemek için: PlatformAdapters.<platform>.publish()
   içindeki gövdeyi gerçek fetch() çağrısıyla değiştirin ve
   Settings.getSettings() ile alınan API anahtarını kullanın.
--------------------------------------------------------- */

const STORAGE_KEYS = {
  draft: "ygy_draft",
  history: "ygy_history",
  templates: "ygy_templates",
  settings: "ygy_settings",
};

/* ---------- AI Önerileri (NVIDIA nvidia_chat ile üretildi) ---------- */

const AI_SUGGESTIONS = [
  {
    category: "Sohbet",
    title: "Gecenin Tadı Sohbet, Sürpriz Sorular ve Anlık Anılar",
    description: "Sohbet köşesine gel, canlı sohbetimizde eğlenceli anlar yaşa!",
    tags: ["sohbet", "canlı", "sürpriz", "etkileşim", "soru-cevap"],
  },
  {
    category: "FPS/Aksiyon",
    title: "Yoğun Aksiyon, Taktiksel Çatışmalar ve Anlık Headshotlar",
    description: "Yoğun rekabet ve yüksek tempolu FPS keyfini birlikte keşfedelim!",
    tags: ["fps", "aksiyon", "headshot", "taktik", "rekabet", "oyun"],
  },
  {
    category: "Retro/8-bit",
    title: "Retro Dünyasına Yolculuk: 8-bit Klasiklerle Nostaljik Macera",
    description: "Nostalji rüzgarını hisset, 8-bit oyunlarla geçmişe yolculuk yap!",
    tags: ["retro", "8bit", "nostalji", "klasik", "pixel", "macera"],
  },
  {
    category: "Müzik",
    title: "Canlı Müzik Seansı: En Sevilen Parçalar ve Anlık İstekler",
    description: "Müzik dolu bir akşam, favori şarkılarını ve canlı istekleri kaçırma!",
    tags: ["müzik", "canlı", "şarkı", "istek", "akustik", "dinleme"],
  },
  {
    category: "IRL",
    title: "Günlük Hayat Vlogu: Şehir Turu, Kafe Molası ve Anlık Anılar",
    description: "Şehrin sokaklarında spontane bir keşfe çık, gerçek anları yakala!",
    tags: ["irl", "vlog", "şehir", "keşif", "kafe", "günlük"],
  },
  {
    category: "Yaratıcı/Sanat",
    title: "Dijital Çizim Seansı: Karakter Tasarımı ve Canlı İpuçları",
    description: "Canlı çizimle karakter yarat, adım adım ipuçlarıyla yeteneğini geliştir!",
    tags: ["sanat", "çizim", "dijital", "tasarım", "karakter", "canlı"],
  },
];

/* ---------- Yardımcılar ---------- */

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function formatDateTime(value) {
  if (!value) return "Planlanmadı";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

/* ---------- Form durumu ---------- */

function getFormState() {
  const tagsRaw = $("#fTags").value;
  const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

  return {
    title: $("#fTitle").value.trim(),
    description: $("#fDescription").value.trim(),
    tags,
    language: $("#fLanguage").value,
    scheduledAt: $("#fSchedule").value,
    thumbnail: getFormState._thumb || null,
    twitch: {
      category: $("#twCategory").value.trim(),
      mature: $("#twMature").checked,
      branded: $("#twBranded").checked,
    },
    youtube: {
      category: $("#ytCategory").value,
      privacy: $("#ytPrivacy").value,
      madeForKids: $("#ytKids").checked,
      monetize: $("#ytMonetize").checked,
    },
    kick: {
      category: $("#kkCategory").value.trim(),
      mature: $("#kkMature").checked,
    },
  };
}

function setFormState(state) {
  if (!state) return;
  $("#fTitle").value = state.title || "";
  $("#fDescription").value = state.description || "";
  $("#fTags").value = (state.tags || []).join(", ");
  $("#fLanguage").value = state.language || "tr";
  $("#fSchedule").value = state.scheduledAt || "";
  getFormState._thumb = state.thumbnail || null;
  renderThumb(state.thumbnail || null);

  const tw = state.twitch || {};
  $("#twCategory").value = tw.category || "";
  $("#twMature").checked = !!tw.mature;
  $("#twBranded").checked = !!tw.branded;

  const yt = state.youtube || {};
  $("#ytCategory").value = yt.category || "Oyun";
  $("#ytPrivacy").value = yt.privacy || "public";
  $("#ytKids").checked = !!yt.madeForKids;
  $("#ytMonetize").checked = yt.monetize !== false;

  const kk = state.kick || {};
  $("#kkCategory").value = kk.category || "";
  $("#kkMature").checked = !!kk.mature;

  renderTagPreview();
  renderTitleCount();
  renderAllOutputs();
}

function clearForm() {
  setFormState({
    title: "", description: "", tags: [], language: "tr", scheduledAt: "",
    thumbnail: null,
    twitch: { category: "", mature: false, branded: false },
    youtube: { category: "Oyun", privacy: "public", madeForKids: false, monetize: true },
    kick: { category: "", mature: false },
  });
}

function renderThumb(dataUrl) {
  const box = $("#thumbPreview");
  box.innerHTML = "";
  if (dataUrl) {
    const img = document.createElement("img");
    img.src = dataUrl;
    box.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "thumb-empty";
    span.textContent = "Görsel seçilmedi";
    box.appendChild(span);
  }
}

function renderTagPreview() {
  const raw = $("#fTags").value;
  const tags = raw.split(",").map(t => t.trim()).filter(Boolean);
  const row = $("#tagPreview");
  row.innerHTML = "";
  tags.forEach(t => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = t;
    row.appendChild(chip);
  });
}

function renderTitleCount() {
  $("#titleCount").textContent = String($("#fTitle").value.length);
}

/* ---------- Platform adaptörleri (ileride API entegrasyonu buraya) ---------- */

const PlatformAdapters = {
  twitch: {
    label: "Twitch",
    format(entry) {
      const lines = [
        `[TWITCH] ${entry.title || "(başlıksız)"}`,
        `Kategori: ${entry.twitch.category || "-"}`,
        `Dil: ${entry.language}`,
        `Yetişkin içerik: ${entry.twitch.mature ? "Evet" : "Hayır"}`,
        `Marka içerikli: ${entry.twitch.branded ? "Evet" : "Hayır"}`,
        `Planlanan: ${formatDateTime(entry.scheduledAt)}`,
        entry.tags.length ? `Etiketler: ${entry.tags.join(", ")}` : null,
        entry.description ? `\nAçıklama:\n${entry.description}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    },
    async publish(entry, settings) {
      // API entegrasyonu için: Twitch Helix "Modify Channel Information" endpoint'i.
      // settings.twitch.accessToken / settings.twitch.clientId kullanılacak.
      throw new Error("not_implemented");
    },
  },

  youtube: {
    label: "YouTube",
    format(entry) {
      const lines = [
        `[YOUTUBE] ${entry.title || "(başlıksız)"}`,
        `Kategori: ${entry.youtube.category}`,
        `Gizlilik: ${entry.youtube.privacy}`,
        `Çocuklara uygun: ${entry.youtube.madeForKids ? "Evet" : "Hayır"}`,
        `Gelir elde etme: ${entry.youtube.monetize ? "Açık" : "Kapalı"}`,
        `Planlanan: ${formatDateTime(entry.scheduledAt)}`,
        entry.tags.length ? `Etiketler: ${entry.tags.join(", ")}` : null,
        entry.description ? `\nAçıklama:\n${entry.description}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    },
    async publish(entry, settings) {
      // API entegrasyonu için: YouTube Data API v3 "liveBroadcasts.insert/update" endpoint'i.
      // settings.youtube.apiKey / OAuth token kullanılacak.
      throw new Error("not_implemented");
    },
  },

  kick: {
    label: "Kick",
    format(entry) {
      const lines = [
        `[KICK] ${entry.title || "(başlıksız)"}`,
        `Kategori: ${entry.kick.category || "-"}`,
        `Dil: ${entry.language}`,
        `Yetişkin içerik: ${entry.kick.mature ? "Evet" : "Hayır"}`,
        `Planlanan: ${formatDateTime(entry.scheduledAt)}`,
        entry.tags.length ? `Etiketler: ${entry.tags.join(", ")}` : null,
        entry.description ? `\nAçıklama:\n${entry.description}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    },
    async publish(entry, settings) {
      // API entegrasyonu için: Kick public API "channel" güncelleme endpoint'i.
      // settings.kick.accessToken kullanılacak.
      throw new Error("not_implemented");
    },
  },
};

function renderAllOutputs() {
  const entry = getFormState();
  Object.keys(PlatformAdapters).forEach(key => {
    const out = $(`#out-${key}`);
    if (out) out.textContent = PlatformAdapters[key].format(entry);
  });
}

async function handlePublish(platform) {
  const entry = getFormState();
  const settings = loadJSON(STORAGE_KEYS.settings, {});
  try {
    await PlatformAdapters[platform].publish(entry, settings);
    showToast(`${PlatformAdapters[platform].label}: yayınlandı`);
  } catch (e) {
    // API henüz bağlı değil: formatlanmış metni panoya kopyalayıp kullanıcıyı bilgilendir.
    const text = PlatformAdapters[platform].format(entry);
    await copyToClipboard(text);
    showToast(`${PlatformAdapters[platform].label}: API bağlı değil, metin panoya kopyalandı`);
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

/* ---------- Sekmeler ---------- */

function initTabs() {
  $all(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const platform = btn.dataset.platform;
      $all(".tab-panel").forEach(p => {
        p.classList.toggle("hidden", p.dataset.panel !== platform);
      });
    });
  });
}

/* ---------- Geçmiş & Şablonlar ---------- */

function saveToHistory() {
  const entry = getFormState();
  if (!entry.title) {
    showToast("Kaydetmeden önce bir başlık girin");
    return;
  }
  const history = loadJSON(STORAGE_KEYS.history, []);
  history.unshift({ ...entry, savedAt: new Date().toISOString(), id: crypto.randomUUID() });
  saveJSON(STORAGE_KEYS.history, history.slice(0, 100));
  showToast("Geçmişe kaydedildi");
}

function saveAsTemplate() {
  const name = prompt("Şablon adı:");
  if (!name) return;
  const entry = getFormState();
  const templates = loadJSON(STORAGE_KEYS.templates, []);
  templates.unshift({ ...entry, name, id: crypto.randomUUID() });
  saveJSON(STORAGE_KEYS.templates, templates);
  showToast(`Şablon kaydedildi: ${name}`);
}

function openListModal(kind) {
  const isHistory = kind === "history";
  const items = loadJSON(isHistory ? STORAGE_KEYS.history : STORAGE_KEYS.templates, []);
  const modal = $("#modal");
  modal.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeModal);
  modal.appendChild(closeBtn);

  const h3 = document.createElement("h3");
  h3.textContent = isHistory ? "Geçmiş Yayınlar" : "Şablonlar";
  modal.appendChild(h3);

  if (!items.length) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = isHistory ? "Henüz kayıtlı geçmiş yok." : "Henüz kayıtlı şablon yok.";
    modal.appendChild(p);
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "list-item";

    const label = document.createElement("span");
    label.textContent = isHistory
      ? `${item.title} — ${formatDateTime(item.savedAt)}`
      : item.name;
    row.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "btn small";
    loadBtn.textContent = "Yükle";
    loadBtn.addEventListener("click", () => {
      setFormState(item);
      closeModal();
      showToast("Form dolduruldu");
    });
    actions.appendChild(loadBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn small danger";
    delBtn.textContent = "Sil";
    delBtn.addEventListener("click", () => {
      const key = isHistory ? STORAGE_KEYS.history : STORAGE_KEYS.templates;
      const list = loadJSON(key, []).filter(x => x.id !== item.id);
      saveJSON(key, list);
      openListModal(kind);
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    modal.appendChild(row);
  });

  $("#modalBackdrop").classList.remove("hidden");
}

/* ---------- Ayarlar (gelecekteki API entegrasyonu için) ---------- */

function openSettingsModal() {
  const settings = loadJSON(STORAGE_KEYS.settings, {});
  const modal = $("#modal");
  modal.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", closeModal);
  modal.appendChild(closeBtn);

  const h3 = document.createElement("h3");
  h3.textContent = "Ayarlar";
  modal.appendChild(h3);

  const note = document.createElement("div");
  note.className = "settings-note";
  note.textContent = "Bu alanlar yalnızca tarayıcınızda yerel olarak saklanır ve şu anda hiçbir yere gönderilmez. İleride gerçek platform API entegrasyonu eklendiğinde bu bilgiler kullanılacaktır.";
  modal.appendChild(note);

  const fields = [
    { key: "twitch", label: "Twitch", inputs: [["clientId", "Client ID"], ["accessToken", "Access Token"]] },
    { key: "youtube", label: "YouTube", inputs: [["apiKey", "API Key"], ["accessToken", "OAuth Access Token"]] },
    { key: "kick", label: "Kick", inputs: [["accessToken", "Access Token"]] },
  ];

  fields.forEach(group => {
    const wrap = document.createElement("div");
    wrap.className = "settings-group";
    const h4 = document.createElement("h4");
    h4.textContent = group.label;
    wrap.appendChild(h4);

    group.inputs.forEach(([key, placeholder]) => {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = placeholder;
      input.style.marginBottom = "8px";
      input.value = (settings[group.key] && settings[group.key][key]) || "";
      input.addEventListener("change", () => {
        const s = loadJSON(STORAGE_KEYS.settings, {});
        s[group.key] = s[group.key] || {};
        s[group.key][key] = input.value;
        saveJSON(STORAGE_KEYS.settings, s);
      });
      wrap.appendChild(input);
    });

    modal.appendChild(wrap);
  });

  $("#modalBackdrop").classList.remove("hidden");
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
}

/* ---------- Dışa / İçe Aktar ---------- */

function exportData() {
  const data = {
    history: loadJSON(STORAGE_KEYS.history, []),
    templates: loadJSON(STORAGE_KEYS.templates, []),
    settings: loadJSON(STORAGE_KEYS.settings, {}),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yayin-verileri-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.history) saveJSON(STORAGE_KEYS.history, data.history);
      if (data.templates) saveJSON(STORAGE_KEYS.templates, data.templates);
      if (data.settings) saveJSON(STORAGE_KEYS.settings, data.settings);
      showToast("Veriler içe aktarıldı");
    } catch (e) {
      showToast("Dosya okunamadı: geçersiz JSON");
    }
  };
  reader.readAsText(file);
}

/* ---------- Olay bağlama ---------- */

function initAiSuggestions() {
  const select = $("#aiCategorySelect");
  select.innerHTML = "";
  AI_SUGGESTIONS.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = s.category;
    select.appendChild(opt);
  });
}

function applyAiSuggestion(index) {
  const s = AI_SUGGESTIONS[index];
  if (!s) return;
  $("#fTitle").value = s.title;
  $("#fDescription").value = s.description;
  $("#fTags").value = s.tags.join(", ");
  renderTitleCount();
  renderTagPreview();
  renderAllOutputs();
  autosave();
  showToast(`"${s.category}" önerisi uygulandı`);
}

function initEvents() {
  $("#fTitle").addEventListener("input", () => { renderTitleCount(); renderAllOutputs(); autosave(); });
  $("#fDescription").addEventListener("input", () => { renderAllOutputs(); autosave(); });
  $("#fTags").addEventListener("input", () => { renderTagPreview(); renderAllOutputs(); autosave(); });
  $("#fLanguage").addEventListener("change", () => { renderAllOutputs(); autosave(); });
  $("#fSchedule").addEventListener("change", () => { renderAllOutputs(); autosave(); });

  $all(".tab-panel input, .tab-panel select").forEach(el => {
    el.addEventListener("input", () => { renderAllOutputs(); autosave(); });
    el.addEventListener("change", () => { renderAllOutputs(); autosave(); });
  });

  $("#fThumb").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      getFormState._thumb = reader.result;
      renderThumb(reader.result);
      autosave();
    };
    reader.readAsDataURL(file);
  });

  $("#btnApplyAiSuggestion").addEventListener("click", () => {
    applyAiSuggestion(Number($("#aiCategorySelect").value));
  });
  $("#btnShuffleAiSuggestion").addEventListener("click", () => {
    const current = Number($("#aiCategorySelect").value);
    let next = current;
    if (AI_SUGGESTIONS.length > 1) {
      while (next === current) next = Math.floor(Math.random() * AI_SUGGESTIONS.length);
    }
    $("#aiCategorySelect").value = String(next);
    applyAiSuggestion(next);
  });

  $("#btnClear").addEventListener("click", () => {
    if (confirm("Form temizlensin mi?")) clearForm();
  });
  $("#btnSaveTemplate").addEventListener("click", saveAsTemplate);
  $("#btnSaveHistory").addEventListener("click", saveToHistory);

  $("#btnHistory").addEventListener("click", () => openListModal("history"));
  $("#btnTemplates").addEventListener("click", () => openListModal("templates"));
  $("#btnSettings").addEventListener("click", openSettingsModal);

  $("#btnExport").addEventListener("click", exportData);
  $("#btnImport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
  });

  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target === $("#modalBackdrop")) closeModal();
  });

  $all('[data-action="copy"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const platform = btn.dataset.platform;
      const text = $(`#out-${platform}`).textContent;
      await copyToClipboard(text);
      showToast(`${PlatformAdapters[platform].label}: metin kopyalandı`);
    });
  });

  $all('[data-action="publish"]').forEach(btn => {
    btn.addEventListener("click", () => handlePublish(btn.dataset.platform));
  });

  $("#btnPublishAll").addEventListener("click", async () => {
    for (const platform of Object.keys(PlatformAdapters)) {
      await handlePublish(platform);
    }
  });

  initTabs();
}

function autosave() {
  saveJSON(STORAGE_KEYS.draft, getFormState());
}

/* ---------- Başlangıç ---------- */

function init() {
  initAiSuggestions();
  initEvents();
  const draft = loadJSON(STORAGE_KEYS.draft, null);
  if (draft) {
    setFormState(draft);
  } else {
    clearForm();
  }
}

document.addEventListener("DOMContentLoaded", init);
