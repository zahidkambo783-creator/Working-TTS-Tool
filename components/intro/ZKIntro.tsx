"use client";
import React, { useEffect, useRef, useState } from "react";

type IntroState =
  | "DARK"
  | "THIN_WAVE"
  | "ACTIVE_WAVE"
  | "FLOW"
  | "CONVERGENCE"
  | "LOGO_ZK"
  | "LOGO_FULL"
  | "HOLD"
  | "LOADING"
  | "READY"
  | "EXIT";

interface ZKIntroProps {
  onComplete: () => void;
  appReady: boolean;
}

export default function ZKIntro({ onComplete, appReady }: ZKIntroProps) {
  const [state, setState] = useState<IntroState>("DARK");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // State Machine Timers
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    
    const schedule = (nextState: IntroState, delay: number) => {
      t = setTimeout(() => setState(nextState), delay);
    };

    switch (state) {
      case "DARK": schedule("THIN_WAVE", 500); break;
      case "THIN_WAVE": schedule("ACTIVE_WAVE", 800); break; // 1.3s
      case "ACTIVE_WAVE": schedule("FLOW", 700); break; // 2.0s
      case "FLOW": schedule("CONVERGENCE", 1000); break; // 3.0s
      case "CONVERGENCE": schedule("LOGO_ZK", 400); break; // 3.4s
      case "LOGO_ZK": schedule("LOGO_FULL", 400); break; // 3.8s
      case "LOGO_FULL": schedule("HOLD", 700); break; // 4.5s
      case "HOLD": schedule("LOADING", 500); break; // 5.0s
      case "LOADING":
        // Wait for appReady, but at least wait 1.5 seconds for visual Polish
        const checkReady = () => {
          if (appReady) schedule("READY", 0);
          else setTimeout(checkReady, 200);
        };
        setTimeout(checkReady, 1500);
        break;
      case "READY": schedule("EXIT", 600); break; // 600ms for fade out
      case "EXIT": onComplete(); break;
    }
    return () => clearTimeout(t);
  }, [state, appReady, onComplete]);

  // Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", handleResize);

    let time = 0;
    
    // Particles
    const particles: {x: number, y: number, vx: number, vy: number, life: number, size: number}[] = [];
    
    const render = () => {
      time += 0.02;
      const s = stateRef.current;
      
      ctx.clearRect(0, 0, width, height);

      // We only draw canvas during these states
      if (["DARK", "LOGO_FULL", "HOLD", "LOADING", "READY", "EXIT"].includes(s) && s !== "DARK" && particles.length === 0) {
        requestRef.current = requestAnimationFrame(render);
        return;
      }

      const centerY = height / 2;
      const baseAmplitude = height * 0.15;
      
      let waveCount = 1;
      let targetAmpMultiplier = 0;
      let alpha = 0;
      let drawParticles = false;
      let pullToCenter = false;

      if (s === "THIN_WAVE") {
        targetAmpMultiplier = 0.05;
        alpha = 0.4;
      } else if (s === "ACTIVE_WAVE") {
        targetAmpMultiplier = 0.4;
        alpha = 0.7;
      } else if (s === "FLOW") {
        targetAmpMultiplier = 1.0;
        alpha = 0.8;
        waveCount = 12; // desktop, maybe less on mobile, but canvas handles 12 fine
        drawParticles = true;
      } else if (s === "CONVERGENCE" || s === "LOGO_ZK") {
        targetAmpMultiplier = 0;
        alpha = s === "CONVERGENCE" ? 0.8 : 0;
        waveCount = 12;
        drawParticles = true;
        pullToCenter = true;
      }

      // Smooth amplitude transition
      // We can use time-based interpolation, but for simplicity, we'll just draw what's asked
      // In a real implementation we'd lerp it.
      
      // We will define a global amplitude that lerps towards targetAmpMultiplier
      (canvas as any).currentAmp = (canvas as any).currentAmp || 0;
      (canvas as any).currentAlpha = (canvas as any).currentAlpha || 0;
      
      (canvas as any).currentAmp += (targetAmpMultiplier - (canvas as any).currentAmp) * 0.1;
      (canvas as any).currentAlpha += (alpha - (canvas as any).currentAlpha) * 0.05;

      const amp = baseAmplitude * (canvas as any).currentAmp;
      const currentAlpha = (canvas as any).currentAlpha;

      if (currentAlpha > 0.01) {
        ctx.globalCompositeOperation = "screen";
        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath();
          // Strands spread out their phase and frequency
          const phaseOffset = w * 0.5;
          const freqMultiplier = 1 + (w * 0.1);
          
          for (let x = 0; x <= width; x += 5) {
            // Normalize x to 0..1
            const nx = x / width;
            // Bell curve window so edges are flat
            const windowEnv = Math.sin(nx * Math.PI);
            
            // Multiple sine waves combined
            const y1 = Math.sin(nx * 10 * freqMultiplier + time * 2 + phaseOffset);
            const y2 = Math.sin(nx * 25 + time * 3) * 0.5;
            const y3 = Math.cos(nx * 15 - time + phaseOffset * 2) * 0.3;
            
            const totalY = (y1 + y2 + y3) * windowEnv * amp;
            
            const y = centerY + totalY;
            
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            // Spawn particles
            if (drawParticles && Math.random() < 0.02 && windowEnv > 0.3 && !pullToCenter) {
               particles.push({
                 x, 
                 y, 
                 vx: (Math.random() - 0.5) * 2, 
                 vy: (Math.random() - 0.5) * 2,
                 life: 1.0,
                 size: Math.random() * 1.5 + 0.5
               });
            }
          }
          
          ctx.strokeStyle = 
`rgba(245, 245, 247, ${alpha})`
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Draw Particles
      if (drawParticles || particles.length > 0) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          
          if (pullToCenter) {
             // pull towards center (width/2, height/2)
             const dx = (width/2) - p.x;
             const dy = (height/2) - p.y;
             p.vx += dx * 0.01;
             p.vy += dy * 0.01;
             p.life -= 0.02; // die faster
          } else {
             p.life -= 0.005;
          }
          
          p.x += p.vx;
          p.y += p.vy;
          
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = 
`rgba(245, 245, 247, ${alpha})`
          ctx.fill();
        }
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  if (state === "EXIT") return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out"
      style={{ 
        backgroundColor: "#05060D", 
        opacity: state === "READY" ? 0 : 1,
        pointerEvents: state === "READY" ? "none" : "auto" 
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none"
      />

      {/* Logo Container */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <h1 
          className="text-6xl md:text-8xl font-black tracking-tighter"
          style={{ 
            color: "#F5F5F7",
            opacity: ["LOGO_ZK", "LOGO_FULL", "HOLD", "LOADING", "READY"].includes(state) ? 1 : 0,
            transform: ["LOGO_ZK", "LOGO_FULL", "HOLD", "LOADING", "READY"].includes(state) ? "scale(1)" : "scale(0.9)",
            transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          ZK
        </h1>
        <h2 
          className="text-sm md:text-lg font-medium tracking-[0.3em] mt-2"
          style={{
            color: "#B8B8C2",
            opacity: ["LOGO_FULL", "HOLD", "LOADING", "READY"].includes(state) ? 1 : 0,
            transform: ["LOGO_FULL", "HOLD", "LOADING", "READY"].includes(state) ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          VOICE STUDIO
        </h2>
      </div>

      {/* Loading Indicator */}
      <div 
        className="absolute bottom-24 flex flex-col items-center gap-3"
        style={{
          opacity: ["LOADING", "READY"].includes(state) ? 1 : 0,
          transition: "opacity 0.5s ease"
        }}
      >
        <span className="text-xs text-[#92929F] tracking-wide">Preparing your studio...</span>
        <div className="w-48 h-[2px] bg-[#282833] rounded-full overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 h-full bg-[#8B72FF] rounded-full"
            style={{
              width: "100%",
              transformOrigin: "left",
              animation: "zk-progress 1.5s ease-in-out infinite alternate"
            }}
          />
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes zk-progress {
          0% { transform: scaleX(0.1) translateX(0); }
          100% { transform: scaleX(0.5) translateX(100%); }
        }
      `}} />
    </div>
  );
}
