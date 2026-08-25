import type { Channel, FeedItem, HomeFeedResponse } from "@/shared/api/types";
import { formatMessageNotification } from "@/features/notifications/lib/notificationFormat";
import {
  FORUM_HUMAN_MESSAGE_KINDS,
  STREAM_HUMAN_MESSAGE_KINDS,
  isAgentOnlyChannelEvent,
  isExternalHumanChannelMessage,
  isHumanChannelMessage,
} from "@/shared/lib/humanChannelEventPolicy";

export type NotificationChannel = Pick<
  Channel,
  "id" | "name" | "channelType" | "archivedAt"
>;

const CHANNEL_MESSAGE_KINDS: ReadonlySet<number> = new Set([
  ...STREAM_HUMAN_MESSAGE_KINDS,
  ...FORUM_HUMAN_MESSAGE_KINDS,
]);

export function enrichFeedItemChannel(
  item: FeedItem,
  channels: readonly NotificationChannel[],
): FeedItem {
  const needsName = !item.channelName.trim();
  const needsType = item.channelType === undefined;
  if (!item.channelId || (!needsName && !needsType)) return item;
  const channel = channels.find((candidate) => candidate.id === item.channelId);
  if (!channel) return item;
  return {
    ...item,
    channelName: needsName ? channel.name : item.channelName,
    channelType: needsType ? channel.channelType : item.channelType,
  };
}

function resolvedChannel(
  item: FeedItem,
  channels: readonly NotificationChannel[],
) {
  return item.channelId
    ? channels.find((candidate) => candidate.id === item.channelId)
    : undefined;
}

function validChannelType(value: string | undefined) {
  return value === "stream" || value === "forum" || value === "dm"
    ? value
    : undefined;
}

/** Shared Inbox/badge/desktop-notification gate for channel-backed feed rows. */
export function isHumanFeedItemVisible(
  item: FeedItem,
  channels: readonly NotificationChannel[] = [],
  currentPubkey?: string,
): boolean {
  if (isAgentOnlyChannelEvent(item)) return false;
  const normalizedPubkey = currentPubkey?.trim().toLowerCase() ?? "";
  if (
    normalizedPubkey.length > 0 &&
    item.pubkey.toLowerCase() === normalizedPubkey
  ) {
    return false;
  }

  const channel = resolvedChannel(item, channels);
  if (channel?.archivedAt != null) return false;

  if (!CHANNEL_MESSAGE_KINDS.has(item.kind)) return true;
  const channelType =
    channel?.channelType ?? validChannelType(item.channelType);
  if (!channelType) return true;
  return currentPubkey === undefined
    ? isHumanChannelMessage(item, channelType)
    : isExternalHumanChannelMessage(item, channelType, currentPubkey);
}

export function filterHomeFeedForHumanSurfaces(
  feed: HomeFeedResponse | undefined,
  channels: readonly NotificationChannel[] = [],
  currentPubkey?: string,
): HomeFeedResponse | undefined {
  if (!feed) return undefined;
  const filter = (items: readonly FeedItem[]) =>
    items
      .map((item) => enrichFeedItemChannel(item, channels))
      .filter((item) => isHumanFeedItemVisible(item, channels, currentPubkey));
  return {
    ...feed,
    feed: {
      mentions: filter(feed.feed.mentions ?? []),
      needsAction: filter(feed.feed.needsAction ?? []),
      activity: filter(feed.feed.activity ?? []),
      agentActivity: filter(feed.feed.agentActivity ?? []),
    },
  };
}
/** Inbox keeps valid human rows visible even when the current user authored them. */
export function filterHomeFeedForInbox(
  feed: HomeFeedResponse | undefined,
  channels: readonly NotificationChannel[] = [],
): HomeFeedResponse | undefined {
  return filterHomeFeedForHumanSurfaces(feed, channels);
}

function feedNotificationSource(item: FeedItem) {
  if (item.channelType === "dm") return "dm" as const;
  if (item.category === "mention") return "mention" as const;
  if (item.kind === 46010) return "approval" as const;
  return "needs_action" as const;
}

export function formatFeedNotification(item: FeedItem, senderName?: string) {
  return formatMessageNotification({
    source: feedNotificationSource(item),
    senderName,
    channelName: item.channelType !== "dm" ? item.channelName : null,
    content: item.content,
  });
}

export function notificationTitle(item: FeedItem, senderName?: string) {
  return formatFeedNotification(item, senderName).title;
}

export function notificationBody(item: FeedItem) {
  return formatFeedNotification(item).body;
}

export function collectHomeAlertItems(
  feed: HomeFeedResponse,
  channels: readonly NotificationChannel[] = [],
  currentPubkey?: string,
) {
  const filtered = filterHomeFeedForHumanSurfaces(
    feed,
    channels,
    currentPubkey,
  );
  return [
    ...(filtered?.feed.mentions ?? []),
    ...(filtered?.feed.needsAction ?? []),
  ];
}

export function eligibleFeedNotificationItems(
  feed: HomeFeedResponse,
  options: {
    mentions: boolean;
    needsAction: boolean;
    currentPubkey?: string;
  },
  channels: readonly NotificationChannel[] = [],
) {
  const filtered = filterHomeFeedForHumanSurfaces(
    feed,
    channels,
    options.currentPubkey,
  );
  const items: FeedItem[] = [];
  if (options.mentions) {
    items.push(
      ...(filtered?.feed.mentions ?? []).filter(
        (item) => item.channelType !== "dm",
      ),
    );
  }
  if (options.needsAction) items.push(...(filtered?.feed.needsAction ?? []));
  return items.sort((left, right) => left.createdAt - right.createdAt);
}
