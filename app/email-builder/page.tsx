import { redirect } from "next/navigation";

export default function EmailBuilderRedirect() {
  redirect("/templates/welcome-email");
}
