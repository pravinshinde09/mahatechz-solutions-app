import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
import { api } from "@/api/client";
import type { MyCertificate } from "@/contracts/certification";

/** Downloads the PDF from its short-lived signed URL into the cache and opens the share sheet (spec §22.4). */
export async function shareCertificatePdf(c: MyCertificate): Promise<void> {
  const { url } = await api<{ url: string }>(`/me/certificates/${c.id}/pdf?format=json`);
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  const dir = new Directory(Paths.cache, "certificates");
  if (!dir.exists) dir.create();
  const target = new File(dir, `certificate-${c.certificateNumber}.pdf`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: c.courseTitle, UTI: "com.adobe.pdf" });
}
