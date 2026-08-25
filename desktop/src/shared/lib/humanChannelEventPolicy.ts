import type { ChannelType, RelayEvent } from "@/shared/api/types";
import {
  KIND_FORUM_COMMENT,
  KIND_FORUM_POST,
  KIND_HUDDLE_STARTED,
  KIND_STREAM_MESSAGE,
  KIND_STREAM_MESSAGE_V2,
} from "@/shared/constants/kinds";

type ChannelEvent = Pick<RelayEvent, "kind" | "pubkey" | "tags">;
type KindAndTags = Pick<RelayEvent, "kind" | "tags">;

export const STREAM_HUMAN_MESSAGE_KINDS = [
  KIND_STREAM_MESSAGE,
  KIND_STREAM_MESSAGE_V2,
] as const;

export const FORUM_HUMAN_MESSAGE_KINDS = [
  KIND_FORUM_POST,
  KIND_FORUM_COMMENT,
] as const;

export const DM_HUMAN_UNREAD_KINDS = [
  ...STREAM_HUMAN_MESSAGE_KINDS,
  KIND_HUDDLE_STARTED,
] as const;

const STREAM_KIND_SET: ReadonlySet<number> = new Set(
  STREAM_HUMAN_MESSAGE_KINDS,
);
const FORUM_KIND_SET: ReadonlySet<number> = new Set(FORUM_HUMAN_MESSAGE_KINDS);

/**
 * The single machine-only packet marker. Ordinary `p` tags are human mentions
 * and must stay visible. Matching is deliberately exact and case-sensitive.
 */
export function isAgentOnlyChannelEvent(
  event: Pick<RelayEvent, "tags"> | { tags?: string[][] },
): boolean {
  return (
    event.tags?.some(
      (tag) => tag.length === 2 && tag[0] === "audience" && tag[1] === "agent",
    ) ?? false
  );
}

/** Keep machine packets available to agent/project consumers, not human timelines. */
export function humanChannelTimelineEvents<
  Event extends Pick<RelayEvent, "tags"> | { tags?: string[][] },
>(events: readonly Event[]): Event[] {
  return events.filter((event) => !isAgentOnlyChannelEvent(event));
}

export function channelHumanMessageKinds(
  channelType: ChannelType,
): readonly number[] {
  return channelType === "forum"
    ? FORUM_HUMAN_MESSAGE_KINDS
    : STREAM_HUMAN_MESSAGE_KINDS;
}

export function channelHumanUnreadKinds(
  channelType: ChannelType,
): readonly number[] {
  return channelType === "dm"
    ? DM_HUMAN_UNREAD_KINDS
    : channelHumanMessageKinds(channelType);
}

export function isHumanChannelMessage(
  event: KindAndTags,
  channelType: ChannelType,
): boolean {
  if (isAgentOnlyChannelEvent(event)) return false;
  return channelType === "forum"
    ? FORUM_KIND_SET.has(event.kind)
    : STREAM_KIND_SET.has(event.kind);
}

export function isHumanChannelUnreadEvent(
  event: KindAndTags,
  channelType: ChannelType,
): boolean {
  return (
    isHumanChannelMessage(event, channelType) ||
    (channelType === "dm" &&
      event.kind === KIND_HUDDLE_STARTED &&
      !isAgentOnlyChannelEvent(event))
  );
}

function isExternalAuthor(event: Pick<RelayEvent, "pubkey">, pubkey?: string) {
  const normalized = pubkey?.trim().toLowerCase() ?? "";
  return normalized.length === 0 || event.pubkey.toLowerCase() !== normalized;
}

export function isExternalHumanChannelMessage(
  event: ChannelEvent,
  channelType: ChannelType,
  currentPubkey?: string,
): boolean {
  return (
    isHumanChannelMessage(event, channelType) &&
    isExternalAuthor(event, currentPubkey)
  );
}

export function isExternalHumanChannelUnreadEvent(
  event: ChannelEvent,
  channelType: ChannelType,
  currentPubkey?: string,
): boolean {
  return (
    isHumanChannelUnreadEvent(event, channelType) &&
    isExternalAuthor(event, currentPubkey)
  );
}
