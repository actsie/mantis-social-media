#!/usr/bin/env node
/**
 * security-check.js
 * Runs openclaw security audit + web search for known vulns.
 * Sends a Telegram summary. Runs daily at 3:05 AM PST.
 *
 * This script is meant to be run as an OpenClaw cron message (isolated session),
 * so it outputs structured instructions for the agent to follow.
 */

// This script is the task prompt — not a Node runner.
// The cron message below is what the agent receives.
console.log("This file is a reference. The cron message is defined in the setup script.");
