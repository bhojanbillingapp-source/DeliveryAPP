import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import type { AppStackParamList, MainTabParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'More'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function MoreScreen({ navigation }: Props) {
  const { customer, logout } = useAuth();

  function confirmLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Account</Text>

      {customer ? (
        <TouchableOpacity style={styles.accountRow} onPress={() => navigation.navigate('Profile')} activeOpacity={0.75}>
          <Text style={styles.accountName}>{customer.name || 'Your account'}</Text>
          <Text style={styles.accountMobile}>{customer.mobile}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Login')} activeOpacity={0.75}>
          <Text style={styles.rowText}>Sign in</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => (customer ? navigation.navigate('MainTabs', { screen: 'MyOrders' }) : navigation.navigate('Login'))}
      >
        <Text style={styles.rowText}>Orders</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => (customer ? navigation.navigate('AddressList') : navigation.navigate('Login'))}
      >
        <Text style={styles.rowText}>Address Book</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => navigation.navigate('Notifications')}>
        <Text style={styles.rowText}>Notifications</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {customer && (
        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  accountRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  accountName: { fontSize: 17, fontWeight: '700', color: colors.text },
  accountMobile: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { fontSize: 15, fontWeight: '600', color: colors.text },
  arrow: { fontSize: 20, color: colors.textMuted },
  logoutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.sm, padding: 14, alignItems: 'center' },
  logoutButtonText: { color: colors.danger, fontWeight: '700' },
});
