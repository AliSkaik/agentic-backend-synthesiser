// The verification orchestrator: one module in, one verdict out.
//
// This is the only place in the codebase permitted to set the word `verified`.
// The header of `src/agents/integrityVerifier.js` reserves that word for "the
// orchestrator that runs all of them", and until this file existed the rule was
// stated in a comment and enforced nowhere. Each layer answers for itself with
// `passed`; `verified: true` is set here and only when every layer has passed.
//
// Layer 1 short-circuits. On a parse failure Layer 2 is not merely unnecessary,
// it is unrunnable: it consumes the AST that Layer 1 produces and never
// re-parses the source itself.
//
// Adding a runtime layer later means editing this file and nothing else. The
// caller never learns what a layer checks it sees one boolean and one string.
import { verifyIntegrity } from "./agents/integrityVerifier.js";
import { validateRelations } from "./agents/relationalValidator.js";

/**
 * @param {string} code  Agent 2's module, as text
 * @param {string} ddl   the DDL Agent 1 produced
 * @returns {{
 *   verified: boolean,
 *   layer: number|null,      // the layer that failed; null when verified
 *   error: object|null,      // the failing layer's structured error, unchanged
 *   feedback: string|null,   // the failing layer's re-prompt text, unchanged
 *   ast: object|null         // retained on success for later layers
 * }}
 */
export function verify(code, ddl) {
  const layer1 = verifyIntegrity(code);
  if (!layer1.passed) return failure(layer1);

  const layer2 = validateRelations(layer1.ast, ddl);
  if (!layer2.passed) return failure(layer2);

  return { verified: true, layer: null, error: null, feedback: null, ast: layer1.ast };
}

// The layer's `feedback` string is forwarded byte-for-byte. It is the only
// thing that changes the next prompt, so reassembling it here would put the
// wording of a correction in two places at once.
function failure(result) {
  return {
    verified: false,
    layer: result.layer,
    error: result.error ?? null,
    feedback: result.feedback ?? null,
    ast: null,
  };
}
