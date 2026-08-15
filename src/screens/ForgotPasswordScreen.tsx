import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { sendResetOtp, verifyResetOtp, resetPassword } from '../api/passwordReset';
import type { AuthStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

type Step = 'mobile' | 'otp' | 'password';

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!mobile.trim()) {
      Alert.alert('Mobile number required', 'Enter the mobile number on your account.');
      return;
    }
    setLoading(true);
    try {
      const result = await sendResetOtp(mobile.trim());
      if (result.dev_otp) {
        Alert.alert('Dev OTP', `OTP: ${result.dev_otp}`);
      }
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Could not send OTP', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) {
      Alert.alert('OTP required', 'Enter the 6-digit code we sent you.');
      return;
    }
    setLoading(true);
    try {
      await verifyResetOtp(mobile.trim(), otp.trim());
      setStep('password');
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(mobile.trim(), otp.trim(), newPassword);
      Alert.alert('Password reset', 'You can now log in with your new password.', [
        { text: 'Log in', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Could not reset password', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset your password</Text>

      {step === 'mobile' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={setMobile}
            autoCapitalize="none"
          />
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSendOtp} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'otp' && (
        <>
          <Text style={styles.helper}>Enter the OTP sent to {mobile}</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit OTP"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
          />
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleVerifyOtp} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'password' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleResetPassword} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => navigation.replace('Login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.link}>Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  helper: { color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  button: { backgroundColor: colors.primary, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginTop: spacing.xs },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: spacing.lg, color: colors.textMuted },
});
