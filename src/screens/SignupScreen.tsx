import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { requestSignupOtp, verifySignupOtp } from '../api/signupOtp';
import CountryCodePicker from '../components/CountryCodePicker';
import type { CountryCode } from '../data/countryCodes';
import { COUNTRY_CODES } from '../data/countryCodes';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Signup'>;

type Step = 'details' | 'otp';

// Mobile numbers are entered per selected country code — accept any
// reasonable national number length rather than assuming India's 10 digits.
const MOBILE_RE = /^\d{4,14}$/;

export default function SignupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const [step, setStep] = useState<Step>('details');
  const [country, setCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const fullMobile = `${country.dial_code}${mobile.trim()}`;

  async function handleSendOtp() {
    if (!name.trim() || !mobile.trim() || !password) {
      Alert.alert('Missing details', 'Fill in your name, mobile number and password.');
      return;
    }
    if (!MOBILE_RE.test(mobile.trim())) {
      Alert.alert('Invalid mobile number', 'Enter a valid mobile number.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestSignupOtp(fullMobile);
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
      await verifySignupOtp(fullMobile, otp.trim());
      await signup(name.trim(), fullMobile, password);
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err: any) {
      Alert.alert('Sign up failed', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + spacing.sm }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      )}
      <View style={styles.body}>
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
              <TouchableOpacity style={styles.countryCode} onPress={() => setPickerVisible(true)} activeOpacity={0.75}>
                <Text style={styles.countryCodeText}>{country.flag} {country.dial_code}</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="Mobile number"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={mobile}
                onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 14))}
                maxLength={14}
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
            <Text style={styles.helper}>Enter the OTP sent to {country.dial_code} {mobile}</Text>
            <Text style={styles.mobileLockedHint}>Your mobile number can't be changed after this step.</Text>
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

      <CountryCodePicker visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={setCountry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  backIcon: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  helper: { color: colors.textMuted, marginBottom: spacing.xs, textAlign: 'center' },
  mobileLockedHint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md, textAlign: 'center' },
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
