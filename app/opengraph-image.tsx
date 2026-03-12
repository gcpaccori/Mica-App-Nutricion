import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #f4f0e7 0%, #ebe6db 48%, #f8f4ec 100%)",
          color: "#111111",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 15% 18%, rgba(157,108,255,0.18), transparent 24%), radial-gradient(circle at 80% 22%, rgba(76,255,138,0.16), transparent 20%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 56,
            width: 12,
            height: 518,
            background: "#0f5c4d",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "62px 72px 62px 96px",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                textTransform: "uppercase",
                letterSpacing: "0.34em",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  display: "flex",
                  width: 74,
                  height: 74,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#111111",
                  color: "#f8f4ec",
                  border: "1px solid #111111",
                }}
              >
                MN
              </span>
              <span>Mico Nutri Heald</span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxWidth: 780,
              }}
            >
              <div
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.32em",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "rgba(17,17,17,0.56)",
                }}
              >
                Clinical nutrition workflow
              </div>
              <div
                style={{
                  fontSize: 82,
                  lineHeight: 0.94,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.06em",
                }}
              >
                Pacientes, planes e ingestas en una sola vista clinica.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {[
                "Pacientes",
                "Objetivos",
                "Planes",
                "Ingestas",
                "Comparativas",
              ].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(17,17,17,0.14)",
                    background: "rgba(255,255,255,0.58)",
                    padding: "12px 18px",
                    fontSize: 24,
                    fontWeight: 600,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
                textAlign: "right",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "rgba(17,17,17,0.48)",
                  fontWeight: 700,
                }}
              >
                Nutrition OS
              </div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>Mico Nutri Heald</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}