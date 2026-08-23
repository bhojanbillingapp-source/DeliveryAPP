import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { OutletProvider } from '../context/OutletContext';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import MenuScreen from '../screens/MenuScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import AddressListScreen from '../screens/AddressListScreen';
import AddressFormScreen from '../screens/AddressFormScreen';
import MapPickerScreen from '../screens/MapPickerScreen';
import TrackOrderScreen from '../screens/TrackOrderScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { AppStackParamList, AuthStackParamList } from './types';
import { colors } from '../theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export default function RootNavigator() {
  const { customer, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <OutletProvider>
      <NavigationContainer>
        {customer ? (
          <CartProvider>
            <AppStack.Navigator screenOptions={{ headerShown: false }}>
              <AppStack.Screen name="Menu" component={MenuScreen} />
              <AppStack.Screen name="Cart" component={CartScreen} />
              <AppStack.Screen name="Orders" component={OrdersScreen} />
              <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} />
              <AppStack.Screen name="AddressList" component={AddressListScreen} />
              <AppStack.Screen name="AddressForm" component={AddressFormScreen} />
              <AppStack.Screen name="MapPicker" component={MapPickerScreen} />
              <AppStack.Screen name="TrackOrder" component={TrackOrderScreen} />
              <AppStack.Screen name="Profile" component={ProfileScreen} />
            </AppStack.Navigator>
          </CartProvider>
        ) : (
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Signup" component={SignupScreen} />
            <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
    </OutletProvider>
  );
}
