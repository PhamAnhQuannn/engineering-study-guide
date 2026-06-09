import { redirect } from "next/navigation";

// Root redirects to the Knowledge tab (default learn surface).
export default function Home() {
  redirect("/knowledge");
}
