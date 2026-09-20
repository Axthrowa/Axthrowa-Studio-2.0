/**
 * Eski `/overlay/widgets/:kind` → yeni `/widgets/:kind` (HashRouter).
 */

import { Navigate, useParams, useSearchParams } from "react-router-dom";

export default function OverlayWidgetRedirect() {
  const { kind = "chat" } = useParams();
  const [params] = useSearchParams();
  const qs = new URLSearchParams(params);
  if (!qs.has("obs")) qs.set("obs", "1");
  const search = qs.toString();
  return <Navigate to={`/widgets/${kind.toLowerCase()}?${search}`} replace />;
}
