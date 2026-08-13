import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MenuScreen from '../screens/MenuScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import type { AppStackParamList, AuthStackParamList } from './types';
import { colors } from '../theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

export default function RootNavigator() {
  const { customer, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {customer ? (
        <CartProvider>
          <AppStack.Navigator screenOptions={{ headerShown: false }}>
            <AppStack.Screen name="Menu" component={MenuScreen} />
            <AppStack.Screen name="Cart" component={CartScreen} />
            <AppStack.Screen name="Orders" component={OrdersScreen} />
            <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} />
          </AppStack.Navigator>
        </CartProvider>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
