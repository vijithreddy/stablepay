import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from 'expo-blur';
import { Paper } from "../../constants/PaperTheme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Paper.colors.background }} edges={['top']}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Paper.colors.orange,
          tabBarInactiveTintColor: Paper.colors.sandLight,
          tabBarBackground: () => (
            <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
          ),
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0.5,
            borderTopColor: 'rgba(226, 221, 212, 0.6)',
            elevation: 0,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
          },
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginTop: 3,
          },
        }}
      >
        <Tabs.Screen name="index" options={{
          title: 'Pay',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: focused ? Paper.colors.orange : 'transparent', marginBottom: 2 }} />
          ),
        }} />
        <Tabs.Screen name="history" options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: focused ? Paper.colors.orange : 'transparent', marginBottom: 2 }} />
          ),
        }} />
        <Tabs.Screen name="profile" options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: focused ? Paper.colors.orange : 'transparent', marginBottom: 2 }} />
          ),
        }} />
      </Tabs>
    </SafeAreaView>
  );
}
