import { Stack } from "expo-router";
import { VoiceCallProvider } from "../VoiceCallProviderOptimized";
import { PresenceProvider } from "../src/providers/PresenceProvider";

export default function Layout() {
  return (
    <PresenceProvider>
      <VoiceCallProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </VoiceCallProvider>
    </PresenceProvider>
  );
}
