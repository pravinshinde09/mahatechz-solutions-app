import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { api } from "@/api/client";
import type { LearnResource } from "@/api/queries";

/**
 * Spec §23.7: files are downloaded to the app cache from the short-lived signed URL and opened
 * with the system viewer via the share sheet. Links open in the browser.
 */
export async function openResource(r: LearnResource): Promise<void> {
  const { url } = await api<{ url: string }>(`/resources/${r.resourceId}/download?format=json`);
  if (r.type === "LINK") {
    await WebBrowser.openBrowserAsync(url);
    return;
  }
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  const dir = new Directory(Paths.cache, "resources");
  if (!dir.exists) dir.create();
  const target = new File(dir, `${r.resourceId}-${(r.filename ?? r.title).replace(/[^\w.-]+/g, "_")}`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: r.mimeType ?? undefined, dialogTitle: r.title });
}
