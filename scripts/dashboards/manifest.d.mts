import type { DashboardSource } from "../../lib/dashboards/types";

export const SOURCES_PATH: string;

export interface ValidationResult {
  ok: DashboardSource[];
  excluded: Array<{ slug: string; reason: string }>;
  errors: string[];
}

export function validateSources(list: unknown[]): ValidationResult;
export const SOURCES_DIR: string;
export function readAllSources(file?: string, dir?: string): unknown[];
export function loadSources(file?: string, dir?: string): ValidationResult;
