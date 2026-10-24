import App from "@/components/App";
import { loadTemplates } from "@/lib/templates-server";

export default async function Home() {
  return <App templates={await loadTemplates()} />;
}
