import assert from "node:assert/strict";
import test from "node:test";

import { isChannelUnreadTriggerEvent } from "@/features/channels/useLiveChannelUpdates";
import { channelCatchUpEventKinds } from "@/features/channels/useUnreadChannels";
import {
  countTopLevelTimelineRows,
  formatTimelineMessages,
} from "@/features/messages/lib/formatTimelineMessages";
import {
  eligibleFeedNotificationItems,
  filterHomeFeedForInbox,
} from "@/features/notifications/lib/feed";
import { buildHomeBadgeFeedItems } from "@/features/notifications/lib/homeBadge";

const SELF = "a".repeat(64);
const OTHER = "b".repeat(64);

function event(overrides = {}) {
  return {
    id: "c".repeat(64),
    pubkey: OTHER,
    created_at: 100,
    kind: 9,
    tags: [["h", "stream"]],
    content: "hello",
    sig: "sig",
    ...overrides,
  };
}

function item(id, overrides = {}) {
  return {
    id,
    pubkey: OTHER,
    createdAt: 100,
    kind: 9,
    tags: [["h", "stream"]],
    content: "hello",
    channelId: "stream",
    channelName: "",
    category: "mention",
    ...overrides,
  };
}

const channels = [
  { id: "stream", name: "stream", channelType: "stream", archivedAt: null },
  { id: "forum", name: "forum", channelType: "forum", archivedAt: null },
  {
    id: "retired",
    name: "retired",
    channelType: "stream",
    archivedAt: "2026-08-25T00:00:00Z",
  },
];

function feed(mentions) {
  return {
    feed: { mentions, needsAction: [], activity: [], agentActivity: [] },
    meta: { since: 0, total: mentions.length, generatedAt: 100 },
  };
}

test("live and restart catch-up use disjoint stream/forum kinds", () => {
  assert.deepEqual(channelCatchUpEventKinds("stream"), [9, 40002]);
  assert.deepEqual(channelCatchUpEventKinds("forum"), [45001, 45003]);
  assert.deepEqual(channelCatchUpEventKinds("dm"), [9, 40002, 48100]);
  assert.equal(isChannelUnreadTriggerEvent(event(), "stream", SELF), true);
  assert.equal(isChannelUnreadTriggerEvent(event(), "forum", SELF), false);
  assert.equal(
    isChannelUnreadTriggerEvent(event({ kind: 45001 }), "forum", SELF),
    true,
  );
});

test("agent-only packets do not render or consume a visible row", () => {
  const packet = event({
    tags: [
      ["h", "stream"],
      ["p", SELF],
      ["audience", "agent"],
    ],
  });
  assert.equal(isChannelUnreadTriggerEvent(packet, "stream", SELF), false);
  assert.deepEqual(formatTimelineMessages([packet], null, SELF, null), []);
  assert.equal(countTopLevelTimelineRows([packet]), 0);

  const mention = event({
    tags: [
      ["h", "stream"],
      ["p", SELF],
    ],
  });
  assert.equal(isChannelUnreadTriggerEvent(mention, "stream", SELF), true);
  assert.equal(formatTimelineMessages([mention], null, SELF, null).length, 1);
});

test("Inbox visibility is broader than unread and notification eligibility", () => {
  const input = feed([
    item("agent", {
      tags: [
        ["h", "stream"],
        ["p", SELF],
        ["audience", "agent"],
      ],
    }),
    item("own", { pubkey: SELF }),
    item("hidden-forum", { channelId: "forum", tags: [["h", "forum"]] }),
    item("forum-post", {
      channelId: "forum",
      kind: 45001,
      tags: [["h", "forum"]],
    }),
    item("retired", {
      channelId: "retired",
      tags: [["h", "retired"]],
    }),
    item("mention", {
      tags: [
        ["h", "stream"],
        ["p", SELF],
      ],
    }),
  ]);
  const expectedVisible = ["own", "forum-post", "mention"];
  const expectedExternal = ["forum-post", "mention"];

  assert.deepEqual(
    filterHomeFeedForInbox(input, channels).feed.mentions.map(
      (entry) => entry.id,
    ),
    expectedVisible,
  );
  assert.deepEqual(
    buildHomeBadgeFeedItems(input, [], new Set(), channels, SELF).map(
      (entry) => entry.id,
    ),
    expectedExternal,
  );
  assert.deepEqual(
    eligibleFeedNotificationItems(
      input,
      { mentions: true, needsAction: true, currentPubkey: SELF },
      channels,
    ).map((entry) => entry.id),
    expectedExternal,
  );
});
