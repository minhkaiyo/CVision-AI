"use client";

// ============================================================
// AnalysisContext — Global background analysis state
// Placed in layout so it survives page navigation.
// ============================================================

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import type { AnalysisResult } from "@/lib/types";

export type AnalysisStep = "idle" | "uploading" | "reading" | "analyzing" | "done";

export interface AnalysisState {
  // Form inputs (persist across navigation)
  file: File | null;
  role: string;
  jd: string;

  // Progress state
  loading: boolean;
  step: AnalysisStep;
  uploadProgress: number;

  // Result (set when done)
  result: AnalysisResult | null;
}

interface AnalysisContextValue extends AnalysisState {
  setFile: (f: File | null) => void;
  setRole: (r: string) => void;
  setJd: (j: string) => void;
  setLoading: (v: boolean) => void;
  setStep: (s: AnalysisStep) => void;
  setUploadProgress: (p: number) => void;
  setResult: (r: AnalysisResult | null) => void;
  reset: () => void;
}

const defaultState: AnalysisState = {
  file: null,
  role: "",
  jd: "",
  loading: false,
  step: "idle",
  uploadProgress: 0,
  result: null,
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>(defaultState);

  const setFile = useCallback((file: File | null) => setState(s => ({ ...s, file })), []);
  const setRole = useCallback((role: string) => setState(s => ({ ...s, role })), []);
  const setJd = useCallback((jd: string) => setState(s => ({ ...s, jd })), []);
  const setLoading = useCallback((loading: boolean) => setState(s => ({ ...s, loading })), []);
  const setStep = useCallback((step: AnalysisStep) => setState(s => ({ ...s, step })), []);
  const setUploadProgress = useCallback((uploadProgress: number) => setState(s => ({ ...s, uploadProgress })), []);
  const setResult = useCallback((result: AnalysisResult | null) => setState(s => ({ ...s, result })), []);
  const reset = useCallback(() => setState(defaultState), []);

  return (
    <AnalysisContext.Provider value={{
      ...state,
      setFile, setRole, setJd, setLoading, setStep, setUploadProgress, setResult, reset,
    }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used inside AnalysisProvider");
  return ctx;
}
