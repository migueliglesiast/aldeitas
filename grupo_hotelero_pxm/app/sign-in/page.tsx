import { redirect } from "next/navigation";
import { signInUrl } from "@/lib/auth-redirect";

type Props = {
  searchParams?: { next?: string };
};

export default function SignInPage({ searchParams }: Props) {
  redirect(signInUrl(searchParams?.next || "/admin"));
}
