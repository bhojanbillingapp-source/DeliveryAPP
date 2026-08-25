import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { OutletProvider } from '../context/OutletContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import MoreScreen from '../screens/MoreScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CategoryItemsScreen from '../screens/CategoryItemsScreen';
import CartScreen from '../screens/CartScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressFormScreen from '../screens/AddressFormScreen';
import MapPickerScreen from '../screens/MapPickerScreen';
import TrackOrderScreen from '../screens/TrackOrderScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SelectOutletScreen from '../screens/SelectOutletScreen';
import CartBar from '../components/CartBar';
import { navigationRef } from './navigationRef';
import type { AppStackParamList, MainTabParamList } from './types';
import { colors } from '../theme';

const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: '⌂',
  MyOrders: '▤',
  More: '⋯',
};

function TabIcon({ route, color, size }: { route: keyof MainTabParamList; color: string; size: number }) {
  return <Text style={{ color, fontSize: size, fontWeight: '600' }}>{TAB_ICONS[route]}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <TabIcon route="Home" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="MyOrders"
        component={OrdersScreen}
        options={{
          title: 'My Orders',
          tabBarIcon: ({ color, size }) => <TabIcon route="MyOrders" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarIcon: ({ color, size }) => <TabIcon route="More" color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <OutletProvider>
      <OrderTypeProvider>
        <CartProvider>
          <NavigationContainer ref={navigationRef}>
            <AppStack.Navigator screenOptions={{ headerShown: false }}>
              <AppStack.Screen name="MainTabs" component={MainTabs} />
              <AppStack.Screen name="Categories" component={CategoriesScreen} />
              <AppStack.Screen name="CategoryItems" component={CategoryItemsScreen} />
              <AppStack.Screen name="Cart" component={CartScreen} />
              <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} />
              <AppStack.Screen name="AddressList" component={AddressListScreen} />
              <AppStack.Screen name="AddressForm" component={AddressFormScreen} />
              <AppStack.Screen name="MapPicker" component={MapPickerScreen} />
              <AppStack.Screen name="TrackOrder" component={TrackOrderScreen} />
              <AppStack.Screen name="Profile" component={ProfileScreen} />
              <AppStack.Screen name="Notifications" component={NotificationsScreen} />
              <AppStack.Screen name="SelectOutlet" component={SelectOutletScreen} />
              <AppStack.Screen name="Login" component={LoginScreen} />
              <AppStack.Screen name="Signup" component={SignupScreen} />
              <AppStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            </AppStack.Navigator>
            <CartBar />
          </NavigationContainer>
        </CartProvider>
      </OrderTypeProvider>
    </OutletProvider>
  );
}
