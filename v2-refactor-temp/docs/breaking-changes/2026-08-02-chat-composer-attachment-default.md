---
title: Chat composer defaults to the attachment shortcut
category: changed
severity: notice
introduced_in_pr: TBD
date: 2026-08-02
---

## What changed

Fresh Chat profiles, profiles missing the Chat toolbar preference, and users who choose "Restore default" now pin only Attachment in the composer toolbar. New Conversation, Web Search, and other secondary actions remain available in the "+" panel, while active unpinned tools still surface in the composer.

## Why this matters to the user

The default Chat composer is quieter without removing capabilities. Existing stored Chat toolbar selections are preserved, and the Agent composer default is unchanged.

## What the user should do

Nothing — automatic.

## Notes for release manager

Merge this notice with the Chat-default portion of the July composer-toolbar customization fragment.
