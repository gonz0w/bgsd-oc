'use strict';

const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeThreshold(value, fallback = 0.8) {
  const parsed = toNumber(value);
  if (parsed === null) return fallback;
  if (parsed > 1) return Math.max(0, Math.min(1, parsed / 10));
  return Math.max(0, Math.min(1, parsed));
}

function loadReviewConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const raw = readJson(configPath) || {};
  const review = raw.review && typeof raw.review === 'object' ? raw.review : {};
  return {
    path: configPath,
    confidence_threshold: normalizeThreshold(
      review.confidence_threshold ?? review.confidenceThreshold ?? review.threshold,
      0.8
    ),
    exclusions_path: path.join('.planning', 'review-exclusions.json'),
  };
}

module.exports = {
  loadReviewConfig,
  normalizeThreshold,
};
