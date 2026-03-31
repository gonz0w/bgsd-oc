import * as v from 'valibot';
import { z } from 'zod';
import { resolveValidationFlags } from './flags.js';
import { writeDebugDiagnostic } from '../debug-contract.js';

function mapFieldToValibot(fieldSpec) {
  let schema;

  switch (fieldSpec.type) {
    case 'coerceNumber': {
      schema = v.pipe(
        v.union([v.number(), v.string()]),
        v.transform(value => Number(value)),
        v.number()
      );
      break;
    }
    case 'enum': {
      schema = v.picklist(fieldSpec.values);
      break;
    }
    case 'string': {
      schema = v.string();
      break;
    }
    default:
      throw new Error(`Unsupported schema type: ${fieldSpec.type}`);
  }

  return fieldSpec.optional ? v.optional(schema) : schema;
}

function mapFieldToZod(fieldSpec) {
  let schema;

  switch (fieldSpec.type) {
    case 'coerceNumber': {
      schema = z.coerce.number();
      break;
    }
    case 'enum': {
      schema = z.enum(fieldSpec.values);
      break;
    }
    case 'string': {
      schema = z.string();
      break;
    }
    default:
      throw new Error(`Unsupported schema type: ${fieldSpec.type}`);
  }

  return fieldSpec.optional ? schema.optional() : schema;
}

function buildValibotSchema(schemaSpec) {
  const shape = {};
  for (const [fieldName, fieldSpec] of Object.entries(schemaSpec.shape || {})) {
    shape[fieldName] = mapFieldToValibot(fieldSpec);
  }
  return v.object(shape);
}

function buildZodSchema(schemaSpec) {
  const shape = {};
  for (const [fieldName, fieldSpec] of Object.entries(schemaSpec.shape || {})) {
    shape[fieldName] = mapFieldToZod(fieldSpec);
  }
  return z.object(shape);
}

function formatEnumOptions(values) {
  return values.map(value => `"${value}"`).join('|');
}

function getPathKey(issue) {
  if (!issue || !Array.isArray(issue.path) || issue.path.length === 0) {
    return null;
  }

  const segment = issue.path[0];
  return segment && typeof segment.key === 'string' ? segment.key : null;
}

function firstErrorMessage(result, schemaSpec) {
  if (result.engine === 'valibot') {
    const firstIssue = result.issues && result.issues[0];
    const message = firstIssue && firstIssue.message ? firstIssue.message : 'Invalid arguments';
    const fieldKey = getPathKey(firstIssue);
    const fieldSpec = fieldKey && schemaSpec && schemaSpec.shape ? schemaSpec.shape[fieldKey] : null;

    if (message.includes('Expected number but received NaN')) {
      return 'Invalid input: expected number, received NaN';
    }

    if (fieldSpec && fieldSpec.type === 'enum' && Array.isArray(fieldSpec.values)) {
      if (firstIssue.type === 'picklist' || (firstIssue.type === 'object' && firstIssue.received === 'undefined')) {
        return `Invalid option: expected one of ${formatEnumOptions(fieldSpec.values)}`;
      }
    }

    return message;
  }

  const issue = result.error && result.error.issues && result.error.issues[0];
  return issue && issue.message ? issue.message : 'Invalid arguments';
}

function emitDebugMarker(toolName, engine) {
  writeDebugDiagnostic('[bGSD:validation-engine]', `${toolName}:${engine}`);
}

function runValidation(engine, schemaSpec, source) {
  if (engine === 'valibot') {
    return v.safeParse(buildValibotSchema(schemaSpec), source);
  }

  return buildZodSchema(schemaSpec).safeParse(source);
}

function normalizeDebugResult(result, engine) {
  if (result.success) {
    const payload = engine === 'valibot' ? result.output : result.data;
    return { success: true, data: payload };
  }

  return {
    success: false,
    message: firstErrorMessage({ ...result, engine }),
  };
}

function emitShadowCompareDiagnostics(toolName, schemaSpec, source, primaryEngine, primaryResult) {
  const shadowEngine = primaryEngine === 'valibot' ? 'zod' : 'valibot';
  const shadowResult = runValidation(shadowEngine, schemaSpec, source);

  const primaryNormalized = normalizeDebugResult(primaryResult, primaryEngine);
  const shadowNormalized = normalizeDebugResult(shadowResult, shadowEngine);
  const parity = JSON.stringify(primaryNormalized) === JSON.stringify(shadowNormalized) ? 'match' : 'mismatch';

  writeDebugDiagnostic('[bGSD:validation-shadow]', `${toolName}:${primaryEngine}->${shadowEngine}:${parity}`);
}

export function createObjectSchema(shape) {
  return { type: 'object', shape };
}

export function validateArgs(toolName, schemaSpec, input) {
  const flags = resolveValidationFlags();
  const source = input && typeof input === 'object' ? input : {};
  const engine = flags.engine;
  emitDebugMarker(toolName, engine);

  const result = runValidation(engine, schemaSpec, source);
  emitShadowCompareDiagnostics(toolName, schemaSpec, source, engine, result);

  if (engine === 'valibot') {
    if (result.success) {
      return {
        ok: true,
        data: result.output,
        error: null,
      };
    }

    return {
      ok: false,
      data: null,
      error: {
        code: 'validation_error',
        message: firstErrorMessage({ ...result, engine }, schemaSpec),
      },
    };
  }

  if (result.success) {
    return {
      ok: true,
      data: result.data,
      error: null,
    };
  }

  return {
    ok: false,
    data: null,
    error: {
      code: 'validation_error',
      message: firstErrorMessage({ ...result, engine }, schemaSpec),
    },
  };
}
