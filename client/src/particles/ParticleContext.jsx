import { createContext, useContext, useRef, useEffect, useCallback, useMemo } from "react";
import { ParticleEngine } from "./ParticleEngine";

const ParticleCtx = createContext(null);

export function ParticleProvider({ children }) {
  const canvasRef = useRef(null);
  const canvasBehindRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ParticleEngine();
    engine.init(canvas);
    if (canvasBehindRef.current) {
      engine.initBehind(canvasBehindRef.current);
    }
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const emit = useCallback((preset, opts) => {
    engineRef.current?.emit(preset, opts);
  }, []);

  const setFrozen = useCallback((frozen) => {
    if (engineRef.current) engineRef.current.frozen = frozen;
  }, []);

  const value = useMemo(() => ({ emit, setFrozen }), [emit, setFrozen]);

  return (
    <ParticleCtx.Provider value={value}>
      <canvas
        ref={canvasBehindRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 102,
        }}
      />
    </ParticleCtx.Provider>
  );
}

const noopCtx = { emit: () => {}, setFrozen: () => {} };

export function useParticles() {
  return useContext(ParticleCtx) || noopCtx;
}
