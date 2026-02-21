import { createContext, useContext, useRef, useEffect, useCallback } from "react";
import { ParticleEngine } from "./ParticleEngine";

const ParticleCtx = createContext(null);

export function ParticleProvider({ children }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ParticleEngine();
    engine.init(canvas);
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const emit = useCallback((preset, opts) => {
    engineRef.current?.emit(preset, opts);
  }, []);

  return (
    <ParticleCtx.Provider value={emit}>
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
    </ParticleCtx.Provider>
  );
}

const noop = () => {};

export function useParticles() {
  return useContext(ParticleCtx) || noop;
}
