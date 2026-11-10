import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Plus } from "lucide-react";
import { STUDIO_SKINS } from "../../lib/theme/ThemeContext";
import { Button, IconButton } from "./Button";
import { Input, Select, Slider, Switch, Checkbox, Textarea, Radio } from "./Alanlar";
import { Tabs, SegmentedControl, Toolbar, TabPanel } from "./Gezinme";
import { Panel, SettingRow, ListRow } from "./Panel";
import { StatusPill, StatusDot, Badge, Kbd, Meter } from "./Durum";
import { Tooltip, ipucuNoktasi } from "./Tooltip";
import { Dialog, ConfirmDialog } from "./Dialog";
import { EmptyState, ErrorState, Skeleton } from "./Geribildirim";
import { cn } from "./cn";
import { dbOrani, hataMetni, sayiBicim, sonrakiIndeks } from "./yardimci";

// Test ortamı DOM'suz (node): bileşenler sunucu çizimiyle, davranış saf yardımcılarla sınanır.
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("sonrakiIndeks (sekme / bölümlü denetim / araç çubuğu ok tuşları)", () => {
  const acik = [false, false, false, false];
  it("sağ/sol komşuya gider, uçlarda sarar", () => {
    expect(sonrakiIndeks(0, "ArrowRight", acik)).toBe(1);
    expect(sonrakiIndeks(3, "ArrowRight", acik)).toBe(0);
    expect(sonrakiIndeks(0, "ArrowLeft", acik)).toBe(3);
  });
  it("kapalı öğeleri atlar, Home/End ilk/son açık öğe", () => {
    const k = [true, false, true, false];
    expect(sonrakiIndeks(1, "ArrowRight", k)).toBe(3);
    expect(sonrakiIndeks(3, "ArrowRight", k)).toBe(1);
    expect(sonrakiIndeks(3, "Home", k)).toBe(1);
    expect(sonrakiIndeks(1, "End", k)).toBe(3);
  });
  it("dikey yönde yukarı/aşağı; ilgisiz tuş ve boş liste null", () => {
    expect(sonrakiIndeks(0, "ArrowDown", acik, "dikey")).toBe(1);
    expect(sonrakiIndeks(0, "ArrowRight", acik, "dikey")).toBeNull();
    expect(sonrakiIndeks(0, "Enter", acik)).toBeNull();
    expect(sonrakiIndeks(0, "ArrowRight", [])).toBeNull();
    expect(sonrakiIndeks(0, "ArrowRight", [true, true])).toBeNull();
  });
});

describe("Tabs", () => {
  const items = [
    { id: "a", label: "Bir" },
    { id: "b", label: "İki", disabled: true },
    { id: "c", label: "Üç" },
  ];
  const m = html(<Tabs label="Sayfalar" idPrefix="t" items={items} value="c" onValueChange={() => {}} />);
  it("tablist + tab rolleri, seçili sekme tek sekme durağı (roving tabindex)", () => {
    expect(m).toContain('role="tablist"');
    expect(m).toContain('aria-label="Sayfalar"');
    expect(m.match(/role="tab"/g)).toHaveLength(3);
    expect(m.match(/tabindex="0"/g)).toHaveLength(1);
    expect(m).toMatch(/id="t-sekme-c"[^>]*aria-selected="true"[^>]*tabindex="0"/);
    expect(m).toMatch(/id="t-sekme-a"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  });
  it("sekme ↔ panel bağı", () => {
    expect(m).toContain('aria-controls="t-panel-c"');
    const p = html(<TabPanel idPrefix="t" id="c">x</TabPanel>);
    expect(p).toContain('role="tabpanel"');
    expect(p).toContain('aria-labelledby="t-sekme-c"');
  });
});

describe("SegmentedControl ve Toolbar", () => {
  it("radiogroup: seçili radio aria-checked ve tek sekme durağı", () => {
    const m = html(
      <SegmentedControl label="Köşe" value="az" onValueChange={() => {}} options={[{ id: "keskin", label: "Keskin" }, { id: "az", label: "Az" }]} />
    );
    expect(m).toContain('role="radiogroup"');
    expect(m).toMatch(/aria-checked="true"[^>]*tabindex="0"[^>]*>Az/);
  });
  it("toolbar erişilebilir adla", () => {
    const m = html(<Toolbar label="Sahne araçları"><button>x</button></Toolbar>);
    expect(m).toContain('role="toolbar"');
    expect(m).toContain('aria-label="Sahne araçları"');
  });
});

describe("Button / IconButton", () => {
  it("loading: kapalı, aria-busy ve dönen simge", () => {
    const m = html(<Button loading>Kaydet</Button>);
    expect(m).toContain("disabled");
    expect(m).toContain('aria-busy="true"');
    expect(m).toContain("animate-spin");
    expect(m).toContain('type="button"');
  });
  it("IconButton aria-label zorunlu ve düğmenin kendisinde; pressed → aria-pressed", () => {
    const m = html(
      <IconButton label="Sahne ekle" pressed tooltip={false}>
        <Plus />
      </IconButton>
    );
    expect(m).toMatch(/<button[^>]*aria-label="Sahne ekle"/);
    expect(m).toContain('aria-pressed="true"');
    // @ts-expect-error label olmadan derlenmez
    void (<IconButton><Plus /></IconButton>);
  });
  it("danger varyantı dolgu değil kenar", () => {
    expect(html(<Button variant="danger">Sil</Button>)).toContain("border-ui-danger");
  });
});

describe("form denetimleri", () => {
  it("Input: invalid → aria-invalid; simgeli sarmal", () => {
    expect(html(<Input invalid />)).toContain('aria-invalid="true"');
    expect(html(<Input leading={<Plus />} />)).toContain("pl-7");
  });
  it("Switch: role=switch ve aria-checked", () => {
    const m = html(<Switch checked onCheckedChange={() => {}} aria-label="Oto" />);
    expect(m).toContain('role="switch"');
    expect(m).toContain('aria-checked="true"');
    expect(m).toContain('data-state="checked"');
  });
  it("Slider: değer dil biçiminde ve birimiyle, aria-valuetext aynı", () => {
    const m = html(<Slider label="Ses" value={-12.4} onValueChange={() => {}} min={-60} max={0} step={0.1} unit="dB" />);
    expect(m).toContain("-12,4 dB");
    expect(m).toContain('aria-valuetext="-12,4 dB"');
    expect(m).toMatch(/<label[^>]*for="[^"]+"/);
  });
  it("Select, Textarea, Checkbox, Radio çizilir", () => {
    expect(html(<Select aria-label="x"><option>a</option></Select>)).toContain("<select");
    expect(html(<Textarea />)).toContain("<textarea");
    expect(html(<Checkbox label="Seç" />)).toMatch(/<label[^>]*><input type="checkbox"/);
    expect(html(<Radio name="r" />)).toContain('type="radio"');
  });
  it("Select: wrapperClassName sarmalayıcıya, className select'e gider (esnek satırda ezilmez)", () => {
    const m = html(<Select aria-label="x" wrapperClassName="w-28 shrink-0" className="pl-3"><option>a</option></Select>);
    expect(m).toMatch(/^<span class="[^"]*\bw-28 shrink-0\b/);
    expect(m).toMatch(/<select[^>]*class="[^"]*\bpl-3\b/);
    expect(m).not.toMatch(/<select[^>]*class="[^"]*shrink-0/);
  });
});

describe("durum öğeleri", () => {
  it("StatusPill simge + metin; CANLI dolu kırmızı", () => {
    const m = html(<StatusPill tone="live">CANLI</StatusPill>);
    expect(m).toContain("<svg");
    expect(m).toContain("CANLI");
    expect(m).toContain("bg-ui-live");
  });
  it("StatusDot görünür metin taşır; hideLabel yalnız ekran okuyucu", () => {
    expect(html(<StatusDot tone="ok" label="Bağlı" />)).toContain(">Bağlı<");
    expect(html(<StatusDot label="Bağlı değil" hideLabel />)).toContain("sr-only");
  });
  it("Badge ve Kbd", () => {
    expect(html(<Badge>3</Badge>)).toContain(">3<");
    expect(html(<Kbd>Ctrl K</Kbd>)).toContain("<kbd");
  });
  it("Meter: role=meter, Türkçe dB; −1 dBFS üstü tepe sarı + uyarı", () => {
    const n = html(<Meter label="Mikrofon" db={-12.4} peak={-6} />);
    expect(n).toContain('role="meter"');
    expect(n).toContain('aria-valuetext="-12,4 dB"');
    expect(n).toContain("bg-ui-ok");
    const k = html(<Meter label="Mikrofon" db={-3} peak={-0.5} />);
    expect(k).toContain("bg-ui-warn");
    expect(k).toContain("Kırpılmaya yakın");
    expect(html(<Meter label="Boş" db={-Infinity} />)).toContain("Sessiz");
  });
  it("dbOrani ve sayiBicim", () => {
    expect(dbOrani(0)).toBe(1);
    expect(dbOrani(-60)).toBe(0);
    expect(dbOrani(-30)).toBe(0.5);
    expect(dbOrani(-Infinity)).toBe(0);
    expect(dbOrani(6)).toBe(1);
    expect(sayiBicim(6012, "tr", 0)).toBe("6.012");
    expect(sayiBicim(-12.4, "en")).toBe("-12.4");
    expect(sayiBicim(-Infinity, "tr")).toBe("-∞");
  });
});

describe("Panel, SettingRow, ListRow", () => {
  it("Panel başlıkla adlandırılmış bölge", () => {
    const m = html(<Panel title="Sahneler" meta="7" actions={<span>e</span>}>g</Panel>);
    expect(m).toMatch(/<section aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1"/);
    expect(m).toContain(">7<");
  });
  it("SettingRow etiketi denetime bağlar, açıklama kimliği öngörülebilir", () => {
    const m = html(<SettingRow label="Tema" description="Açık/koyu" htmlFor="tema"><input id="tema" /></SettingRow>);
    expect(m).toContain('for="tema"');
    expect(m).toContain('id="tema-aciklama"');
  });
  it("ListRow seçimi aria-selected ile (rol verilince)", () => {
    expect(html(<ListRow role="option" selected>Oyun</ListRow>)).toContain('aria-selected="true"');
    expect(html(<ListRow>Oyun</ListRow>)).not.toContain("aria-selected");
  });
});

describe("Tooltip", () => {
  it("kapalıyken yalnız tetikleyici; konum hesabı yöne göre", () => {
    expect(html(<Tooltip content="İpucu"><button>x</button></Tooltip>)).not.toContain("role=\"tooltip\"");
    const r = { left: 100, right: 140, top: 50, bottom: 70, width: 40, height: 20 };
    expect(ipucuNoktasi(r, "top")).toEqual({ x: 120, y: 44 });
    expect(ipucuNoktasi(r, "bottom")).toEqual({ x: 120, y: 76 });
    expect(ipucuNoktasi(r, "right")).toEqual({ x: 146, y: 60 });
    expect(ipucuNoktasi(r, "left")).toEqual({ x: 94, y: 60 });
  });
});

describe("Dialog / ConfirmDialog", () => {
  it("kapalıyken hiçbir şey çizmez", () => {
    expect(html(<Dialog open={false} onOpenChange={() => {}} title="x" />)).toBe("");
    expect(html(<ConfirmDialog open={false} onOpenChange={() => {}} title="x" confirmLabel="Evet" onConfirm={() => {}} />)).toBe("");
  });
});

describe("EmptyState, Skeleton, ErrorState", () => {
  it("EmptyState başlık ve eylem", () => {
    const m = html(<EmptyState title="Henüz sahne yok" action={<button>Ekle</button>} />);
    expect(m).toContain("Henüz sahne yok");
    expect(m).toContain("Ekle");
  });
  it("Skeleton varsayılan gizli, label ile Yükleniyor", () => {
    expect(html(<Skeleton />)).toContain('aria-hidden="true"');
    expect(html(<Skeleton label />)).toContain("Yükleniyor");
  });
  it("ErrorState: insan diliyle başlık, ham hata yalnız kapalı ayrıntıda", () => {
    const m = html(<ErrorState title="Güncelleme alınamadı" error={new SyntaxError("Unexpected token '<'")} onRetry={() => {}} />);
    const [ust, ayrinti] = m.split("<details");
    expect(ust).toContain("Güncelleme alınamadı");
    expect(ust).not.toContain("Unexpected token");
    expect(ayrinti).toContain("Unexpected token");
    expect(ayrinti).not.toContain("<details open");
    expect(m).toContain("Teknik ayrıntılar");
    expect(m).toContain("Yeniden dene");
  });
  it("başlık verilmezse varsayılan; hata yoksa ayrıntı yok", () => {
    const m = html(<ErrorState />);
    expect(m).toContain("Bir şeyler ters gitti");
    expect(m).not.toContain("<details");
  });
  it("hataMetni", () => {
    expect(hataMetni(null)).toBe("");
    expect(hataMetni("düz")).toBe("düz");
    expect(hataMetni({ kod: 7 })).toContain('"kod": 7');
    const e = new Error("bozuk");
    e.stack = undefined;
    expect(hataMetni(e)).toBe("Error: bozuk");
  });
});

describe("cn (token farkında)", () => {
  it("yazı boyutu ve yazı rengi token'ları birbirini silmez", () => {
    expect(cn("text-ui-2 text-ui-fg").split(" ")).toEqual(["text-ui-2", "text-ui-fg"]);
  });
  it("yoğunluk ölçüsü ve köşe çakışmayı çözer", () => {
    expect(cn("h-9 px-4", "h-ctl px-pad")).toBe("h-ctl px-pad");
    expect(cn("rounded-xl", "rounded-ui-2")).toBe("rounded-ui-2");
  });
});

/* ------------------------------------------------------------ token kontrastı */

const css = readFileSync(new URL("../../styles/ust-serit.css", import.meta.url), "utf8");

function blok(bas: string): Record<string, string> {
  const i = css.indexOf(bas);
  if (i < 0) throw new Error(`${bas} yok`);
  const govde = css.slice(css.indexOf("{", i) + 1, css.indexOf("\n}", i)).replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries([...govde.matchAll(/(--ui-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const rgb = (v: string) => v.split(/\s+/).map(Number) as [number, number, number];
const lum = (c: number[]) => {
  const l = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * l(c[0]) + 0.7152 * l(c[1]) + 0.0722 * l(c[2]);
};
const kontrast = (a: string, b: string) => {
  const [h, d] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
};

const taban = blok(':root[data-skin="night-signal"] {');
const acik = { ...taban, ...blok(":root.theme-light {") };
const TEMALAR: [string, Record<string, string>][] = [
  ...STUDIO_SKINS.filter((s) => s.id !== "gun-isigi").map((s): [string, Record<string, string>] => [
    s.id,
    s.id === "night-signal" ? taban : { ...taban, ...blok(`:root[data-skin="${s.id}"] {`) },
  ]),
  ["light", acik],
  ["gun-isigi", { ...acik, ...blok(':root.theme-light[data-skin="gun-isigi"] {') }],
];

describe.each(TEMALAR)("Stüdyo Masası token'ları — %s", (_id, v) => {
  it("tüm --ui-* tanımlı", () => {
    for (const k of ["bg", "s1", "s2", "s3", "line", "line2", "fg", "fg2", "fg3", "accent", "accent-text", "accent-ink", "brand", "live", "live-ink", "rec", "ok", "warn"]) {
      expect(v[`--ui-${k}`], k).toMatch(/^\d+ \d+ \d+$/);
    }
  });
  it("metin, ikincil, üçüncül, vurgu ve durum renkleri her yüzeyde ≥ 4.5:1", () => {
    for (const yuzey of ["--ui-bg", "--ui-s1", "--ui-s2", "--ui-s3"]) {
      for (const metin of ["--ui-fg", "--ui-fg2", "--ui-fg3", "--ui-accent-text", "--ui-rec", "--ui-ok", "--ui-warn", "--ui-brand"]) {
        expect(kontrast(v[metin], v[yuzey]), `${metin} / ${yuzey}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("dolgu üstü yazı: vurgu ve CANLI ≥ 4.5:1", () => {
    expect(kontrast(v["--ui-accent-ink"], v["--ui-accent"])).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(v["--ui-live-ink"], v["--ui-live"])).toBeGreaterThanOrEqual(4.5);
  });
});
