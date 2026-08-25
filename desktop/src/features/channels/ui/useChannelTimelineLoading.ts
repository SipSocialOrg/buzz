import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPersistedHydratedChannel } from "@/features/messages/lib/channelHeadCache";
import {
  resolveTimelineLoadingLatch,
  selectTimelineLoadingState,
} from "@/features/messages/lib/timelineLoadingState";

type ChannelTimelineLoadingOptions = {
  activeChannelId: string | null;
  enabled: boolean;
  query: {
    dataLength: number | null;
    isFetching: boolean;
    isPending: boolean;
    isPlaceholderData: boolean;
  };
};

export function useChannelTimelineLoading({
  activeChannelId,
  enabled,
  query,
}: ChannelTimelineLoadingOptions): boolean {
  const queryClient = useQueryClient();
  const settledChannelIdRef = React.useRef<string | null>(null);
  const hasSettledThisChannel =
    activeChannelId !== null && settledChannelIdRef.current === activeChannelId;
  const hasPersistedHead =
    activeChannelId !== null &&
    hasPersistedHydratedChannel(queryClient, activeChannelId);
  const timelineLoadingNow =
    enabled &&
    selectTimelineLoadingState(
      query,
      // A persisted head counts as hydrated only when it has rows to paint,
      // so an empty placeholder still waits for its authoritative refresh.
      hasSettledThisChannel || hasPersistedHead,
    );
  const { settledChannelId, isLoading } = resolveTimelineLoadingLatch(
    settledChannelIdRef.current,
    activeChannelId,
    timelineLoadingNow,
  );
  settledChannelIdRef.current = settledChannelId;
  return isLoading;
}
