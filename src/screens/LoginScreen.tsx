import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { AuthStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
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
      await login(mobile.trim(), password);
    } catch (err: any) {
      Alert.alert('Login failed', err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        PoSS<Text style={styles.logoDot}>.</Text>
      </Text>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Mobile number"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        value={mobile}
        onChangeText={setMobile}
        autoCapitalize="none"
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  logo: { fontSize: 26, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },
  logoDot: { color: colors.accent },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
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
