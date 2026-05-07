import { redirect } from "next/navigation";

export default function Profile() {
  redirect("/portal/account/me");
}
