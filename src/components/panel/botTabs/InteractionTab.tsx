/** Botaxt Interacción — predictions, queue, songrequest, raffles */

import { useState } from "react";
import type { BotConfigV2 } from "../../../lib/smartBot/v2";
import { Btn, Card, Check, Field, Header, SubNav } from "./ui";

type Props = {
  cfg: BotConfigV2;
  patch: (p: Partial<BotConfigV2>) => void;
  onToast: (m: string) => void;
};

type Sub = "prediction" | "queue" | "song" | "raffle" | "poll";

export default function InteractionTab({ cfg, patch, onToast }: Props) {
  const [sub, setSub] = useState<Sub>("queue");
  const q = cfg.queue;
  const sr = cfg.songRequest;
  const g = cfg.giveaway;
  const pred = cfg.prediction;
  const poll = cfg.poll;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Header
        title="Etkileşim"
        sub="Tahmin/kuyruk (smartBot). Canlı !oy / !sr / !katil için Widgets → Runtime kullanın."
      />
      <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-2 text-[12px] text-cyan-100/85">
        Overlay anket, şarkı kuyruğu ve çekiliş <strong>Widget Runtime</strong> ile
        yönetilir. Bu sekme panel içi smartBot kuyruk/tahmin ayarları içindir.
      </div>
      <SubNav
        value={sub}
        onChange={setSub}
        items={
          [
            { id: "queue", label: "Sıra" },
            { id: "song", label: "Şarkı İsteği" },
            { id: "raffle", label: "Çekiliş" },
            { id: "prediction", label: "Tahmin" },
            { id: "poll", label: "Anket" },
          ] as const
        }
      />

      {sub === "queue" && (
        <Card>
          <Check
            label="Modül açık"
            checked={q.enabled}
            onChange={(v) => patch({ queue: { ...q, enabled: v } })}
          />
          <Check
            label="Sıra açık (katılım)"
            checked={q.open}
            onChange={(v) => patch({ queue: { ...q, open: v } })}
          />
          <Field label="Ad" value={q.name} onChange={(v) => patch({ queue: { ...q, name: v } })} />
          <Field
            label="Maliyet"
            type="number"
            value={String(q.cost)}
            onChange={(v) => patch({ queue: { ...q, cost: Number(v) || 0 } })}
          />
          <Field
            label="Max kullanıcı"
            type="number"
            value={String(q.maxUsers)}
            onChange={(v) => patch({ queue: { ...q, maxUsers: Number(v) || 50 } })}
          />
          <p className="text-xs text-white/50">Sırada: {q.users.length}</p>
          <ul className="max-h-32 overflow-auto text-xs text-white/70">
            {q.users.map((u, i) => (
              <li key={u}>
                #{i + 1} {u.split(":")[1] || u}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Btn
              onClick={() => {
                const next = q.users[0];
                if (!next) {
                  onToast("Sıra boş");
                  return;
                }
                patch({ queue: { ...q, users: q.users.slice(1) } });
                onToast(`Sıradaki: ${next.split(":")[1] || next}`);
              }}
            >
              Next
            </Btn>
            <Btn tone="danger" onClick={() => patch({ queue: { ...q, users: [] } })}>
              Clear
            </Btn>
          </div>
        </Card>
      )}

      {sub === "song" && (
        <Card>
          <Check
            label="Açık"
            checked={sr.enabled}
            onChange={(v) => patch({ songRequest: { ...sr, enabled: v } })}
          />
          <Check
            label="Duraklat"
            checked={sr.paused}
            onChange={(v) => patch({ songRequest: { ...sr, paused: v } })}
          />
          <Field
            label="Maliyet"
            type="number"
            value={String(sr.cost)}
            onChange={(v) => patch({ songRequest: { ...sr, cost: Number(v) || 0 } })}
          />
          <Field
            label="Kişi başı max"
            type="number"
            value={String(sr.maxPerUser)}
            onChange={(v) => patch({ songRequest: { ...sr, maxPerUser: Number(v) || 3 } })}
          />
          <Field
            label="Kara liste"
            value={sr.blacklist.join(", ")}
            onChange={(v) =>
              patch({
                songRequest: {
                  ...sr,
                  blacklist: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
          />
          <p className="text-xs text-white/50">Komutlar: !sr / !istek / !song · skip: panelden sil</p>
          <ul className="max-h-40 space-y-1 overflow-auto text-xs">
            {sr.queue.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 text-white/80">
                <span>
                  {item.title} <span className="text-white/50">@{item.user}</span>
                </span>
                <Btn
                  tone="danger"
                  onClick={() =>
                    patch({
                      songRequest: {
                        ...sr,
                        queue: sr.queue.filter((x) => x.id !== item.id),
                      },
                    })
                  }
                >
                  Sil
                </Btn>
              </li>
            ))}
            {!sr.queue.length && <li className="text-white/50">Kuyruk boş</li>}
          </ul>
        </Card>
      )}

      {sub === "raffle" && (
        <Card>
          <Check
            label="Aktif çekiliş"
            checked={g.active}
            onChange={(v) => patch({ giveaway: { ...g, active: v } })}
          />
          <Field
            label="Kelime"
            value={g.keyword}
            onChange={(v) => patch({ giveaway: { ...g, keyword: v || "+1" } })}
          />
          <Field
            label="Ödül"
            value={g.prize}
            onChange={(v) => patch({ giveaway: { ...g, prize: v } })}
          />
          <Field
            label="Abone çarpanı"
            type="number"
            value={String(g.subMultiplier)}
            onChange={(v) =>
              patch({ giveaway: { ...g, subMultiplier: Number(v) || 1 } })
            }
          />
          <Check
            label="Sadece abone"
            checked={g.subsOnly}
            onChange={(v) => patch({ giveaway: { ...g, subsOnly: v } })}
          />
          <p className="text-xs text-white/50">
            Katılımcı: {g.entrants.length} · OBS: /raffles?obs=1
          </p>
        </Card>
      )}

      {sub === "prediction" && (
        <Card>
          <Check
            label="Aktif"
            checked={pred.active}
            onChange={(v) => patch({ prediction: { ...pred, active: v } })}
          />
          <Field
            label="Soru"
            value={pred.question}
            onChange={(v) => patch({ prediction: { ...pred, question: v } })}
          />
          <Field
            label="Seçenek A"
            value={pred.options[0]}
            onChange={(v) =>
              patch({ prediction: { ...pred, options: [v, pred.options[1]] } })
            }
          />
          <Field
            label="Seçenek B"
            value={pred.options[1]}
            onChange={(v) =>
              patch({ prediction: { ...pred, options: [pred.options[0], v] } })
            }
          />
          <p className="text-xs text-white/50">
            Potlar: {pred.pots[0]} / {pred.pots[1]}
          </p>
        </Card>
      )}

      {sub === "poll" && (
        <Card>
          <Check
            label="Aktif"
            checked={poll.active}
            onChange={(v) => patch({ poll: { ...poll, active: v } })}
          />
          <Field
            label="Soru"
            value={poll.question}
            onChange={(v) => patch({ poll: { ...poll, question: v } })}
          />
          <Field
            label="Seçenekler (virgül)"
            value={poll.options.join(", ")}
            onChange={(v) =>
              patch({
                poll: {
                  ...poll,
                  options: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
          />
        </Card>
      )}
    </section>
  );
}
