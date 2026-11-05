/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function GET(request: Request) {
  const size =
    new URL(request.url).searchParams.get("size") === "192" ? 192 : 512;
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#171319",
      }}
    >
      <img
        src={`data:image/png;base64,${logo.toString("base64")}`}
        width={size * 0.7}
        height={size * 0.7}
        alt=""
        style={{ objectFit: "contain" }}
      />
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=604800" },
    },
  );
}
