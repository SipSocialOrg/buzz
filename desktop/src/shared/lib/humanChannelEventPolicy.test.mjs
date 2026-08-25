import assert from "node:assert/strict";
import test from "node:test";

import {
  channelHumanMessageKinds,
  isAgentOnlyChannelEvent,
  isExternalHumanChannelMessage,
  isHumanChannelMessage,
} from "./humanChannelEventPolicy.ts";

const SELF = "a".repeat(64);
const OTHER = "b".repeat(64);

function event(overrides = {}) {
  return {
    id: "c".repeat(64),
    pubkey: OTHER,
    created_at: 100,
    kind: 9,
    tags: [["h", "channel"]],
    content: "hello",
    sig: "sig",
    ...overrides,
  };
}

test("stream and forum human message kinds never overlap", () => {
  assert.deepEqual(channelHumanMessageKinds("stream"), [9, 40002]);
  assert.deepEqual(channelHumanMessageKinds("forum"), [45001, 45003]);
  assert.deepEqual(channelHumanMessageKinds("dm"), [9, 40002]);
});

test("kind 9 is visible in streams but hidden in forums", () => {
  const message = event();
  assert.equal(isHumanChannelMessage(message, "stream"), true);
  assert.equal(isHumanChannelMessage(message, "forum"), false);
});

test("forum roots and comments are human-visible only in forums", () => {
  assert.equal(isHumanChannelMessage(event({ kind: 45001 }), "forum"), true);
  assert.equal(isHumanChannelMessage(event({ kind: 45003 }), "forum"), true);
  assert.equal(isHumanChannelMessage(event({ kind: 45001 }), "stream"), false);
  assert.equal(isHumanChannelMessage(event({ kind: 45003 }), "dm"), false);
});

test("the exact audience=agent packet is never human-visible or unread", () => {
  const packet = event({
    tags: [
      ["h", "channel"],
      ["p", SELF],
      ["audience", "agent"],
    ],
  });
  assert.equal(isAgentOnlyChannelEvent(packet), true);
  assert.equal(isHumanChannelMessage(packet, "stream"), false);
  assert.equal(isExternalHumanChannelMessage(packet, "stream", SELF), false);
});

test("ordinary p-tagged human mentions remain visible", () => {
  const mention = event({
    tags: [
      ["h", "channel"],
      ["p", SELF],
    ],
  });
  assert.equal(isAgentOnlyChannelEvent(mention), false);
  assert.equal(isExternalHumanChannelMessage(mention, "stream", SELF), true);
});

test("malformed audience tags do not hide human messages", () => {
  for (const tags of [
    [
      ["h", "channel"],
      ["audience", "human"],
    ],
    [
      ["h", "channel"],
      ["audience", "Agent"],
    ],
    [["h", "channel"], ["audience"]],
  ]) {
    const message = event({ tags });
    assert.equal(isAgentOnlyChannelEvent(message), false);
    assert.equal(isHumanChannelMessage(message, "stream"), true);
  }
});

test("self-authored messages never become external unread", () => {
  const own = event({ pubkey: SELF });
  assert.equal(isHumanChannelMessage(own, "stream"), true);
  assert.equal(isExternalHumanChannelMessage(own, "stream", SELF), false);
});
