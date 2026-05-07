export const runtime = "nodejs";

import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { getAccount, getMemberByEmail } from "@heiso-io/bee/server/user.service";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const email = session.user.email ?? "";

    if (session.user.kind === "dev") {
      return NextResponse.json({
        id: userId,
        name: session.user.name,
        email: email,
        avatar: session.user.image,
        active: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        kind: "dev",
        membership: {
          id: 'admin',
          role: 'owner',
          customRole: {
            id: 'admin',
            name: 'Admin',
          }
        }
      });
    }

    let data = userId ? await getAccount(userId) : null;

    if (!data && email) {
      data = await getMemberByEmail(email);
    }

    return NextResponse.json(data ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}
