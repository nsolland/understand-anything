#!/usr/bin/env node
/**
 * VALO AI Bridge adapter for Understand Anything.
 *
 * Reads the local .ua knowledge graph and emits a bounded, machine-readable
 * context envelope for an execution agent such as Hermes.
 *
 * No network access. No code execution. Fail closed when the graph is missing
 * or malformed.
 */
import fs from "node:fs";
import path from "node:path";

function fail(message, code = 2) {
  process.stderr.write(JSON.stringify({ ok: false, error: message }) + "\n");
  process.exit(code);
}

function parseArgs(argv) {
  const out = { root: process.cwd(), query: "", maxNodes: 40 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--root") out.root = argv[++i];
    else if (argv[i] === "--query") out.query = argv[++i] ?? "";
    else if (argv[i] === "--max-nodes") out.maxNodes = Number(argv[++i]);
    else fail(`unknown argument: ${argv[i]}`);
  }
  if (!Number.isInteger(out.maxNodes) || out.maxNodes < 1 || out.maxNodes > 500) {
    fail("--max-nodes must be an integer between 1 and 500");
  }
  return out;
}

function graphPath(root) {
  const candidates = [
    path.join(root, ".ua", "knowledge-graph.json"),
    path.join(root, ".understand-anything", "knowledge-graph.json"),
  ];
  return candidates.find(fs.existsSync) ?? null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOf(node) {
  return [
    node?.id, node?.name, node?.label, node?.path, node?.file,
    node?.summary, node?.description, node?.type, node?.kind,
  ].filter(Boolean).join(" ").toLowerCase();
}

function nodeId(node, index) {
  return String(node?.id ?? node?.key ?? node?.path ?? node?.name ?? index);
}

function edgeEnds(edge) {
  return [
    String(edge?.source ?? edge?.from ?? edge?.sourceId ?? ""),
    String(edge?.target ?? edge?.to ?? edge?.targetId ?? ""),
  ];
}

const args = parseArgs(process.argv);
const file = graphPath(path.resolve(args.root));
if (!file) fail("knowledge graph not found; run /understand first");

let graph;
try {
  graph = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  fail(`cannot parse knowledge graph: ${error.message}`);
}

const nodes = asArray(graph.nodes ?? graph.graph?.nodes);
const edges = asArray(graph.edges ?? graph.links ?? graph.graph?.edges ?? graph.graph?.links);
if (nodes.length === 0) fail("knowledge graph contains no nodes");

const terms = args.query.toLowerCase().split(/\s+/).filter(Boolean);
const scored = nodes.map((node, index) => {
  const haystack = textOf(node);
  const score = terms.length === 0 ? 1 : terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0);
  return { node, index, score, id: nodeId(node, index) };
}).filter(x => x.score > 0);

scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
const selected = scored.slice(0, args.maxNodes);
const selectedIds = new Set(selected.map(x => x.id));
const relevantEdges = edges.filter(edge => {
  const [source, target] = edgeEnds(edge);
  return selectedIds.has(source) || selectedIds.has(target);
});

const envelope = {
  schema: "valo.ai-bridge.context.v1",
  ok: true,
  source: {
    type: "understand-anything",
    graph: path.relative(path.resolve(args.root), file),
    nodeCount: nodes.length,
    edgeCount: edges.length,
  },
  request: {
    query: args.query,
    maxNodes: args.maxNodes,
  },
  constraints: {
    effectAuthority: "none",
    directEffectPath: false,
    requiresFreshAuthorizationBeforeEffect: true,
    evidenceRequired: true,
  },
  context: {
    nodes: selected.map(({ node }) => node),
    edges: relevantEdges,
  },
};

process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
