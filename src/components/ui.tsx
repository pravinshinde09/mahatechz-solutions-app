import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, font, radius, space } from "@/theme/tokens";

export function Screen({ children, refreshing, onRefresh, scroll = true, padded = true }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; scroll?: boolean; padded?: boolean }) {
  const body = padded ? <View style={styles.padded}>{children}</View> : children;
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right"]}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.cyan} colors={[colors.cyan]} /> : undefined}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** Spec §23.9: offline banner via NetInfo. */
function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Text style={styles.offlineText}>You&apos;re offline — showing what was last loaded.</Text>
    </View>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.title, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.heading, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted, small, style, numberOfLines }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.body, muted && styles.muted, small && styles.small, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, variant = "primary", disabled, busy, style }: { title: string; onPress: () => void; variant?: "primary" | "outline" | "danger" | "ghost"; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [styles.button, styles[variant], off && styles.disabled, pressed && styles.pressed, style]}
    >
      {busy ? <ActivityIndicator color={variant === "primary" ? colors.primaryForeground : colors.foreground} /> : null}
      <Text style={[styles.buttonText, variant === "primary" ? styles.buttonTextPrimary : variant === "danger" ? styles.buttonTextDanger : null]}>{title}</Text>
    </Pressable>
  );
}

export function TextField({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
    </View>
  );
}

export function Badge({ text, tone = "muted" }: { text: string; tone?: "muted" | "success" | "warning" | "danger" | "primary" }) {
  const color = tone === "muted" ? colors.muted : tone === "primary" ? colors.primary : colors[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center} accessibilityLabel="Loading">
      <ActivityIndicator color={colors.cyan} size="large" />
    </View>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Heading style={{ textAlign: "center" }}>{title}</Heading>
      <Body muted style={{ textAlign: "center", marginTop: space.sm }}>
        {description}
      </Body>
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

/** Inline retry for network errors (spec §23.9). */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <Body style={{ textAlign: "center", color: colors.danger }}>{message}</Body>
      <Button title="Try again" variant="outline" onPress={onRetry} style={{ marginTop: space.lg }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: space.xxl },
  padded: { padding: space.lg, gap: space.lg },
  title: { color: colors.foreground, fontSize: font.title, fontWeight: "700", lineHeight: 28 },
  heading: { color: colors.foreground, fontSize: font.heading, fontWeight: "600", lineHeight: 24 },
  body: { color: colors.foreground, fontSize: font.body, lineHeight: 22 },
  muted: { color: colors.muted },
  small: { fontSize: font.small, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  pressed: { opacity: 0.8 },
  button: { minHeight: 48, borderRadius: radius.sm, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  primary: { backgroundColor: colors.primary },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  danger: { borderWidth: 1, borderColor: colors.danger },
  ghost: {},
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.foreground, fontSize: font.body, fontWeight: "600" },
  buttonTextPrimary: { color: colors.primaryForeground },
  buttonTextDanger: { color: colors.danger },
  field: { gap: space.xs },
  label: { color: colors.foreground, fontSize: font.small, fontWeight: "500" },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderInput, borderRadius: radius.sm, paddingHorizontal: space.md, color: colors.foreground, backgroundColor: colors.surface, fontSize: font.body },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: font.tiny },
  hint: { color: colors.muted, fontSize: font.tiny },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.cyan },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  badgeText: { fontSize: font.tiny, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, backgroundColor: colors.background },
  empty: { alignItems: "center", padding: space.xl },
  offline: { backgroundColor: colors.warning, paddingVertical: space.xs, paddingHorizontal: space.lg },
  offlineText: { color: colors.primaryForeground, fontSize: font.tiny, fontWeight: "600", textAlign: "center" },
});
