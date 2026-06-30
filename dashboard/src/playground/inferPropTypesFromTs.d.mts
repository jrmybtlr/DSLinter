import type { Program, TypeChecker, SourceFile, Type } from "typescript";
import type { PlaygroundSpec } from "../types/report.js";

export type PropKind = "boolean" | "string" | "number" | "node";

export type CheckerProgram = {
  program: Program;
  checker: TypeChecker;
};

export declare function createCheckerProgram(projectRoot: string): CheckerProgram | null;

export declare function findComponentParamType(
  checker: TypeChecker,
  sf: SourceFile,
  exportName: string,
): Type | undefined;

export declare function classifyPropType(checker: TypeChecker, type: Type): PropKind | null;

export declare function extractFiniteStringUnion(
  checker: TypeChecker,
  type: Type,
): string[] | null;

export declare function inferDeclaredPropKindsFromTs(
  checker: TypeChecker,
  program: Program,
  projectRoot: string,
  relPath: string,
  exportName: string,
  declaredProps: string[],
): Record<string, string>;

export declare function enrichPlaygroundSpecFromTs(
  spec: PlaygroundSpec,
  checker: TypeChecker,
  program: Program,
  projectRoot: string,
): PlaygroundSpec;

export declare function enrichPlaygroundsFromReport(
  report: { playgrounds?: PlaygroundSpec[] },
  checker: TypeChecker,
  program: Program,
  projectRoot: string,
): void;
