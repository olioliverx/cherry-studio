// @amp-agent-mode {"key":"grok-4-5","label":"grok-4.5"}

import type { PluginAPI } from '@ampcode/plugin'

export default function (amp: PluginAPI) {
  const agent = amp.createAgent({
    model: 'xai/grok-4.5',
    instructions:
      'Work as a senior coding agent. Follow repository instructions and prefer the smallest correct, verified change.',
    tools: 'all',
    reasoningEffort: 'high'
  })

  amp.registerAgentMode({
    key: 'grok-4-5',
    label: 'grok-4.5',
    description: 'Grok 4.5 with high reasoning effort and all tools.',
    agent: agent.definition
  })
}
