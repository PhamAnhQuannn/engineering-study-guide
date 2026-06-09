import { redirect } from "next/navigation";

// Topic hub is superseded by mode tabs — default to the knowledge article.
export default async function TopicPage(props: PageProps<"/topic/[slug]">) {
  const { slug } = await props.params;
  redirect(`/topic/${slug}/study`);
}
