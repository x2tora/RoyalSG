/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = params.get("size") === "192" ? 192 : 512;
  const maskable = params.get("purpose") === "maskable";
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: maskable ? size : size * 0.88,
          height: maskable ? size : size * 0.88,
          borderRadius: maskable ? 0 : size * 0.2,
          background: "#171319",
        }}
      >
        <img
          src={`data:image/png;base64,${logo.toString("base64")}`}
          width={size * (maskable ? 0.56 : 0.64)}
          height={size * (maskable ? 0.56 : 0.64)}
          alt=""
          style={{ objectFit: "contain" }}
        />
      </div>
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=604800" },
    },
  );
}
