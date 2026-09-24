# VALO AI Bridge adapter

This branch adds a minimal bridge from Understand Anything's local knowledge graph to execution agents such as Hermes.

Run Understand Anything first so the target repository contains `.ua/knowledge-graph.json`, then:

```sh
node /path/to/understand-anything/scripts/valo-ai-bridge.mjs --root /path/to/project --query "authority gateway"
```

The adapter returns a bounded JSON context envelope. It deliberately grants no effect authority. Any write, deployment, message, external call, or other consequence must pass a separate fresh authorization check at consequence time and produce evidence.

The adapter is local-only and fail-closed: it does not call a model, execute target code, or access the network.

Contract: `valo.ai-bridge.context.v1`.

This is intentionally the first narrow integration seam: Understand Anything supplies structural/semantic context; Hermes can consume it for reasoning; VALO/HEIMEL remains responsible for authorization of effects.
