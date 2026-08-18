import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { requestSignupOtp, verifySignupOtp } from '../api/signupOtp';
import type { AuthStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

type Step = 'details' | 'otp';

// Indian mobile numbers: 10 digits, first digit 6-9 (TRAI numbering plan).
// Country code is fixed to +91 for now — international signup isn't supported yet.
const INDIA_MOBILE_RE = /^[6-9]\d{9}$/;

export default function SignupScreen({ navigation }: Props) {
  const { signup } = useAuth();
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!name.trim() || !mobile.trim() || !password) {
      Alert.alert('Missing details', 'Fill in your name, mobile number and password.');
      return;
    }
    if (!INDIA_MOBILE_RE.test(mobile.trim())) {
      Alert.alert('Invalid mobile number', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestSignupOtp(mobile.trim());
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

  async function handleVerifyAndSignup() {
    if (!otp.trim()) {
      Alert.alert('OTP required', 'Enter the 6-digit code we sent you.');
      return;
    }
    setLoading(true);
    try {
      await verifySignupOtp(mobile.trim(), otp.trim());
      await signup(name.trim(), mobile.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign up failed', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        PoSS<Text style={styles.logoDot}>.</Text>
      </Text>
      <Text style={styles.title}>Create your account</Text>

      {step === 'details' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={mobile}
              onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'otp' && (
        <>
          <Text style={styles.helper}>Enter the OTP sent to +91 {mobile}</Text>
          <TextInput
            style={styles.input}
            placeholder="6-digit OTP"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyAndSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Sign Up</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('details')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => navigation.navigate('Login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.link}>Already have an account? <Text style={styles.linkAccent}>Log in</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  logo: { fontSize: 26, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },
  logoDot: { color: colors.accent },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  helper: { color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  phoneRow: { flexDirection: 'row', gap: spacing.sm },
  countryCode: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  countryCodeText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  phoneInput: { flex: 1 },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: spacing.lg, color: colors.textMuted },
  linkAccent: { color: colors.accent, fontWeight: '700' },
});
