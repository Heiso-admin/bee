import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { redirect } from "next/navigation";
import { cachedGetMemberByEmail } from "@heiso-io/bee/lib/cache/member";
import AuthenticationForm from "./authentication-form";

export default async function AuthenticationPage() {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/auth/login");
    }

    const user = await cachedGetMemberByEmail(session.user.email);

    const loginMethod = user?.loginMethod || "email";

    return <AuthenticationForm loginMethod={loginMethod} />;
}
