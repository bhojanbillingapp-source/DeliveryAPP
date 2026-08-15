import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { updateName, requestMobileChangeOtp, confirmMobileChange } from '../api/profile';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { customer, updateCustomer, logout } = useAuth();
  const [name, setName] = useState(customer?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [changingMobile, setChangingMobile] = useState(false);
  const [newMobile, setNewMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mobileBusy, setMobileBusy] = useState(false);

  async function handleSaveName() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your name.');
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateName(name.trim());
      await updateCustomer(updated);
      Alert.alert('Saved', 'Your name has been updated.');
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleSendMobileOtp() {
    if (!newMobile.trim()) {
      Alert.alert('Mobile number required', 'Enter your new mobile number.');
      return;
    }
    setMobileBusy(true);
    try {
      const result = await requestMobileChangeOtp(newMobile.trim());
      if (result.dev_otp) Alert.alert('Dev OTP', `OTP: ${result.dev_otp}`);
      setOtpSent(true);
    } catch (err: any) {
      Alert.alert('Could not send OTP', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setMobileBusy(false);
    }
  }

  async function handleConfirmMobile() {
    if (!otp.trim()) {
      Alert.alert('OTP required', 'Enter the OTP sent to your new number.');
      return;
    }
    setMobileBusy(true);
    try {
      const updated = await confirmMobileChange(newMobile.trim(), otp.trim());
      await updateCustomer(updated);
      setChangingMobile(false);
      setOtpSent(false);
      setNewMobile('');
      setOtp('');
      Alert.alert('Mobile number updated');
    } catch (err: any) {
      Alert.alert('Could not confirm', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setMobileBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />

      <View style={{ padding: spacing.md }}>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={[styles.button, savingName && styles.buttonDisabled]} onPress={handleSaveName} disabled={savingName} activeOpacity={0.85}>
            {savingName ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Name</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Mobile number</Text>
          <Text style={styles.currentMobile}>{customer?.mobile}</Text>
          {!changingMobile ? (
            <TouchableOpacity onPress={() => setChangingMobile(true)}>
              <Text style={styles.linkAccent}>Change mobile number</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="New mobile number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={newMobile}
                onChangeText={setNewMobile}
                editable={!otpSent}
              />
              {otpSent && (
                <TextInput
                  style={styles.input}
                  placeholder="OTP"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                />
              )}
              <TouchableOpacity
                style={[styles.button, mobileBusy && styles.buttonDisabled]}
                onPress={otpSent ? handleConfirmMobile : handleSendMobileOtp}
                disabled={mobileBusy}
                activeOpacity={0.85}
              >
                {mobileBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{otpSent ? 'Confirm OTP' : 'Send OTP'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setChangingMobile(false);
                  setOtpSent(false);
                  setNewMobile('');
                  setOtp('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  currentMobile: { fontSize: 16, color: colors.text, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  button: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  linkAccent: { color: colors.primary, fontWeight: '700' },
  cancelText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  logoutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.sm, padding: 14, alignItems: 'center' },
  logoutButtonText: { color: colors.danger, fontWeight: '700' },
});
