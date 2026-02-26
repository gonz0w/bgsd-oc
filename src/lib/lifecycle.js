'use strict';

const path = require('path');
const { debugLog } = require('./output');
const { findCycles } = require('./deps');

// ─── Lifecycle Detector Registry ─────────────────────────────────────────────
//
// Extensible lifecycle detection. To add a new framework:
//   1. Create a detector object with { name, detect, extractLifecycle }
//   2. Push it to LIFECYCLE_DETECTORS array
//   3. detect(intel) → boolean: does this codebase have lifecycle patterns for this detector?
//   4. extractLifecycle(intel, cwd) → LifecycleNode[]: extract lifecycle ordering nodes
//

/**
 * @typedef {Object} LifecycleNode
 * @property {string} id - Unique identifier (e.g., 'migration:20240101_create_users')
 * @property {string} file_or_step - Relative file path or step description
 * @property {string} type - migration|seed|config|boot|compilation|initialization
 * @property {string[]} must_run_before - IDs of nodes that must run after this one
 * @property {string[]} must_run_after - IDs of nodes that must run before this one
 * @property {string} framework - Detector name (e.g., 'generic', 'elixir-phoenix')
 * @property {number} confidence - 0-100 confidence score
 */

/** Migration directory patterns */
var MIGRATION_DIR_RE = /(?:^|\/)(migrations|db\/migrate|priv\/[^/]*\/migrations)\//;

/** Maximum migration nodes per directory before capping */
var MAX_MIGRATION_NODES = 20;


/**
 * Classify a migration file prefix to determine ordering confidence.
 * @param {string} basename - File basename
 * @returns {number} Confidence score
 */
function classifyMigrationPrefix(basename) {
  if (/^\d{14}[_-]/.test(basename)) return 95;  // Timestamp (YYYYMMDDHHMMSS)
  if (/^\d{8}[_-]/.test(basename)) return 85;    // Date (YYYYMMDD)
  if (/^\d{1,4}[_-]/.test(basename)) return 90;  // Sequence number
  return 70;                                       // Alphabetical fallback
}


/**
 * Lifecycle detector registry.
 * Each detector: { name: string, detect: (intel) => boolean, extractLifecycle: (intel, cwd) => LifecycleNode[] }
 * @type {Array<{name: string, detect: function, extractLifecycle: function}>}
 */
var LIFECYCLE_DETECTORS = [
  // ─── Generic Migration Detector ──────────────────────────────────────────
  {
    name: 'generic-migrations',

    /**
     * Detect if this codebase has migration directories.
     */
    detect(intel) {
      var filePaths = Object.keys(intel.files || {});
      return filePaths.some(function(f) {
        return MIGRATION_DIR_RE.test(f);
      });
    },

    /**
     * Extract lifecycle nodes from migration directories.
     * Builds sequential chains: each migration depends on the previous one.
     */
    extractLifecycle(intel, cwd) {
      var filePaths = Object.keys(intel.files || {});
      var migrationDirs = new Set();

      // Find migration directories
      for (var i = 0; i < filePaths.length; i++) {
        var f = filePaths[i];
        if (MIGRATION_DIR_RE.test(f)) {
          // Extract the directory portion (everything before the last path segment)
          var dir = f.replace(/\/[^/]+$/, '');
          migrationDirs.add(dir);
        }
      }

      var nodes = [];

      migrationDirs.forEach(function(dir) {
        // Get files in this directory (one level deep — no subdirectory recursion)
        var dirFiles = filePaths
          .filter(function(fp) {
            if (!fp.startsWith(dir + '/')) return false;
            // Ensure one level deep only
            var rest = fp.slice(dir.length + 1);
            return !rest.includes('/');
          })
          .sort(); // Natural sort order — filename gives ordering

        // Cap migration nodes: keep only the most recent MAX_MIGRATION_NODES
        var capped = false;
        var cappedCount = 0;
        if (dirFiles.length > MAX_MIGRATION_NODES) {
          cappedCount = dirFiles.length - MAX_MIGRATION_NODES;
          dirFiles = dirFiles.slice(dirFiles.length - MAX_MIGRATION_NODES);
          capped = true;
        }

        var prevId = null;
        for (var j = 0; j < dirFiles.length; j++) {
          var file = dirFiles[j];
          var basename = path.basename(file);
          var nameNoExt = basename.replace(/\.[^.]+$/, '');
          var confidence = classifyMigrationPrefix(basename);

          var id = 'migration:' + nameNoExt;
          var node = {
            id: id,
            file_or_step: file,
            type: 'migration',
            must_run_before: [],
            must_run_after: prevId ? [prevId] : [],
            framework: 'generic',
            confidence: confidence,
          };

          // Maintain symmetry: update previous node's must_run_before
          if (prevId) {
            var prevNode = nodes.find(function(n) { return n.id === prevId; });
            if (prevNode) prevNode.must_run_before.push(id);
          }

          nodes.push(node);
          prevId = id;
        }

        // Add summary node for capped migrations
        if (capped && nodes.length > 0) {
          var firstKeptId = nodes[nodes.length - dirFiles.length].id;
          var summaryNode = {
            id: 'migration:earlier-' + cappedCount,
            file_or_step: '... and ' + cappedCount + ' earlier migrations',
            type: 'migration',
            must_run_before: [firstKeptId],
            must_run_after: [],
            framework: 'generic',
            confidence: 0,
          };
          nodes.unshift(summaryNode);
        }
      });

      return nodes;
    },
  },

  // ─── Elixir/Phoenix Detector ─────────────────────────────────────────────
  {
    name: 'elixir-phoenix',

    /**
     * Detect if this codebase uses Elixir/Phoenix.
     * Gates on framework detection from Phase 24 conventions.
     */
    detect(intel) {
      if (!intel.conventions || !intel.conventions.frameworks) return false;
      return intel.conventions.frameworks.some(function(f) {
        return f.framework === 'elixir-phoenix';
      });
    },

    /**
     * Extract Elixir/Phoenix lifecycle nodes.
     * Detects: config ordering, application boot, seed→migration dependency, router compilation.
     */
    extractLifecycle(intel, cwd) {
      var filePaths = Object.keys(intel.files || {});
      var nodes = [];

      // 1. Config ordering: config.exs → runtime.exs
      var configExs = filePaths.find(function(f) { return f === 'config/config.exs'; });
      var runtimeExs = filePaths.find(function(f) { return f === 'config/runtime.exs'; });

      if (configExs) {
        nodes.push({
          id: 'config:compile-time',
          file_or_step: configExs,
          type: 'config',
          must_run_before: [],
          must_run_after: [],
          framework: 'elixir-phoenix',
          confidence: 95,
        });
      }

      if (runtimeExs) {
        nodes.push({
          id: 'config:runtime',
          file_or_step: runtimeExs,
          type: 'config',
          must_run_before: [],
          must_run_after: configExs ? ['config:compile-time'] : [],
          framework: 'elixir-phoenix',
          confidence: 90,
        });
      }

      // 2. Application boot: lib/*/application.ex
      var appFile = filePaths.find(function(f) {
        return /lib\/[^/]+\/application\.ex$/.test(f);
      });

      if (appFile) {
        var bootAfter = [];
        if (configExs) bootAfter.push('config:compile-time');
        if (runtimeExs) bootAfter.push('config:runtime');

        nodes.push({
          id: 'boot:application',
          file_or_step: appFile,
          type: 'boot',
          must_run_before: [],
          must_run_after: bootAfter,
          framework: 'elixir-phoenix',
          confidence: 95,
        });

        // Update config nodes must_run_before
        if (configExs) {
          var configNode = nodes.find(function(n) { return n.id === 'config:compile-time'; });
          if (configNode) configNode.must_run_before.push('boot:application');
        }
        if (runtimeExs) {
          var runtimeNode = nodes.find(function(n) { return n.id === 'config:runtime'; });
          if (runtimeNode) runtimeNode.must_run_before.push('boot:application');
        }
      }

      // 3. Seeds depend on last migration
      var seedFile = filePaths.find(function(f) { return /seeds\.exs$/.test(f); });
      var migrationFiles = filePaths.filter(function(f) {
        return /priv\/[^/]*\/migrations\//.test(f);
      });

      if (seedFile && migrationFiles.length > 0) {
        var sortedMigrations = migrationFiles.slice().sort();
        var lastMigrationBasename = path.basename(sortedMigrations[sortedMigrations.length - 1]);
        var lastMigrationId = 'migration:' + lastMigrationBasename.replace(/\.[^.]+$/, '');

        nodes.push({
          id: 'seed:seeds',
          file_or_step: seedFile,
          type: 'seed',
          must_run_before: [],
          must_run_after: [lastMigrationId],
          framework: 'elixir-phoenix',
          confidence: 90,
        });
      }

      // 4. Router: compiled at boot, depends on application start
      var routerFile = filePaths.find(function(f) { return /router\.ex$/.test(f); });

      if (routerFile && appFile) {
        nodes.push({
          id: 'compilation:router',
          file_or_step: routerFile,
          type: 'compilation',
          must_run_before: [],
          must_run_after: ['boot:application'],
          framework: 'elixir-phoenix',
          confidence: 85,
        });

        // Update boot node's must_run_before
        var bootNode = nodes.find(function(n) { return n.id === 'boot:application'; });
        if (bootNode) bootNode.must_run_before.push('compilation:router');
      }

      return nodes;
    },
  },
];


// ─── DAG Construction ────────────────────────────────────────────────────────

/**
 * Merge duplicate nodes (same file_or_step from different detectors).
 * Keeps the node with higher confidence.
 *
 * @param {LifecycleNode[]} nodes - All collected nodes
 * @returns {LifecycleNode[]} Deduplicated nodes
 */
function mergeNodes(nodes) {
  var byFile = {};

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var key = node.file_or_step;
    if (!byFile[key]) {
      byFile[key] = node;
    } else {
      // Keep the one with higher confidence
      if (node.confidence > byFile[key].confidence) {
        // Merge edges from lower-confidence node
        var old = byFile[key];
        for (var j = 0; j < old.must_run_before.length; j++) {
          if (node.must_run_before.indexOf(old.must_run_before[j]) === -1) {
            node.must_run_before.push(old.must_run_before[j]);
          }
        }
        for (var k = 0; k < old.must_run_after.length; k++) {
          if (node.must_run_after.indexOf(old.must_run_after[k]) === -1) {
            node.must_run_after.push(old.must_run_after[k]);
          }
        }
        byFile[key] = node;
      } else {
        // Merge edges from new node into existing
        var existing = byFile[key];
        for (var j2 = 0; j2 < node.must_run_before.length; j2++) {
          if (existing.must_run_before.indexOf(node.must_run_before[j2]) === -1) {
            existing.must_run_before.push(node.must_run_before[j2]);
          }
        }
        for (var k2 = 0; k2 < node.must_run_after.length; k2++) {
          if (existing.must_run_after.indexOf(node.must_run_after[k2]) === -1) {
            existing.must_run_after.push(node.must_run_after[k2]);
          }
        }
      }
    }
  }

  return Object.values(byFile);
}


/**
 * Enforce must_run_before / must_run_after symmetry across all nodes.
 * If node A has must_run_after: ['B'], ensure node B has must_run_before: ['A'].
 *
 * @param {LifecycleNode[]} nodes - All nodes to process
 */
function enforceSymmetry(nodes) {
  var nodeMap = {};
  for (var i = 0; i < nodes.length; i++) {
    nodeMap[nodes[i].id] = nodes[i];
  }

  for (var j = 0; j < nodes.length; j++) {
    var node = nodes[j];

    // For each must_run_after, ensure that node has must_run_before pointing back
    for (var k = 0; k < node.must_run_after.length; k++) {
      var beforeId = node.must_run_after[k];
      var beforeNode = nodeMap[beforeId];
      if (beforeNode && beforeNode.must_run_before.indexOf(node.id) === -1) {
        beforeNode.must_run_before.push(node.id);
      }
    }

    // For each must_run_before, ensure that node has must_run_after pointing back
    for (var m = 0; m < node.must_run_before.length; m++) {
      var afterId = node.must_run_before[m];
      var afterNode = nodeMap[afterId];
      if (afterNode && afterNode.must_run_after.indexOf(node.id) === -1) {
        afterNode.must_run_after.push(node.id);
      }
    }
  }
}


/**
 * Build chains from lifecycle nodes using connected components + Kahn's topological sort.
 * Only returns chains with length > 1 (single nodes aren't chains).
 *
 * @param {LifecycleNode[]} nodes - All lifecycle nodes
 * @returns {string[][]} Array of chains (each chain is an array of node IDs in order)
 */
function buildChains(nodes) {
  if (nodes.length === 0) return [];

  var nodeMap = {};
  for (var i = 0; i < nodes.length; i++) {
    nodeMap[nodes[i].id] = nodes[i];
  }

  // Build adjacency and in-degree from must_run_before edges
  var adjacency = {};
  var inDegree = {};

  for (var j = 0; j < nodes.length; j++) {
    var node = nodes[j];
    if (!adjacency[node.id]) adjacency[node.id] = [];
    if (inDegree[node.id] === undefined) inDegree[node.id] = 0;

    for (var k = 0; k < node.must_run_before.length; k++) {
      var target = node.must_run_before[k];
      adjacency[node.id].push(target);
      if (inDegree[target] === undefined) inDegree[target] = 0;
      inDegree[target]++;
      if (!adjacency[target]) adjacency[target] = [];
    }
  }

  // Find connected components via BFS (undirected)
  var visited = new Set();
  var components = [];

  function bfsComponent(start) {
    var comp = new Set();
    var q = [start];
    comp.add(start);
    while (q.length > 0) {
      var cur = q.shift();
      // Follow forward edges
      var fwd = adjacency[cur] || [];
      for (var fi = 0; fi < fwd.length; fi++) {
        if (!comp.has(fwd[fi])) { comp.add(fwd[fi]); q.push(fwd[fi]); }
      }
      // Follow reverse edges (must_run_after)
      var curNode = nodeMap[cur];
      if (curNode) {
        for (var ri = 0; ri < curNode.must_run_after.length; ri++) {
          var prev = curNode.must_run_after[ri];
          if (!comp.has(prev)) { comp.add(prev); q.push(prev); }
        }
      }
    }
    return comp;
  }

  for (var ci = 0; ci < nodes.length; ci++) {
    if (!visited.has(nodes[ci].id)) {
      var comp = bfsComponent(nodes[ci].id);
      comp.forEach(function(id) { visited.add(id); });
      components.push(comp);
    }
  }

  // Topological sort each component (Kahn's algorithm)
  var chains = [];

  for (var si = 0; si < components.length; si++) {
    var compSet = components[si];
    // Create local in-degree copy for this component
    var localInDegree = {};
    compSet.forEach(function(id) {
      localInDegree[id] = 0;
    });

    // Count in-degree only from edges within the component
    compSet.forEach(function(id) {
      var edges = adjacency[id] || [];
      for (var ei = 0; ei < edges.length; ei++) {
        if (compSet.has(edges[ei])) {
          localInDegree[edges[ei]]++;
        }
      }
    });

    // BFS from zero in-degree nodes
    var queue = [];
    compSet.forEach(function(id) {
      if (localInDegree[id] === 0) queue.push(id);
    });

    var sorted = [];
    while (queue.length > 0) {
      var current = queue.shift();
      sorted.push(current);
      var edges = adjacency[current] || [];
      for (var ei2 = 0; ei2 < edges.length; ei2++) {
        if (compSet.has(edges[ei2])) {
          localInDegree[edges[ei2]]--;
          if (localInDegree[edges[ei2]] === 0) {
            queue.push(edges[ei2]);
          }
        }
      }
    }

    // Only include chains with length > 1
    if (sorted.length > 1) {
      chains.push(sorted);
    }
  }

  return chains;
}


// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Build a lifecycle graph from codebase intel.
 *
 * Runs each detector, merges duplicates, enforces symmetry, detects cycles,
 * and flattens into chains via topological sort.
 *
 * @param {object} intel - Codebase intel object (from codebase-intel.json)
 * @param {string} cwd - Project root directory
 * @returns {{ nodes: LifecycleNode[], edges: number, chains: string[][], cycles: string[][], detectors_used: string[], stats: object, built_at: string }}
 */
function buildLifecycleGraph(intel, cwd) {
  var allNodes = [];
  var detectorsUsed = [];

  // Run each detector
  for (var i = 0; i < LIFECYCLE_DETECTORS.length; i++) {
    var detector = LIFECYCLE_DETECTORS[i];
    try {
      if (detector.detect(intel)) {
        debugLog('lifecycle', 'detector activated: ' + detector.name);
        var extracted = detector.extractLifecycle(intel, cwd);
        allNodes = allNodes.concat(extracted);
        detectorsUsed.push(detector.name);
      }
    } catch (e) {
      debugLog('lifecycle', 'detector error: ' + detector.name + ': ' + e.message);
    }
  }

  // Merge duplicate nodes (same file_or_step from different detectors)
  var nodes = mergeNodes(allNodes);

  // Enforce must_run_before / must_run_after symmetry
  enforceSymmetry(nodes);

  // Count edges
  var edgeCount = 0;
  for (var j = 0; j < nodes.length; j++) {
    edgeCount += nodes[j].must_run_before.length;
  }

  // Cycle detection: convert to { forward: {} } shape for findCycles
  var forward = {};
  for (var k = 0; k < nodes.length; k++) {
    forward[nodes[k].id] = nodes[k].must_run_before.slice();
  }
  var cycleData = findCycles({ forward: forward });

  // Chain flattening via topological sort
  var chains = buildChains(nodes);

  return {
    nodes: nodes,
    edges: edgeCount,
    chains: chains,
    cycles: cycleData.cycles || [],
    detectors_used: detectorsUsed,
    stats: {
      node_count: nodes.length,
      edge_count: edgeCount,
      chain_count: chains.length,
      cycle_count: cycleData.cycle_count || 0,
    },
    built_at: new Date().toISOString(),
  };
}


// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  LIFECYCLE_DETECTORS: LIFECYCLE_DETECTORS,
  buildLifecycleGraph: buildLifecycleGraph,
};
