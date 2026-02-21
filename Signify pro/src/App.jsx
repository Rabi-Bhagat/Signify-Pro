import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

const PRESET_COLORS = ["#000000", "#0000FF", "#FF0000", "#228B22", "#FFA500"];
const BRUSH_STYLES = [
  { id: "solid", label: "Solid", icon: "⎯" },
  { id: "dashed", label: "Dashed", icon: "╌" },
  { id: "dotted", label: "Dotted", icon: "•" },
  { id: "scatter", label: "Scatter", icon: "✨" },
];

function App() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(5);
  const [brushStyle, setBrushStyle] = useState("solid");
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [toasts, setToasts] = useState([]);

  const ctxRef = useRef(null);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory((prev) => [...prev, canvas.toDataURL()]);
      setRedoStack([]);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;

      // Initial state is transparent
      setHistory([canvas.toDataURL()]);
    }
  }, []);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = fontSize;

      // Eraser logic using composite operations
      if (isEraser) {
        ctxRef.current.globalCompositeOperation = "destination-out";
      } else {
        ctxRef.current.globalCompositeOperation = "source-over";
      }

      // Handle Dash styles
      if (brushStyle === "dashed" && !isEraser) {
        ctxRef.current.setLineDash([fontSize * 3, fontSize * 2]);
      } else if (brushStyle === "dotted" && !isEraser) {
        ctxRef.current.setLineDash([1, fontSize * 2]);
      } else {
        ctxRef.current.setLineDash([]);
      }
    }
  }, [color, fontSize, isEraser, brushStyle]);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = getCoordinates(e);
    if (brushStyle === "scatter" && !isEraser) {
      setIsDrawing(true);
      drawScatter(offsetX, offsetY);
    } else {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(offsetX, offsetY);
      setIsDrawing(true);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = getCoordinates(e);

    if (brushStyle === "scatter" && !isEraser) {
      drawScatter(offsetX, offsetY);
    } else {
      ctxRef.current.lineTo(offsetX, offsetY);
      ctxRef.current.stroke();
    }
  };

  const drawScatter = (x, y) => {
    const ctx = ctxRef.current;
    const density = 15;
    ctx.fillStyle = color;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * fontSize * 2;
      const xOffset = Math.cos(angle) * radius;
      const yOffset = Math.sin(angle) * radius;
      ctx.fillRect(x + xOffset, y + yOffset, 1, 1);
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      if (!isEraser && brushStyle !== "scatter") {
        ctxRef.current.closePath();
      }
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.nativeEvent instanceof MouseEvent) {
      return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
    } else {
      const touch = e.nativeEvent.touches[0] || e.nativeEvent.changedTouches[0];
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top,
      };
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    const current = newHistory.pop();
    setRedoStack((prev) => [...prev, current]);
    setHistory(newHistory);

    const prevImg = new Image();
    prevImg.src = newHistory[newHistory.length - 1];
    prevImg.onload = () => {
      ctxRef.current.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );
      ctxRef.current.drawImage(prevImg, 0, 0);
    };
    addToast("Undo successful", "info");
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const newRedo = [...redoStack];
    const next = newRedo.pop();
    setHistory((prev) => [...prev, next]);
    setRedoStack(newRedo);

    const nextImg = new Image();
    nextImg.src = next;
    nextImg.onload = () => {
      ctxRef.current.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );
      ctxRef.current.drawImage(nextImg, 0, 0);
    };
    addToast("Redo successful", "info");
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
    addToast("Canvas cleared", "warning");
  };

  const handleBgChange = (e) => {
    setBgColor(e.target.value);
    addToast("Pad color updated", "info");
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;

    // Create a composite canvas for download
    const compCanvas = document.createElement("canvas");
    compCanvas.width = canvas.width;
    compCanvas.height = canvas.height;
    const compCtx = compCanvas.getContext("2d");

    // Fill background
    compCtx.fillStyle = bgColor;
    compCtx.fillRect(0, 0, compCanvas.width, compCanvas.height);

    // Layer transparent signature
    compCtx.drawImage(canvas, 0, 0);

    const dataUrl = compCanvas.toDataURL("image/png");
    localStorage.setItem("savedSignature", dataUrl);

    const link = document.createElement("a");
    link.download = "signature.png";
    link.href = dataUrl;
    link.click();
    addToast("Signature downloaded!", "success");
  };

  const retrieveSignature = () => {
    const saved = localStorage.getItem("savedSignature");
    if (saved) {
      const img = new Image();
      img.src = saved;
      img.onload = () => {
        // Since original saved signatures might have baked background,
        // we'll draw it on the transparent canvas.
        ctxRef.current.drawImage(img, 0, 0);
        saveToHistory();
        addToast("Signature recovered", "info");
      };
    } else {
      addToast("No saved signature found", "warning");
    }
  };

  return (
    <div className="signature-container">
      <header className="header">
        <div className="logo-container">
          <svg
            className="app-logo"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="logo-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="var(--accent-primary)" />
                <stop offset="100%" stopColor="var(--accent-secondary)" />
              </linearGradient>
            </defs>
            <path
              d="M20 50 Q30 20 50 20 Q70 20 80 50 Q70 80 50 80 Q30 80 20 50 Z"
              fill="none"
              stroke="url(#logo-grad)"
              strokeWidth="6"
            />
            <path
              d="M35 50 L45 60 L65 40"
              fill="none"
              stroke="url(#logo-grad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
          <h1>Signify Pro</h1>
        </div>
        <p className="tagline">"Your Identity, Digitally Handcrafted."</p>
        <div className="badge-container">
          <span className="badge responsive-badge">
            <span className="pulse-dot"></span>
            Fully Responsive & Secure
          </span>
        </div>
      </header>

      <div className="main-layout">
        <aside className="toolbar">
          <div className="control-group">
            <label>Studio Mode</label>
            <div className="tool-buttons">
              <button
                className={`btn btn-secondary btn-tool ${!isEraser ? "active" : ""}`}
                onClick={() => setIsEraser(false)}
              >
                Pen
              </button>
              <button
                className={`btn btn-secondary btn-tool ${isEraser ? "active" : ""}`}
                onClick={() => setIsEraser(true)}
              >
                Eraser
              </button>
            </div>
          </div>

          {!isEraser && (
            <div className="control-group">
              <label>Creative Styles</label>
              <div className="tool-buttons style-grid">
                {BRUSH_STYLES.map((style) => (
                  <button
                    key={style.id}
                    className={`btn btn-secondary btn-tool style-btn ${brushStyle === style.id ? "active" : ""}`}
                    onClick={() => setBrushStyle(style.id)}
                    title={style.label}
                  >
                    <span className="style-icon">{style.icon}</span>
                    <span className="style-label">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isEraser && (
            <div className="control-group">
              <label>Professional Colors</label>
              <div className="color-presets">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`preset-btn ${color === c ? "active" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  title="Custom Color"
                />
              </div>
            </div>
          )}

          <div className="control-group">
            <label>Ink Size: {fontSize}px</label>
            <input
              type="range"
              min="1"
              max="50"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label>Pad Background</label>
            <input type="color" value={bgColor} onChange={handleBgChange} />
          </div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="tool-buttons">
              <button
                className="btn btn-secondary btn-tool"
                onClick={undo}
                disabled={history.length <= 1}
              >
                Undo
              </button>
              <button
                className="btn btn-secondary btn-tool"
                onClick={redo}
                disabled={redoStack.length === 0}
              >
                Redo
              </button>
            </div>
            <div
              className="live-preview"
              style={{ color: isEraser ? "var(--text-muted)" : color }}
            >
              Preview:{" "}
              <span
                style={{
                  fontSize: `${fontSize / 2 + 10}px`,
                  borderBottom:
                    brushStyle === "dashed"
                      ? `2px dashed ${color}`
                      : brushStyle === "dotted"
                        ? `2px dotted ${color}`
                        : `2px solid ${color}`,
                }}
              >
                {isEraser ? "Erasing..." : "Signature"}
              </span>
            </div>
          </div>

          <div className="canvas-wrapper" style={{ backgroundColor: bgColor }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <div className="action-bar">
            <button className="btn btn-danger" onClick={clearCanvas}>
              Reset
            </button>
            <button className="btn btn-secondary" onClick={retrieveSignature}>
              Recover
            </button>
            <div />
            <button className="btn btn-primary" onClick={saveSignature}>
              Download PNG
            </button>
          </div>
        </section>
      </div>

      <footer className="app-footer">
        Developed by{" "}
        <a
          href="http://rabibhagat.com.np"
          target="_blank"
          rel="noopener noreferrer"
        >
          Rabi Bhagat
        </a>
      </footer>

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
