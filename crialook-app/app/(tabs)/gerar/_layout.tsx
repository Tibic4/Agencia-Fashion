import { Stack } from 'expo-router';

export default function GerarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="resultado" />
    </Stack>
  );
}
