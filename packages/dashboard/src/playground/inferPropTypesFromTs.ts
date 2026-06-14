export type { DeclaredPropKind, PlaygroundSpec } from "../types/report";
export type PropKind = "boolean" | "string" | "number" | "node";

export type CheckerProgram = {
  program: import("typescript").Program;
  checker: import("typescript").TypeChecker;
};

export {
  classifyPropType,
  createCheckerProgram,
  enrichPlaygroundSpecFromTs,
  enrichPlaygroundsFromReport,
  extractFiniteStringUnion,
  findComponentParamType,
  inferDeclaredPropKindsFromTs,
} from "./inferPropTypesFromTs.mjs";
