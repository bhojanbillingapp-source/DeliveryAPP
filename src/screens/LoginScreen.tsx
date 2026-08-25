import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import CountryCodePicker from '../components/CountryCodePicker';
import type { CountryCode } from '../data/countryCodes';
import { COUNTRY_CODES } from '../data/countryCodes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [country, setCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!mobile.trim() || !password) {
      Alert.alert('Missing details', 'Enter your mobile number and password.');
      return;
    }
    setLoading(true);
    try {
      await login(`${country.dial_code}${mobile.trim()}`, password);
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err: any) {
      const message = err?.response?.data?.message
        || (err?.code === 'ECONNABORTED'
          ? 'Could not reach the server. Check your connection and try again.'
          : err?.message === 'Network Error'
          ? 'Could not reach the server. Check your connection and try again.'
          : 'Something went wrong.');
      Alert.alert('Login failed', message);
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
        <Text style={styles.title}>Welcome back</Text>
        <View style={styles.phoneRow}>
          <TouchableOpacity style={styles.countryCode} onPress={() => setPickerVisible(true)} activeOpacity={0.75}>
            <Text style={styles.countryCodeText}>{country.flag} {country.dial_code}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="Mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={t => setMobile(t.replace(/\D/g, ''))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.link}>New here? <Text style={styles.linkAccent}>Create an account</Text></Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.link}>Forgot password?</Text>
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
