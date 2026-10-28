import { useState } from "react";
import { Platform, Share, View } from "react-native";
import { ApiError } from "@/api/client";
import { useCertificates } from "@/api/queries";
import { Badge, Body, Button, Card, EmptyState, ErrorState, Heading, Loading, Screen } from "@/components/ui";
import type { MyCertificate } from "@/contracts/certification";
import { shareCertificatePdf } from "@/features/certificates";
import { formatDate } from "@/lib/format";
import { colors, space } from "@/theme/tokens";

const statusBadge = { ISSUED: { text: "Valid", tone: "success" }, REVOKED: { text: "Revoked", tone: "danger" }, SUPERSEDED: { text: "Replaced", tone: "warning" } } as const;

/** Spec §22.4 "Certificates": list, download/share PDF, verification link. */
export default function CertificatesScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useCertificates();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState message={error?.message ?? "Couldn't load your certificates."} onRetry={refetch} />;
  const current = data.filter((c) => c.status !== "SUPERSEDED");

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      {!current.length ? (
        <EmptyState title="No certificates yet" description="Complete a course to earn a certificate. The Progress tab of each course shows what's left." />
      ) : (
        current.map((c) => <CertificateCard key={c.id} c={c} />)
      )}
    </Screen>
  );
}

function CertificateCard({ c }: { c: MyCertificate }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const badge = statusBadge[c.status];

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await shareCertificatePdf(c);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Couldn't download the PDF. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const shareLink = async () => {
    const text = `My certificate for ${c.courseTitle}: ${c.verificationUrl}`;
    if (Platform.OS === "web") {
      await navigator.clipboard?.writeText(c.verificationUrl);
      setMessage("Verification link copied.");
      return;
    }
    await Share.share({ message: text, url: c.verificationUrl });
  };

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Heading>{c.courseTitle}</Heading>
          <Body muted small>
            {c.recipientName} · issued {formatDate(c.issuedAt)}
          </Body>
          <Body muted small style={{ fontFamily: "monospace" }}>
            {c.certificateNumber}
          </Body>
        </View>
        <Badge text={badge.text} tone={badge.tone} />
      </View>
      {c.status === "REVOKED" ? (
        <Body small muted>
          This certificate is no longer valid. Contact support on the website if you think this is a mistake.
        </Body>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title={busy ? "Preparing PDF…" : "Download / share PDF"} onPress={download} busy={busy} />
          <Button title="Share verification link" variant="outline" onPress={() => void shareLink()} />
        </View>
      )}
      {message ? (
        <Body small style={{ color: message.startsWith("Verification") ? colors.success : colors.danger }}>
          {message}
        </Body>
      ) : null}
    </Card>
  );
}
