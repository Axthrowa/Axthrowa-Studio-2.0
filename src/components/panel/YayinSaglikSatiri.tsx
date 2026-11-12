import { useEffect, useState } from "react";
import { obsApi } from "../../lib/api/actions";
import { getStreamHealth, isObsConnected } from "../../lib/obs";
import { meterZone } from "../../lib/obsAudio";
import { saglikSatiri } from "../../lib/saglikSatiri";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";

/** Üst şeritte tek satır: kare düşüşü ve sesin kırpmaya yaklaşması. */
export default function YayinSaglikSatiri() {
  const [metin, setMetin] = useState("yayın sağlığı okunuyor");

  useEffect(() => {
    let iptal = false;
    const tick = async () => {
      if (!isObsConnected()) {
        if (!iptal) setMetin(saglikSatiri({ obs: false, yayin: false, dropPct: 0, clip: false }));
        return;
      }
      let yayin = false;
      let dropPct = 0;
      let clip = false;
      try {
        const h = await getStreamHealth();
        yayin = h.active;
        dropPct = h.dropPct;
      } catch {
        /* satır yine de yazılır */
      }
      try {
        const m = await obsApi.meters();
        clip = m.inputs.some((g) => (g.channels?.length ? g.channels : [{ peakDb: g.peakDb }]).some((c) => meterZone(c.peakDb) === "clip"));
      } catch {
        /* ölçer yok */
      }
      if (!iptal) setMetin(saglikSatiri({ obs: true, yayin, dropPct, clip }));
    };
    void tick();
    const id = setVisibleInterval(() => void tick(), 5000);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
    };
  }, []);

  return (
    <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/70" title={metin}>
      {metin}
    </p>
  );
}
