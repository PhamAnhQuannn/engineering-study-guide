@AGENTS.md

## Multi-Agent Model Policy

When spawning team/multi-agent work (workflows, parallel agents, fan-out):
- **Worker agents**: use `model: "sonnet"` — cost-efficient for parallel tasks
- **Synthesis/lead agent**: use Opus (default, no override needed) — high quality for final integration
- This applies to all prompts requesting team/multi-agent orchestration
