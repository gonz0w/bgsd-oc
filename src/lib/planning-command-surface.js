'use strict';

const fs = require('fs');
const path = require('path');

const ROUTE_PATTERN = /^- `([^`]+)` → route to `([^`]+)`/gm;

function tokenizeRouteGrammar(route) {
  return route.split(/\s+/).filter(Boolean);
}

function isRequiredToken(token) {
  return /^<[^>]+>$/.test(token);
}

function isOptionalToken(token) {
  return /^\[[^\]]+\]$/.test(token);
}

function createRouteEntry(route, workflow) {
  const tokens = tokenizeRouteGrammar(route);
  const literalPrefix = [];

  for (const token of tokens) {
    if (isRequiredToken(token) || isOptionalToken(token)) break;
    literalPrefix.push(token);
  }

  return {
    route,
    workflow,
    tokens,
    literalPrefix,
    requiredOperandCount: tokens.filter((token, index) => index >= literalPrefix.length && isRequiredToken(token)).length,
  };
}

function setNestedRoute(target, prefix, entry) {
  if (prefix.length === 1) {
    target[prefix[0]] = entry;
    return;
  }

  if (!target[prefix[0]]) target[prefix[0]] = {};
  setNestedRoute(target[prefix[0]], prefix.slice(1), entry);
}

function buildLegacyAliases(routeEntries) {
  const aliases = {};
  const directPhaseRoutes = routeEntries.filter(entry => entry.literalPrefix.length === 1 && entry.tokens[1] === '<phase-number>');

  for (const entry of directPhaseRoutes) {
    const subaction = entry.literalPrefix[0];
    const alias = subaction === 'phase' ? '/bgsd-plan-phase' : `/bgsd-${subaction}-phase`;
    aliases[alias] = ['/bgsd-plan', subaction];
  }

  return aliases;
}

function loadPlanningCommandSurface(cwd = process.cwd()) {
  const commandPath = path.join(cwd, 'commands', 'bgsd-plan.md');
  const content = fs.readFileSync(commandPath, 'utf8');
  const matches = Array.from(content.matchAll(ROUTE_PATTERN));
  const routeEntries = matches.map((match) => createRouteEntry(match[1], match[2]));
  const routes = {};

  for (const entry of routeEntries) {
    setNestedRoute(routes, entry.literalPrefix, entry);
  }

  const subactions = Array.from(new Set(routeEntries.map(entry => entry.literalPrefix[0])));

  return {
    commandPath,
    subactions,
    routeEntries,
    routes,
    legacyAliases: buildLegacyAliases(routeEntries),
  };
}

module.exports = {
  loadPlanningCommandSurface,
};
