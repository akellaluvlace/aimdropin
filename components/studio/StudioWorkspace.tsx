"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Workspace from "@/components/Workspace";
import RatingStars from "@/components/community/RatingStars";
import type { TargetType } from "@/lib/community/usage";
import type { PreviewKind } from "@/lib/preview";
import { createProject } from "@/lib/studio/projects";
import { ACCOUNTS_ENABLED } from "@/lib/supabase/client";
import type { ProjectOrigin } from "@/lib/studio/types";

type WorkspaceProps = React.ComponentProps<typeof Workspace>;

// The editor on template / dashboard / playground pages, plus "Save to my
// studio": the current code becomes a project (in your account when signed
// in, in this browser otherwise) and opens in the studio editor.
export default function StudioWorkspace({
  origin,
  projectTitle,
  rateTarget,
  ...props
}: Omit<WorkspaceProps, "headerExtra" | "onCodeChange"> & {
  origin: ProjectOrigin | null;
  projectTitle: string;
  // Shows the star rating for what's being edited (a landing template).
  rateTarget?: { type: TargetType; id: string };
}) {
  const router = useRouter();
  const latest = useRef<{ code: string; kind: PreviewKind }>({ code: props.initialCode, kind: props.initialKind });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCodeChange = useCallback((code: string, kind: PreviewKind) => {
    latest.current = { code, kind };
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    const { code, kind } = latest.current;
    const r = await createProject({
      title: projectTitle,
      stack: kind === "jsx" ? "jsx" : "html",
      source: code,
      origin,
      purpose: origin?.type === "dashboard" ? "dashboard" : "landing",
    });
    if (r.ok) router.push(`/me/edit/${r.value.id}`);
    else {
      setError(r.error);
      setSaving(false);
    }
  };

  // The studio ships with accounts; until then this is the plain editor.
  if (!ACCOUNTS_ENABLED) return <Workspace {...props} />;

  return (
    <Workspace
      {...props}
      onCodeChange={onCodeChange}
      headerExtra={
        <>
          {rateTarget ? <RatingStars targetType={rateTarget.type} targetId={rateTarget.id} /> : null}
          {error ? <span className="max-w-xs truncate font-mono text-[10px] uppercase tracking-[0.15em] text-coral" title={error}>{error}</span> : null}
          <button type="button" onClick={save} disabled={saving} className="btn btn-accent">
            {saving ? "Saving…" : "Save to my studio"}
          </button>
        </>
      }
    />
  );
}
