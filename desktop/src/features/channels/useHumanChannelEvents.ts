import { useMemo } from "react";
import type { RelayEvent } from "@/shared/api/types";
import { humanChannelTimelineEvents } from "@/shared/lib/humanChannelEventPolicy";

export const EMPTY_EVENTS: RelayEvent[] = [];

export function useHuman(messages: RelayEvent[], threadReplies?: RelayEvent[]) {
  const humanMessages = useMemo(
    () => humanChannelTimelineEvents(messages),
    [messages],
  );
  const humanReplies = useMemo(
    () => humanChannelTimelineEvents(threadReplies ?? EMPTY_EVENTS),
    [threadReplies],
  );
  return [humanMessages, humanReplies] as const;
}
