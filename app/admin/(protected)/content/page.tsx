import { ContentManager } from "@/components/admin/ContentManager";
import { getQuickLinks, getSiteSettings } from "@/lib/queries";

export default async function AdminContentPage() {
  const [settings, quickLinks] = await Promise.all([
    getSiteSettings(),
    getQuickLinks(),
  ]);

  return <ContentManager settings={settings} quickLinks={quickLinks} />;
}
