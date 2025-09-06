import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: Request) {
  const secret = process.env.CENTRIFUGO_JWT_SECRET!;
  
  // 👤 Em vez de "user123", você deve pegar o ID real do usuário (ex: via NextAuth)
  const userId = "user123";

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1h

  const token = jwt.sign(
    { sub: userId, exp },
    secret,
    { algorithm: "HS256" }
  );

  return NextResponse.json({ token });
}