// Agent 3 integrity verifier.
// Layer 1: does the generated module parse at all?
//
// Contract: this module answers for ONE layer only. `passed: true` means this
// layer's check succeeded it does NOT mean the module is correct, and no
// caller may treat it as a full verification. A syntactically valid module can
// still be wrong in ways only later layers detect (v5-blog parses cleanly and
// reads a URL parameter from the request body).
//
// The field is deliberately not called `verified`. A per-layer result named
// `verified` is a false pass waiting to happen, which is the failure this
// component exists to prevent. When further layers exist, the orchestrator
// that runs all of them owns the word `verified`, and it may only set it once
// every layer has passed.
import * as acorn from "acorn";

const LAYER = 1;

function excerpt(code, line, column) {
  const text = code.split("\n")[line - 1] ?? "";
  const gutter = String(line);
  return (
    `  ${gutter} | ${text}\n` +
    `  ${" ".repeat(gutter.length)} | ${" ".repeat(Math.max(column, 0))}^`
  );
}

function feedbackFor(message, line, column, code) {
  return [
    `Layer ${LAYER} (syntax): the module you returned does not parse as JavaScript.`,
    `${message} at line ${line}, column ${column}:`,
    "",
    excerpt(code, line, column),
    "",
    "Return the complete module again, corrected so that it parses as an ES module.",
  ].join("\n");
}

export function verifyIntegrity(code) {
  if (typeof code !== "string" || code.trim() === "") {
    return {
      passed: false,
      layer: LAYER,
      error: {
        type: "EmptyOutput",
        message: "No code was produced",
        line: null,
        column: null,
      },
      feedback: `Layer ${LAYER} (syntax): no code was produced. Return a complete ES module.`,
    };
  }

  try {
    const ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    });
    return { passed: true, layer: LAYER, ast };
  } catch (err) {
    // Acorn currently appends "(line:column)" to err.message. Stripping it
    // normalises the message so identical faults group together when failures
    // are counted across a run, and keeps position in one place: err.loc.
    //
    // This is an assumption about a library's message formatting, not a
    // guaranteed API. If Acorn changes it, the replace becomes a no-op and the
    // position appears twice in the feedback text a cosmetic defect, not a
    // wrong verdict, and it cannot turn a failure into a pass. err.loc is the
    // authoritative source for line and column either way.
    const message = err.message.replace(/\s*\(\d+:\d+\)\s*$/, "");
    const line = err.loc?.line ?? null;
    const column = err.loc?.column ?? null;
    return {
      passed: false,
      layer: LAYER,
      error: { type: "SyntaxError", message, line, column },
      feedback: feedbackFor(message, line, column, code),
    };
  }
}
